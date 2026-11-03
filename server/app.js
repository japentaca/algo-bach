const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;
const generator = require('../src/main');

app.use(express.json());

// ---- Optional velocity-layered samples (VSCO 2 CE, indexed by carrilion) ----
// The samples are not part of this repo: they are served from carrilion's
// soundfont folder (or SOUNDFONTS_DIR). carrilion's indexer already wrote
// metadata.json with key ranges, per-sample gain and velocity layers.
const SOUNDFONTS_DIR = process.env.SOUNDFONTS_DIR
  || path.join(__dirname, '../../../carrilion/assets/soundfonts');
const VSCO_NAME = 'VSCO-2-CE-1.1.0';
const VSCO_METADATA = path.join(SOUNDFONTS_DIR, VSCO_NAME, 'metadata.json');
let vscoCatalog;  // undefined = not read yet, null = unavailable

function getVscoCatalog() {
  if (vscoCatalog !== undefined) return vscoCatalog;
  try {
    const meta = JSON.parse(fs.readFileSync(VSCO_METADATA, 'utf8'));
    vscoCatalog = meta.catalog[VSCO_NAME] || null;
  } catch (error) {
    console.log(`VSCO samples not available (${VSCO_METADATA}): ${error.message}`);
    vscoCatalog = null;
  }
  return vscoCatalog;
}

app.use('/soundfonts', express.static(SOUNDFONTS_DIR, { maxAge: '7d', fallthrough: false }));

app.get('/api/vsco/status', (req, res) => {
  res.json({ available: !!getVscoCatalog() });
});

// Round robins: the catalog points to ONE file per note and layer, but VSCO often
// recorded each note twice or more ("_rr1"/"_rr2", "_RR1"/"_RR2", "_1"/"_2"). The
// other takes that really exist on disk are listed as `alts`, so the player can
// alternate them on repeated notes.
const RR_SUFFIX = /(_rr|_RR|_)(\d)(\.\w+)$/;
const RR_MAX = 4;
const altsCache = new Map();  // sample path -> [other takes]

function roundRobinAlts(samplePath) {
  if (altsCache.has(samplePath)) return altsCache.get(samplePath);
  const alts = [];
  if (RR_SUFFIX.test(samplePath)) {
    for (let d = 1; d <= RR_MAX; d++) {
      const alt = samplePath.replace(RR_SUFFIX, (m, pre, n, ext) => `${pre}${d}${ext}`);
      if (alt !== samplePath && fs.existsSync(path.join(SOUNDFONTS_DIR, VSCO_NAME, alt))) alts.push(alt);
    }
  }
  altsCache.set(samplePath, alts);
  return alts;
}

/** Copy of a catalog sample entry with its round-robin `alts` (when there are any). */
function withAlts(sample) {
  if (!sample || !sample.path) return sample;
  const alts = roundRobinAlts(sample.path);
  return alts.length ? { ...sample, alts } : sample;
}

// Sample map + velocity layers of one articulation: ?instrument=&articulation=
app.get('/api/vsco/articulation', (req, res) => {
  const catalog = getVscoCatalog();
  if (!catalog) return res.status(404).json({ error: 'vsco_unavailable' });
  const { instrument, articulation } = req.query;
  const inst = typeof instrument === 'string' && Object.prototype.hasOwnProperty.call(catalog.instruments, instrument)
    ? catalog.instruments[instrument] : null;
  const art = inst && inst.articulations.find(a => a.name === articulation);
  if (!art) return res.status(404).json({ error: 'not_found' });
  const samples = {};
  for (const [note, s] of Object.entries(art.samples)) samples[note] = withAlts(s);
  const velocity = {};
  for (const [note, layers] of Object.entries(art.velocity || {})) velocity[note] = layers.map(withAlts);
  res.json({
    baseUrl: `soundfonts/${encodeURIComponent(VSCO_NAME)}/`,
    samples,
    velocity,
  });
});

// API routes BEFORE static middleware
app.get('/api/generate', (req, res) => {
  const options = req.query;
  console.log("Received generation request:", options);
  try {
    const piece = generator.generatePiece(options);
    res.json(piece);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Static files after API routes
app.use(express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
  console.log(`Bach Generator listening at http://localhost:${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
  console.log(`API: http://localhost:${port}/api/generate?form=Chorale&mode=major&key=C&duration=2`);
});
