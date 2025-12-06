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
  DOMINANT: ['V', 'V7', 'vii°', 'vii°7']
};

// Minor Mode Functions
const FUNCTIONS_MINOR = {
  TONIC: ['i', 'VI', 'III'],
  SUBDOMINANT: ['iv', 'ii°'],
  DOMINANT: ['V', 'V7', 'vii°', 'vii°7'] // V and vii° use raised 7th (harmonic minor)
};

// Cadence Types - Different authentic and half cadences
const CADENCE_TYPES = {
  PAC: [        // Perfect Authentic Cadence (V-I, soprano ends on tonic)
    { numeral: 'I', inversion: 2 },   // Cadential 6/4
    { numeral: 'V', inversion: 0 },
    { numeral: 'I', inversion: 0 }
  ],
  IAC: [        // Imperfect Authentic Cadence (V-I, soprano not on tonic)
    { numeral: 'I', inversion: 2 },
    { numeral: 'V', inversion: 0 },
    { numeral: 'I', inversion: 1 }
  ],
  HC: [         // Half Cadence (ends on V)
    { numeral: 'I', inversion: 0 },
    { numeral: 'IV', inversion: 0 },
    { numeral: 'V', inversion: 0 }
  ],
  DC: [         // Deceptive Cadence (V-vi)
    { numeral: 'I', inversion: 2 },
    { numeral: 'V', inversion: 0 },
    { numeral: 'vi', inversion: 0 }
  ]
};

// Transition Probabilities (Simplified Markov Chain)
// "From Function": { "To Function": Probability }
const TRANSITIONS = {
  TONIC: { TONIC: 0.3, SUBDOMINANT: 0.4, DOMINANT: 0.3 },
  SUBDOMINANT: { TONIC: 0.1, SUBDOMINANT: 0.2, DOMINANT: 0.7 }, // Strong pull to Dominant
  DOMINANT: { TONIC: 0.85, SUBDOMINANT: 0.02, DOMINANT: 0.13 }   // Stronger pull to Tonic, rarely retrogressive
};

// Chord weights within each function (primary chords weighted higher)
// Higher weight = more likely to be selected
const CHORD_WEIGHTS = {
  major: {
    TONIC: { 'I': 0.65, 'vi': 0.25, 'iii': 0.10 },
    SUBDOMINANT: { 'IV': 0.55, 'ii': 0.45 },
    DOMINANT: { 'V': 0.50, 'V7': 0.30, 'vii°': 0.12, 'vii°7': 0.08 }
  },
  minor: {
    TONIC: { 'i': 0.65, 'VI': 0.25, 'III': 0.10 },
    SUBDOMINANT: { 'iv': 0.55, 'ii°': 0.45 },
    DOMINANT: { 'V': 0.50, 'V7': 0.30, 'vii°': 0.12, 'vii°7': 0.08 }
  }
};

// Special weights when resolving from DOMINANT to TONIC (prefer I/i strongly)
const RESOLUTION_WEIGHTS = {
  major: { 'I': 0.80, 'vi': 0.15, 'iii': 0.05 },
  minor: { 'i': 0.80, 'VI': 0.15, 'III': 0.05 }
};

// Root motion quality based on interval (semitones mod 12)
// Lower score = better root motion
const ROOT_MOTION_QUALITY = {
  0: 0.3,   // Unison (same chord) - weak but ok
  1: 0.7,   // Minor 2nd - weak
  2: 0.6,   // Major 2nd - moderate
  3: 0.4,   // Minor 3rd - good
  4: 0.4,   // Major 3rd - good
  5: 0.2,   // Perfect 4th - strong (circle of fifths)
  6: 0.9,   // Tritone - avoid
  7: 0.2,   // Perfect 5th - strong (circle of fifths)
  8: 0.4,   // Minor 6th - good
  9: 0.4,   // Major 6th - good
  10: 0.6,  // Minor 7th - moderate
  11: 0.7   // Major 7th - weak
};

