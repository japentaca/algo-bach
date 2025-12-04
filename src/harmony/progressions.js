const { Progression, Note } = require('tonal');
const seedrandom = require('seedrandom');

/**
 * Functional Harmony Engine
 * Generates chord progressions based on Baroque functional logic.
 */

// Functional Categories
const FUNCTIONS = {
  TONIC: ['I', 'vi', 'iii'],
  SUBDOMINANT: ['IV', 'ii'],
  DOMINANT: ['V', 'vii°']
};

// Transition Probabilities (Simplified Markov Chain)
// "From Function": { "To Function": Probability }
const TRANSITIONS = {
  TONIC: { TONIC: 0.3, SUBDOMINANT: 0.4, DOMINANT: 0.3 },
  SUBDOMINANT: { TONIC: 0.1, SUBDOMINANT: 0.2, DOMINANT: 0.7 }, // Strong pull to Dominant
  DOMINANT: { TONIC: 0.8, SUBDOMINANT: 0.05, DOMINANT: 0.15 }   // Strong pull to Tonic (Resolution)
};

const Progressions = {
  /**
   * Generates a sequence of Roman numerals.
   * @param {string} key - e.g., "C"
   * @param {number} length - Number of chords
   * @param {string} seed - Random seed
   */
  generate: (key, length = 8, seed = Date.now()) => {
    const rng = seedrandom(seed);
    const progression = [];

    let currentFunction = 'TONIC';
    let currentChord = 'I'; // Start on Tonic

    progression.push({ numeral: currentChord, inversion: 0 });

    for (let i = 1; i < length - 2; i++) { // Reserve last 2 for cadence
      // 1. Determine next function
      const probs = TRANSITIONS[currentFunction];
      const rand = rng();
      let sum = 0;
      let nextFunction = 'TONIC'; // Default

      for (const [func, prob] of Object.entries(probs)) {
        sum += prob;
        if (rand < sum) {
          nextFunction = func;
          break;
        }
      }

      // 2. Pick a chord from that function
      const candidates = FUNCTIONS[nextFunction];
      const nextChordNumeral = candidates[Math.floor(rng() * candidates.length)];

      // 3. Determine Inversion (Probabilistic)
      // 0 = Root, 1 = 1st Inv (3rd in bass), 2 = 2nd Inv (5th in bass)
      let inversion = 0;
      const invRoll = rng();

      if (nextChordNumeral === 'V' || nextChordNumeral === 'I' || nextChordNumeral === 'IV') {
        if (invRoll > 0.7) inversion = 1; // 30% chance of 1st inversion
      }
      // Note: 2nd inversion (6/4) is special (cadential), handled below or ignored for now to avoid bad style.

      progression.push({ numeral: nextChordNumeral, inversion: inversion });
      currentFunction = nextFunction;
      currentChord = nextChordNumeral;
    }

    // Force Cadence at the end
    // Simple Authentic Cadence: ii - V - I
    progression.push({ numeral: 'V', inversion: 0 });
    progression.push({ numeral: 'I', inversion: 0 });

    // Convert numerals to real chord names
    const chords = progression.map(p => {
      const chordName = Progression.fromRomanNumerals(key, [p.numeral])[0];
      return {
        name: chordName,
        inversion: p.inversion,
        numeral: p.numeral
      };
    });

    return {
      progression: chords
    };
  }
};

module.exports = Progressions;
