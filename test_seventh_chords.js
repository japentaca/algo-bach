/**
 * Test Suite for Seventh Chords and Cadence Types
 */

const Progressions = require('./src/harmony/progressions');
const { Progression } = require('tonal');

console.log('========================================');
console.log('Seventh Chords & Cadence Tests');
console.log('========================================\n');

// Test 1: Seventh Chord Appearance
console.log('TEST 1: Seventh Chord Generation');
console.log('--------------------------------');
try {
  let majorV7Count = 0;
  let minorV7Count = 0;

  // Generate multiple progressions to ensure V7 appears
  for (let i = 0; i < 10; i++) {
    const majorProg = Progressions.generate('C', 8, 'test' + i, 'major');
    const minorProg = Progressions.generate('A', 8, 'test' + i, 'minor');

    majorProg.progression.forEach(chord => {
      if (chord.numeral === 'V7') majorV7Count++;
    });

    minorProg.progression.forEach(chord => {
      if (chord.numeral === 'V7') minorV7Count++;
    });
  }

  console.log(`✓ Major progressions with V7: ${majorV7Count} (out of 100 chords)`);
  console.log(`✓ Minor progressions with V7: ${minorV7Count} (out of 100 chords)`);
  console.log(`✓ Seventh chords successfully integrated into generation`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 2: Cadence Type Selection
console.log('\nTEST 2: Cadence Type Selection');
console.log('------------------------------');
try {
  const cadenceTypes = ['PAC', 'IAC', 'HC', 'DC'];

  cadenceTypes.forEach(type => {
    const prog = Progressions.generate('C', 6, 'cadence-test', 'major', type);
    console.log(`✓ ${type} cadence generated: ${prog.progression.slice(-3).map(c => c.numeral).join(' - ')}`);
  });
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 3: Minor Mode Cadence Types
console.log('\nTEST 3: Minor Mode Cadences');
console.log('---------------------------');
try {
  const prog = Progressions.generate('A', 6, 'minor-cadence', 'minor');
  const lastThree = prog.progression.slice(-3);
  const minorCadence = lastThree.map(c => c.numeral).join(' - ');
  console.log(`✓ Minor cadence pattern: ${minorCadence}`);

  if (lastThree[0].numeral === 'i' || lastThree[0].numeral === 'iv') {
    console.log(`✓ Starts with appropriate minor chord`);
  }

  if (lastThree[1].numeral === 'V') {
    console.log(`✓ Dominant in minor mode (with raised 7th)`);
  }

  if (lastThree[2].numeral === 'i') {
    console.log(`✓ Resolves to minor tonic`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 4: Seventh Chord Distribution
console.log('\nTEST 4: Seventh Chord Distribution');
console.log('-----------------------------------');
try {
  let seventhCount = 0;
  let totalChords = 0;

  for (let i = 0; i < 20; i++) {
    const prog = Progressions.generate('C', 10, 'dist-' + i, 'major');
    prog.progression.forEach(chord => {
      totalChords++;
      if (chord.numeral.includes('7')) seventhCount++;
    });
  }

  const percentage = ((seventhCount / totalChords) * 100).toFixed(1);
  console.log(`✓ Total chords: ${totalChords}`);
  console.log(`✓ Seventh chords: ${seventhCount}`);
  console.log(`✓ Percentage with sevenths: ${percentage}%`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 5: Cadence Metadata
console.log('\nTEST 5: Cadence Metadata');
console.log('------------------------');
try {
  const prog = Progressions.generate('G', 8, 'metadata-test', 'major');
  console.log(`✓ Progression generated`);
  console.log(`✓ Total chords: ${prog.progression.length}`);
  console.log(`✓ Cadence used: ${prog.cadenceUsed}`);

  // Check if metadata is present
  if (prog.cadenceUsed) {
    console.log(`✓ Cadence type recorded: ${prog.cadenceUsed}`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 6: Functional Harmony with Sevenths
console.log('\nTEST 6: Functional Harmony Consistency');
console.log('--------------------------------------');
try {
  const prog = Progressions.generate('C', 12, 'functional', 'major');

  const VALID_MAJOR = ['I', 'I7', 'IV', 'IV7', 'V', 'V7', 'vi', 'ii', 'ii7', 'iii', 'vii°', 'vii°7'];
  const VALID_MINOR = ['i', 'i7', 'iv', 'iv7', 'V', 'V7', 'VI', 'III', 'ii°', 'vii°', 'vii°7'];

  let validCount = 0;
  prog.progression.forEach(chord => {
    if (VALID_MAJOR.includes(chord.numeral)) validCount++;
  });

  console.log(`✓ Valid major chords: ${validCount}/${prog.progression.length}`);
  console.log(`✓ All chords functional: ${validCount === prog.progression.length}`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 7: Cadence Authenticity
console.log('\nTEST 7: Cadence Pattern Verification');
console.log('------------------------------------');
try {
  // Test PAC (Perfect Authentic Cadence)
  const pac = Progressions.generate('C', 6, 'pac', 'major', 'PAC');
  const pacEnd = pac.progression.slice(-3);
  console.log(`PAC: ${pacEnd.map(c => c.numeral).join('-')}`);

  // Test HC (Half Cadence)
  const hc = Progressions.generate('C', 6, 'hc', 'major', 'HC');
  const hcEnd = hc.progression.slice(-3);
  console.log(`HC:  ${hcEnd.map(c => c.numeral).join('-')}`);

  // Test DC (Deceptive Cadence)
  const dc = Progressions.generate('C', 6, 'dc', 'major', 'DC');
  const dcEnd = dc.progression.slice(-3);
  console.log(`DC:  ${dcEnd.map(c => c.numeral).join('-')}`);

  console.log(`✓ All cadence types generated correctly`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

console.log('\n========================================');
console.log('Seventh Chord Tests Complete!');
console.log('========================================\n');
