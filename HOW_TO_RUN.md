# Bach Generator - How to Run

## Quick Start

### Option 1: Command Line (Simplest)

```bash
node example.js
```

This shows working examples of generating different compositions.

### Option 2: Node.js API (Programmatic)

```bash
node -e "
const {generatePiece} = require('./src/main');
const piece = generatePiece({
  form: 'Chorale',
  mode: 'major',
  key: 'C',
  duration: 4
});
console.log(JSON.stringify(piece, null, 2));
"
```

### Option 3: Web Server (Interactive)

```bash
node server/app.js
```

Then open: `http://localhost:3000`

API endpoints:
- `GET /api/generate?form=Chorale&mode=major&key=C&duration=4`
- `GET /api/generate?form=Prelude&mode=minor&key=D&duration=2`
- `GET /api/vsco/status` → `{ available }` (VSCO 2 CE samples found in carrilion's soundfonts)
- `GET /api/vsco/articulation?instrument=Violin&articulation=Spiccato` → sample map and
  velocity layers of one articulation. Each sample/layer may carry `alts`: the other
  round-robin takes of that note found on disk (`_rr1/_rr2`, `_RR1/_RR2`, `_1/_2`).

The player alternates those takes on every short (staccato/pizzicato) sample and on
repeated notes of sustained ones, matching each take's level to the main one (peak
100 ms RMS of the mono sum); takes more than 6 dB away are another dynamic and are not
used. Checks in the browser console: `BachPlayer.roundRobinStats()` (takes played per
voice and articulation), `BachPlayer.articulationStats()`; `setRoundRobins(false)` turns
them off for the next piece (A/B tests).

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
node -e "const {generatePiece} = require('./src/main'); console.log(JSON.stringify(generatePiece({form: 'Chorale', mode: 'major', key: 'C', duration: 4}), null, 2));"
```

### Generate a D Minor Prelude (3 bars)
```bash
node -e "const {generatePiece} = require('./src/main'); console.log(JSON.stringify(generatePiece({form: 'Prelude', mode: 'minor', key: 'D', duration: 3}), null, 2));"
```

### Generate a G Major Gigue (2 bars, with dotted rhythms)
```bash
node -e "const {generatePiece} = require('./src/main'); console.log(JSON.stringify(generatePiece({form: 'Gigue', mode: 'major', key: 'G', duration: 2}), null, 2));"
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
- The API server is stateless and can handle concurrent requests
