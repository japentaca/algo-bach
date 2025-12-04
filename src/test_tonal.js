const { Chord, Progression } = require('tonal');

console.log("--- Tonal Inversion Test ---");

const chords = Progression.fromRomanNumerals("C", ["I", "V6", "I64"]);
console.log("Generated Chords:", chords);

chords.forEach(name => {
  const c = Chord.get(name);
  console.log(`\nChord: ${name}`);
  console.log(`Notes: ${c.notes.join("-")}`);
  console.log(`Tonic: ${c.tonic}`);
  console.log(`Type: ${c.type}`);
  // Check if we can identify the bass note
  // Tonal doesn't always explicitly give "bass" for slash chords in the .notes array order
  // We might need to parse the slash ourselves if Tonal doesn't.
});
