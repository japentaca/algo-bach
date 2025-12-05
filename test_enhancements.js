const { generatePiece } = require('./src/main.js');

console.log('=== Enhanced Bach System Demo ===\n');

// Test 1: Chorale with phrase structure
console.log('1. Chorale with Phrase Structure:');
const chorale = generatePiece({
  form: 'Chorale',
  key: 'C',
  mode: 'major',
  duration: 8,
  ornamentDensity: 60,
  seed: 'chorale-test'
});

console.log(`Form: ${chorale.meta.form}`);
console.log(`Phrase Structure: ${chorale.meta.phraseMarkers ? 'Yes' : 'No'}`);
if (chorale.meta.phraseMarkers) {
  console.log(`  Antecedent: measures ${chorale.meta.phraseMarkers.antecedent.start}-${chorale.meta.phraseMarkers.antecedent.end} (${chorale.meta.phraseMarkers.antecedent.cadence})`);
  console.log(`  Consequent: measures ${chorale.meta.phraseMarkers.consequent.start}-${chorale.meta.phraseMarkers.consequent.end} (${chorale.meta.phraseMarkers.consequent.cadence})`);
}

// Count voice interaction types
const interactionTypes = {};
chorale.notes.forEach(note => {
  if (note.type) {
    interactionTypes[note.type] = (interactionTypes[note.type] || 0) + 1;
  }
});
console.log('Voice Interactions:', Object.keys(interactionTypes).length > 0 ? interactionTypes : 'None');
console.log(`Total notes: ${chorale.notes.length}\n`);

// Test 2: Shorter piece (no phrase structure)
console.log('2. Short Piece (No Phrase Structure):');
const short = generatePiece({
  form: 'Chorale',
  key: 'G',
  mode: 'minor',
  duration: 2,
  ornamentDensity: 40,
  seed: 'short-test'
});

console.log(`Form: ${short.meta.form}`);
console.log(`Phrase Structure: ${short.meta.phraseMarkers ? 'Yes' : 'No'}`);
console.log(`Total notes: ${short.notes.length}\n`);

// Test 3: High ornament density
console.log('3. High Ornament Density:');
const ornate = generatePiece({
  form: 'Prelude',
  key: 'D',
  mode: 'major',
  duration: 6,
  ornamentDensity: 90,
  seed: 'ornate-test'
});

const ornateTypes = {};
ornate.notes.forEach(note => {
  if (note.type) {
    ornateTypes[note.type] = (ornateTypes[note.type] || 0) + 1;
  }
});
console.log(`Form: ${ornate.meta.form}`);
console.log(`Ornament Types:`, ornateTypes);
console.log(`Total notes: ${ornate.notes.length}\n`);

// Test 4: Voice interaction analysis
console.log('4. Voice Interaction Analysis:');
const interaction = generatePiece({
  form: 'Chorale',
  key: 'F',
  mode: 'major',
  duration: 6,
  ornamentDensity: 50,
  seed: 'interaction-test'
});

// Analyze voice pairs
const voicePairs = {
  'Soprano-Alto': 0,
  'Alto-Tenor': 0,
  'Tenor-Bass': 0
};

interaction.notes.forEach(note => {
  if (note.type === 'call' || note.type === 'response') {
    if (note.voice === 0 || note.voice === 1) voicePairs['Soprano-Alto']++;
    if (note.voice === 1 || note.voice === 2) voicePairs['Alto-Tenor']++;
    if (note.voice === 2 || note.voice === 3) voicePairs['Tenor-Bass']++;
  }
});

console.log(`Call-Response Pairs:`, voicePairs);
console.log(`Total notes: ${interaction.notes.length}\n`);

console.log('=== Demo Complete ===');