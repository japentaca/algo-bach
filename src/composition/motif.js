const { Note, Interval } = require('tonal');

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

  /**
   * Inverts the motif around the first note.
   * @returns {Motif}
   */
  invert() {
    if (this.notes.length === 0) return new Motif([]);
    const pivot = this.notes[0];
    const newNotes = this.notes.map(note => {
      const interval = Interval.distance(pivot, note);
      const semitones = Interval.semitones(interval);
      // Invert direction: +4 semitones becomes -4 semitones
      return Note.transpose(pivot, Interval.fromSemitones(-semitones));
    });
    return new Motif(newNotes);
  }

  /**
   * Retrogrades the motif (reverses order).
   * @returns {Motif}
   */
  retrograde() {
    return new Motif([...this.notes].reverse());
  }

  /**
   * Transposes the motif by a given interval.
   * @param {string} interval - e.g., "2M", "-5P"
   * @returns {Motif}
   */
  transpose(interval) {
    const newNotes = this.notes.map(note => Note.transpose(note, interval));
    return new Motif(newNotes);
  }

  /**
   * Mutates the motif by slightly changing one note.
   * @returns {Motif}
   */
  mutate() {
    if (this.notes.length === 0) return new Motif([]);
    const newNotes = [...this.notes];
    const index = Math.floor(Math.random() * newNotes.length);
    // Randomly move up or down by a step (approx 2 semitones)
    const shift = Math.random() > 0.5 ? "2M" : "-2M";
    newNotes[index] = Note.transpose(newNotes[index], shift);
    return new Motif(newNotes);
  }
}

module.exports = Motif;
