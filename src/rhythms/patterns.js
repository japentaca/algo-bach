/**
 * Rhythmic Patterns Engine
 * Provides various baroque rhythmic patterns for different forms
 */

const Rhythms = {
  /**
   * Predefined rhythmic patterns for different forms
   */
  PATTERNS: {
    chorale: ['2n', '2n', '2n', '2n'],           // All half notes
    prelude: ['8n', '8n', '8n', '8n', '4n', '4n'], // Sixteenth patterns
    gigue: ['4n.', '8n', '4n.', '8n'],          // Dotted eighth-sixteenth (compound meter)
    allemande: ['4n', '4n', '4n', '4n'],        // All quarter notes
    courante: ['8n', '8n', '4n', '8n', '8n', '4n'], // Mixed sixteenths and quarters
    sarabande: ['4n', '4n', '4n', '4n'],        // Slow quarters
    minuet: ['4n', '4n', '4n', '4n'],           // Simple duple meter
    fugue: ['2n', '2n', '2n', '2n'],            // Steady half notes
    passacaglia: ['4n', '4n', '4n', '4n']       // Steady quarter notes
  },

  /**
   * Gets the rhythm pattern for a given form
   * @param {string} formType - Type of baroque form
   * @returns {array} Array of duration strings
   */
  getPattern: (formType) => {
    const pattern = Rhythms.PATTERNS[formType] || Rhythms.PATTERNS.chorale;
    return pattern;
  },

  /**
   * Generates rhythms for a voice based on form and position
   * @param {string} formType - Baroque form type
   * @param {number} barCount - Number of bars
   * @param {number} voiceNumber - Voice (0=S, 1=A, 2=T, 3=B)
   * @returns {array} Rhythms for all notes in this voice
   */
  generateVoiceRhythms: (formType, barCount, voiceNumber) => {
    const basePattern = Rhythms.getPattern(formType);
    const rhythms = [];

    // Generate rhythms for each bar
    for (let bar = 0; bar < barCount; bar++) {
      // Vary rhythm slightly for lower voices (more rhythmic interest)
      if (voiceNumber === 3 && bar % 2 === 0) {
        // Bass sometimes gets variations
        rhythms.push(...Rhythms.PATTERNS.passacaglia);
      } else {
        rhythms.push(...basePattern);
      }
    }

    return rhythms;
  },

  /**
   * Creates syncopated rhythms (shifted by half beat)
   * Used for ricercar and complex fugal forms
   * @param {string} basePattern - Base rhythm pattern
   * @returns {array} Syncopated variation
   */
  syncope: (basePattern) => {
    return basePattern.map(duration => {
      if (duration === '4n') return '8n.'; // Quarter becomes dotted eighth
      if (duration === '2n') return '4n.'; // Half becomes dotted quarter
      if (duration === '8n') return '16n'; // Eighth becomes sixteenth
      return duration;
    });
  },

  /**
   * Creates augmented rhythms (doubled durations)
   * @param {string} basePattern - Base rhythm pattern
   * @returns {array} Augmented variation
   */
  augment: (basePattern) => {
    return basePattern.map(duration => {
      if (duration === '4n') return '2n';  // Quarter to half
      if (duration === '8n') return '4n';  // Eighth to quarter
      if (duration === '16n') return '8n'; // Sixteenth to eighth
      if (duration === '4n.') return '2n.'; // Dotted quarter to dotted half
      if (duration === '8n.') return '4n.'; // Dotted eighth to dotted quarter
      return duration;
    });
  },

  /**
   * Creates diminished rhythms (halved durations)
   * @param {string} basePattern - Base rhythm pattern
   * @returns {array} Diminished variation
   */
  diminish: (basePattern) => {
    return basePattern.map(duration => {
      if (duration === '2n') return '4n';  // Half to quarter
      if (duration === '4n') return '8n';  // Quarter to eighth
      if (duration === '8n') return '16n'; // Eighth to sixteenth
      if (duration === '2n.') return '4n.'; // Dotted half to dotted quarter
      if (duration === '4n.') return '8n.'; // Dotted quarter to dotted eighth
      return duration;
    });
  },

  /**
   * Applies rhythmic pattern to notes array
   * @param {array} notes - Array of note objects
   * @param {array} rhythms - Durations to apply
   * @returns {array} Notes with updated durations
   */
  applyRhythms: (notes, rhythms) => {
    const notesByVoice = { 0: [], 1: [], 2: [], 3: [] };

    // Group notes by voice
    notes.forEach(n => {
      if (notesByVoice[n.voice]) {
        notesByVoice[n.voice].push(n);
      }
    });

    // Apply rhythms to each voice
    const result = [];
    for (let voice = 0; voice < 4; voice++) {
      const voiceNotes = notesByVoice[voice];
      voiceNotes.forEach((note, idx) => {
        result.push({
          ...note,
          duration: rhythms[idx % rhythms.length]
        });
      });
    }

    return result.sort((a, b) => a.startTime - b.startTime);
  }
};

module.exports = Rhythms;
