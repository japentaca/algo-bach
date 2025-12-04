# Bach-Style Music Generator - Implementation Plan

## Project Overview
Node.js system that generates baroque-style music based on music theory literature, outputting arrays of note objects.

## Output Format
All generators return arrays of note objects:
```javascript
{
  pitch: 60,        // MIDI number (0-127)
  duration: 0.5,    // in beats (quarter note = 1.0)
  voice: 0,         // voice index (0-3 for SATB)
  startTime: 2.0,   // absolute time in beats from start
  velocity: 80      // dynamics (0-127), optional
}
```

---

## Module 1: Theory Engine (`theory/`)

### `theory/intervals.js`
- Calculate interval between two pitches
- Classify intervals (perfect, major, minor, augmented, diminished)
- Check if interval is consonant/dissonant
- Interval inversion calculations

### `theory/scales.js`
- Generate major/minor scales from root
- Return scale degrees for a given key
- Modal scales (Dorian, Phrygian, etc.)
- Chromatic alterations (raised leading tone in minor)

### `theory/chords.js`
- Generate triads and seventh chords from root
- Roman numeral analysis
- Chord quality identification
- Voice leading distance calculator

### `theory/voiceLeading.js`
- **Parallel motion detector** (forbid parallel 5ths and 8ves)
- **Contrary motion checker**
- **Voice range validator** (SATB ranges)
- **Voice crossing detector**
- **Leap resolution rules** (large leaps should reverse direction)
- **Tendency tone resolution** (leading tone to tonic, 7th down by step)

### `theory/counterpoint.js`
- **Species counterpoint rules** (1st through 4th species)
- **Consonance/dissonance treatment**
- **Passing tone, neighbor tone, suspension rules**
- **Cantus firmus validator**
- **Two-voice counterpoint checker**

---

## Module 2: Harmonic Framework (`harmony/`)

### `harmony/progressions.js`
- **Common progression patterns** (I-IV-V-I, I-vi-IV-V, etc.)
- **Functional harmony rules** (tonic, subdominant, dominant)
- **Cadence generators**:
  - Authentic (V-I, V7-I)
  - Plagal (IV-I)
  - Half (anything-V)
  - Deceptive (V-vi)
- **Sequence patterns** (descending 5ths, ascending 2nds)
- **Modulation rules** (to dominant, relative major/minor)

### `harmony/figuredBass.js`
- Parse figured bass notation (6, 6/4, 7, etc.)
- Generate chord voicings from figured bass
- Resolution rules for suspensions (4-3, 7-6, 9-8)
- Doubling rules (double root in root position, etc.)

### `harmony/choraleHarmonization.js`
- Four-part harmonization of soprano melody
- Chord choice based on melody notes
- Apply voice leading rules
- Cadence placement strategy

---

## Module 3: Voice Generator (`voices/`)

### `voices/melodicLine.js`
- Generate melodic contour (arch shape, waves)
- Apply step/leap balance (prefer steps, limit consecutive leaps)
- Melodic peak placement (golden ratio)
- Return to tonic strategies
- Sequence repetition

### `voices/rhythmGenerator.js`
- Generate rhythmic patterns based on meter
- Baroque rhythm vocabulary (dotted rhythms, suspensions)
- Syncopation rules
- Phrase rhythm (strong beats, weak beats)
- Cadential rhythm formulas

### `voices/ornamentation.js`
- Trill patterns
- Turn and mordent insertion
- Appoggiatura rules
- Passing tones and neighbor tones
- Anticipation

---

## Module 4: Compositional Strategies (`strategies/`)

### `strategies/fugue.js`
- **Subject generation** (5-8 notes, strong tonal identity)
- **Answer generation** (tonal answer with mutations)
- **Countersubject creation** (complementary rhythm)
- **Exposition structure** (subject entries in all voices)
- **Episode generation** (sequences, fragmentation)
- **Stretto planning** (overlapping subject entries)
- **Final cadence with subject**

### `strategies/chorale.js`
- **Four phrases structure** (typically 8 bars each)
- **Fermata placements** (end of each phrase)
- **Soprano melody as cantus firmus**
- **Harmonization with functional bass**
- **Cadence at each phrase end**
- **Simple note-against-note texture**

### `strategies/invention.js`
- **Two-voice texture**
- **Motif-based development**
- **Imitation between voices**
- **Sequence patterns**
- **Binary form** (modulation to dominant, return to tonic)

