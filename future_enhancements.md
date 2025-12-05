# Bach Generator - Enhancement Status & Roadmap

## Project Context
Node.js algorithmic composition system generating baroque-style SATB music. Uses `tonal` library for music theory. Entry point: `src/main.js` → `Planner.generate()`.

---

## ✅ COMPLETED - Critical Fixes

### 1. ✅ Hidden/Direct 5ths and 8ves Detection
**File:** `src/voices/leading.js` → `evaluateTransition()`
- Penalizes similar motion arriving at P5/P8 (cost += 50)

### 2. ✅ Voice Spacing Constraints
**File:** `src/voices/leading.js` → `generateCandidateVoicings()`
- S-A ≤ 8ve, A-T ≤ 8ve validation implemented
- Bass can exceed octave from tenor

### 3. ✅ Doubling Rules
**File:** `src/voices/leading.js` → `validateDoubling()`
- Penalizes doubled leading tone (100 points)
- Prefers doubled root in root position

### 4. ✅ Tendency Tone Resolution
**File:** `src/voices/leading.js` → `evaluateTransition()`
- Leading tone → tonic resolution enforced (penalty 100)
- Uses `Scales.getLeadingTone(key)`

### 5. ✅ Cadential 6/4 Handling
**File:** `src/harmony/progressions.js`
- I64 only appears before V in cadences
- Proper PAC, IAC, HC, DC, PC cadence types

### 6. ✅ Minor Key Support
**Files:** `progressions.js`, `planner.js`, `melodic.js`
- Mode parameter throughout API
- `FUNCTIONS_MINOR` with proper chord functions
- Melodic minor support for passing tones (raised 6th/7th ascending)

---

## ✅ COMPLETED - Moderate Fixes

### 7. ✅ Transform.js Cleanup
- File was already removed/never existed

### 8. ✅ Seventh Chords
**File:** `src/harmony/progressions.js`, `src/voices/leading.js`
- V7 and vii°7 in DOMINANT function
- 7th resolution rule (down by step) in `check7thResolution()`

### 9. ✅ Cadence Variety
**File:** `src/harmony/progressions.js`
- `CADENCE_TYPES`: PAC, IAC, HC, DC
- `CADENCE_MINOR`: PAC, IAC, HC, PC (Phrygian)
- `selectCadence()` method for context-aware selection

### 10. ⏳ Motif-Harmony Synchronization
**File:** `src/composition/planner.js`
- Planned: Validate motif notes against chord tones
- Status: Not yet implemented

### 11. ✅ Fugue Implementation
**File:** `src/composition/planner.js`
- `generateFugue()` - Complete fugue structure
- `generateSubject()` - Algorithmic subject generation
- `transposeToAnswer()` - Tonal answer with 4th/5th mutation
- `generateCountersubject()` - Contrary motion accompaniment
- `realizeFugueExposition()` - S→A→T→B staggered entries
- `realizeFugueEpisode()` - Sequential passages using SEQUENCES
- `realizeMiddleEntries()` - Entries in relative key
- `realizeFugueStretto()` - Overlapping entries at 2-beat intervals
- `realizeFinalEntry()` - Subject in bass with authentic cadence

### 12. ✅ Rhythmic Variety
**File:** `src/rhythms/patterns.js`
- 9 baroque rhythm patterns: chorale, prelude, gigue, allemande, courante, sarabande, minuet, fugue, passacaglia
- `syncope()`, `augment()`, `diminish()` transformations

### 13. ✅ Additional Ornaments
**File:** `src/voices/melodic.js`
- `addNeighborTones()` - approach by step, return by step
- `addAppoggiature()` - accented non-chord tones
- `add98Suspension()` - 9-8 suspensions
- `addSuspensions()` - 4-3 suspensions at cadences
- `addPassingTones()` - with melodic minor support

---

## ✅ COMPLETED - Enhancements

### 14. ✅ Key Selection UI
**Files:** `public/index.html`, `public/player.js`
- Key dropdown: C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
- Mode dropdown: Major, Minor
- API params: `key`, `mode` passed to generator

### 15. ⏳ Phrase Structure
**File:** `src/composition/structure.js`
- Planned: Antecedent/consequent phrase pairs
- Planned: Half cadence at phrase middle, PAC at end
- Status: Not yet implemented

### 16. ✅ Sequence Generation
**File:** `src/harmony/progressions.js`
- `SEQUENCES` constant with 4 patterns:
  - `descendingFifths`: I-IV-vii°-iii-vi-ii-V-I
  - `ascending5ths6ths`: I-V6-vi-iii6-IV-I6-ii-V
  - `descending3rds`: I-vi-IV-ii-vii°-V-I
  - `romanesca`: I-V6-vi-iii6-IV-I6-IV-V
- `generateSequence(key, type, mode, repetitions)` method

### 17. ⏳ MIDI/MusicXML Export
- Planned: Export to MIDI file
- Status: Not yet implemented

### 18. ⏳ Validation/Scoring System
- Planned: Score output against counterpoint rules
- Planned: Count violations and provide quality score
- Status: Not yet implemented

---

## API Reference

### Planner.generate(options)
```javascript
const piece = planner.generate({
  form: 'Chorale',    // Chorale, Prelude, Fugue, Ritornello, Variations, Suite
  mode: 'major',      // 'major' or 'minor'
  key: 'C',           // C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
  duration: 2,        // Number of bars
  seed: 'optional'    // For reproducible generation
});
```

### Progressions.generate(key, length, seed, mode, cadenceType)
```javascript
const data = Progressions.generate('C', 8, 'seed', 'major', 'PAC');
// Returns: { progression: [...], cadenceUsed: 'PAC', rng: seedrandom }
```

### Progressions.generateSequence(key, sequenceType, mode, repetitions)
```javascript
const chords = Progressions.generateSequence('C', 'descendingFifths', 'major', 1);
// Returns: Array of chord objects
```

---

## File Summary

| File | Status | Features |
|------|--------|----------|
| `src/voices/leading.js` | ✅ Complete | Hidden 5ths, spacing, doubling, tendency tones, 7th resolution |
| `src/harmony/progressions.js` | ✅ Complete | Minor mode, 7th chords, cadences, sequences |
| `src/composition/planner.js` | ✅ Complete | Full fugue system, mode support |
| `src/voices/melodic.js` | ✅ Complete | All ornaments, melodic minor integration |
| `src/rhythms/patterns.js` | ✅ Complete | 9 baroque patterns with transformations |
| `src/theory/scales.js` | ✅ Complete | Major, minor, melodic minor, leading tone |
| `public/index.html` | ✅ Complete | Key/mode selection UI |
| `public/player.js` | ✅ Complete | Passes key/mode to API |

---

## Remaining Work

1. **Motif-Harmony Synchronization** - Validate motif notes against chord tones
2. **Phrase Structure** - Antecedent/consequent with appropriate cadences
3. **MIDI Export** - Export generated pieces to MIDI files
4. **Validation System** - Quality scoring and rule violation detection
