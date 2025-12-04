const Rules = require('./theory/rules');
const Scales = require('./theory/scales');

console.log("=== Testing Theory Engine ===\n");

// 1. Test Interval Analysis
console.log("--- Interval Analysis ---");
const intervals = [
  ['C4', 'G4'], // Perfect 5th (Consonant)
  ['C4', 'E4'], // Major 3rd (Imperfect Consonance)
  ['C4', 'F4'], // Perfect 4th (Dissonant in strict counterpoint)
  ['B3', 'C4'], // Minor 2nd (Dissonant)
  ['C4', 'C5']  // Octave (Perfect Consonance)
];

intervals.forEach(([n1, n2]) => {
  const analysis = Rules.analyzeInterval(n1, n2);
  console.log(`${n1}-${n2}: ${analysis.simple} -> ${analysis.quality} (Consonant: ${analysis.isConsonant})`);
});

// 2. Test Motion Analysis
console.log("\n--- Motion Analysis ---");
const motions = [
  ['C4', 'D4', 'E4', 'F4'], // Parallel (both up by step) - Wait, C->D is +2, E->F is +1. Similar, not parallel.
  ['C4', 'D4', 'C4', 'D4'], // Parallel (+2, +2)
  ['C4', 'D4', 'G4', 'F4'], // Contrary (Up, Down)
  ['C4', 'C4', 'G4', 'A4']  // Oblique (Static, Up)
];

motions.forEach(([v1o, v1n, v2o, v2n]) => {
  const motion = Rules.analyzeMotion(v1o, v1n, v2o, v2n);
  console.log(`${v1o}->${v1n} vs ${v2o}->${v2n}: ${motion}`);
});

// 3. Test Scales
console.log("\n--- Baroque Scales ---");
const cMajor = Scales.getScale("C", "major");
console.log("C Major:", cMajor.join(" "));

const aMinorNatural = Scales.getScale("A", "minor");
console.log("A Minor (Natural):", aMinorNatural.join(" "));

console.log("A Melodic Minor (Ascending):");
const ascending = [];
for (let i = 1; i <= 7; i++) ascending.push(Scales.getMelodicMinorNote("A", i, true));
console.log(ascending.join(" "));

console.log("A Melodic Minor (Descending):");
const descending = [];
for (let i = 1; i <= 7; i++) descending.push(Scales.getMelodicMinorNote("A", i, false));
console.log(descending.join(" "));

console.log("\n=== Test Complete ===");
