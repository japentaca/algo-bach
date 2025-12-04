const { Note } = require('tonal');

class Modulator {
  constructor(startKey = 'C') {
    this.startKey = startKey;
  }

  /**
   * Returns a related key based on the Circle of Fifths.
   * @param {string} currentKey 
   * @returns {string} New key
   */
  getNextRelatedKey(currentKey) {
    const options = [
      { relation: 'Dominant', interval: '5P' },
      { relation: 'Subdominant', interval: '4P' },
      { relation: 'Relative Minor', interval: '-3m' }, // Assuming Major context
      { relation: 'Supertonic', interval: '2M' }
    ];
    // Weighted random? For now, uniform.
    const choice = options[Math.floor(Math.random() * options.length)];
    // Simplify note name (e.g., "Fx" -> "G") to avoid double sharps/flats accumulation
    return Note.simplify(Note.transpose(currentKey, choice.interval));
  }

  /**
   * Plans a route of keys for a given length.
   * @param {string} startKey 
   * @param {number} length 
   * @returns {string[]} Array of keys
   */
  planRoute(startKey, length) {
    const route = [startKey];
    let current = startKey;
    for (let i = 0; i < length; i++) {
      current = this.getNextRelatedKey(current);
      route.push(current);
    }
    return route;
  }

  /**
   * Plans the modulation path based on the structure.
   * @param {Array} sections - The structure sections.
   * @returns {Array} Array of keys for each section.
   */
  plan(sections) {
    let currentKey = this.startKey;

    return sections.map((section, index) => {
      const start = currentKey;
      let end;

      // If it's the last section, we usually want to end on the Tonic
      if (index === sections.length - 1) {
        end = this.startKey;
      } else {
        // Decide if this section modulates or stays
        // For now, let's say 50% chance to modulate, 50% to stay (start=end)
        // But to make it interesting, let's modulate often.
        end = this.getNextRelatedKey(start);
      }

      currentKey = end;
      return { start, end };
    });
  }
}

module.exports = Modulator;
