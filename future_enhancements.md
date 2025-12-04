# Bach Generator - Future Enhancements & Corrections

## Project Context
Node.js algorithmic composition system generating baroque-style SATB music. Uses `tonal` library for music theory. Entry point: `src/main.js` → `Planner.generate()`.

---

## CRITICAL FIXES (Implement First)

### 1. Hidden/Direct 5ths and 8ves Detection
**File:** `src/voices/leading.js` → `evaluateTransition()`

Current code only detects parallel motion to perfect intervals. Must also penalize **similar motion** arriving at P5/P8:
```javascript
if (motion === 'similar' && Rules.isPerfectFifthOrOctave(intervalNew.simple)) {
  cost += 50; // Hidden 5ths/8ves penalty
}
```

### 2. Voice Spacing Constraints
**File:** `src/voices/leading.js` → `generateCandidateVoicings()`

Add validation: S-A ≤ 8ve, A-T ≤ 8ve. Bass can exceed octave from tenor.
```javascript
// After voice crossing check, add:
const saSpacing = Note.midi(s) - Note.midi(a);
const atSpacing = Note.midi(a) - Note.midi(t);
if (saSpacing > 12 || atSpacing > 12) continue; // Skip invalid spacing
```

### 3. Doubling Rules
**File:** `src/voices/leading.js`

Create new function `validateDoubling(voicing, chordData, key)`:
- Count occurrences of each pitch class in SATB
- **FORBIDDEN:** Doubling leading tone (get via `Scales.getLeadingTone(key)`)
- **PREFERRED:** Double root in root position, soprano in first inversion
- Return penalty score for cost function

### 4. Tendency Tone Resolution
**File:** `src/voices/leading.js` → `evaluateTransition()`

Track and enforce:
- Leading tone (scale degree 7) → must resolve UP to tonic
- Chordal 7th → must resolve DOWN by step
- Add check: if `prevVoicing` contains leading tone in any voice, `nextVoicing` same voice must be tonic

Implementation:
```javascript
// In evaluateTransition, after parallel check:
const leadingTone = Scales.getLeadingTone(key);
['S','A','T','B'].forEach(voice => {
  if (Note.pitchClass(v1[voice]) === leadingTone) {
    const expectedResolution = Note.transpose(leadingTone, '2m'); // or tonic
    if (Note.pitchClass(v2[voice]) !== expectedResolution) {
      cost += 100; // Unresolved leading tone
    }
  }
});
```
**Requires:** Pass `key` parameter through to `evaluateTransition()`.

### 5. Cadential 6/4 Handling
**File:** `src/harmony/progressions.js`

Current inversion logic allows I64 randomly. Fix:
- I64 should ONLY appear immediately before V in cadences
- Modify cadence generation (lines ~74-77):
```javascript
// Force Authentic Cadence: I64 - V - I
progression.push({ numeral: 'I', inversion: 2 }); // Cadential 6/4
progression.push({ numeral: 'V', inversion: 0 });
progression.push({ numeral: 'I', inversion: 0 });
```

### 6. Minor Key Support
**Files:** Multiple

A. `src/harmony/progressions.js`:
- Add `mode` parameter to `generate(key, length, seed, mode='major')`
- Use different numeral set for minor: `i, ii°, III, iv, V, VI, vii°`
- Force raised 7th on V chord (use harmonic minor)

B. `src/composition/planner.js`:
- Pass mode through options
- Select scale based on mode for motif generation

C. `src/theory/scales.js`:
- Already has `getMelodicMinorNote()` - integrate it into melodic generation

D. `src/voices/melodic.js`:
- Use `Scales.getMelodicMinorNote()` for passing tones in minor keys

---

## MODERATE FIXES

### 7. Remove Redundant Transform.js
**File:** `src/composition/transform.js`

This file is a non-functional placeholder. `Motif` class already implements all transformations. Either:
- DELETE `transform.js` entirely
- OR make it call `Motif` methods

### 8. Seventh Chords
**File:** `src/harmony/progressions.js`

Add to `FUNCTIONS`:
```javascript
DOMINANT: ['V', 'V7', 'vii°', 'vii°7']
```

**File:** `src/voices/leading.js`:
- Handle 4-note chords in voicing (one voice may not have chord tone, or double less)
- Add 7th resolution rule (7th of chord resolves DOWN by step)

### 9. Cadence Variety
**File:** `src/harmony/progressions.js`

Add cadence types:
```javascript
const CADENCES = {
  PAC: [{ numeral: 'V', inv: 0 }, { numeral: 'I', inv: 0 }], // Perfect Authentic
  IAC: [{ numeral: 'V', inv: 0 }, { numeral: 'I', inv: 1 }], // Imperfect
  HC: [{ numeral: 'I', inv: 0 }, { numeral: 'V', inv: 0 }],  // Half
  DC: [{ numeral: 'V', inv: 0 }, { numeral: 'vi', inv: 0 }], // Deceptive
  PC: [{ numeral: 'iv6', inv: 1 }, { numeral: 'V', inv: 0 }] // Phrygian (minor only)
};
```
Select based on section type and mode.

