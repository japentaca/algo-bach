const Progressions = require('../harmony/progressions');
const Leading = require('../voices/leading');
const Melodic = require('../voices/melodic');
const Rhythms = require('../rhythms/patterns');

class Planner {
  generate(options = {}) {
    const form = options.form || 'Chorale';
    const duration = options.duration || 2;
    const mode = options.mode || 'major';
    const key = options.key || 'C';

    // 1. Generate Harmonic Framework (main progression)
    const seed = options.seed || 'default';
    const progressionData = Progressions.generate(key, duration, seed, mode);
    const progression = progressionData.progression;

    // 2. Apply Voice Leading (SATB)
    const voicings = Leading.connectChords(progression);

    // 3. Convert Voicings to Note Objects with rhythmic variety
    const notes = [];
    const rhythmPattern = Rhythms.getPattern(form.toLowerCase());

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      const duration = rhythmPattern[index % rhythmPattern.length];

      // Bass (voice 3)
      notes.push({ pitch: voicing.B, duration: duration, startTime: startTime, voice: 3 });

      // Tenor (voice 2)
      notes.push({ pitch: voicing.T, duration: duration, startTime: startTime, voice: 2 });

      // Alto (voice 1)
      notes.push({ pitch: voicing.A, duration: duration, startTime: startTime, voice: 1 });

      // Soprano (voice 0)
      notes.push({ pitch: voicing.S, duration: duration, startTime: startTime, voice: 0 });
    });

    // 4. Apply Melodic Ornamentation
    const suspendedNotes = Melodic.addSuspensions(notes, progression, key);
    const ornamentedNotes = Melodic.addPassingTones(suspendedNotes, key);

    // Format progression string
    const numeralString = progression.map(p => {
      let n = p.numeral;
      if (p.inversion === 1) n += "6";
      if (p.inversion === 2) n += "6/4";
      return n;
    }).join(" - ");

    return {
      notes: ornamentedNotes,
      meta: {
        key: key,
        mode: mode,
        form: form,
        style: `Baroque ${form}`,
        progression: numeralString
      }
    };
  }
}

module.exports = Planner;
