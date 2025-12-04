# Bach-Style Music Generator - Implementation Guide

## Project Overview
Node.js system that generates baroque-style music based on music theory literature, outputting arrays of note objects.

## Output Format
All generators return arrays of note objects:
```javascript
{
  pitch: 60,        // MIDI number (0-127) or Note Name (e.g., "C4")
  duration: "4n",   // Tone.js duration notation (e.g., "4n", "2n")
  voice: 0,         // voice index (0-3 for SATB)
  startTime: 2.0,   // absolute time in beats from start
  velocity: 0.8     // dynamics (0-1)
}
```

---

## Module 1: Theory Engine (`src/theory/`)

### `theory/intervals.js`
- Calculate interval between two pitches
- Classify intervals (perfect, major, minor, augmented, diminished)

### `theory/scales.js`
- Generate major/minor scales from root
- Return scale degrees for a given key

### `theory/chords.js`
- Generate triads and seventh chords from root

### `theory/voiceLeading.js` (and `voices/leading.js`)
- **Parallel motion detector** (forbid parallel 5ths and 8ves)
- **Voice range validator** (SATB ranges)

---

## Module 2: Harmonic Framework (`src/harmony/`)

### `harmony/progressions.js`
- **Common progression patterns** (I-IV-V-I, I-vi-IV-V, etc.)
- **Cadence generators**

---

## Module 3: Composition Engine (`src/composition/`)

### `composition/motif.js`
- **Motif Generation**: Creates random motifs within a scale.
- **Transformations**:
    - `invert()`: Melodic inversion.
    - `retrograde()`: Reverse order.
    - `transpose(interval)`: Pitch shift.
    - `mutate()`: Random variation.

### `composition/modulator.js`
- **Harmonic Navigation**:
    - `CircleOfFifths`: Logic for related key selection.
    - `planRoute(startKey, length)`: Generates key journeys for long forms.

### `composition/structure.js`
- **Form Generation**:
    - `Chorale`: Standard AABB.
    - `Prelude`: Exposition, Development, Recapitulation.
    - `Fugue`: Exposition, Episodes, Entries.
    - **Extended Forms**:
        - `Ritornello`: Tutti/Solo alternation.
        - `Variations`: Theme and Variations.
        - `Suite`: Allemande, Courante, Sarabande, Gigue.

### `composition/planner.js`
- **Orchestration**:
    - Integrates Structure, Modulator, and Motif.
    - Handles "Tutti" vs "Solo" textures.
    - Applies voice leading and ornamentation (suspensions, passing tones).

---

## Module 4: Voices & Ornamentation (`src/voices/`)

### `voices/melodic.js`
- **Ornamentation**:
    - `addSuspensions`: Adds 4-3 suspensions at cadences.
    - `addPassingTones`: Fills intervals with passing tones.

---

## Module 5: Frontend & Audio (`public/`)

### `public/index.html`
- User Interface for selecting Form and Duration.

### `public/player.js`
- **Tone.js Integration**: Handles audio playback.
- **Stereo Panning**:
    - Soprano: Right (0.4)
    - Alto: Center-Right (0.15)
    - Tenor: Center-Left (-0.15)
    - Bass: Left (-0.4)
- **Humanization**: Adds slight timing and velocity variations.

---

## Usage

1. Start the server:
   ```bash
   npm start
   ```
2. Open `http://localhost:3000`.
3. Select a Form (e.g., Ritornello) and Duration.
4. Click "Generate & Play".

---

## Implementation Status
- **Stage 1**: Basic Theory & Harmony (Completed)
- **Stage 2**: Voice Leading & Counterpoint (Completed)
- **Stage 3**: Extended Forms & Development (Completed)
    - Implemented Motivic Transformations.
    - Implemented Circle of Fifths Modulation.
    - Implemented Extended Forms (Ritornello, Variations, Suite).
    - Improved Audio (Stereo Panning).

## Future Enhancements
- Style interpolation (blend Bach + Mozart)
- User-provided motifs as input
- Export to MusicXML format