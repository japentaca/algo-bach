const { Interval } = require('tonal');

/**
 * Bach-style Counterpoint Rules Engine
 * Based on Fuxian species counterpoint and Baroque harmonic practice.
 */

const PERFECT_CONSONANCES = ['1P', '5P', '8P', '15P', '12P', '22P', '19P']; // Unisons, Perfect 5ths, Octaves
const IMPERFECT_CONSONANCES = ['3M', '3m', '6M', '6m', '10M', '10m', '13M', '13m']; // 3rds and 6ths
// Note: The Perfect 4th is dissonant in strict two-part counterpoint, 
// though consonant in triads. We treat it as dissonant for strict checking.
const DISSONANCES = ['2M', '2m', '4P', '4A', '4d', '5A', '5d', '7M', '7m', '9M', '9m'];

const Rules = {
  /**
   * Analyzes an interval between two notes.
   * @param {string} note1 - Lower note (e.g., "C4")
   * @param {string} note2 - Higher note (e.g., "G4")
   * @returns {object} Analysis of the interval
   */
  analyzeInterval: (note1, note2) => {
    const interval = Interval.distance(note1, note2);
    const simple = Interval.simplify(interval); // e.g., "10M" -> "3M"
    const semitones = Interval.semitones(interval);

    let quality = 'dissonant';
    if (PERFECT_CONSONANCES.includes(simple) || PERFECT_CONSONANCES.includes(interval)) {
      quality = 'perfect_consonance';
    } else if (IMPERFECT_CONSONANCES.includes(simple) || IMPERFECT_CONSONANCES.includes(interval)) {
      quality = 'imperfect_consonance';
    }

    return {
      interval: interval,
      simple: simple,
      semitones: semitones,
      quality: quality,
      isConsonant: quality !== 'dissonant',
      isPerfect: quality === 'perfect_consonance'
    };
  },

  /**
   * Checks if an interval is a perfect fifth or octave (for parallel checking).
   */
  isPerfectFifthOrOctave: (interval) => {
    const simple = Interval.simplify(interval);
    return simple === '5P' || simple === '8P' || simple === '1P';
  },

  /**
   * Determines if motion is parallel, contrary, oblique, or similar.
   */
  analyzeMotion: (voice1Old, voice1New, voice2Old, voice2New) => {
    const int1 = Interval.semitones(Interval.distance(voice1Old, voice1New));
    const int2 = Interval.semitones(Interval.distance(voice2Old, voice2New));

    if (int1 === 0 && int2 === 0) return 'static';
    if (int1 === 0 || int2 === 0) return 'oblique';

    const dir1 = Math.sign(int1);
    const dir2 = Math.sign(int2);

    if (dir1 !== dir2) return 'contrary';
    if (int1 === int2) return 'parallel';
    return 'similar';
  },

  /**
   * Evaluates root motion quality between two chord numerals
   * @param {string} fromNumeral - Source chord (e.g., 'V', 'ii')
   * @param {string} toNumeral - Target chord (e.g., 'I', 'vi')
   * @returns {object} Quality assessment { quality: 'strong'|'moderate'|'weak'|'avoid', score: 0-1 }
   */
  getRootMotionQuality: (fromNumeral, toNumeral) => {
    const degreeMap = { 'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6 };
    const degreeToSemitones = [0, 2, 4, 5, 7, 9, 11];

    const cleanFrom = fromNumeral.replace(/[°7]/g, '').toUpperCase();
    const cleanTo = toNumeral.replace(/[°7]/g, '').toUpperCase();

    const fromDegree = degreeMap[cleanFrom] !== undefined ? degreeMap[cleanFrom] : 0;
    const toDegree = degreeMap[cleanTo] !== undefined ? degreeMap[cleanTo] : 0;

    const interval = Math.abs(degreeToSemitones[toDegree] - degreeToSemitones[fromDegree]) % 12;

    // Classify by interval
    if (interval === 5 || interval === 7) {
      return { quality: 'strong', score: 0.9 };  // 4ths and 5ths (circle of fifths)
    } else if (interval === 3 || interval === 4 || interval === 8 || interval === 9) {
      return { quality: 'moderate', score: 0.6 };  // 3rds and 6ths
    } else if (interval === 6) {
      return { quality: 'avoid', score: 0.1 };  // Tritone
    } else if (interval === 0) {
      return { quality: 'weak', score: 0.4 };  // Same chord
    } else {
      return { quality: 'weak', score: 0.3 };  // 2nds and 7ths
    }
  },

  /**
   * Checks if a chord transition is a strong harmonic resolution
   * @param {string} fromNumeral - Source chord (e.g., 'V', 'V7')
   * @param {string} toNumeral - Target chord (e.g., 'I', 'vi')
   * @returns {boolean} True if this is a strong resolution
   */
  isStrongResolution: (fromNumeral, toNumeral) => {
    const strongResolutions = [
      ['V', 'I'], ['V', 'i'], ['V7', 'I'], ['V7', 'i'],
      ['vii°', 'I'], ['vii°', 'i'], ['vii°7', 'I'], ['vii°7', 'i'],
      ['IV', 'I'], ['iv', 'i'],  // Plagal
      ['ii', 'V'], ['ii°', 'V'], ['IV', 'V'], ['iv', 'V']  // Pre-dominant to dominant
    ];

    const cleanFrom = fromNumeral.replace(/6\/4|6/g, '');
    const cleanTo = toNumeral.replace(/6\/4|6/g, '');

    return strongResolutions.some(([f, t]) => cleanFrom === f && cleanTo === t);
  },

  /**
   * Checks if a progression contains retrogressive motion (going "backwards" in functional harmony)
   * @param {string} fromFunction - Source function ('TONIC', 'SUBDOMINANT', 'DOMINANT')
   * @param {string} toFunction - Target function
   * @returns {boolean} True if this is retrogressive motion
   */
  isRetrogradeMotion: (fromFunction, toFunction) => {
    // Retrograde: D->S or T->D without S in between (less common)
    const retrogressions = [
      ['DOMINANT', 'SUBDOMINANT'],  // V -> IV (retrogression)
      ['TONIC', 'DOMINANT']         // I -> V without passing through SD (acceptable but less strong)
    ];

    return retrogressions.some(([f, t]) => fromFunction === f && toFunction === t);
  }
};

module.exports = Rules;