/**
 * Select a chord from candidates using weighted probability
 * @param {object} weights - Object mapping chord numerals to weights
 * @param {function} rng - Random number generator
 * @returns {string} Selected chord numeral
 */
function selectWeightedChord(weights, rng) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0);
  const rand = rng() * totalWeight;

  let cumulative = 0;
  for (const [chord, weight] of entries) {
    cumulative += weight;
    if (rand < cumulative) {
      return chord;
    }
  }
  return entries[0][0]; // Fallback to first chord
}

/**
 * Get the root pitch class from a Roman numeral
 * @param {string} numeral - Roman numeral (e.g., 'I', 'vi', 'V7')
 * @returns {number} Scale degree (0-6)
 */
function getRootDegree(numeral) {
  const clean = numeral.replace(/[°7]/g, '').toUpperCase();
  const degreeMap = { 'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6 };
  return degreeMap[clean] !== undefined ? degreeMap[clean] : 0;
}

/**
 * Calculate root motion quality between two chords
 * @param {string} prevNumeral - Previous chord numeral
 * @param {string} nextNumeral - Next chord numeral
 * @param {function} rng - Random number generator for probabilistic acceptance
 * @returns {boolean} True if root motion is acceptable
 */
function hasGoodRootMotion(prevNumeral, nextNumeral, rng) {
  // 20% of the time, allow any root motion for variety
  if (rng() < 0.20) return true;

  const prevDegree = getRootDegree(prevNumeral);
  const nextDegree = getRootDegree(nextNumeral);

  // Calculate interval in semitones (approximate using major scale intervals)
  const degreeToSemitones = [0, 2, 4, 5, 7, 9, 11]; // Major scale
  const prevSemi = degreeToSemitones[prevDegree];
  const nextSemi = degreeToSemitones[nextDegree];
  const interval = Math.abs(nextSemi - prevSemi) % 12;

  const quality = ROOT_MOTION_QUALITY[interval];

  // Probabilistic acceptance based on quality (lower = better = more likely)
  // Quality 0.2 (good) -> 95% accept, Quality 0.9 (bad) -> 30% accept
  const acceptProbability = 1.0 - (quality * 0.7);
  return rng() < acceptProbability;
}

const Progressions = {
  /**
   * Selects appropriate cadence type based on context
   * @param {string} mode - 'major' or 'minor'
   * @param {number} position - Position in form (0=beginning, 1=middle, 2=end)
   * @returns {array} Cadence progression
   */
  selectCadence: (mode = 'major', position = 2) => {
    // For minor mode, adapt cadences
    if (mode === 'minor') {
      const CADENCE_MINOR = {
        PAC: [        // Perfect Authentic Cadence in minor (V-i)
          { numeral: 'i', inversion: 2 },
          { numeral: 'V', inversion: 0 },
          { numeral: 'i', inversion: 0 }
        ],
        IAC: [        // Imperfect Authentic Cadence in minor
          { numeral: 'i', inversion: 2 },
          { numeral: 'V', inversion: 0 },
          { numeral: 'i', inversion: 1 }
        ],
        HC: [         // Half Cadence in minor (often on v or V)
          { numeral: 'i', inversion: 0 },
          { numeral: 'iv', inversion: 0 },
          { numeral: 'V', inversion: 0 }
        ],
        PC: [         // Phrygian Cadence (iv6-V) - characteristic of minor
          { numeral: 'iv', inversion: 1 },
          { numeral: 'V', inversion: 0 },
          { numeral: 'i', inversion: 0 }
        ]
      };

      // Choose based on position: half cadence at middle, PAC at end
      if (position === 1) return CADENCE_MINOR.HC;
      if (position === 2) return Math.random() > 0.5 ? CADENCE_MINOR.PAC : CADENCE_MINOR.PC;
      return CADENCE_MINOR.PAC;
    }

    // For major mode
    if (position === 1) {
      // Middle position: half cadence or deceptive allowed
      const rand = Math.random();
      if (rand < 0.7) return CADENCE_TYPES.HC;
      return CADENCE_TYPES.DC;  // Deceptive cadence only in middle, never at end
    }
    if (position === 2) {
      // FINAL position: MUST resolve to tonic (never deceptive)
      const rand = Math.random();
      if (rand < 0.7) return CADENCE_TYPES.PAC;  // Perfect Authentic preferred
      return CADENCE_TYPES.IAC;  // Imperfect Authentic also resolves to I
    }
    return CADENCE_TYPES.PAC;  // Default to perfect authentic
  },

  /**
   * Generates a sequence of Roman numerals.
   * @param {string} key - e.g., "C"
   * @param {number} length - Number of chords
   * @param {string} seed - Random seed
   * @param {string} mode - 'major' or 'minor'
   * @param {string} cadenceType - 'PAC', 'IAC', 'HC', 'DC', 'PC' (auto if not specified)
   */
  generate: (key, length = 8, seed = Date.now(), mode = 'major', cadenceType = null) => {
    const rng = seedrandom(seed);
    const progression = [];

    // Select chord functions based on mode
    const chordFunctions = mode === 'minor' ? FUNCTIONS_MINOR : FUNCTIONS;
    const startChord = mode === 'minor' ? 'i' : 'I';

    let currentFunction = 'TONIC';
    let currentChord = startChord;

    progression.push({ numeral: currentChord, inversion: 0 });

    for (let i = 1; i < length - 3; i++) { // Reserve last 3 for cadence
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

      // 2. Pick a chord from that function using weighted selection
      let weights;

      // Use special resolution weights when dominant resolves to tonic
      if (currentFunction === 'DOMINANT' && nextFunction === 'TONIC') {
        weights = RESOLUTION_WEIGHTS[mode];
      } else {
        weights = CHORD_WEIGHTS[mode][nextFunction];
      }

      // Try to find a chord with good root motion (with retries)
      let nextChordNumeral;
      let attempts = 0;
      const maxAttempts = 3;

      do {
        nextChordNumeral = selectWeightedChord(weights, rng);
        attempts++;
      } while (attempts < maxAttempts && !hasGoodRootMotion(currentChord, nextChordNumeral, rng));

      // Note: 7th chords are now included in the weights, no need for separate stochastic addition

      // 3. Determine Inversion (Probabilistic - weighted)
      // Root (50%), 1st Inv (35%), 2nd Inv (15%, rare)
      let inversion = 0;
      const invRoll = rng();

      if (invRoll < 0.35) {
        inversion = 1; // 35% chance of 1st inversion (6)
      } else if (invRoll < 0.50 && (nextChordNumeral === 'V' || nextChordNumeral === 'V7' || nextChordNumeral === 'IV')) {
        inversion = 2; // 15% chance of 2nd inversion (6/4) - only on certain chords
      }
      // Otherwise inversion = 0 (root position) - 50%

      progression.push({ numeral: nextChordNumeral, inversion: inversion });
      currentFunction = nextFunction;
      currentChord = nextChordNumeral;
    }

    // Apply Cadence at the end
    // Select cadence type based on context or parameter
    let cadence;
    if (cadenceType && CADENCE_TYPES[cadenceType]) {
      cadence = CADENCE_TYPES[cadenceType];
    } else {
      cadence = Progressions.selectCadence(mode, 2); // position 2 = end
    }

    // Add cadence chords to progression
    cadence.forEach(chord => {
      progression.push(chord);
    });

    // Convert numerals to real chord names
    const chords = progression.map(p => {
      const chordName = Progression.fromRomanNumerals(key, [p.numeral])[0];
      return {
        name: chordName,
        inversion: p.inversion,
        numeral: p.numeral,
        seventh: p.numeral.includes('7') ? true : false
      };
    });

    return {
      progression: chords,
      cadenceUsed: cadenceType || 'Auto-selected',
      rng: rng
    };
  },

  /**
   * Generate a final cadence that ALWAYS resolves to tonic
   * Use this for the very end of a piece to ensure proper resolution
   * @param {string} mode - 'major' or 'minor'
   * @returns {array} Final cadence progression (guaranteed to end on I/i)
   */
  getFinalCadence: (mode = 'major') => {
    if (mode === 'minor') {
      // Minor: iv - V - i (or ii°6 - V - i for more color)
      const rand = Math.random();
      if (rand < 0.6) {
        return [
          { numeral: 'iv', inversion: 0 },
          { numeral: 'V', inversion: 0 },
          { numeral: 'i', inversion: 0 }
        ];
      } else {
        // Cadential 6/4 version
        return [
          { numeral: 'i', inversion: 2 },
          { numeral: 'V', inversion: 0 },
          { numeral: 'i', inversion: 0 }
        ];
      }
    }
    // Major: IV - V - I or I6/4 - V - I
    const rand = Math.random();
    if (rand < 0.5) {
      return [
        { numeral: 'IV', inversion: 0 },
        { numeral: 'V', inversion: 0 },
        { numeral: 'I', inversion: 0 }
      ];
    } else {
      // Cadential 6/4 version
      return [
        { numeral: 'I', inversion: 2 },
        { numeral: 'V', inversion: 0 },
        { numeral: 'I', inversion: 0 }
      ];
    }
  },

  /**
   * Common Baroque sequences for episodic material
   */
  SEQUENCES: {
    descendingFifths: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
    ascending5ths6ths: ['I', 'V6', 'vi', 'iii6', 'IV', 'I6', 'ii', 'V'],
    descending3rds: ['I', 'vi', 'IV', 'ii', 'vii°', 'V', 'I'],
    romanesca: ['I', 'V6', 'vi', 'iii6', 'IV', 'I6', 'IV', 'V']
  },

  /**
   * Generates a sequential passage for fugue episodes or development.
   * @param {string} key - Tonic key
   * @param {string} sequenceType - Type from SEQUENCES
   * @param {string} mode - 'major' or 'minor'
   * @param {number} repetitions - How many times to cycle (default 1)
   * @returns {object[]} Array of chord objects
   */
  generateSequence: (key, sequenceType = 'descendingFifths', mode = 'major', repetitions = 1) => {
    let sequence = Progressions.SEQUENCES[sequenceType] || Progressions.SEQUENCES.descendingFifths;

    // Adjust for minor mode
    if (mode === 'minor') {
      sequence = sequence.map(numeral => {
        // Convert major numerals to minor equivalents
        const conversions = {
          'I': 'i', 'i': 'i',
          'II': 'ii°', 'ii': 'ii°', 'ii°': 'ii°',
          'III': 'III', 'iii': 'III',
          'IV': 'iv', 'iv': 'iv',
          'V': 'V', 'v': 'V',
          'VI': 'VI', 'vi': 'VI',
          'VII': 'vii°', 'vii°': 'vii°'
        };
        // Handle inversions (e.g., "V6" -> "V6")
        const baseNumeral = numeral.replace(/[0-9]/g, '');
        const inversion = numeral.replace(/[^0-9]/g, '');
        return (conversions[baseNumeral] || baseNumeral) + inversion;
      });
    }

    // Repeat sequence if needed
    let fullSequence = [];
    for (let i = 0; i < repetitions; i++) {
      fullSequence = fullSequence.concat(sequence);
    }

    // Convert to chord objects with inversions
    const chords = fullSequence.map(numeral => {
      let inv = 0;
      let cleanNumeral = numeral;

      if (numeral.includes('6/4')) {
        inv = 2;
        cleanNumeral = numeral.replace('6/4', '');
      } else if (numeral.includes('6')) {
        inv = 1;
        cleanNumeral = numeral.replace('6', '');
      }

      const chordName = Progression.fromRomanNumerals(key, [cleanNumeral])[0];
      return {
        name: chordName,
        inversion: inv,
        numeral: cleanNumeral,
        seventh: cleanNumeral.includes('7')
      };
    });

    return chords;
  }
};

module.exports = Progressions;
