const Progressions = require('../harmony/progressions');
const seedrandom = require('seedrandom');

/**
 * Phrase Structure Engine
 * Creates antecedent-consequent phrase patterns with proper cadences
 */

const PhraseStructure = {
  /**
   * Check if a cross-phrase transition is awkward (tritone root motion or problematic)
   * @param {string} fromNumeral - Last chord of previous phrase
   * @param {string} toNumeral - First chord of next phrase
   * @returns {boolean} True if transition is awkward
   */
  isAwkwardTransition: (fromNumeral, toNumeral) => {
    const degreeMap = { 'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6 };
    const degreeToSemitones = [0, 2, 4, 5, 7, 9, 11];

    const cleanFrom = (fromNumeral || 'I').replace(/[°7]/g, '').toUpperCase();
    const cleanTo = (toNumeral || 'I').replace(/[°7]/g, '').toUpperCase();

    const fromDegree = degreeMap[cleanFrom] !== undefined ? degreeMap[cleanFrom] : 0;
    const toDegree = degreeMap[cleanTo] !== undefined ? degreeMap[cleanTo] : 0;

    const interval = Math.abs(degreeToSemitones[toDegree] - degreeToSemitones[fromDegree]) % 12;

    // Tritone (6 semitones) is awkward
    if (interval === 6) return true;

    // Same chord repeated across phrase boundary can sound static
    if (interval === 0 && cleanFrom === cleanTo) return true;

    return false;
  },

  /**
   * Generates a period (antecedent + consequent phrases)
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {number} phraseLength - Length of each phrase in measures (default 4)
   * @param {string} seed - Random seed
   * @param {boolean} parallel - Whether consequent should be parallel (true) or contrasting (false)
   * @returns {object} Object with progression data and phrase markers
   */
  generatePeriod: (key, mode = 'major', phraseLength = 4, seed = 'default', parallel = true) => {
    const rng = seedrandom(seed);

    // Generate antecedent phrase (ends with half cadence)
    const antecedentSeed = rng().toString();
    const antecedentData = Progressions.generate(key, phraseLength, antecedentSeed, mode, 'HC');

    // Generate consequent phrase (ends with authentic cadence)
    let consequentSeed = rng().toString();
    let consequentData = Progressions.generate(key, phraseLength, consequentSeed, mode, parallel ? 'PAC' : 'IAC');

    // 50% of the time, validate cross-phrase transition for smoothness
    if (rng() < 0.5) {
      const lastAntecedent = antecedentData.progression[antecedentData.progression.length - 1];
      const firstConsequent = consequentData.progression[0];

      // Check if transition is awkward (tritone root motion or same chord repeated)
      const isAwkward = PhraseStructure.isAwkwardTransition(lastAntecedent.numeral, firstConsequent.numeral);

      if (isAwkward) {
        // Regenerate consequent with new seed
        consequentSeed = rng().toString();
        consequentData = Progressions.generate(key, phraseLength, consequentSeed, mode, parallel ? 'PAC' : 'IAC');
      }
    }

    // Combine progressions
    const fullProgression = [...antecedentData.progression, ...consequentData.progression];

    // Add phrase markers
    const phraseMarkers = {
      antecedent: {
        start: 0,
        end: phraseLength - 1,
        type: 'antecedent',
        cadence: 'HC'
      },
      consequent: {
        start: phraseLength,
        end: (phraseLength * 2) - 1,
        type: 'consequent',
        cadence: parallel ? 'PAC' : 'IAC'
      }
    };

    return {
      progression: fullProgression,
      phraseMarkers,
      form: 'period',
      antecedent: antecedentData.progression,
      consequent: consequentData.progression,
      rng: rng
    };
  },

  /**
   * Generates a sentence structure (3 phrases: presentation, continuation, cadential)
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {number} phraseLength - Length of each phrase in measures (default 2)
   * @param {string} seed - Random seed
   * @returns {object} Object with progression data and phrase markers
   */
  generateSentence: (key, mode = 'major', phraseLength = 2, seed = 'default') => {
    const rng = seedrandom(seed);

    // Presentation phrase (basic idea repeated)
    const presentationSeed = rng().toString();
    const presentationData = Progressions.generate(key, phraseLength, presentationSeed, mode);

    // Continuation phrase (fragmentation and sequence)
    const continuationSeed = rng().toString();
    const continuationData = Progressions.generate(key, phraseLength, continuationSeed, mode);

    // Cadential phrase (strong cadence)
    const cadentialSeed = rng().toString();
    const cadentialData = Progressions.generate(key, phraseLength, cadentialSeed, mode, 'PAC');

    // Combine progressions
    const fullProgression = [
      ...presentationData.progression,
      ...continuationData.progression,
      ...cadentialData.progression
    ];

    // Add phrase markers
    const phraseMarkers = {
      presentation: {
        start: 0,
        end: phraseLength - 1,
        type: 'presentation'
      },
      continuation: {
        start: phraseLength,
        end: (phraseLength * 2) - 1,
        type: 'continuation'
      },
      cadential: {
        start: phraseLength * 2,
        end: (phraseLength * 3) - 1,
        type: 'cadential',
        cadence: 'PAC'
      }
    };

    return {
      progression: fullProgression,
      phraseMarkers,
      form: 'sentence',
      presentation: presentationData.progression,
      continuation: continuationData.progression,
      cadential: cadentialData.progression,
      rng: rng
    };
  },

  /**
   * Generates a binary form (A B)
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {number} sectionLength - Length of each section in measures (default 8)
   * @param {string} seed - Random seed
   * @param {boolean} modulate - Whether to modulate in B section
   * @returns {object} Object with progression data and section markers
   */
  generateBinary: (key, mode = 'major', sectionLength = 8, seed = 'default', modulate = true) => {
    const rng = seedrandom(seed);

    // A section (in tonic)
    const aSeed = rng().toString();
    const aData = Progressions.generate(key, sectionLength, aSeed, mode, 'IAC');

    // B section (modulates to dominant/relative and returns)
    const bSeed = rng().toString();
    let bKey = key;
    let bMode = mode;

    if (modulate) {
      // Modulate to dominant (major) or relative (minor)
      if (mode === 'major') {
        bKey = require('tonal').Note.transpose(key, '5P'); // Dominant
      } else {
        bKey = require('tonal').Note.transpose(key, '3M'); // Relative major
      }
    }

    const bData = Progressions.generate(bKey, sectionLength, bSeed, bMode, 'PAC');

    // Combine progressions
    const fullProgression = [...aData.progression, ...bData.progression];

    // Add section markers
    const sectionMarkers = {
      A: {
        start: 0,
        end: sectionLength - 1,
        type: 'A',
        key: key,
        mode: mode,
        cadence: 'IAC'
      },
      B: {
        start: sectionLength,
        end: (sectionLength * 2) - 1,
        type: 'B',
        key: bKey,
        mode: bMode,
        cadence: 'PAC'
      }
    };

    return {
      progression: fullProgression,
      sectionMarkers,
      form: 'binary',
      A: aData.progression,
      B: bData.progression,
      rng: rng
    };
  },

  /**
   * Generates a ternary form (A B A)
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {number} sectionLength - Length of each section in measures (default 4)
   * @param {string} seed - Random seed
   * @returns {object} Object with progression data and section markers
   */
  generateTernary: (key, mode = 'major', sectionLength = 4, seed = 'default') => {
    const rng = seedrandom(seed);

    // A section (in tonic)
    const a1Seed = rng().toString();
    const a1Data = Progressions.generate(key, sectionLength, a1Seed, mode, 'IAC');

    // B section (contrasting, often in related key)
    const bSeed = rng().toString();
    let bKey = key;
    let bMode = mode;

    // Modulate to dominant (major) or relative (minor) for B section
    if (mode === 'major') {
      bKey = require('tonal').Note.transpose(key, '5P'); // Dominant
    } else {
      bKey = require('tonal').Note.transpose(key, '3M'); // Relative major
    }

    const bData = Progressions.generate(bKey, sectionLength, bSeed, bMode, 'HC');

    // A' section (return to tonic, often with embellishment)
    const a2Seed = rng().toString();
    const a2Data = Progressions.generate(key, sectionLength, a2Seed, mode, 'PAC');

    // Combine progressions
    const fullProgression = [
      ...a1Data.progression,
      ...bData.progression,
      ...a2Data.progression
    ];

    // Add section markers
    const sectionMarkers = {
      A: {
        start: 0,
        end: sectionLength - 1,
        type: 'A',
        key: key,
        mode: mode,
        cadence: 'IAC'
      },
      B: {
        start: sectionLength,
        end: (sectionLength * 2) - 1,
        type: 'B',
        key: bKey,
        mode: bMode,
        cadence: 'HC'
      },
      Aprime: {
        start: sectionLength * 2,
        end: (sectionLength * 3) - 1,
        type: 'A\'',
        key: key,
        mode: mode,
        cadence: 'PAC'
      }
    };

    return {
      progression: fullProgression,
      sectionMarkers,
      form: 'ternary',
      A: a1Data.progression,
      B: bData.progression,
      Aprime: a2Data.progression,
      rng: rng
    };
  },

  /**
   * Analyzes a progression to identify phrase boundaries and cadences
   * @param {object[]} progression - Array of chord objects
   * @returns {object[]} Array of phrase boundary markers
   */
  analyzePhrases: (progression) => {
    const phrases = [];
    let currentPhrase = {
      start: 0,
      chords: []
    };

    for (let i = 0; i < progression.length; i++) {
      const chord = progression[i];
      currentPhrase.chords.push(chord);

      // Check for cadence patterns
      const isCadence = (
        // V-I (PAC/IAC)
        (i > 0 && progression[i - 1].numeral === 'V' && chord.numeral === 'I') ||
        // V-vi (DC)
        (i > 0 && progression[i - 1].numeral === 'V' && chord.numeral === 'vi') ||
        // IV-V (HC)
        (i > 0 && progression[i - 1].numeral === 'IV' && chord.numeral === 'V') ||
        // Last chord
        (i === progression.length - 1)
      );

      if (isCadence) {
        currentPhrase.end = i;
        currentPhrase.length = i - currentPhrase.start + 1;

        // Determine cadence type
        if (i > 0) {
          const prevChord = progression[i - 1];
          if (prevChord.numeral === 'V' && chord.numeral === 'I') {
            currentPhrase.cadence = chord.inversion === 0 ? 'PAC' : 'IAC';
          } else if (prevChord.numeral === 'V' && chord.numeral === 'vi') {
            currentPhrase.cadence = 'DC';
          } else if (prevChord.numeral === 'IV' && chord.numeral === 'V') {
            currentPhrase.cadence = 'HC';
          }
        }

        phrases.push(currentPhrase);
        currentPhrase = {
          start: i + 1,
          chords: []
        };
      }
    }

    return phrases;
  }
};

module.exports = PhraseStructure;