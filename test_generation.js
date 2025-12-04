const generator = require('./src/main');
const Progressions = require('./src/harmony/progressions');

try {
  console.log("Testing generation...");

  // Debug Progressions directly
  const progData = Progressions.generate('C', 8);
  console.log("Progression:", JSON.stringify(progData.progression, null, 2));

  console.log("Testing Chorale...");
  const chorale = generator.generatePiece({ key: 'C', form: 'Chorale' });
  console.log("Chorale Meta:", chorale.meta);
  console.log("Chorale Notes:", chorale.notes.length);

  console.log("\nTesting Prelude...");
  const prelude = generator.generatePiece({ key: 'G', form: 'Prelude' });
  console.log("Prelude Meta:", prelude.meta);
  console.log("Prelude Notes:", prelude.notes.length);

  console.log("\nTesting Fugue...");
  const fugue = generator.generatePiece({ key: 'D', form: 'Fugue' });
  console.log("Fugue Meta:", fugue.meta);
  console.log("Fugue Notes:", fugue.notes.length);
} catch (error) {
  console.error("Generation failed:");
  console.error(error);
}
