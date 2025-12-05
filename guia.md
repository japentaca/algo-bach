# Bach-Style Music Generator - Implementation Guide

## Project Overview
Node.js system that generates baroque-style SATB music based on music theory literature. Uses the `tonal` library for music theory calculations.

## Output Format
All generators return arrays of note objects:
```javascript
{
  pitch: "C4",      // Note name with octave
  duration: "4n",   // Tone.js duration notation (e.g., "4n", "2n", "1n")
  voice: 0,         // Voice index (0=Soprano, 1=Alto, 2=Tenor, 3=Bass)
  startTime: 2.0,   // Absolute time in beats from start
  type: "passing"   // Optional: "passing", "neighbor", "suspension", "appoggiatura"
}
```

---

## API Reference

### Main Entry Point
```javascript
const Planner = require('./src/composition/planner');
const planner = new Planner();

const piece = planner.generate({
  form: 'Fugue',      // Chorale, Prelude, Fugue, Ritornello, Variations, Suite
  mode: 'minor',      // 'major' or 'minor'
  key: 'D',           // C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
  duration: 30,       // Number of bars
  seed: 'my-seed'     // Optional: for reproducible generation
});
```

### HTTP API
```
GET /api/generate?form=Fugue&mode=minor&key=D&duration=30&seed=optional
```

Returns:
```javascript
{
  notes: [...],
  meta: {
    key: "D",
    mode: "minor",
    form: "Fugue",
    style: "Baroque Fugue",
    progression: "Fugue: Exposition - Episode - Middle Entries - Episode - Stretto - Final Entry"
  }
}
```

---

## Module 1: Theory Engine (`src/theory/`)

### `rules.js`
- `analyzeInterval(note1, note2)`: Returns interval analysis with quality
- `isPerfectFifthOrOctave(interval)`: Checks for parallel-prone intervals
- `analyzeMotion(v1Old, v1New, v2Old, v2New)`: Detects parallel, similar, contrary, oblique motion

### `scales.js`
- `getScale(tonic, type)`: Returns scale notes
- `getMelodicMinorNote(tonic, degree, isAscending)`: Handles raised 6th/7th ascending
- `getLeadingTone(tonic, mode)`: Returns scale degree 7 (raised in minor)

---

## Module 2: Harmonic Framework (`src/harmony/`)

### `progressions.js`

**Chord Functions:**
- Major: `TONIC: [I, vi, iii]`, `SUBDOMINANT: [IV, ii]`, `DOMINANT: [V, V7, vii°, vii°7]`
- Minor: `TONIC: [i, VI, III]`, `SUBDOMINANT: [iv, ii°]`, `DOMINANT: [V, V7, vii°, vii°7]`

**Cadence Types:**
- PAC (Perfect Authentic): I6/4 - V - I
- IAC (Imperfect Authentic): I6/4 - V - I6
- HC (Half Cadence): I - IV - V
- DC (Deceptive Cadence): I6/4 - V - vi
- PC (Phrygian, minor only): iv6 - V - i

**Sequences:**
- `descendingFifths`: I - IV - vii° - iii - vi - ii - V - I
- `ascending5ths6ths`: I - V6 - vi - iii6 - IV - I6 - ii - V
- `descending3rds`: I - vi - IV - ii - vii° - V - I
- `romanesca`: I - V6 - vi - iii6 - IV - I6 - IV - V

---

## Module 3: Composition Engine (`src/composition/`)

### `planner.js`
Main orchestration class with full fugue support:

**Standard Generation:**
- Generates harmonic progressions via `Progressions.generate()`
- Applies voice leading via `Leading.connectChords()`
- Adds ornamentation via `Melodic.addSuspensions()` and `addPassingTones()`

**Fugue Generation (`generateFugue()`):**
1. **Exposition**: Subject in S, Answer in A, Subject in T, Answer in B (staggered)
2. **Episode 1**: Sequential passage using descendingFifths
3. **Middle Entries**: Subject/Answer in relative key
4. **Episode 2**: Sequential passage using ascending5ths6ths
5. **Stretto**: Overlapping entries at 2-beat intervals
6. **Final Entry**: Subject in bass with authentic cadence

**Fugue Methods:**
- `generateSubject(key, mode, rng)`: Creates 4-7 note subject
- `transposeToAnswer(subject, key, mode)`: Tonal answer with 4th/5th mutation
- `generateCountersubject(subject, key, mode, rng)`: Contrary motion accompaniment
- `realizeFugueExposition()`, `realizeFugueEpisode()`, `realizeFugueStretto()`, etc.

---

## Module 4: Voice Leading (`src/voices/`)

### `leading.js`
- `connectChords(progression, rng)`: Connects chords with smooth voice leading
- `evaluateTransition(v1, v2, key, chordData)`: Scores transitions with penalties:
  - Parallel 5ths/8ves: FORBIDDEN (Infinity)
  - Hidden 5ths/8ves: 50 points
  - Unresolved leading tone: 100 points
  - Unresolved 7th: 20 points
- `validateDoubling(voicing, chordData, key)`: Penalizes doubled leading tone (100 points)
- `generateCandidateVoicings()`: Respects spacing constraints (S-A ≤ 8ve, A-T ≤ 8ve)

### `melodic.js`
- `addPassingTones(notes, key, mode)`: Fills thirds with passing tones (melodic minor aware)
- `addSuspensions(notes, progression, key)`: 4-3 suspensions at V-I cadences
- `addNeighborTones(notes, key)`: Step away and return
- `addAppoggiature(notes, progression, key)`: Accented non-chord tones
- `add98Suspension(notes)`: 9-8 suspensions

---

## Module 5: Rhythms (`src/rhythms/`)

### `patterns.js`
Baroque rhythmic patterns:
- `chorale`: ['2n', '2n', '2n', '2n']
- `prelude`: ['8n', '8n', '8n', '8n', '4n', '4n']
- `gigue`: ['4n.', '8n', '4n.', '8n']
- `allemande`: ['4n', '4n', '4n', '4n']
- `courante`: ['8n', '8n', '4n', '8n', '8n', '4n']
- `sarabande`: ['4n', '4n', '4n', '4n']
- `fugue`: ['2n', '2n', '2n', '2n']

**Transformations:**
- `syncope(pattern)`: Shifts rhythms for syncopation
- `augment(pattern)`: Doubles durations
- `diminish(pattern)`: Halves durations

---

## Module 6: Frontend (`public/`)

### `index.html`
User interface with:
- **Key Selection**: C through B (including sharps/flats)
- **Mode Selection**: Major / Minor
- **Form Selection**: Chorale, Prelude, Fugue, Ritornello, Variations, Suite
- **Duration**: Short (~1m), Medium (~3m), Long (~5m)
- **Seed Controls**: Random or reproducible generation

### `player.js`
Tone.js audio playback with:
- **Stereo Panning**: S=Right(0.4), A=Center-Right(0.15), T=Center-Left(-0.15), B=Left(-0.4)
- **Polyphonic Synthesis**: 4 PolySynth instances

---

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Open browser
http://localhost:3000
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (public/)                       │
│   index.html ──▶ player.js ──▶ Tone.js Audio                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server (server/app.js)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Planner (src/composition/)                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ Progressions│───▶│   Leading   │───▶│   Melodic   │        │
│   │  (harmony/) │    │  (voices/)  │    │  (voices/)  │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│          │                  │                  │                 │
│          ▼                  ▼                  ▼                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   Scales    │    │    Rules    │    │   Rhythms   │        │
│   │  (theory/)  │    │  (theory/)  │    │ (rhythms/)  │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```
