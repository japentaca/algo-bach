// Golden snapshots of generatePiece(): writes one JSON per case, or compares
// against a previous run.
//   node tools/golden.mjs write <dir>
//   node tools/golden.mjs check <dir> [bundle.js]
// With a bundle (dist/assets/index-*.js from npm run build), the browser build's
// window.BachGenerator is checked instead of src/main.js.
// Options are passed as strings, exactly as the old GET /api/generate handed
// req.query to the generator (and as the browser entry does now).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { isDeepStrictEqual } from 'util';

const [cmd, dir, bundle] = process.argv.slice(2);
if (!['write', 'check'].includes(cmd) || !dir) {
  console.error('usage: node tools/golden.mjs write|check <dir>');
  process.exit(2);
}

let generatePiece;
if (bundle) {
  // Just enough of a page for Vite's modulepreload polyfill
  globalThis.window = globalThis;
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  await import(pathToFileURL(resolve(bundle)).href);
  generatePiece = window.BachGenerator.generatePiece;
} else {
  const mod = await import(pathToFileURL(resolve('src/main.js')).href);
  generatePiece = mod.generatePiece || mod.default.generatePiece;
}

const FORMS = ['Chorale', 'Prelude', 'Fugue', 'Ritornello', 'Variations', 'Passacaglia', 'Suite'];
const MODES = ['major', 'minor'];
const KEYS = ['C', 'F#', 'Bb'];
const DURATIONS = [8, 30, 90];          // the UI sends 30 / 90 / 150 bars
const SEEDS = ['golden-1', 'xk3-42', 'seed 7'];
const DENSITIES = [50, 0, 100];

const cases = [];
for (const form of FORMS) for (const mode of MODES) for (const key of KEYS) for (const duration of DURATIONS) {
  SEEDS.forEach((seed, i) => {
    cases.push({
      key, mode, form, duration: String(duration), seed,
      ornamentDensity: String(DENSITIES[i]),
      expressivity: 'style', randomTexture: 'true', sparseOrnaments: 'true',
    });
  });
}
// A few long pieces (150 bars) and option-shape edge cases
for (const form of FORMS) cases.push({ key: 'D', mode: 'minor', form, duration: '150', seed: 'long', ornamentDensity: '50', expressivity: 'style', randomTexture: 'false', sparseOrnaments: 'false' });
cases.push({ form: 'Chorale' });
cases.push({ form: 'Fugue', key: 'G', mode: 'minor', duration: '12' });

if (cmd === 'write') mkdirSync(dir, { recursive: true });
let same = 0, diff = 0, missing = 0;
const t0 = Date.now();
cases.forEach((opts, i) => {
  const file = join(dir, `${String(i).padStart(3, '0')}.json`);
  const piece = generatePiece({ ...opts });
  const json = JSON.stringify({ opts, piece });
  if (cmd === 'write') { writeFileSync(file, json); return; }
  if (!existsSync(file)) { missing++; return; }
  const prev = readFileSync(file, 'utf8');
  if (prev === json && isDeepStrictEqual(JSON.parse(prev), { opts, piece: JSON.parse(JSON.stringify(piece)) })) same++;
  else { diff++; console.log('DIFF', file, JSON.stringify(opts)); }
});
console.log(`${cmd}: ${cases.length} cases in ${((Date.now() - t0) / 1000).toFixed(1)} s`
  + (cmd === 'check' ? ` — identical ${same}, different ${diff}, missing ${missing}` : ''));
process.exit(diff || missing ? 1 : 0);
