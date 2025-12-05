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

## Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `form` | "Chorale", "Prelude", "Gigue", "Allemande", "Courante", "Sarabande", "Minuet", "Fugue", "Passacaglia" | "Chorale" | Musical form type (affects rhythm) |
| `mode` | "major", "minor" | "major" | Major or minor tonality |
| `key` | C, D, E, F, G, A, B, C#, Db, etc. | "C" | Tonic pitch class |
| `duration` | 1-8 (recommended) | 2 | Number of bars to generate |

## Output Format

```javascript
{
  notes: [
    { pitch: "C5", duration: "2n", startTime: 0, voice: 0 },
    { pitch: "G4", duration: "2n", startTime: 0, voice: 1 },
    // ... more notes
  ],
  meta: {
    key: "C",
    mode: "major",
    form: "Chorale",
    style: "Baroque Chorale",
    progression: "I - I6/4 - V - I"
  }
}
```

### Note Fields:
- `pitch`: Scientific pitch notation (C4 = middle C)
- `duration`: Note length ("2n" = half note, "4n" = quarter note, "8n" = eighth note)
- `startTime`: Offset in quarter notes
- `voice`: 0=Soprano, 1=Alto, 2=Tenor, 3=Bass

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
# All tests (54 tests total)
node test_integration.js
node test_implementation.js
node test_seventh_chords.js
node test_ornaments.js
node test_rhythms.js
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

```
src/
├── main.js                 # Entry point
├── composition/
│   └── planner.js         # Orchestrates generation
├── harmony/
│   └── progressions.js    # Chord progression generation
├── voices/
│   ├── leading.js         # Voice leading rules
│   ├── melodic.js         # Ornamentation
│   └── allocator.js       # Voice range management
├── theory/
│   ├── rules.js           # Music theory rules
│   └── scales.js          # Scale utilities
└── rhythms/
    └── patterns.js        # Rhythmic patterns

server/
├── app.js                 # Express web server
└── public/
    ├── index.html         # Web interface
    └── player.js          # Client logic
```

## Performance

Generation typically completes in:
- 2-bar piece: ~50ms
- 4-bar piece: ~80ms
- 8-bar piece: ~150ms

## Notes

- The system uses deterministic generation based on seed values
- Each generation is reproducible with the same parameters and seed
- The API server is stateless and can handle concurrent requests
