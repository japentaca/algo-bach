const { Scale, Note } = require('tonal');

/**
 * Baroque Scale Engine
 * Handles specific scalar forms used in Bach's time, specifically the
 * mutable nature of the minor mode (Melodic vs Harmonic).
 */

const Scales = {
  /**
   * Get notes for a scale.
   * @param {string} tonic - e.g., "C"
   * @param {string} type - "major", "minor" (natural), "harmonic minor", "melodic minor"
   */
  getScale: (tonic, type) => {
    // Tonal handles standard scales well
    return Scale.get(`${tonic} ${type}`).notes;
  },

  /**
   * Returns the correct scale degree for a given context.
   * Crucial for Melodic Minor: 
   * - Raised 6th and 7th when ascending
   * - Natural 6th and 7th when descending
   */
  getMelodicMinorNote: (tonic, degree, isAscending) => {
    const naturalMinor = Scale.get(`${tonic} minor`).notes;

    // Degree is 1-based index
    const index = degree - 1;
    let note = naturalMinor[index];

    if (isAscending) {
      if (degree === 6 || degree === 7) {
        // Raise by a semitone
        return Note.transpose(note, "1A"); // Augmented unison = +1 semitone
      }
    }
    return note;
  },

  /**
   * Returns the Leading Tone for a key.
   * Always raised in minor keys for dominant function.
   */
  getLeadingTone: (tonic, mode = 'major') => {
    if (mode === 'major') {
      return Note.transpose(tonic, "7M");
    } else {
      // In minor, we need the raised 7th (Harmonic minor 7th)
      // Natural minor 7th is 7m, so we want 7M from root
      return Note.transpose(tonic, "7M");
    }
  }
};

module.exports = Scales;
