// Shared by tools/build-sample-manifests.mjs, tools/check-samples.mjs and the
// vite.config.js check: which instrument x articulation / .sfz the page can ask for
// (read from public/instrumentConfig.js), and which sample files a manifest points to.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** STYLE_PRESETS of public/instrumentConfig.js (a classic script: run in a sandbox). */
export function loadStylePresets() {
  const src = fs.readFileSync(path.join(ROOT, 'public/instrumentConfig.js'), 'utf8');
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(src, sandbox, { filename: 'instrumentConfig.js' });
  return sandbox.module.exports.STYLE_PRESETS;
}

/**
 * Every sample source a style can load: { vsco: [{instrument, articulation, styles}],
 * sfz: [{lib, file, styles}] }. VSCO: each part's sustain, its arts, its solo arts, and
 * the style's continuo organ.
 */
export function referencedSources(presets = loadStylePresets()) {
  const vsco = new Map();
  const sfz = new Map();
  const addVsco = (spec, style) => {
    if (!spec || !spec.instrument || !spec.articulation) return;
    const k = `${spec.instrument}|${spec.articulation}`;
    if (!vsco.has(k)) vsco.set(k, { instrument: spec.instrument, articulation: spec.articulation, styles: [] });
    if (!vsco.get(k).styles.includes(style)) vsco.get(k).styles.push(style);
  };
  for (const [name, style] of Object.entries(presets)) {
    if (style.engine === 'vsco') {
      for (const part of style.vsco || []) {
        addVsco(part, name);
        for (const [art, spec] of Object.entries(part.arts || {})) {
          if (art === 'solo') Object.values(spec).forEach(s => addVsco(s, name));
          else addVsco(spec, name);
        }
      }
      addVsco(style.continuo, name);
    } else if (style.engine === 'sfz' && style.sfz) {
      const k = `${style.sfz.lib}|${style.sfz.file}`;
      if (!sfz.has(k)) sfz.set(k, { lib: style.sfz.lib, file: style.sfz.file, styles: [] });
      sfz.get(k).styles.push(name);
    }
  }
  return { vsco: [...vsco.values()], sfz: [...sfz.values()] };
}

/** Sample paths (relative to the manifest's baseUrl) of a manifest: mains, alts, stacks, layers, releases. */
export function manifestSamplePaths(detail) {
  const out = new Set();
  const visit = (s) => {
    if (!s || typeof s !== 'object') return;
    if (s.path) out.add(s.path);
    (s.alts || []).forEach(a => out.add(typeof a === 'string' ? a : a.path));
    (s.stack || []).forEach(visit);
  };
  Object.values(detail.samples || {}).forEach(visit);
  Object.values(detail.velocity || {}).forEach(layers => layers.forEach(visit));
  Object.values(detail.releases || {}).forEach(visit);
  return [...out];
}

/** URL of a sample as the browser builds it (layeredSampler.js: baseUrl + encoded path). */
export function sampleUrl(detail, p) {
  return detail.baseUrl + p.split('/').map(encodeURIComponent).join('/');
}

/**
 * Check a built (or public/) tree: every manifest under manifests/ and every sample it
 * names exists. Returns { manifests, samples, bytes, missing: [url] }.
 */
export function checkTree(dir) {
  const missing = [];
  const samples = new Set();
  let bytes = 0;
  const mdir = path.join(dir, 'manifests');
  const index = path.join(mdir, 'index.json');
  if (!fs.existsSync(index)) return { manifests: 0, samples: 0, bytes: 0, missing: ['manifests/index.json'] };
  const { files } = JSON.parse(fs.readFileSync(index, 'utf8'));
  for (const rel of files) {
    const f = path.join(dir, rel);
    if (!fs.existsSync(f)) { missing.push(rel); continue; }
    const detail = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!detail.baseUrl) continue;  // status files
    for (const p of manifestSamplePaths(detail)) {
      const url = sampleUrl(detail, p);
      if (samples.has(url)) continue;
      samples.add(url);
      // A static server decodes the URL with decodeURI: %23, %2C... would stay encoded
      if (decodeURI(url) !== decodeURIComponent(url)) { missing.push(`${url} (reserved character in the path)`); continue; }
      const file = path.join(dir, decodeURIComponent(url));
      if (fs.existsSync(file)) bytes += fs.statSync(file).size;
      else missing.push(url);
    }
  }
  return { manifests: files.length, samples: samples.size, bytes, missing };
}
