import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as generator from '../src/main.js';
import { SOUNDFONTS_DIR, vscoStatus, vscoArticulation, sfzStatus, sfzFileOk, sfzInstrument } from './samples.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(express.json());

// ---- Optional velocity-layered samples (VSCO 2 CE / VCSL Keys, from carrilion) ----
// The built site does not need these routes: tools/build-sample-manifests.mjs writes
// the same answers as static JSON (public/manifests/) and copies the samples into
// public/soundfonts/. They stay here to compare against (server/samples.js holds the
// shared logic) and to play from carrilion's folder directly.
app.use('/soundfonts', express.static(SOUNDFONTS_DIR, { maxAge: '7d', fallthrough: false }));

app.get('/api/vsco/status', (req, res) => res.json(vscoStatus()));

// Sample map + velocity layers of one articulation: ?instrument=&articulation=
app.get('/api/vsco/articulation', (req, res) => {
  if (!vscoStatus().available) return res.status(404).json({ error: 'vsco_unavailable' });
  const detail = vscoArticulation(req.query.instrument, req.query.articulation);
  if (!detail) return res.status(404).json({ error: 'not_found' });
  res.json(detail);
});

app.get('/api/sfz/status', (req, res) => {
  res.json(sfzStatus(typeof req.query.lib === 'string' ? req.query.lib : 'VCSL-Keys'));
});

// ?lib=VCSL-Keys&file=Harpsichord, Flemish - 8'.sfz
app.get('/api/sfz', (req, res) => {
  const { lib, file } = req.query;
  if (!sfzFileOk(lib, file)) return res.status(404).json({ error: 'not_found' });
  const detail = sfzInstrument(lib, file);
  if (!detail) return res.status(404).json({ error: 'sfz_unavailable' });
  res.json(detail);
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

// Static files after API routes. The page itself is static (npm run dev / preview);
// after npm run build, dist/ is served here too, so the built site works on this port.
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
  console.log(`Bach Generator listening at http://localhost:${port}`);
  console.log(`Built site (npm run build): http://localhost:${port}. Not needed by the site itself: npm run dev / npm run preview are static.`);
  console.log(`API: http://localhost:${port}/api/generate?form=Chorale&mode=major&key=C&duration=2`);
});
