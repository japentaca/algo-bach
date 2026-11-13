# Bach Generator - How to Run

## Quick Start

### Option 1: Command Line (Simplest)

```bash
node example.js
```

This shows working examples of generating different compositions.

### Option 2: Node.js API (Programmatic)

```bash
node --input-type=module -e "
import { generatePiece } from './src/main.js';
const piece = generatePiece({
  form: 'Chorale',
  mode: 'major',
  key: 'C',
  duration: 4
});
console.log(JSON.stringify(piece, null, 2));
"
```

### Option 3: Web page (Interactive)

The project is ES modules (`"type": "module"`). The page is built with Vite:
`index.html` (repo root) is the entry, `src/browser.js` bundles the generator
(`window.BachGenerator.generatePiece`, called by `public/player.js`, so composing
needs no server), and `public/` (the classic `<script>` files, `impulses/`,
`Orchestra/`, and the VSCO / VCSL `soundfonts/` + `manifests/` written by `npm run
samples`) is served and copied as is.

```bash
npm install
npm run samples  # once (and after changing instruments): manifests + samples from carrilion
npm run dev      # Vite on http://localhost:41324
npm run build    # static site in dist/ (fails if a referenced sample is missing)
npm run preview  # serves dist/
npm run check:samples  # every style's manifests and samples exist in dist/
npm run deploy -- --dry-run  # checks + build + what would be uploaded (no Cloudflare)
npm run deploy   # publish dist/ to Cloudflare Pages: https://barroco.jape.com.ar (see CLAUDE.md)
```

**No server is needed**: `dist/` works from any static host (Cloudflare Pages: 1282
samples + 40 manifests, largest file 1.4 MiB, well under its 25 MiB / 20,000-file limits).

