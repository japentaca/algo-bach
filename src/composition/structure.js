class Structure {
  constructor(form = 'AABB') {
    this.form = form;
    this.sections = [];
  }

  /**
   * Generates the structure for the piece.
   * @returns {Object} Structure definition
   */
  generate(formType = 'Chorale') {
    this.sections = [];

    if (formType === 'Prelude') {
      this.sections = [
        { name: 'A', type: 'Exposition', bars: 8, keyChange: 'I-V' },
        { name: 'B', type: 'Development', bars: 12, keyChange: 'V-vi' },
        { name: 'A\'', type: 'Recapitulation', bars: 8, keyChange: 'vi-I' }
      ];
    } else if (formType === 'Fugue') {
      this.sections = [
        { name: 'Exposition', type: 'Fugue-Exposition', bars: 8, keyChange: 'I-I' },
        { name: 'Episode 1', type: 'Episode', bars: 4, keyChange: 'I-V' },
        { name: 'Middle Entry', type: 'Middle-Entry', bars: 8, keyChange: 'V-vi' },
        { name: 'Episode 2', type: 'Episode', bars: 4, keyChange: 'vi-I' },
        { name: 'Final Entry', type: 'Final-Entry', bars: 8, keyChange: 'I-I' }
      ];
    } else {
      // Default: Chorale (AABB)
      this.sections = [
        { name: 'A', type: 'Exposition', bars: 8, keyChange: 'I-V' },
        { name: 'A', type: 'Exposition', bars: 8, keyChange: 'I-V' },
        { name: 'B', type: 'Development', bars: 8, keyChange: 'V-I' },
        { name: 'B', type: 'Development', bars: 8, keyChange: 'V-I' }
      ];
    }
    return this.sections;
  }
}

module.exports = Structure;
