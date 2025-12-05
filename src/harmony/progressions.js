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
  DOMINANT: { TONIC: 0.8, SUBDOMINANT: 0.05, DOMINANT: 0.15 }   // Strong pull to Tonic (Resolution)
};

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
    if (position === 1) return CADENCE_TYPES.HC;  // Half cadence in middle
    if (position === 2) {
      // End: prefer PAC or IAC with small chance of deceptive
      const rand = Math.random();
      if (rand < 0.6) return CADENCE_TYPES.PAC;
      if (rand < 0.85) return CADENCE_TYPES.IAC;
      return CADENCE_TYPES.DC;
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

      // 2. Pick a chord from that function
      const candidates = chordFunctions[nextFunction];
      const nextChordNumeral = candidates[Math.floor(rng() * candidates.length)];

      // 3. Determine Inversion (Probabilistic)
      // 0 = Root, 1 = 1st Inv (3rd in bass), 2 = 2nd Inv (5th in bass)
      let inversion = 0;
      const invRoll = rng();

      if (nextChordNumeral === 'V' || nextChordNumeral === 'i' || nextChordNumeral === 'I' || nextChordNumeral === 'iv' || nextChordNumeral === 'IV') {
        if (invRoll > 0.7) inversion = 1; // 30% chance of 1st inversion
      }
      // Note: 2nd inversion (6/4) is special (cadential), handled below or ignored for now to avoid bad style.

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
      cadenceUsed: cadenceType || 'Auto-selected'
    };
  }
};

module.exports = Progressions;
