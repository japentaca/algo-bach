const { generatePiece } = require('./src/main');

console.log('=== BACH GENERATOR EXAMPLES ===\n');

// Example 1: C Major Chorale
console.log('EXAMPLE 1: C Major Chorale');
console.log('---------------------------');
let piece = generatePiece({ form: 'Chorale', mode: 'major', key: 'C', duration: 2 });
console.log('Key:', piece.meta.key);
console.log('Mode:', piece.meta.mode);
console.log('Form:', piece.meta.form);
console.log('Notes:', piece.notes.length);
console.log('Progression:', piece.meta.progression);

// Example 2: D Minor Prelude
console.log('\n\nEXAMPLE 2: D Minor Prelude');
console.log('---------------------------');
piece = generatePiece({ form: 'Prelude', mode: 'minor', key: 'D', duration: 3 });
console.log('Key:', piece.meta.key);
console.log('Mode:', piece.meta.mode);
console.log('Form:', piece.meta.form);
console.log('Notes:', piece.notes.length);
console.log('Progression:', piece.meta.progression);

// Example 3: Show all available parameters
console.log('\n\nAVAILABLE PARAMETERS');
console.log('--------------------');
console.log('form: "Chorale", "Prelude", "Gigue", "Allemande", "Courante", "Sarabande", "Minuet", "Fugue", "Passacaglia"');
console.log('mode: "major" or "minor"');
console.log('key: Any pitch class (C, D, E, F, G, A, B) plus accidentals (C#, Db, etc.)');
console.log('duration: Number of bars (1-8 recommended)');

// Example 4: G Major Gigue
console.log('\n\nEXAMPLE 4: G Major Gigue');
console.log('-------------------------');
piece = generatePiece({ form: 'Gigue', mode: 'major', key: 'G', duration: 2 });
console.log('Form:', piece.meta.form);
console.log('Notes:', piece.notes.length);
console.log('Rhythm info - Gigue uses dotted rhythms (4n., 8n)');
console.log('Progression:', piece.meta.progression);

// Example 5: Show note structure
console.log('\n\nNOTE STRUCTURE');
console.log('--------------');
piece = generatePiece({ form: 'Chorale', mode: 'major', key: 'C', duration: 1 });
console.log('Total notes:', piece.notes.length);
console.log('First 3 notes:');
const voices = ['Soprano', 'Alto', 'Tenor', 'Bass'];
piece.notes.slice(0, 3).forEach((n, i) => {
  console.log(`  ${i + 1}. pitch: ${n.pitch}, duration: ${n.duration}, voice: ${voices[n.voice]}, startTime: ${n.startTime}`);
});

console.log('\n=== GENERATION COMPLETE ===');
