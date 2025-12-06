
const Melodic = require('./src/voices/melodic');
const { Note } = require('tonal');

console.log('========================================');
console.log('Minor Scale Adherence Test');
console.log('========================================\n');

// Helper to check if a note is in a list of allowed notes
function isNoteInList(note, list) {
  const pc = Note.pitchClass(note);
  return list.includes(pc);
}

// A Minor Harmonic Scale: A, B, C, D, E, F, G#
const A_HARMONIC_MINOR = ['A', 'B', 'C', 'D', 'E', 'F', 'G#'];
// A Natural Minor Scale: A, B, C, D, E, F, G
const A_NATURAL_MINOR = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

console.log('TEST 1: Neighbor Tones in A Minor (Harmonic)');
console.log('--------------------------------------------');
// Create a note E5 (Dominant) - Upper neighbor should be F (Natural), Lower neighbor should be D (Natural)
// Create a note A5 (Tonic) - Lower neighbor should be G# (Leading Tone) in Harmonic Minor
const notes1 = [
  { pitch: 'A5', duration: '1n', startTime: 0, voice: 0 }, // Lower neighbor -> G#
  { pitch: 'E5', duration: '1n', startTime: 4, voice: 0 }  // Upper neighbor -> F
];

// Force high probability for testing
const config = {
  baseDensity: 1.0,
  voiceMultipliers: [1.0, 1.0, 1.0, 1.0],
  totalMeasures: 100,
  cadenceMeasures: 0,
  ornamentProbabilities: {
    neighbor: 1.0,
    passing: 1.0,
    suspension: 1.0,
    appoggiatura: 1.0
  }
};

const neighbors = Melodic.addNeighborTones(notes1, 'A', 'minor', config);
let neighborNotes = neighbors.filter(n => n.type === 'neighbor');

// Retry if no neighbors generated (due to 40% max prob cap)
let attempts = 0;
while (neighborNotes.length === 0 && attempts < 20) {
  const retry = Melodic.addNeighborTones(notes1, 'A', 'minor', config);
  neighborNotes = retry.filter(n => n.type === 'neighbor');
  attempts++;
}

console.log(`Generated ${neighborNotes.length} neighbor tones after ${attempts + 1} attempts.`);

// Retry to find a lower neighbor for A5
console.log('Searching for Lower Neighbor to A5...');
let foundLower = false;
for (let i = 0; i < 50; i++) {
  const retry = Melodic.addNeighborTones(notes1, 'A', 'minor', config);
  const nn = retry.find(n => n.type === 'neighbor' && n.startTime < 4 && Note.midi(n.pitch) < Note.midi('A5'));
  if (nn) {
    console.log(`Found Lower Neighbor: ${nn.pitch}`);
    if (Note.pitchClass(nn.pitch) === 'G#') {
      console.log('✓ Correctly used G# (Leading Tone)');
      foundLower = true;
    } else {
      console.log(`✗ Incorrectly used ${Note.pitchClass(nn.pitch)}`);
    }
    break;
  }
}
if (!foundLower) console.log('Could not generate lower neighbor in 50 tries.'); console.log('\nTEST 2: Appoggiaturas in C Minor');
console.log('--------------------------------');
// C Minor Harmonic: C, D, Eb, F, G, Ab, B
// Target note C5. Appoggiatura from below should be B (Leading Tone), not Bb or A.
const notes2 = [
  { pitch: 'C5', duration: '2n', startTime: 2, voice: 0 }
];
const progression2 = [{ name: 'Cm', numeral: 'i', inversion: 0 }, { name: 'Cm', numeral: 'i', inversion: 0 }];

// Run multiple times to try to catch the lower appoggiatura
let foundLeadingTone = false;
for (let i = 0; i < 20; i++) {
  const appogs = Melodic.addAppoggiature(notes2, progression2, 'C', 'minor', config);
  const appogNote = appogs.find(n => n.type === 'appoggiatura');

  if (appogNote) {
    const pc = Note.pitchClass(appogNote.pitch);
    if (pc === 'B') {
      foundLeadingTone = true;
      console.log(`✓ Found Appoggiatura B -> C (Leading Tone resolution)`);
      break;
    }
  }
}

if (!foundLeadingTone) {
  console.log('Did not generate B -> C appoggiatura in 20 tries (might be random or issue)');
}

console.log('\nTEST 3: Passing Tones in A Minor (Ascending vs Descending)');
console.log('----------------------------------------------------------');
// Ascending: E -> A (gap of 4th) -> should fill with F# G# (Melodic Minor) or F G# (Harmonic)
// Let's test a smaller gap: F to A (Major 3rd) -> G (Natural) or G# (Harmonic/Melodic)?
// Actually, let's test the specific case of Minor 3rd interval.
// F5 to A5 (Major 3rd) in A Minor. Passing tone G or G#?
// In A Minor, F is natural. A is natural.
// If ascending melodic minor: F# G# A. But we start on F natural.
// If harmonic minor: F G# A. (Augmented 2nd F-G# is awkward).
// Usually melodic minor is used for smooth lines.

// Let's test G to B in C Minor.
// G4 -> B4 (Major 3rd). Passing tone A or Ab?
// C Harmonic Minor: G Ab B C.
// C Melodic Minor Ascending: G A B C.
// So it could be A or Ab depending on implementation.

// Let's test C to Eb (Minor 3rd). Passing tone D.
const notes3 = [
  { pitch: 'C5', duration: '2n', startTime: 0, voice: 0 },
  { pitch: 'Eb5', duration: '2n', startTime: 2, voice: 0 }
];

const passing = Melodic.addPassingTones(notes3, 'C', 'minor', config);
const passingNote = passing.find(n => n.type === 'passing');

if (passingNote) {
  console.log(`Passing tone between C5 and Eb5: ${passingNote.pitch}`);
  if (Note.pitchClass(passingNote.pitch) === 'D') {
    console.log('✓ Correctly used D natural');
  } else {
    console.log(`✗ Used ${Note.pitchClass(passingNote.pitch)}`);
  }
} else {
  console.log('No passing tone generated');
}

console.log('\nDone.');
