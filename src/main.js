import Planner from './composition/planner.js';

function generatePiece(options) {
  // Use the new Planner for generation
  const planner = new Planner();
  const piece = planner.generate(options);

  return piece;
}

export { generatePiece };
