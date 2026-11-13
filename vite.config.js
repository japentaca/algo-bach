import { defineConfig } from 'vite';

// index.html (repo root) is the entry. public/ is served and copied as is: the
// classic <script> files (player.js, layeredSampler.js, ...), impulses/ and
// Orchestra/. The generator (src/) is bundled through src/browser.js.
//
// The VSCO / SFZ samples still come from the Express server (server/app.js,
// port 3000): in dev, run it next to Vite and these paths are proxied to it.
const SAMPLE_SERVER = 'http://localhost:3000';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 41324,
    proxy: {
      '/soundfonts': SAMPLE_SERVER,
      '/api': SAMPLE_SERVER,
    },
  },
  preview: {
    proxy: {
      '/soundfonts': SAMPLE_SERVER,
      '/api': SAMPLE_SERVER,
    },
  },
});
