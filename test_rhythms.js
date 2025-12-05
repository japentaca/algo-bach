/**
 * Test Suite for Rhythmic Patterns
 */

const Rhythms = require('./src/rhythms/patterns');
const { generatePiece } = require('./src/main');

console.log('========================================');
console.log('Rhythmic Patterns Test');
console.log('========================================\n');

// Test 1: Pattern Availability
console.log('TEST 1: Rhythm Pattern Availability');
console.log('----------------------------------');
try {
  const formTypes = ['chorale', 'prelude', 'gigue', 'allemande', 'courante', 'sarabande', 'minuet', 'fugue', 'passacaglia'];

  formTypes.forEach(form => {
    const pattern = Rhythms.getPattern(form);
    console.log(`✓ ${form.padEnd(15)}: ${pattern.join(' + ')}`);
  });
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 2: Pattern Application
console.log('\nTEST 2: Pattern Application');
console.log('---------------------------');
try {
  const testNotes = [
    { pitch: 'C5', startTime: 0, voice: 0, duration: '2n' },
    { pitch: 'E4', startTime: 0, voice: 1, duration: '2n' },
    { pitch: 'G3', startTime: 0, voice: 2, duration: '2n' },
    { pitch: 'C3', startTime: 0, voice: 3, duration: '2n' }
  ];

  const patterns = ['chorale', 'prelude', 'gigue'];

  patterns.forEach(patternType => {
    const pattern = Rhythms.getPattern(patternType);
    const applied = Rhythms.applyRhythms(testNotes, pattern);

    const durations = [...new Set(applied.map(n => n.duration))];
    console.log(`✓ ${patternType}: Applied ${applied.length} notes with durations [${durations.join(', ')}]`);
  });
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 3: Augmentation
console.log('\nTEST 3: Rhythmic Augmentation');
console.log('-----------------------------');
try {
  const basePattern = ['8n', '8n', '4n', '4n'];
  const augmented = Rhythms.augment(basePattern);

  console.log(`✓ Base:      [${basePattern.join(', ')}]`);
  console.log(`✓ Augmented: [${augmented.join(', ')}]`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 4: Diminution
console.log('\nTEST 4: Rhythmic Diminution');
console.log('---------------------------');
try {
  const basePattern = ['2n', '2n', '4n', '4n'];
  const diminished = Rhythms.diminish(basePattern);

  console.log(`✓ Base:      [${basePattern.join(', ')}]`);
  console.log(`✓ Diminished: [${diminished.join(', ')}]`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 5: Syncopation
console.log('\nTEST 5: Syncopation');
console.log('-------------------');
try {
  const basePattern = ['4n', '4n', '2n', '2n'];
  const syncopated = Rhythms.syncope(basePattern);

  console.log(`✓ Base:       [${basePattern.join(', ')}]`);
  console.log(`✓ Syncopated: [${syncopated.join(', ')}]`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 6: Piece Generation with Different Forms
console.log('\nTEST 6: Piece Generation with Form-Specific Rhythms');
console.log('----------------------------------------------------');
try {
  const forms = ['Chorale', 'Prelude'];

  forms.forEach(form => {
    try {
      const piece = generatePiece({ form: form, mode: 'major', key: 'C', duration: 1 });

      // Analyze rhythms
      const rhythmTypes = new Set(piece.notes.map(n => n.duration));
      const rhythmArray = Array.from(rhythmTypes).sort();

      console.log(`✓ ${form}: ${piece.notes.length} notes with rhythms [${rhythmArray.join(', ')}]`);
    } catch (e) {
      console.log(`✗ ${form}: ${e.message}`);
    }
  });
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 7: Voice-Specific Rhythms
console.log('\nTEST 7: Voice-Specific Rhythm Generation');
console.log('----------------------------------------');
try {
  const form = 'chorale';
  const barCount = 4;

  for (let voice = 0; voice < 4; voice++) {
    const voiceRhythms = Rhythms.generateVoiceRhythms(form, barCount, voice);
    const voiceNames = ['Soprano', 'Alto', 'Tenor', 'Bass'];
    console.log(`✓ ${voiceNames[voice]}: ${voiceRhythms.length} rhythm values generated`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 8: Rhythm Consistency
console.log('\nTEST 8: Rhythm Consistency');
console.log('--------------------------');
try {
  let allConsistent = true;

  const formTypes = Object.keys(Rhythms.PATTERNS);
  formTypes.forEach(form => {
    const pattern = Rhythms.PATTERNS[form];
    // Each duration should be a valid tonal.js duration string
    pattern.forEach(duration => {
      if (!['2n', '4n', '8n', '16n', '2n.', '4n.', '8n.'].includes(duration)) {
        allConsistent = false;
        console.log(`✗ Invalid duration in ${form}: ${duration}`);
      }
    });
  });

  if (allConsistent) {
    console.log(`✓ All rhythm patterns use valid durations`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

console.log('\n========================================');
console.log('Rhythmic Pattern Tests Complete!');
console.log('========================================\n');
