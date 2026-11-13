import { defineConfig } from 'vite';
import { resolve } from 'path';
import { checkTree } from './tools/sample-manifest-lib.mjs';

// index.html (repo root) is the entry. public/ is served and copied as is: the
// classic <script> files (player.js, layeredSampler.js, ...), impulses/, Orchestra/,
// and the VSCO / VCSL samples with their static maps (public/soundfonts/,
// public/manifests/, written by `npm run samples`). The generator (src/) is bundled
// through src/browser.js. No server is needed.

// Fails the build if a manifest or a sample it names is missing from dist/
// (public/soundfonts/ is git-ignored: regenerate it with `npm run samples`).
function checkSamplesPlugin() {
  let outDir;
  return {
    name: 'check-samples',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      const r = checkTree(outDir);
      if (r.missing.length) {
        throw new Error(`[check-samples] ${r.missing.length} missing (run npm run samples): `
          + r.missing.slice(0, 10).join(', ') + (r.missing.length > 10 ? ', ...' : ''));
      }
      console.log(`[check-samples] ${r.manifests} manifests, ${r.samples} samples (${(r.bytes / 1048576).toFixed(1)} MiB) OK`);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 41324,
  },
  plugins: [checkSamplesPlugin()],
});
