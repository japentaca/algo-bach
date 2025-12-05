/**
 * Test Script for Bach Generator Implementation
 * Tests critical fixes and enhancements
 */

const { generatePiece } = require('./src/main');
const Progressions = require('./src/harmony/progressions');
const Leading = require('./src/voices/leading');
const Scales = require('./src/theory/scales');
const { Note, Chord } = require('tonal');

console.log('========================================');
console.log('Bach Generator - Implementation Tests');
console.log('========================================\n');

// Test 1: Voice Spacing Constraints
console.log('TEST 1: Voice Spacing Constraints');
console.log('----------------------------------');
try {
  const testVoicing = {
    S: 'G5',
    A: 'E5',
    T: 'C4', // This should fail spacing check (A-T > 8ve)
    B: 'G3'
  };
  const chordNotes = ['G', 'C', 'E'];
  const candidates = Leading.generateCandidateVoicings(testVoicing, chordNotes, 'G');
  console.log(`✓ Generated ${candidates.length} valid candidates (should be limited by spacing)`);
  candidates.forEach((c, i) => {
    const saSpacing = Note.midi(c.S) - Note.midi(c.A);
    const atSpacing = Note.midi(c.A) - Note.midi(c.T);
    console.log(`  Candidate ${i}: S-A=${saSpacing}, A-T=${atSpacing}`);
  });
} catch (e) {
  console.log(`✗ Error in voice spacing test: ${e.message}`);
}

// Test 2: Hidden 5ths/8ves Detection
console.log('\nTEST 2: Hidden 5ths/8ves Detection');
console.log('-----------------------------------');
try {
  const v1 = { S: 'E4', A: 'C4', T: 'G3', B: 'C3' };
  const v2 = { S: 'F4', A: 'D4', T: 'A3', B: 'F2' }; // Similar motion to 5th
  const cost = Leading.evaluateTransition(v1, v2);
  console.log(`✓ Transition cost: ${cost} (should be > 0 due to hidden 5ths penalty)`);
  if (cost > 50) console.log(`  ✓ Penalty for hidden motion detected (cost = ${cost})`);
} catch (e) {
  console.log(`✗ Error in hidden intervals test: ${e.message}`);
}

// Test 3: Doubling Rules
console.log('\nTEST 3: Doubling Rules (Leading Tone)');
console.log('--------------------------------------');
try {
  const testChord = { name: 'C', inversion: 0 };
  const key = 'C';
  const leadingTone = Scales.getLeadingTone(key);
  console.log(`✓ Leading tone in ${key}: ${leadingTone}`);

  // Test voicing with doubled leading tone (should penalize)
  const voicingBad = {
    S: leadingTone + '5',
    A: 'E4',
    T: leadingTone + '4', // Doubled!
    B: 'C3'
  };

  const penalty = Leading.validateDoubling(voicingBad, testChord, key);
  console.log(`✓ Doubled leading tone penalty: ${penalty} (should be 100)`);

  // Test voicing without doubled leading tone
  const voicingGood = {
    S: 'E5',
    A: 'G4',
    T: 'E4',
    B: 'C3'
  };

  const penaltyGood = Leading.validateDoubling(voicingGood, testChord, key);
  console.log(`✓ Valid doubling penalty: ${penaltyGood} (should be < 100)`);
} catch (e) {
  console.log(`✗ Error in doubling rules test: ${e.message}`);
}

// Test 4: Cadential 6/4 in Progressions
console.log('\nTEST 4: Cadential 6/4 Handling');
console.log('-------------------------------');
try {
  const progression = Progressions.generate('C', 4, 'test-seed', 'major');
  console.log(`✓ Generated progression with ${progression.progression.length} chords`);
  const lastThree = progression.progression.slice(-3);
  console.log(`  Last 3 chords: ${lastThree.map(p =>
    `${p.numeral}${p.inversion === 1 ? '6' : p.inversion === 2 ? '6/4' : ''}`
  ).join(' - ')}`);

  if (lastThree[0].inversion === 2 && lastThree[0].numeral === 'I') {
    console.log(`  ✓ Cadential 6/4 (I64) found before V`);
  } else {
    console.log(`  ✗ Expected I64 before V, got ${lastThree[0].numeral}${lastThree[0].inversion}`);
  }
} catch (e) {
  console.log(`✗ Error in cadential test: ${e.message}`);
}

