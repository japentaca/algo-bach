const Motif = require('./composition/motif');
const Modulator = require('./composition/modulator');
const Structure = require('./composition/structure');
const { Note, Interval } = require('tonal');

console.log("=== Testing Extended Generation Features ===\n");

// 1. Test Motif Transformations
console.log("--- Motif Transformations ---");
const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const motif = new Motif(['C4', 'E4', 'G4', 'C5']);
console.log("Original:", motif.notes.join(" "));

const inverted = motif.invert();
console.log("Inverted:", inverted.notes.join(" "));
// Expect: C4 (pivot), E4(+4) -> Ab3(-4), G4(+7) -> F3(-7), C5(+12) -> C3(-12)

const retrograde = motif.retrograde();
console.log("Retrograde:", retrograde.notes.join(" "));
// Expect: C5 G4 E4 C4

const transposed = motif.transpose("2M");
console.log("Transposed (+2M):", transposed.notes.join(" "));
// Expect: D4 F#4 A4 D5

const mutated = motif.mutate();
console.log("Mutated:", mutated.notes.join(" "));
// Expect one note changed

// 2. Test Modulator
console.log("\n--- Modulator ---");
const modulator = new Modulator('C');
const related = modulator.getNextRelatedKey('C');
console.log("Related to C:", related);

const route = modulator.planRoute('C', 5);
console.log("Route (5 steps):", route.join(" -> "));

// 3. Test Structure (Extended)
console.log("\n--- Structure (Extended) ---");
const structure = new Structure();
const ritornello = structure.generate('Ritornello', 1); // 1 minute
console.log("Ritornello (1m):");
ritornello.forEach(s => console.log(`- ${s.name} (${s.type}, ${s.bars} bars)`));

const variations = structure.generate('Variations', 2); // 2 minutes
console.log("\nVariations (2m):");
variations.forEach(s => console.log(`- ${s.name} (${s.type}, ${s.bars} bars)`));

console.log("\n=== Test Complete ===");
