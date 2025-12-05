const Progressions = require('../harmony/progressions');
const Leading = require('../voices/leading');
const Melodic = require('../voices/melodic');
const Rhythms = require('../rhythms/patterns');
const { Note, Interval, Scale } = require('tonal');
const seedrandom = require('seedrandom');

class Planner {
  generate(options = {}) {
    const form = options.form || 'Chorale';
    const formDuration = options.duration || 2;
    const mode = options.mode || 'major';
    const key = options.key || 'C';
    const seed = options.seed || 'default';

    // Check if this is a fugue form
    if (form.toLowerCase() === 'fugue') {
      return this.generateFugue(key, mode, formDuration, seed);
    }

    // 1. Generate Harmonic Framework (main progression)
    const progressionData = Progressions.generate(key, formDuration, seed, mode);
    const progression = progressionData.progression;
    const rng = progressionData.rng;

    // 2. Apply Voice Leading (SATB)
    const voicings = Leading.connectChords(progression, rng);

    // 3. Convert Voicings to Note Objects with rhythmic variety
    const notes = [];
    const rhythmPattern = Rhythms.getPattern(form.toLowerCase());

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      const noteDuration = rhythmPattern[index % rhythmPattern.length];

      notes.push({ pitch: voicing.B, duration: noteDuration, startTime: startTime, voice: 3 });
      notes.push({ pitch: voicing.T, duration: noteDuration, startTime: startTime, voice: 2 });
      notes.push({ pitch: voicing.A, duration: noteDuration, startTime: startTime, voice: 1 });
      notes.push({ pitch: voicing.S, duration: noteDuration, startTime: startTime, voice: 0 });
    });

    // 4. Apply Melodic Ornamentation
    const suspendedNotes = Melodic.addSuspensions(notes, progression, key);
    const ornamentedNotes = Melodic.addPassingTones(suspendedNotes, key, mode);

    const numeralString = progression.map(p => {
      let n = p.numeral;
      if (p.inversion === 1) n += "6";
      if (p.inversion === 2) n += "6/4";
      return n;
    }).join(" - ");

    return {
      notes: ornamentedNotes,
      meta: { key, mode, form, style: `Baroque ${form}`, progression: numeralString }
    };
  }

  generateFugue(key, mode = 'major', duration = 2, seed = 'default') {
    const rng = seedrandom(seed);
    const allNotes = [];
    let currentTime = 0;

    const subject = this.generateSubject(key, mode, rng);
    const subjectLength = subject.length * 2;

    // 1. EXPOSITION
    const expositionNotes = this.realizeFugueExposition(key, mode, subject, rng);
    expositionNotes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));
    currentTime += subjectLength * 4 + 4;

    // 2. EPISODE 1
    const episode1Notes = this.realizeFugueEpisode(key, mode, subject, rng, 'descendingFifths');
    episode1Notes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));
    currentTime += 16;

    // 3. MIDDLE ENTRIES (relative key)
    const relativeKey = mode === 'major' ? Note.transpose(key, '6m') : Note.transpose(key, '3m');
    const relativeMode = mode === 'major' ? 'minor' : 'major';
    const middleNotes = this.realizeMiddleEntries(relativeKey || key, relativeMode, subject, rng);
    middleNotes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));
    currentTime += subjectLength * 2 + 8;

    // 4. EPISODE 2
    const episode2Notes = this.realizeFugueEpisode(key, mode, subject, rng, 'ascending5ths6ths');
    episode2Notes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));
    currentTime += 16;

    // 5. STRETTO
    const strettoNotes = this.realizeFugueStretto(key, mode, subject, rng);
    strettoNotes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));
    currentTime += subjectLength + 8;

    // 6. FINAL ENTRY
    const finalNotes = this.realizeFinalEntry(key, mode, subject, rng);
    finalNotes.forEach(n => allNotes.push({ ...n, startTime: n.startTime + currentTime }));

    return {
      notes: allNotes.sort((a, b) => a.startTime - b.startTime),
      meta: {
        key, mode, form: 'Fugue', style: 'Baroque Fugue',
        progression: 'Fugue: Exposition - Episode - Middle Entries - Episode - Stretto - Final Entry'
      }
    };
  }

  generateSubject(key, mode, rng) {
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes && scaleData.notes.length > 0 ? scaleData.notes : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const subjectLength = 4 + Math.floor(rng() * 4);
    const subject = [];

    let currentDegree = rng() > 0.5 ? 0 : 4;
    subject.push(scale[currentDegree] + '4');

    for (let i = 1; i < subjectLength; i++) {
      const movement = rng();
      if (movement < 0.4) currentDegree += 1;
      else if (movement < 0.7) currentDegree -= 1;
      else if (movement < 0.85) currentDegree += 2;
      else currentDegree -= 2;

      currentDegree = ((currentDegree % 7) + 7) % 7;
      const octave = currentDegree > 3 ? '4' : '5';
      subject.push(scale[currentDegree] + octave);
    }
    return subject;
  }

  transposeToAnswer(subject, key, mode) {
    return subject.map((note, index) => {
      let transposed = Note.transpose(note, '5P');
      const notePC = Note.pitchClass(note);
      const dominantPC = Note.pitchClass(Note.transpose(key, '5P'));
      if (notePC === dominantPC) transposed = Note.transpose(note, '4P');
      return transposed || note;
    });
  }

  generateCountersubject(subject, key, mode, rng) {
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes && scaleData.notes.length > 0 ? scaleData.notes : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    return subject.map(() => scale[Math.floor(rng() * 7)] + '3');
  }

  realizeFugueExposition(key, mode, subject, rng) {
    const notes = [];
    const subjectLength = subject.length;
    const answer = this.transposeToAnswer(subject, key, mode);
    const countersubject = this.generateCountersubject(subject, key, mode, rng);

    const entryTimes = [0, subjectLength * 2, subjectLength * 4, subjectLength * 6];
    const voiceOctaves = ['5', '4', '4', '3'];
    const voices = [0, 1, 2, 3];

    voices.forEach((voice, entryIndex) => {
      const entryTime = entryTimes[entryIndex];
      const isAnswer = entryIndex % 2 === 1;
      const theme = isAnswer ? answer : subject;
      const baseOctave = parseInt(voiceOctaves[voice]);

      theme.forEach((pitch, noteIndex) => {
        const pitchPC = Note.pitchClass(pitch);
        notes.push({ pitch: pitchPC + baseOctave, duration: '2n', startTime: entryTime + noteIndex * 2, voice });
      });

      if (entryIndex > 0) {
        const csVoice = voices[entryIndex - 1];
        const csOctave = parseInt(voiceOctaves[csVoice]);
        countersubject.forEach((pitch, noteIndex) => {
          const pitchPC = Note.pitchClass(pitch);
          notes.push({ pitch: pitchPC + csOctave, duration: '2n', startTime: entryTime + noteIndex * 2, voice: csVoice });
        });
      }
    });
    return notes;
  }

  realizeFugueEpisode(key, mode, subject, rng, sequenceType = 'descendingFifths') {
    const notes = [];
    const sequence = Progressions.generateSequence(key, sequenceType, mode, 1);
    const voicings = Leading.connectChords(sequence, rng);

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      notes.push({ pitch: voicing.S, duration: index % 2 === 0 ? '4n' : '2n', startTime, voice: 0 });
      notes.push({ pitch: voicing.A, duration: '2n', startTime, voice: 1 });
      notes.push({ pitch: voicing.T, duration: '2n', startTime, voice: 2 });
      notes.push({ pitch: voicing.B, duration: '2n', startTime, voice: 3 });
    });
    return notes;
  }

  realizeMiddleEntries(key, mode, subject, rng) {
    const notes = [];
    const answer = this.transposeToAnswer(subject, key, mode);
    const entryTimes = [0, subject.length * 2];
    const themes = [subject, answer];
    const entryVoices = [1, 2];
    const octaves = ['4', '3'];

    entryVoices.forEach((voice, entryIndex) => {
      const entryTime = entryTimes[entryIndex];
      const theme = themes[entryIndex];
      const baseOctave = parseInt(octaves[entryIndex]);

      theme.forEach((pitch, noteIndex) => {
        const pitchPC = Note.pitchClass(pitch);
        notes.push({ pitch: pitchPC + baseOctave, duration: '2n', startTime: entryTime + noteIndex * 2, voice });
      });
    });

    const progression = Progressions.generate(key, subject.length, 'middle', mode);
    const voicings = Leading.connectChords(progression.progression, rng);

    voicings.forEach((voicing, index) => {
      if (index < subject.length) {
        notes.push({ pitch: voicing.S, duration: '2n', startTime: index * 2, voice: 0 });
        notes.push({ pitch: voicing.B, duration: '2n', startTime: index * 2, voice: 3 });
      }
    });
    return notes;
  }

  realizeFugueStretto(key, mode, subject, rng) {
    const notes = [];
    const answer = this.transposeToAnswer(subject, key, mode);
    const strettoInterval = 2;
    const entryTimes = [0, strettoInterval, strettoInterval * 2, strettoInterval * 3];
    const themes = [subject, answer, subject, answer];
    const voices = [0, 1, 2, 3];
    const octaves = ['5', '4', '4', '3'];

    voices.forEach((voice, entryIndex) => {
      const entryTime = entryTimes[entryIndex];
      const theme = themes[entryIndex];
      const baseOctave = parseInt(octaves[entryIndex]);

      theme.forEach((pitch, noteIndex) => {
        const pitchPC = Note.pitchClass(pitch);
        notes.push({ pitch: pitchPC + baseOctave, duration: '2n', startTime: entryTime + noteIndex * 2, voice });
      });
    });
    return notes;
  }

  realizeFinalEntry(key, mode, subject, rng) {
    const notes = [];

    subject.forEach((pitch, index) => {
      const pitchPC = Note.pitchClass(pitch);
      notes.push({ pitch: pitchPC + '2', duration: '2n', startTime: index * 2, voice: 3 });
    });

    const cadenceLength = subject.length + 3;
    const progression = Progressions.generate(key, cadenceLength, 'final', mode);
    const voicings = Leading.connectChords(progression.progression, rng);

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      notes.push({ pitch: voicing.S, duration: '2n', startTime, voice: 0 });
      notes.push({ pitch: voicing.A, duration: '2n', startTime, voice: 1 });
      notes.push({ pitch: voicing.T, duration: '2n', startTime, voice: 2 });
    });

    const finalChord = voicings[voicings.length - 1];
    if (finalChord) {
      const finalTime = voicings.length * 2;
      notes.push({ pitch: finalChord.S, duration: '1n', startTime: finalTime, voice: 0 });
      notes.push({ pitch: finalChord.A, duration: '1n', startTime: finalTime, voice: 1 });
      notes.push({ pitch: finalChord.T, duration: '1n', startTime: finalTime, voice: 2 });
      notes.push({ pitch: key + '2', duration: '1n', startTime: finalTime, voice: 3 });
    }
    return notes;
  }
}

module.exports = Planner;
