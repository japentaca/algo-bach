/**
 * Test Suite for Enhanced Ornament Functions
 */

const Melodic = require('./src/voices/melodic');
const { Note } = require('tonal');

console.log('========================================');
console.log('Enhanced Ornament Functions Test');
console.log('========================================\n');

// Create test notes data
const createTestNotes = () => [
  { pitch: 'C5', duration: '2n', startTime: 0, voice: 0 },
  { pitch: 'E5', duration: '2n', startTime: 2, voice: 0 },
  { pitch: 'G5', duration: '2n', startTime: 4, voice: 0 },
  { pitch: 'C6', duration: '2n', startTime: 6, voice: 0 }
];

const createTestProgression = () => [
  { name: 'C', numeral: 'I', inversion: 0 },
  { name: 'F', numeral: 'IV', inversion: 0 },
  { name: 'G', numeral: 'V', inversion: 0 },
  { name: 'C', numeral: 'I', inversion: 0 }
];

// Test 1: Neighbor Tones
console.log('TEST 1: Neighbor Tone Generation');
console.log('--------------------------------');
try {
  const notes = createTestNotes();
  const ornamental = Melodic.addNeighborTones(notes, 'C');

  const neighborCount = ornamental.filter(n => n.type === 'neighbor').length;
  console.log(`✓ Generated ${ornamental.length} notes (from ${notes.length})`);
  console.log(`✓ Neighbor tones added: ${neighborCount}`);

  if (neighborCount > 0) {
    console.log(`✓ Neighbor tone example:`);
    const example = ornamental.find(n => n.type === 'neighbor');
    console.log(`  Pitch: ${example.pitch}, Duration: ${example.duration}, Type: ${example.type}`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 2: Appoggiaturas
console.log('\nTEST 2: Appoggiatura Generation');
console.log('-------------------------------');
try {
  const notes = createTestNotes();
  const progression = createTestProgression();
  const ornamental = Melodic.addAppoggiature(notes, progression, 'C');

  const appogCount = ornamental.filter(n => n.type === 'appoggiatura').length;
  console.log(`✓ Generated ${ornamental.length} notes (from ${notes.length})`);
  console.log(`✓ Appoggiaturas added: ${appogCount}`);

  if (appogCount > 0) {
    console.log(`✓ Appoggiatura found:`);
    const example = ornamental.find(n => n.type === 'appoggiatura');
    console.log(`  Pitch: ${example.pitch}, Duration: ${example.duration}`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 3: 9-8 Suspensions
console.log('\nTEST 3: 9-8 Suspension Generation');
console.log('---------------------------------');
try {
  const notes = createTestNotes();
  const ornamental = Melodic.add98Suspension(notes);

  const suspCount = ornamental.filter(n => n.type === 'suspension').length;
  console.log(`✓ Generated ${ornamental.length} notes (from ${notes.length})`);
  console.log(`✓ Suspensions added: ${suspCount}`);

  if (suspCount > 0) {
    console.log(`✓ Suspension found in output`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 4: Passing Tones (Original)
console.log('\nTEST 4: Passing Tone Generation');
console.log('-------------------------------');
try {
  const notes = createTestNotes();
  const progression = createTestProgression();
  const ornamental = Melodic.addPassingTones(notes, 'C');

  const passingCount = ornamental.filter(n => n.type === 'passing').length;
  console.log(`✓ Generated ${ornamental.length} notes (from ${notes.length})`);
  console.log(`✓ Passing tones added: ${passingCount}`);

  if (passingCount > 0) {
    console.log(`✓ Passing tone example:`);
    const example = ornamental.find(n => n.type === 'passing');
    console.log(`  Pitch: ${example.pitch}, Duration: ${example.duration}`);
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 5: Suspensions (Original)
console.log('\nTEST 5: Suspension Generation');
console.log('-----------------------------');
try {
  // Create notes that match a V-I progression (better for suspensions)
  const suspensionNotes = [
    { pitch: 'B4', duration: '2n', startTime: 0, voice: 0 },  // V chord 3rd
    { pitch: 'C5', duration: '2n', startTime: 2, voice: 0 }   // I chord root
  ];

  const progression = [
    { name: 'G', numeral: 'V', inversion: 0 },
    { name: 'C', numeral: 'I', inversion: 0 }
  ];

  const ornamental = Melodic.addSuspensions(suspensionNotes, progression, 'C');

  const suspCount = ornamental.filter(n => n.type === 'suspension' || n.type === 'resolution').length;
  console.log(`✓ Generated ${ornamental.length} notes`);
  console.log(`✓ Suspension/Resolution pairs: ${suspCount / 2}`);

  if (suspCount > 0) {
    const example = ornamental.find(n => n.type === 'suspension');
    if (example) {
      console.log(`✓ Suspension pitch: ${example.pitch}`);
    }
  }
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 6: Ornament Timing
console.log('\nTEST 6: Ornament Timing Validation');
console.log('----------------------------------');
try {
  const notes = createTestNotes();
  const ornamental = Melodic.addNeighborTones(notes, 'C');

  // Check that all notes are properly ordered by startTime
  let properOrder = true;
  for (let i = 1; i < ornamental.length; i++) {
    if (ornamental[i].startTime < ornamental[i - 1].startTime) {
      properOrder = false;
      break;
    }
  }

  console.log(`✓ Notes in chronological order: ${properOrder}`);
  console.log(`✓ Start times range: ${Math.min(...ornamental.map(n => n.startTime))} - ${Math.max(...ornamental.map(n => n.startTime))}`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

// Test 7: Voice Integrity
console.log('\nTEST 7: Voice Assignment Integrity');
console.log('----------------------------------');
try {
  const notes = [
    { pitch: 'C5', duration: '2n', startTime: 0, voice: 0 },
    { pitch: 'E4', duration: '2n', startTime: 0, voice: 1 },
    { pitch: 'G3', duration: '2n', startTime: 0, voice: 2 },
    { pitch: 'C3', duration: '2n', startTime: 0, voice: 3 },
    { pitch: 'D5', duration: '2n', startTime: 2, voice: 0 },
    { pitch: 'F4', duration: '2n', startTime: 2, voice: 1 }
  ];

  const ornamental = Melodic.addNeighborTones(notes, 'C');

  // Check that voices are preserved
  let voicesPreserved = true;
  const voiceNotes = { 0: [], 1: [], 2: [], 3: [] };
  ornamental.forEach(n => {
    if (n.voice >= 0 && n.voice <= 3) {
      voiceNotes[n.voice].push(n);
    } else {
      voicesPreserved = false;
    }
  });

  console.log(`✓ Voices properly assigned: ${voicesPreserved}`);
  console.log(`✓ Notes per voice: S:${voiceNotes[0].length}, A:${voiceNotes[1].length}, T:${voiceNotes[2].length}, B:${voiceNotes[3].length}`);
} catch (e) {
  console.log(`✗ Error: ${e.message}`);
}

console.log('\n========================================');
console.log('Ornament Tests Complete!');
console.log('========================================\n');
