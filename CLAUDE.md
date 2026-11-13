# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Barroco Estocástico** (https://barroco.jape.com.ar): a static Vite site that composes SATB baroque pieces in the browser (chorale, prelude, fugue, ritornello, variations, dances...) and plays them with sampled instruments (VSCO 2 CE, VCSL harpsichord) through Tone.js, with a scrolling abcjs score. It merges two projects: the generator and audio engine of `bach` (this repo) and the front-end of the former `barroco stocastico` repo, whose Pages project and domain this site now uses. No server is needed. `HOW_TO_RUN.md` is the detailed reference (sample pipeline, player features, console checks). Comments and docs are in English; the UI text is Spanish.

## Commands

```bash
npm install
npm run samples          # once per clone / after changing instruments: manifests + copy samples from carrilion
npm run dev              # Vite on http://localhost:41324
npm run build            # dist/ (fails if a manifest or sample it names is missing)
npm run preview          # serves dist/
npm run check:samples    # every style's manifests and samples exist in dist/
npm run deploy -- --dry-run   # build + checks + upload listing, no Cloudflare contact
npm run deploy           # build + publish to Cloudflare Pages
npm run server           # optional Express on :3000 (live sample maps, serves dist/)

node test_integration.js          # generator tests (also test_implementation/seventh_chords/ornaments/rhythms.js)
node test_disposal.js
node analyze_quality.js           # voice-leading metrics over many seeds
node tools/golden.mjs write <dir> # generator snapshots; then: node tools/golden.mjs check <dir> (387 cases)
```

No linter, no test runner (`npm test` is a stub). After touching `src/`, run `golden.mjs check` against a snapshot written before the change: any difference is a change in what the site composes. The bundle mode (`check <dir> dist/assets/index-*.js`) no longer works since `ui/main.js` is in the same bundle (it touches `document` at import).

## Architecture

```
index.html            entry (markup + all CSS inline, Spanish UI); loads Tone.js and abcjs from CDNs,
                      the two ES modules, then the classic scripts of public/ in order, then Umami
src/                  generator (ES modules, Node and browser). main.js: generatePiece(options)
  browser.js          bundled by Vite: window.BachGenerator.generatePiece (options as strings, the
                      shape the old GET /api/generate had)
public/               served/copied as is, classic <script>s sharing globals:
  instrumentConfig.js STYLE_PRESETS, VSCO_ENSEMBLES (styles -> instruments, trims, articulations)
  sampleLoader.js, layeredSampler.js   one-layer samples (Orchestra/) and the VSCO/SFZ
                      velocity-layer sampler (reads public/manifests/, keep MANIFESTS in sync with
                      server/samples.js)
  articulation.js     per-section/per-voice articulation plan, messa di voce
  midi.js             Web MIDI output
  player.js           window.BachPlayer: generateAndPlay() composes, loads samples, schedules;
                      emits bach:composed / bach:playing / bach:stopped window events
  kiosk.js            window.BachKiosk: endless concert (Iniciar button, ?kiosk overlay), draws
                      ensemble/form/key/tempo per piece; emits bach:kiosk
ui/                   ES modules (bundled): main.js listens to the bach:* events (title/author,
                      score follower, progress, slideshow, Umami); score.js (abcjs + follower on
                      requestAnimationFrame), authors.js (invented composers/titles), slideshow.js
server/               samples.js + sfz.js build the sample maps (used by tools/ and app.js);
                      app.js is the optional Express server
tools/                build-sample-manifests.mjs (npm run samples), check-samples.mjs,
                      sample-manifest-lib.mjs, golden.mjs, deploy.mjs
vite.config.js        base './'; plugins: virtual:autores-images (public/autores/ portraits),
                      check-samples (fails the build on a missing sample)
```

Rule of thumb: `src/` never touches the DOM; `public/*.js` never imports (globals, script order matters); `ui/` only presents what the player reports and never schedules audio.

### Samples

`npm run samples` reads `public/instrumentConfig.js`, asks `server/samples.js` for every map a style can load, writes them to `public/manifests/` (committed) and copies exactly the files they name (1282 files, ~254 MiB, MP3/FLAC as they are) from carrilion's `assets/soundfonts` (`SOUNDFONTS_DIR`; carrilion is only read) into `public/soundfonts/` (git-ignored). `public/Orchestra/` and `public/impulses/` are also git-ignored and **not regenerated**: a fresh clone needs them copied by hand (deploy refuses without them).

### Deploy

`tools/deploy.mjs`: direct upload with `wrangler pages deploy` (devDependency) to the Pages project `barroco-estocastico` (account of zone `jape.com.ar`), custom domain `barroco.jape.com.ar` + proxied CNAME, all idempotent. It first checks the local-only folders, builds, runs `check-samples`, and verifies the Pages limits (20,000 files, 25 MiB per file; dist is ~1560 files / ~293 MiB, largest 1.4 MiB). The API token is read at run time from a credentials file **outside the repo** (default path in the script, override with `CF_CREDENTIALS`); never copy it into the project or print it. Nothing deploys on push.

### Analytics

Umami (self-hosted, stats.jape.com.ar, no cookies): the tag at the end of `index.html` has `data-domains="barroco.jape.com.ar"`, so dev/preview send nothing. Events from `ui/main.js` (`track()`, guarded with `window.umami?.track` + try): `iniciar` (first concert piece), `pieza` (each following one, `n`), `componer` (manual "Componer y tocar"), `play` (every piece that starts sounding, `modo` concierto/manual, `bpm`); all carry `forma`, `tonalidad` ("C major"), `conjunto` (style id), `compases`.

## Gotchas

- **`AudioContext` needs a real user gesture.** A programmatic `button.click()` leaves Tone's context suspended; in browser automation click the page (e.g. "Componer y tocar" or Iniciar) with a trusted pointer event before driving `BachPlayer` / `BachKiosk` from JS.
- **`requestAnimationFrame` is frozen in hidden tabs**: the progress bar (setInterval) advances but the score follower does not.
- **No `#` (or `$&+,:;=?@`) in sample paths.** The page builds URLs with `encodeURIComponent`; sirv (`vite preview`) decodes with `decodeURI`, which leaves `%23`/`%2C` encoded, so the file is not found and index.html comes back with 200 instead. `npm run samples` renames (`A#3` -> `As3`, `Harpsichord, Flemish` -> `Harpsichord Flemish`) and the manifests carry the renamed paths; deploy rejects `#%?` in any dist path.
- A missing file on Vite or Pages answers with index.html (200), so a missing sample shows up as a decode error, not a 404: trust `npm run build` / `check:samples`.
- `public/manifests/` names and `layeredSampler.js` URLs must stay in sync with `MANIFESTS` in `server/samples.js`.
- Kiosk and the page share the form controls: the kiosk sets them per piece (dispatching change/input events) and restores the seed UI on exit; per-voice articulation is ignored by the kiosk.
- `src/voices/leading.js`, `melodic.js`, `interdependence.js` and `src/harmony/progressions.js` are legacy (not used by the pipeline).
