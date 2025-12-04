const { Interval } = require('tonal');
const Motif = require('./motif');
const Structure = require('./structure');
const Modulator = require('./modulator');
const Transform = require('./transform');
const Progressions = require('../harmony/progressions');
const Leading = require('../voices/leading');
const Melodic = require('../voices/melodic');

class Planner {
  constructor() {
    this.structure = new Structure();
    this.modulator = new Modulator();
  }

  generate(options = {}) {
    const form = options.form || 'Chorale';
    const duration = options.duration || 2;

    // 1. Define Structure
    const sections = this.structure.generate(form, duration);

    // 2. Plan Modulation
    const keyPlan = this.modulator.plan(sections);

    // 3. Generate Primary Motif
    // Assuming C Major scale for simplicity for now
    const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const primaryMotif = Motif.generate(4, scale);

    let allNotes = [];
    let currentBarOffset = 0;
    let allProgressions = [];

    // 4. Orchestrate Sections
    const pieceSections = sections.map((section, index) => {
      const keys = keyPlan[index];

      // Generate notes for this section
      const result = this.realizeSection(section, keys, primaryMotif, currentBarOffset, form);

      allNotes = allNotes.concat(result.notes);
      allProgressions.push(result.progression);
      currentBarOffset += section.bars;

      return {
        name: section.name,
        type: section.type,
        bars: section.bars,
        keys: keys,
        motif: primaryMotif
      };
    });

    return {
      notes: allNotes,
      meta: {
        key: keyPlan[0].start, // Starting key
        style: `Baroque ${form} (Planner Generated)`,
        structure: sections.map(s => s.name).join('-'),
        progression: allProgressions.join(' | ')
      }
    };
  }

  realizeSection(section, keys, motif, barOffset, form) {
    // Use existing logic to generate harmony and melody for this section
    // We use the start key of the section
    const key = keys.start;
    const length = section.bars;
    const seed = Date.now().toString() + section.name; // Unique seed per section

    // Transform Motif based on section type
    let activeMotif = motif;
    if (section.type === 'Development' || section.name.includes('Episode')) {
      activeMotif = activeMotif.invert();
    }
    if (section.type === 'Variation') {
      activeMotif = activeMotif.mutate();
    }
    if (section.type === 'Recapitulation') {
      // Keep original or maybe retrograde? Let's keep original for recognition.
    }

    // Transpose Motif to current key
    // Assuming motif is in C4 roughly.
    // Calculate interval from C to current key.
    // This is a simplification; ideally we'd know the motif's original key.
    try {
      const interval = Interval.distance('C', key);
      activeMotif = activeMotif.transpose(interval);
    } catch (e) {
      // Fallback if interval fails
    }

    // 1. Generate Harmonic Framework
    const progressionData = Progressions.generate(key, length, seed);
    const progression = progressionData.progression;

    // 2. Apply Voice Leading (SATB)
    const voicings = Leading.connectChords(progression);

    // Apply Motif to Soprano (First few notes)
    voicings.forEach((voicing, index) => {
      if (index < activeMotif.notes.length) {
        // Override Soprano with Motif Note
        // We might need to adjust octave if it's too low/high, but let's trust transpose for now.
        if (activeMotif.notes[index]) {
          voicing.S = activeMotif.notes[index];
        }
      }
    });

    // 3. Convert Voicings to Note Objects
    const notes = [];
    const isSolo = section.type === 'Solo' || section.name.includes('Episode');

    voicings.forEach((voicing, index) => {
      const startTime = (index * 2);

      // Bass (Always present)
      notes.push({ pitch: voicing.B, duration: "2n", startTime: startTime, voice: 3 });

      if (!isSolo) {
        // Tenor
        notes.push({ pitch: voicing.T, duration: "2n", startTime: startTime, voice: 2 });
        // Alto
        notes.push({ pitch: voicing.A, duration: "2n", startTime: startTime, voice: 1 });
      }

      // Soprano (Always present)
      notes.push({ pitch: voicing.S, duration: "2n", startTime: startTime, voice: 0 });
    });

    // 4. Apply Melodic Ornamentation
    // A. Suspensions (Structural)
    const suspendedNotes = Melodic.addSuspensions(notes, progression, key);

    // B. Passing Tones (Decorative)
    const ornamentedNotes = Melodic.addPassingTones(suspendedNotes, key);

    // Shift notes by barOffset
    const finalNotes = ornamentedNotes.map(n => ({
      ...n,
      startTime: n.startTime + (barOffset * 2)
    }));

    // Format progression string
    const numeralString = progression.map(p => {
      let n = p.numeral;
      if (p.inversion === 1) n += "6";
      if (p.inversion === 2) n += "6/4";
      return n;
    }).join(" - ");

    return {
      notes: finalNotes,
      progression: numeralString
    };
  }
}

module.exports = Planner;
