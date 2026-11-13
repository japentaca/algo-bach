// Static sample maps + the samples they point to, so the site needs no server.
//   node tools/build-sample-manifests.mjs        (npm run samples)
//
// 1. Reads public/instrumentConfig.js: every VSCO instrument x articulation a style
//    can load (sustain, arts, solo arts, continuo organ) and every .sfz.
// 2. Asks server/samples.js (the same code that answers /api/vsco/* and /api/sfz* in
//    server/app.js) for each answer and writes it as JSON under public/manifests/
//    (URLs: MANIFESTS in server/samples.js, mirrored in public/layeredSampler.js).
// 3. Copies exactly the files those answers name (main takes, round-robin alts,
//    velocity layers, stacked registers, release samples) from SOUNDFONTS_DIR
//    (carrilion's folder) into public/soundfonts/<library>/, at the same relative
//    path, and deletes anything else there. The files are copied as they are (VSCO:
//    MP3 320 kbps, VCSL: FLAC): no re-encoding, so they decode exactly as served by
//    Express. One change to the paths: '#' becomes 's' (A#3 -> As3, the VSCO-2
//    naming) and the other reserved characters ($&+,:;=?@) are dropped
//    ("Harpsichord, Flemish/" -> "Harpsichord Flemish/"): the page encodes paths with
//    encodeURIComponent, and sirv (vite preview) decodes them with decodeURI, which
//    leaves %23 / %2C... encoded, so the file is not found (and index.html comes back).
//
// public/soundfonts/ is git-ignored (~254 MB); public/manifests/ is committed.
import fs from 'fs';
import path from 'path';
import {
  SOUNDFONTS_DIR, VSCO_NAME, SFZ_LIBRARIES, MANIFESTS,
  vscoStatus, vscoArticulation, sfzStatus, sfzInstrument,
} from '../server/samples.js';
import { ROOT, referencedSources, manifestSamplePaths } from './sample-manifest-lib.mjs';

const PUBLIC = path.join(ROOT, 'public');
const MANIFEST_DIR = path.join(PUBLIC, 'manifests');
const SAMPLE_DIR = path.join(PUBLIC, 'soundfonts');
const EXTRA = { [VSCO_NAME]: ['LICENSE', 'README.md'] };  // licence / credits next to the samples

const sitePath = p => p.replace(/#/g, 's').replace(/[$&+,:;=?@]/g, '');

/** The manifest with every sample path mapped to its site path. */
function rename(detail) {
  const fix = (s) => {
    if (!s || typeof s !== 'object') return s;
    const out = { ...s };
    if (out.path) out.path = sitePath(out.path);
    if (out.alts) out.alts = out.alts.map(a => (typeof a === 'string' ? sitePath(a) : fix(a)));
    if (out.stack) out.stack = out.stack.map(fix);
    return out;
  };
  const mapObj = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
  const out = { ...detail, samples: mapObj(detail.samples || {}, fix), velocity: mapObj(detail.velocity || {}, l => l.map(fix)) };
  if (detail.releases) out.releases = mapObj(detail.releases, fix);
  return out;
}

const fail = (msg) => { console.error(`[samples] ${msg}`); process.exit(1); };

if (!vscoStatus().available) fail(`VSCO catalog not found in ${SOUNDFONTS_DIR} (set SOUNDFONTS_DIR)`);

const { vsco, sfz } = referencedSources();
const manifests = new Map();  // path under public/ -> JSON
const copies = new Map();     // dest (relative to soundfonts/) -> source (absolute)
const addCopies = (lib, original) => {
  for (const p of manifestSamplePaths(original)) {
    const dest = `${lib}/${sitePath(p)}`;
    const src = path.join(SOUNDFONTS_DIR, lib, p);
    if (copies.has(dest) && copies.get(dest) !== src) fail(`two samples map to ${dest}`);
    if (!fs.existsSync(src)) fail(`missing sample ${src}`);
    copies.set(dest, src);
  }
};

manifests.set(MANIFESTS.vscoStatus, vscoStatus());
for (const { instrument, articulation, styles } of vsco) {
  const detail = vscoArticulation(instrument, articulation);
  if (!detail) fail(`VSCO ${instrument} / ${articulation} (styles ${styles.join(', ')}) is not in the catalog`);
  const url = MANIFESTS.vscoArticulation(instrument, articulation);
  if (manifests.has(url)) fail(`manifest name clash: ${url}`);
  manifests.set(url, rename(detail));
  addCopies(VSCO_NAME, detail);
}

for (const { lib, file, styles } of sfz) {
  if (!SFZ_LIBRARIES[lib] || !SFZ_LIBRARIES[lib].includes(file)) fail(`${lib} / ${file} (${styles.join(', ')}) is not whitelisted in server/samples.js`);
}
for (const lib of Object.keys(SFZ_LIBRARIES)) {
  const status = sfzStatus(lib);
  manifests.set(MANIFESTS.sfzStatus(lib), status);
  for (const file of status.files) {
    const detail = sfzInstrument(lib, file);
    if (!detail) fail(`cannot parse ${lib} / ${file}`);
    if (detail.info && detail.info.missing) fail(`${lib} / ${file}: ${detail.info.missing} regions without a sample file`);
    const url = MANIFESTS.sfzInstrument(lib, file);
    if (manifests.has(url)) fail(`manifest name clash: ${url}`);
    manifests.set(url, rename(detail));
    addCopies(lib, detail);
  }
}
for (const [lib, files] of Object.entries(EXTRA)) {
  for (const f of files) {
    const src = path.join(SOUNDFONTS_DIR, lib, f);
    if (fs.existsSync(src)) copies.set(`${lib}/${f}`, src);
  }
}

// ---- Manifests (rewritten from scratch) ---------------------------------------------
fs.rmSync(MANIFEST_DIR, { recursive: true, force: true });
for (const [rel, json] of manifests) {
  const file = path.join(PUBLIC, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json) + '\n');
}
fs.writeFileSync(path.join(MANIFEST_DIR, 'index.json'), JSON.stringify({
  note: 'Written by tools/build-sample-manifests.mjs (npm run samples). Do not edit.',
  files: [...manifests.keys()].sort(),
}, null, 1) + '\n');

// ---- Samples (copied when missing or changed; strays deleted) --------------------------
let copied = 0, kept = 0, bytes = 0;
for (const [dest, src] of copies) {
  const out = path.join(SAMPLE_DIR, dest);
  const st = fs.statSync(src);
  bytes += st.size;
  if (fs.existsSync(out) && fs.statSync(out).size === st.size) { kept++; continue; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(src, out);
  copied++;
}
let removed = 0;
const keep = new Set([...copies.keys()].map(k => path.join(SAMPLE_DIR, k)));
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      if (!fs.readdirSync(p).length) fs.rmdirSync(p);
    } else if (!keep.has(p)) { fs.rmSync(p); removed++; }
  }
};
walk(SAMPLE_DIR);

const audio = [...copies.keys()].filter(k => /\.(mp3|flac|wav|ogg)$/i.test(k)).length;
console.log(`[samples] ${manifests.size} manifests (${vsco.length} VSCO articulations, ${manifests.size - vsco.length - 2} .sfz) -> public/manifests/`);
console.log(`[samples] ${audio} audio files + ${copies.size - audio} docs, ${(bytes / 1048576).toFixed(1)} MiB -> public/soundfonts/ (${copied} copied, ${kept} up to date, ${removed} stray removed)`);