### `strategies/prelude.js`
- **Arpeggiated or scalar patterns**
- **Single texture maintained throughout**
- **Harmonic progression as skeleton**
- **Improvisatory feel with consistent figuration**
- **Free form or through-composed**

---

## Module 5: Stochastic Engine (`stochastic/`)

### `stochastic/decisionMaker.js`
- **Weighted random selection** from valid options
- **Temperature parameter** (0 = deterministic, 1 = creative)
- **Constraint satisfaction** (hard rules vs soft preferences)
- **Backtracking** when no valid options exist
- **Markov chain** for melodic continuation probabilities

### `stochastic/probabilityTables.js`
- **Interval probability matrices** (Bach tends toward steps)
- **Rhythm probability distributions** (longer notes on strong beats)
- **Chord transition probabilities** (from corpus analysis)
- **Cadence approach probabilities**
- **Leap resolution tendencies**

---

## Module 6: Main Generator (`generator.js`)

### Core Functions:

#### `generatePiece(options)`
Main entry point. Options include:
```javascript
{
  style: 'fugue' | 'chorale' | 'invention' | 'prelude',
  key: 'C' | 'Dm' | etc.,
  timeSignature: '4/4' | '3/4' | '6/8',
  length: 32,  // bars
  voices: 4,    // number of voices
  temperature: 0.7,  // creativity (0-1)
  seed: 12345  // for reproducibility
}
```

#### `validateOutput(noteArray)`
- Check all voice leading rules
- Verify no parallel 5ths/8ves
- Confirm ranges respected
- Validate harmonic progression

#### `postProcess(noteArray)`
- Add dynamics contour
- Insert ornaments sparingly
- Adjust durations for humanization
- Add articulation hints

---

## Module 7: Utilities (`utils/`)

### `utils/musicMath.js`
- MIDI note to frequency
- Note name to MIDI number
- Beat to millisecond conversion
- Transpose functions

### `utils/validation.js`
- Range checkers
- Rule violation reporters
- Debug output formatters

### `utils/logger.js`
- Compositional decision logging
- Rule application tracking
- Performance metrics

---

## Implementation Phases

### Phase 1: Foundation (Core Theory)
1. Implement `theory/intervals.js`
2. Implement `theory/scales.js`
3. Implement `theory/chords.js`
4. Write tests for music theory basics

### Phase 2: Voice Leading Rules
1. Implement `theory/voiceLeading.js`
2. Implement `theory/counterpoint.js`
3. Test with simple two-voice examples

### Phase 3: Harmonic Framework
1. Implement `harmony/progressions.js`
2. Implement `harmony/figuredBass.js`
3. Test chord progression generation

### Phase 4: Simple Strategy (Chorale)
1. Implement `strategies/chorale.js`
2. Integrate with harmony and voice leading
3. Generate first complete pieces

### Phase 5: Stochastic Layer
1. Implement `stochastic/decisionMaker.js`
2. Implement `stochastic/probabilityTables.js`
3. Add variation to output

### Phase 6: Additional Strategies
1. Implement `strategies/invention.js`
2. Implement `strategies/fugue.js` (most complex)
3. Implement `strategies/prelude.js`

### Phase 7: Polish
1. Add ornamentation
2. Implement validation and post-processing
3. Optimize performance
4. Add comprehensive documentation

---

## Dependencies (Suggested)

```json
{
  "dependencies": {
    "seedrandom": "^3.0.5"  // For reproducible randomness
  },
  "devDependencies": {
    "jest": "^29.0.0",      // Testing framework
    "eslint": "^8.0.0"      // Code quality
  }
}
```

---

## Testing Strategy

### Unit Tests
- Each theory module independently
- Voice leading rule validation
- Interval calculations
- Chord generation

### Integration Tests
- Two-voice counterpoint generation
- Four-voice chorale generation
- Complete piece validation

### Musical Tests (Manual Review)
- Listen to generated pieces
- Verify stylistic authenticity
- Check for rule violations
- Assess musical coherence

---

## Example Usage

```javascript
const { generatePiece } = require('./generator');

const piece = generatePiece({
  style: 'chorale',
  key: 'C',
  timeSignature: '4/4',
  length: 16,
  voices: 4,
  temperature: 0.6,
  seed: 42
});

console.log(piece);
// Returns array of note objects ready for playback
```

---

## Future Enhancements
- Style interpolation (blend Bach + Mozart)
- User-provided motifs as input
- Real-time generation with constraints
- Machine learning integration for probability tables
- Export to MusicXML format
- Multi-movement forms (suite, sonata)