const { Note } = require('tonal');

/**
 * Voice Allocator
 * Manages voice ranges and assignments for SATB (Soprano, Alto, Tenor, Bass).
 */

const RANGES = {
  SOPRANO: { min: "C4", max: "A5" },
  ALTO: { min: "G3", max: "D5" },
  TENOR: { min: "C3", max: "G4" },
  BASS: { min: "E2", max: "C4" }
};

const Allocator = {
  RANGES,

  /**
   * Checks if a note is within the valid range for a given voice.
   * @param {string} note - e.g., "C4"
   * @param {string} voicePart - "SOPRANO", "ALTO", "TENOR", "BASS"
   */
  isWithinRange: (note, voicePart) => {
    const range = RANGES[voicePart];
    if (!range) return false;

    const midi = Note.midi(note);
    const min = Note.midi(range.min);
    const max = Note.midi(range.max);

    return midi >= min && midi <= max;
  },

  /**
   * Returns a rough starting octave for a voice part.
   */
  getStartingOctave: (voicePart) => {
    switch (voicePart) {
      case 'SOPRANO': return 4;
      case 'ALTO': return 4;
      case 'TENOR': return 3;
      case 'BASS': return 2;
      default: return 4;
    }
  }
};

module.exports = Allocator;
