/**
 * The sample-map answers the player asks for (VSCO 2 CE articulations, VCSL SFZ
 * keyboards), built from a soundfont folder. Shared by server/app.js (live, from
 * carrilion's folder) and tools/build-sample-manifests.mjs (static JSON for the site).
 *
 *   vscoStatus()                        -> { available }
 *   vscoArticulation(inst, art)         -> { baseUrl, samples, velocity } | null
 *   sfzStatus(lib)                      -> { available, files }
 *   sfzInstrument(lib, file)            -> parseSfz() shape | null (not whitelisted / unreadable)
 *
 * Sample paths are relative to `baseUrl` (soundfonts/<library>/), as on disk.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSfz } from './sfz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SOUNDFONTS_DIR = process.env.SOUNDFONTS_DIR
  || path.join(__dirname, '../../../carrilion/assets/soundfonts');
export const VSCO_NAME = 'VSCO-2-CE-1.1.0';
const VSCO_METADATA = path.join(SOUNDFONTS_DIR, VSCO_NAME, 'metadata.json');

// Only whitelisted libraries / files can be read (no path from a query reaches the
// file system).
export const SFZ_LIBRARIES = {
  'VCSL-Keys': [
    "Harpsichord, Flemish - Full.sfz",
    "Harpsichord, Flemish - 8'.sfz",
    "Harpsichord, Flemish - 4'.sfz",
  ],
};

// ---- VSCO 2 CE (indexed by carrilion: metadata.json with key ranges, gains, layers) ----
let vscoCatalog;  // undefined = not read yet, null = unavailable

export function getVscoCatalog() {
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

export function vscoStatus() {
  return { available: !!getVscoCatalog() };
}

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

/** Sample map + velocity layers of one articulation (null: unknown / no catalog). */
export function vscoArticulation(instrument, articulation) {
  const catalog = getVscoCatalog();
  if (!catalog) return null;
  const inst = typeof instrument === 'string' && Object.prototype.hasOwnProperty.call(catalog.instruments, instrument)
    ? catalog.instruments[instrument] : null;
  const art = inst && inst.articulations.find(a => a.name === articulation);
  if (!art) return null;
  const samples = {};
  for (const [note, s] of Object.entries(art.samples)) samples[note] = withAlts(s);
  const velocity = {};
  for (const [note, layers] of Object.entries(art.velocity || {})) velocity[note] = layers.map(withAlts);
  return {
    baseUrl: `soundfonts/${encodeURIComponent(VSCO_NAME)}/`,
    samples,
    velocity,
  };
}

// ---- SFZ instruments (VCSL Keys harpsichords, CC0) ----------------------------------
const sfzCache = new Map();  // "lib|file" -> parsed instrument

export function sfzFileOk(lib, file) {
  return typeof lib === 'string' && typeof file === 'string'
    && Object.prototype.hasOwnProperty.call(SFZ_LIBRARIES, lib) && SFZ_LIBRARIES[lib].includes(file);
}

export function sfzStatus(lib = 'VCSL-Keys') {
  if (!Object.prototype.hasOwnProperty.call(SFZ_LIBRARIES, lib)) return { available: false, files: [] };
  const files = SFZ_LIBRARIES[lib].filter(f => fs.existsSync(path.join(SOUNDFONTS_DIR, lib, f)));
  return { available: files.length > 0, files };
}

/** The parsed .sfz (same shape as vscoArticulation + stack/offset/releases), or null. */
export function sfzInstrument(lib, file) {
  if (!sfzFileOk(lib, file)) return null;
  const key = `${lib}|${file}`;
  if (!sfzCache.has(key)) {
    const libDir = path.join(SOUNDFONTS_DIR, lib);
    try {
      sfzCache.set(key, parseSfz(path.join(libDir, file), libDir, `soundfonts/${encodeURIComponent(lib)}/`));
    } catch (error) {
      console.log(`SFZ not available (${lib} / ${file}): ${error.message}`);
      return null;
    }
  }
  return sfzCache.get(key);
}

// ---- Static manifest URLs (tools/build-sample-manifests.mjs writes them; the browser
// computes the same names in public/layeredSampler.js: keep both in sync) ----------
/** File-name-safe form of an instrument / articulation / .sfz name. */
export function manifestName(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '_');
}
export const MANIFESTS = {
  vscoStatus: 'manifests/vsco/status.json',
  vscoArticulation: (instrument, articulation) =>
    `manifests/vsco/${manifestName(instrument)}/${manifestName(articulation)}.json`,
  sfzStatus: (lib) => `manifests/sfz/${manifestName(lib)}/status.json`,
  sfzInstrument: (lib, file) => `manifests/sfz/${manifestName(lib)}/${manifestName(file.replace(/\.sfz$/i, ''))}.json`,
};
