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
  }
};

module.exports = Rules;