### 10. Motif-Harmony Synchronization
**File:** `src/composition/planner.js` → `realizeSection()`

Current motif overlay (lines 95-102) can create dissonances. Fix:
```javascript
// Before overriding soprano with motif:
const motifPitchClass = Note.pitchClass(activeMotif.notes[index]);
const chordNotes = Chord.get(progression[index].name).notes;
if (!chordNotes.includes(motifPitchClass)) {
  // Motif note is non-chord tone - mark as passing/neighbor or skip
  continue;
}
voicing.S = activeMotif.notes[index];
```

### 11. Fugue Implementation
**File:** `src/composition/planner.js`

For `section.type === 'Fugue-Exposition'`:
1. Subject = primary motif in tonic
2. Answer = transpose subject to dominant (P5 up), apply tonal adjustments if needed
3. Countersubject = new motif that works as counterpoint to subject
4. Entry order: S→A→T→B or reverse

Create new method `realizeFugueExposition(section, motif, key)`.

### 12. Rhythmic Variety
**File:** `src/composition/planner.js` and `src/voices/melodic.js`

Current: all notes `"2n"`. Add:
```javascript
const RHYTHMIC_PATTERNS = {
  chorale: ['2n', '2n', '2n', '2n'],
  prelude: ['8n', '8n', '8n', '8n', '4n', '4n'],
  gigue: ['4n.', '8n', '4n.', '8n'] // compound meter
};
```
Apply pattern based on form type.

### 13. Additional Ornaments
**File:** `src/voices/melodic.js`

Add functions:
- `addNeighborTones(notes, key)` - approach by step, return by step
- `addAppoggiatura(notes, key)` - accented non-chord tone resolving by step
- `add76Suspension(notes, progression, key)` - common in baroque
- `add98Suspension(notes, progression, key)`

---

## ENHANCEMENTS (New Features)

### 14. Key Selection UI
**File:** `public/index.html`

Add dropdowns:
```html
<select id="keySelect">
  <option value="C">C</option>
  <!-- All 12 keys -->
</select>
<select id="modeSelect">
  <option value="major">Major</option>
  <option value="minor">Minor</option>
</select>
```

**File:** `public/player.js` - pass to API
**File:** `server/app.js` - forward to generator
**File:** `src/composition/planner.js` - use in generation

### 15. Phrase Structure
**File:** `src/composition/structure.js`

Add phrase-level structure:
```javascript
// Each section contains phrases
generatePhrases(section) {
  const phrases = [];
  const phraseLengths = [4, 4]; // 4-bar antecedent + 4-bar consequent
  // Half cadence at end of antecedent, PAC at end of consequent
  return phrases;
}
```

### 16. Sequence Generation
**File:** `src/harmony/progressions.js`

Add common baroque sequences:
```javascript
const SEQUENCES = {
  descendingFifths: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
  ascending5ths6ths: ['I', 'V6', 'vi', 'iii6', 'IV', 'I6', 'ii', 'V']
};
```

### 17. MIDI/MusicXML Export
**New file:** `src/export/midi.js`

Use `jsmidgen` or `midi-writer-js` package:
```javascript
exportToMidi(notes) {
  // Convert note objects to MIDI file
  // Return buffer or save to file
}
```

### 18. Validation/Scoring System
**New file:** `src/analysis/validator.js`

Score generated output against rules:
```javascript
validatePiece(notes, progression, key) {
  let score = 100;
  score -= countParallelFifths(notes) * 10;
  score -= countUnresolvedLeadingTones(notes, key) * 5;
  score -= countVoiceCrossings(notes) * 3;
  return { score, violations: [...] };
}
```

---

## FILE CHANGE SUMMARY

| File | Changes |
|------|---------|
| `src/voices/leading.js` | Hidden 5ths, spacing, doubling, tendency tones |
| `src/harmony/progressions.js` | Cadential 6/4, minor mode, 7th chords, cadence types, sequences |
| `src/composition/planner.js` | Minor mode, motif sync, fugue, rhythm |
| `src/voices/melodic.js` | More ornaments, minor scale integration |
| `src/theory/scales.js` | Already good, just needs integration |
| `src/composition/structure.js` | Phrase structure |
| `src/composition/transform.js` | DELETE or fix |
| `public/index.html` | Key/mode selection |
| `public/player.js` | Pass new options |
| `server/app.js` | Forward new options |
| NEW: `src/export/midi.js` | MIDI export |
| NEW: `src/analysis/validator.js` | Rule validation |

---

## IMPLEMENTATION ORDER

1. Voice leading fixes (leading.js) - highest impact on theory correctness
2. Minor key support - expands musical vocabulary
3. Seventh chords - essential baroque sound
4. Cadence types - structural correctness
5. Tendency tone resolution - proper counterpoint
6. Rhythmic variety - musical interest
7. Fugue implementation - form authenticity
8. UI enhancements - usability
9. Export features - utility