**Samples** (`npm run samples` = `tools/build-sample-manifests.mjs`): reads
`public/instrumentConfig.js` for every VSCO instrument × articulation a style can load
(each part's sustain, its `arts`, its `solo` arts, the `continuo` organ) and every
whitelisted `.sfz`, asks `server/samples.js` for the answer (the same code behind the
Express routes below), and writes it as static JSON:

- `public/manifests/vsco/status.json`, `public/manifests/vsco/<instrument>/<articulation>.json`
- `public/manifests/sfz/VCSL-Keys/status.json`, `public/manifests/sfz/VCSL-Keys/<file without .sfz>.json`
- `public/manifests/index.json` (the list, for the checks)

(names: every run of characters outside `A-Za-z0-9._-` becomes `_`, e.g.
`ViolinEnsSus/Sustain_Vibrato.json`, `Harpsichord_Flemish_-_8_.json`;
`public/layeredSampler.js` builds the same URLs — keep `MANIFESTS` in both in sync).
Then it copies exactly the files those maps name (main takes, round-robin `alts`,
velocity layers, stacked registers, release samples: 1282 files, 253.6 MiB) from
`SOUNDFONTS_DIR` (default carrilion's `assets/soundfonts`; carrilion is only read) into
`public/soundfonts/<library>/` at the same relative path, and deletes anything else
there. The only change is to the paths: `#` becomes `s` (`A#3` → `As3`, the VSCO-2
naming) and `$&+,:;=?@` are dropped (`Harpsichord, Flemish/` → `Harpsichord Flemish/`):
the page encodes paths with `encodeURIComponent`, and sirv (`vite preview`) decodes them
with `decodeURI`, which leaves `%23` / `%2C` encoded, so the file is not found and
index.html comes back instead. The manifests carry the renamed paths; otherwise they are
identical to the Express answers (checked: all 40, 22 of them after the rename).

**Format: the files are copied as they are, not re-encoded.** carrilion's VSCO 2 CE is
already MP3 (320 kbps, 1174 files, 210.9 MiB) and VCSL Keys is FLAC (24-bit, 108 files,
42.8 MiB); Chrome, Firefox and Safari all decode both in `decodeAudioData` (Safari has
never decoded Ogg Vorbis reliably). The total is within Cloudflare's limits, so a second
lossy generation (MP3 → Vorbis would be ~82 MiB, measured on a 1/25 sample) is not
worth it: the decoded audio is bit-for-bit what Express served, so the round-robin level
matching (peak 100 ms RMS), `.sfz` offsets and release timings cannot shift.

**Git**: `public/soundfonts/` is git-ignored (254 MB is too much to version; it is
regenerated from carrilion in ~2 s); `public/manifests/` (~0.7 MB of JSON) is committed,
so changes to the maps show up in diffs. `npm run build` fails, listing the missing
files, when a manifest or a sample it names is not in `dist/` (`check-samples` plugin
in `vite.config.js`).

Golden snapshots of the generator (the option shape the page sends, every value a
string): `node tools/golden.mjs write <dir>` once, then `node tools/golden.mjs check
<dir>` (or `check <dir> dist/assets/index-*.js` to check the browser bundle).

The Express server (`npm run server`, :3000) is optional: it serves `dist/` and the
live answers the manifests are built from (`/soundfonts` from carrilion's folder):
- `GET /api/vsco/status` → `{ available }` (VSCO 2 CE samples found in `SOUNDFONTS_DIR`)
- `GET /api/vsco/articulation?instrument=Violin&articulation=Spiccato` → sample map and
  velocity layers of one articulation. Each sample/layer may carry `alts`: the other
  round-robin takes of that note found on disk (`_rr1/_rr2`, `_RR1/_RR2`, `_1/_2`).
- `GET /api/sfz/status` → `{ available, files }` (the whitelisted `.sfz` instruments
  found in `SOUNDFONTS_DIR/VCSL-Keys`)
- `GET /api/sfz?lib=VCSL-Keys&file=Harpsichord, Flemish - 8'.sfz` → the same shape as
  `/api/vsco/articulation` (`baseUrl`, `samples` per note with `root` / `gain`, `velocity`,
  `alts`), plus `stack` (regions sounding together, e.g. the 4' over the 8'), `offset` (s),
  `releases` (the release samples per note), `envelope` and `info` (region counts). Only
  the files listed in `SFZ_LIBRARIES` (server/samples.js) can be read; each is parsed once
  (server/sfz.js: `<control>/<global>/<master>/<group>/<region>` inheritance,
  `default_path`, comments, `seq_position` round robins; key-switch files are not used).

The player alternates those takes on every short (staccato/pizzicato) sample and on
repeated notes of sustained ones, matching each take's level to the main one (peak
100 ms RMS of the mono sum); takes more than 6 dB away are another dynamic and are not
used. Checks in the browser console: `BachPlayer.roundRobinStats()` (takes played per
voice and articulation), `BachPlayer.articulationStats()`; `setRoundRobins(false)` turns
them off for the next piece (A/B tests).

**Continuo organ** (Ritornello, VSCO styles with a `continuo` entry in
`public/instrumentConfig.js`: VscoStrings and VscoWoodwinds): an organ doubles the bass in the *tutti* sections and
rests in the solo episodes, as the continuo thins out under the soloist. Stop: the VSCO
manual `Organ` / `Loud`, an 8' principal at the written pitch (only the files of the
doubled notes are loaded). Détaché bass notes are played at half length, held ones
slightly lifted; constant level (pipes have no touch). Not used with MIDI output, for
the other forms, or for non-VSCO styles. Checks: `BachPlayer.continuoStats()` (notes
planned / played per section, files loaded, `outsideTutti` = 0, `log` of the organ
notes' beats); `setContinuo(false)` turns it off for the next piece (A/B tests).

**Messa di voce** (VSCO styles; Tone output only): the articulation plan
(`public/articulation.js`) marks a few long sustained notes (≥ 1.2 s at the current
tempo, never slurred, staccato, pizzicato or tremolo) to be begun softly, swelled and
diminished, as an ornament that goes with the vibrato: the final chord (all voices
together: top 4 dB, inner voices 60%, bass 30%, peak at 30%), the held top note of a
cadence that carries the cadential vibrato (5 dB on PAC / HC / section ends, 3.5 dB on
IAC, none on a deceptive cadence; on the strong ones the inner voices follow at half
depth, the bass does not), a soloist's long cadence notes and one high point per phrase
(6 dB), and one long vibrato note per phrase of a cantabile top voice (4 dB). Notes
under 2 s get a proportionally shallower swell. `LayeredSampler` shapes it with
exponential gain ramps: the note starts `depth` dB under its level, reaches it at the
peak and diminishes again before the release (only half as much before a slurred
note). It never goes above the note's normal level, so peaks are unchanged. Not on the
organ continuo, keyboards, short samples, non-VSCO styles or MIDI. Checks:
`BachPlayer.swellStats()` (swells planned / played per voice, context and section,
`log` of each one), `BachPlayer.articulationStats()` (`swelled` per voice);
`setMessaDiVoce(false)` turns it off for the next piece (A/B tests).

**Articulation per voice** (the row under the Articulation selector): each voice
[S, A, T, B] can leave the global profile (`Auto` = follow it) for Legato, Detached or
Pizzicato, e.g. a pizzicato bass, or a detached bass under a legato melody. The plan
(`BachArticulation.plan(data, { profile, voiceProfiles, canPluck, ... })`) applies the
voice's manner with the global profile's rules (a detached voice still holds its long
notes, ornaments stay slurred, sustained cadence notes keep their vibrato and messa di
voce; plucked notes never swell). Every shared coin and vibrato draw is made on the
global plan first, so the voices left on Auto play exactly what they would without the
override (one exception: the inner voices' `cadence-inner` swells follow the top
voice's cadence swell, so they drop out when the top voice no longer holds that note).
Pizzicato is offered only where the ensemble plucks (VSCO Strings); elsewhere a voice
set to it plays (and shows) Detached, and gets its pizzicato back when the ensemble
plucks again. Non-VSCO styles and MIDI only shorten the detached / plucked notes, as with
the global profile. Section labels name the voices that play otherwise ("Variazione II
· legato · basso pizzicato", "Episodio · violino solo spiccato"). The ritornello soloist
keeps its solo instrument in whatever manner violin I is given. Under a plucked bass
(its effective profile pizzicato, per voice or globally, on strings) the continuo organ
rests (`continuoStats().reason` = `'pizzicato bass'`): an 8' principal would cover the
pluck; a detached bass keeps the organ. The kiosk ignores the row (its pieces use its own
global profile only) and leaves it as set. Not persisted between visits (the page keeps
no settings). Checks: `BachPlayer.lastArticulationPlan()` (`voiceProfiles` = what each
voice plays, `voiceRequested`, `voiceSummary` per voice, `sections[].voiceCharacters`),
the `articulation.voiceProfiles` returned by `generateAndPlay`, and
`BachPlayer.articulationStats()` (notes played per voice and articulation).

**Harpsichords** (styles `HarpsichordFull` = Flemish 8' + 4', `Harpsichord8` = Flemish 8'):
samples from Versilian Studios' **VCSL Keys** (CC0, public domain), copied by `npm run
samples` from the `VCSL-Keys` folder in carrilion's `assets/soundfonts` (or
`SOUNDFONTS_DIR`); the options stay disabled without their manifests. The Flemish instrument was chosen by measuring all 8 VCSL
harpsichords (evenness, tuning, decay, release samples); see the comment in
`public/instrumentConfig.js`. A harpsichord has no dynamics: the velocity curve is almost
flat (±1 dB) and there are no velocity layers; every note gets its full pluck (never
slurred or swelled), there is no organ continuo, and at the end of each note its release
sample (the jack falling back, ~26 dB under the pluck, as the .sfz sets it) is played. One
string per key: two voices on the same key at once are one pluck, and a key struck again
while held is released 20 ms before. The final chord and cadence chords (3+ voices, held
≥ 1.5 beats) are rolled from the bass up (35 / 18 ms per note). Checks:
`BachPlayer.releaseStats()` (release samples played / skipped and files per voice),
`BachPlayer.arpeggioStats()` (`rolled`, `unison`, `restruck`, `log`),
`BachPlayer.articulationStats()` (`sustain` / `stacked` notes); `setReleaseSamples(false)`
turns the release samples off (A/B tests).

**Baroque ensembles (VSCO)** (styles `VscoOboeStrings`, `VscoFluteStrings`,
`VscoTrumpetStrings`, `VscoOboeBassoon`): one obbligato wind over the strings (the B minor
Suite's flute, the oboe concertos and arias, the cantatas' trumpet), or the oboe with
the bassoon on the bass line. Each voice is taken whole from a VSCO quartet
(`VSCO_ENSEMBLES` in `public/instrumentConfig.js`) with that quartet's level folded into
its trims, so it sounds as in its own quartet; only instruments whose samples cover the
generator's range for that voice. Articulations are the ones every voice has (no
pizzicato); the organ continuo plays in the ritornello tutti.

**Kiosk** (`?kiosk`): every piece draws its ensemble from every style the page can play
(weighted towards the VSCO quartets, the Baroque ensembles and the harpsichords; the older
one-layer samples now and then), waiting for the VSCO / SFZ checks so they are in the draw
from the first piece. Coherence: pizzicato only on an ensemble that plucks, tempo and
reverb mix shifted per style, a hall or plate always on (never "none"), and a stereo
seating spread over the stage (modern or antiphonal for ensembles, from the keyboard,
narrower, for one instrument). `BachKiosk.randomize()` returns the choices.

**Reverb routing**: each voice (and the continuo organ) goes Volume → Panner → dry bus,
and Volume → a mono reverb send (−3 dB) → Convolver → wet bus; dry and wet meet in the
master Limiter. The send is taken before the panner on purpose: a stereo convolver does
not cross-feed, so a panned send gave each voice its reverb on its own side only. Now
every voice gets the same full-width room wherever it is seated.

## Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `form` | "Chorale", "Prelude", "Fugue", "Suite", "Ritornello", "Variations", "Allemande", "Courante", "Gigue", "Minuet", "Sarabande", "Passacaglia" | "Chorale" | Form / texture |
| `mode` | "major", "minor" | "major" | Major or minor tonality |
| `key` | C, D, E, F, G, A, B, C#, Db, etc. | "C" | Tonic pitch class |
| `duration` | 1-150 | 2 | Length in 4/4 bars (pieces of 12+ bars modulate to related keys) |
| `seed` | any string | "default" | Same seed + same options = same piece |
| `ornamentDensity` | 0-100 | 50 | Amount of diminutions, suspensions and ornaments |

## Output Format

```javascript
{
  notes: [
    { pitch: "C5", duration: "2n", beats: 2, startTime: 0, voice: 0, velocity: 94 },
    { pitch: "D5", duration: "4n", beats: 1, startTime: 3, voice: 0, velocity: 88, type: "passing" },
    // ... more notes
  ],
  meta: {
    key: "C", mode: "major", form: "Chorale", style: "Baroque Chorale", bars: 8,
    progression: "I - ii6 - V7 - I - ... [G] IV - V7 - I",
    phraseMarkers: [{ index: 0, key: "C", mode: "major", cadence: "HC", startBeat: 0, endBeat: 16 }, ...],
    // Variations, Fugue and Ritornello only: the formal sections
    sections: [{ kind: "theme", index: 0, startBeat: 0, endBeat: 32, texture: "chorale" }, ...]
  }
}
```

`meta.sections[].kind`: Variations → `theme`, `variation` (with `texture`: chorale,
eighths, sixteenths, long, arpeggio, dotted); Fugue → `exposition`, `episode`, `entry`,
`stretto`, `final`, `cadence`; Ritornello → `tutti`, `solo` (opening and closing tutti,
then two solo phrases per tutti return). The web player uses them for its articulation
plan (`public/articulation.js`).

### Note Fields:
- `pitch`: Scientific pitch notation (C4 = middle C)
- `duration`: Nearest Tone.js note value ("2n", "4n", "8n."...)
- `beats`: Exact length in quarter-note beats (use this for scheduling)
- `startTime`: Offset in quarter notes
- `voice`: 0=Soprano, 1=Alto, 2=Tenor, 3=Bass
- `velocity`: 1-127, shaped by phrase (louder toward cadences)
- `type`: omitted for chord tones; otherwise "passing", "neighbor", "suspension", "resolution", "arpeggio", "trill", "mordent", "subject", "answer", "countersubject", "episode"...

## Examples

### Generate a C Major Chorale (4 bars)
```bash
node --input-type=module -e "import { generatePiece } from './src/main.js'; console.log(JSON.stringify(generatePiece({form: 'Chorale', mode: 'major', key: 'C', duration: 4}), null, 2));"
```

### Generate a D Minor Prelude (3 bars)
```bash
node --input-type=module -e "import { generatePiece } from './src/main.js'; console.log(JSON.stringify(generatePiece({form: 'Prelude', mode: 'minor', key: 'D', duration: 3}), null, 2));"
```

### Generate a G Major Gigue (2 bars, with dotted rhythms)
```bash
node --input-type=module -e "import { generatePiece } from './src/main.js'; console.log(JSON.stringify(generatePiece({form: 'Gigue', mode: 'major', key: 'G', duration: 2}), null, 2));"
```

## Running Tests

```bash
node test_integration.js
node test_implementation.js
node test_seventh_chords.js
node test_ornaments.js
node test_rhythms.js

# Objective quality metrics (parallels, unprepared dissonances, crossings,
# range, notes outside the local key, determinism) over many seeds/keys/forms
node analyze_quality.js
```

## Music Theory Features

The generator includes:

✓ **Voice Leading Rules**
- Hidden 5ths/8ves detection and penalty
- Voice spacing constraints (S-A ≤ 12 semitones, A-T ≤ 12 semitones)
- Doubling rules (leading tone forbidden)

✓ **Harmony**
- Functional progression generation
- Seventh chords (V7, vii°7)
- Multiple cadence types (PAC, IAC, HC, DC)
- Cadential 6/4 handling

✓ **Minor Key Support**
- Natural, melodic, and harmonic minor
- Proper mode-specific chord progressions

✓ **Ornamentation**
- Passing tones
- Neighbor tones
- Appoggiaturas
- Suspensions (4-3, 9-8)

✓ **Rhythmic Variety**
- Form-specific patterns (Chorale: half notes, Prelude: mixed, Gigue: dotted)
- Augmentation, diminution, syncopation

## Architecture

Generation pipeline (one seeded RNG for every step):

1. **Tonal & phrase plan** (`src/harmony/phrasePlan.js`): 4-bar phrases with
   metrically placed cadences (PAC, IAC, HC, Phrygian, deceptive), modulation to
   related keys through pivot chords, secondary dominants, Picardy third.
2. **Chords from scale degrees** (`src/theory/chords.js`): correct minor/diminished
   chords, harmonic-minor dominants (tonal's roman-numeral parser ignores case).
3. **Voice leading** (`src/voices/voicing.js`): dynamic programming over every
   legal SATB voicing; forbids parallel 5ths/8ves, resolves leading tones and
   sevenths in the real key, controls doubling, spacing, overlaps and tessitura.
4. **Texture** (`src/voices/figuration.js`): chorale (passing tones, suspensions),
   arpeggiated prelude, dance textures (melodic diminution + walking/drum bass),
   followed by a repair pass that removes embellishments causing parallels or clashes.
5. **Ornaments** (`src/voices/ornaments.js`): cadential trills, mordents.
6. **Fugue** (`src/composition/fugue.js`): composed subject, tonal answer,
   invertible countersubject, exposition / episodes / middle entries / stretto /
   final entry, harmonized from the subject itself.

```
src/
├── main.js                    # Entry point (generatePiece)
├── composition/
│   ├── planner.js             # Orchestrates generation per form
│   ├── fugue.js               # Fugue engine
│   └── output.js              # Spelling, dynamics, output format
├── harmony/
│   ├── phrasePlan.js          # Phrases, cadences, modulations
│   └── progressions.js        # Legacy progression API (kept for compatibility)
├── theory/
│   ├── chords.js              # Chords/keys from scale degrees
│   ├── rules.js, scales.js    # Interval / scale utilities
├── voices/
│   ├── voicing.js             # DP voice leading
│   ├── figuration.js          # Textures + repair
│   ├── ornaments.js           # Trills, mordents
│   └── leading.js, melodic.js, interdependence.js  # legacy (not used by the pipeline)
└── rhythms/patterns.js
```

## Performance

Typical generation time: 30 bars ~50-150 ms, 150 bars ~0.2-1 s.

## Notes

- The system uses deterministic generation based on seed values
- Each generation is reproducible with the same parameters and seed
