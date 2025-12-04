class Motif {
  constructor(notes = []) {
    this.notes = notes;
  }

  /**
   * Generates a random motif of a given length within a scale.
   * @param {number} length - Number of notes (3-7).
   * @param {string[]} scale - Array of notes in the scale.
   * @returns {Motif}
   */
  static generate(length = 4, scale) {
    const notes = [];
    for (let i = 0; i < length; i++) {
      const randomNote = scale[Math.floor(Math.random() * scale.length)];
      notes.push(randomNote);
    }
    return new Motif(notes);
  }
}

module.exports = Motif;