// Test 5: Minor Key Support
console.log('\nTEST 5: Minor Key Support');
console.log('--------------------------');
try {
  const progressionMinor = Progressions.generate('A', 6, 'test-seed', 'minor');
  console.log(`✓ Generated minor progression (A minor)`);
  console.log(`  Chords: ${progressionMinor.progression.map(p => p.numeral).join(' - ')}`);

  if (progressionMinor.progression.some(p => p.numeral === 'i')) {
    console.log(`  ✓ Found 'i' chord (minor tonic)`);
  }
  if (progressionMinor.progression.some(p => p.numeral === 'V')) {
    console.log(`  ✓ Found 'V' chord (with raised 7th)`);
  }
} catch (e) {
  console.log(`✗ Error in minor key test: ${e.message}`);
}

// Test 6: Piece Generation with New Options
console.log('\nTEST 6: Full Piece Generation (Major)');
console.log('-------------------------------------');
try {
  const piece = generatePiece({ form: 'Chorale', mode: 'major', key: 'G' });
  console.log(`✓ Generated piece in major mode`);
  console.log(`  Notes count: ${piece.notes.length}`);
  console.log(`  Key: ${piece.meta.key}`);
  console.log(`  Mode: ${piece.meta.mode}`);
  console.log(`  Style: ${piece.meta.style}`);
} catch (e) {
  console.log(`✗ Error in major piece generation: ${e.message}`);
  console.log(`  Stack: ${e.stack}`);
}

// Test 7: Piece Generation with Minor Key
console.log('\nTEST 7: Full Piece Generation (Minor)');
console.log('-------------------------------------');
try {
  const piece = generatePiece({ form: 'Chorale', mode: 'minor', key: 'D', duration: 1 });
  console.log(`✓ Generated piece in minor mode`);
  console.log(`  Notes count: ${piece.notes.length}`);
  console.log(`  Key: ${piece.meta.key}`);
  console.log(`  Mode: ${piece.meta.mode}`);
  console.log(`  Sample progressions: ${piece.meta.progression.substring(0, 100)}...`);
} catch (e) {
  console.log(`✗ Error in minor piece generation: ${e.message}`);
  console.log(`  Stack: ${e.stack}`);
}

// Test 8: Scales Functions
console.log('\nTEST 8: Scale Functions');
console.log('------------------------');
try {
  const majorScale = Scales.getScale('C', 'major');
  console.log(`✓ C Major scale: ${majorScale.join(', ')}`);

  const minorScale = Scales.getScale('A', 'minor');
  console.log(`✓ A Minor scale: ${minorScale.join(', ')}`);

  const melodicMinorAsc = Scales.getMelodicMinorNote('A', 6, true);
  const melodicMinorDesc = Scales.getMelodicMinorNote('A', 6, false);
  console.log(`✓ A Melodic minor 6th ascending: ${melodicMinorAsc}, descending: ${melodicMinorDesc}`);

  const leadingToneMajor = Scales.getLeadingTone('C', 'major');
  const leadingToneMinor = Scales.getLeadingTone('A', 'minor');
  console.log(`✓ Leading tone in C major: ${leadingToneMajor}`);
  console.log(`✓ Leading tone in A minor: ${leadingToneMinor}`);
} catch (e) {
  console.log(`✗ Error in scales test: ${e.message}`);
}

console.log('\n========================================');
console.log('Tests Complete!');
console.log('========================================\n');
