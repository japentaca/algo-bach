const Planner = require('./composition/planner');

function generatePiece(options) {
  // Use the new Planner for generation
  const planner = new Planner();
  const piece = planner.generate(options);

  return piece;
}

module.exports = { generatePiece };
