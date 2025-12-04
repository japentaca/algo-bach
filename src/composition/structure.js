class Structure {
  constructor(form = 'AABB') {
    this.form = form;
    this.sections = [];
  }

  /**
   * Generates the structure for the piece.
   * @param {string} formType - The form of the piece.
   * @param {number} durationMinutes - Target duration in minutes.
   * @returns {Object} Structure definition
   */
  generate(formType = 'Chorale', durationMinutes = 2) {
    this.sections = [];

    if (['Ritornello', 'Variations', 'Suite'].includes(formType)) {
      return this.generateExtended(formType, durationMinutes);
    }

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

  generateExtended(formType, durationMinutes) {
    const totalBars = Math.ceil(durationMinutes * 15); // Approx 15 bars/min at 60bpm 4/4
    const sections = [];
    let currentBars = 0;

    if (formType === 'Ritornello') {
      let sectionCount = 1;
      while (currentBars < totalBars) {
        const isTutti = sectionCount % 2 !== 0;
        const name = isTutti ? `Ritornello ${Math.ceil(sectionCount / 2)}` : `Episode ${Math.floor(sectionCount / 2)}`;
        const type = isTutti ? 'Tutti' : 'Solo';
        const bars = isTutti ? 4 : 8; // Ritornellos shorter, Episodes longer

        sections.push({ name, type, bars, keyChange: 'modulating' });
        currentBars += bars;
        sectionCount++;
      }
    } else if (formType === 'Variations') {
      const themeLength = 16;
      sections.push({ name: 'Theme', type: 'Theme', bars: themeLength, keyChange: 'I-I' });
      currentBars += themeLength;

      let varCount = 1;
      while (currentBars < totalBars) {
        sections.push({ name: `Var. ${varCount}`, type: 'Variation', bars: themeLength, keyChange: 'I-I' });
        currentBars += themeLength;
        varCount++;
      }
    } else if (formType === 'Suite') {
      // Fixed suite structure regardless of duration for now, or scale bars?
      // Let's just add standard movements
      sections.push({ name: 'Allemande', type: 'Allemande', bars: 16, keyChange: 'I-V-I' });
      sections.push({ name: 'Courante', type: 'Courante', bars: 16, keyChange: 'I-V-I' });
      sections.push({ name: 'Sarabande', type: 'Sarabande', bars: 16, keyChange: 'I-V-I' });
      sections.push({ name: 'Gigue', type: 'Gigue', bars: 16, keyChange: 'I-V-I' });
    }

    return sections;
  }
}

module.exports = Structure;
