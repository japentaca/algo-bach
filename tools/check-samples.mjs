// Checks a built site (default dist/) the way the page uses it, style by style:
// every instrument x articulation / .sfz each style of public/instrumentConfig.js can
// load has its manifest at the URL layeredSampler.js asks for, and every sample that
// manifest names (main takes, alts, velocity layers, stacks, releases) is there.
//   node tools/check-samples.mjs [dir]       (npm run check:samples)
import fs from 'fs';
import path from 'path';
import { MANIFESTS } from '../server/samples.js';
import { ROOT, loadStylePresets, referencedSources, manifestSamplePaths, sampleUrl, checkTree } from './sample-manifest-lib.mjs';

const dir = path.resolve(ROOT, process.argv[2] || 'dist');
const read = rel => {
  const f = path.join(dir, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const exists = url => decodeURI(url) === decodeURIComponent(url) && fs.existsSync(path.join(dir, decodeURIComponent(url)));

const presets = loadStylePresets();
const problems = [];
const perStyle = {};
const allSamples = new Set();

const vscoStatus = read(MANIFESTS.vscoStatus);
if (!vscoStatus || !vscoStatus.available) problems.push(`${MANIFESTS.vscoStatus}: not available`);

for (const [name, style] of Object.entries(presets)) {
  if (style.engine !== 'vsco' && style.engine !== 'sfz') continue;
  const { vsco, sfz } = referencedSources({ [name]: style });
  const urls = [];
  const sources = [
    ...vsco.map(v => ({ label: `${v.instrument} / ${v.articulation}`, url: MANIFESTS.vscoArticulation(v.instrument, v.articulation) })),
    ...sfz.map(s => ({ label: `${s.lib} / ${s.file}`, url: MANIFESTS.sfzInstrument(s.lib, s.file), sfz: s })),
  ];
  for (const src of sources) {
    if (src.sfz) {
      const st = read(MANIFESTS.sfzStatus(src.sfz.lib));
      if (!st || !st.files.includes(src.sfz.file)) problems.push(`${name}: ${src.sfz.file} not in ${MANIFESTS.sfzStatus(src.sfz.lib)}`);
    }
    const detail = read(src.url);
    if (!detail) { problems.push(`${name}: missing manifest ${src.url} (${src.label})`); continue; }
    if (!Object.keys(detail.samples || {}).length) problems.push(`${name}: ${src.url} has no samples`);
    for (const p of manifestSamplePaths(detail)) {
      const url = sampleUrl(detail, p);
      urls.push(url);
      allSamples.add(url);
      if (!exists(url)) problems.push(`${name}: missing sample ${url}`);
    }
  }
  perStyle[name] = { sources: sources.length, samples: new Set(urls).size };
}

const tree = checkTree(dir);
problems.push(...tree.missing.map(m => `index: missing ${m}`));

console.table(perStyle);
console.log(`${Object.keys(perStyle).length} sampled styles, ${allSamples.size} distinct sample URLs referenced; `
  + `tree: ${tree.manifests} manifests, ${tree.samples} samples, ${(tree.bytes / 1048576).toFixed(1)} MiB (${dir})`);
if (problems.length) {
  console.error(`${problems.length} problems:\n` + problems.slice(0, 50).join('\n'));
  process.exitCode = 1;
} else {
  console.log('OK: every referenced manifest and sample exists');
}
