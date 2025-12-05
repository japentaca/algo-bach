const Progressions = require('../harmony/progressions');
const Leading = require('../voices/leading');
const Melodic = require('../voices/melodic');
const Rhythms = require('../rhythms/patterns');
const { Note, Interval, Scale } = require('tonal');
const seedrandom = require('seedrandom');

class Planner {
  generate(options = {}) {
    const form = options.form || 'Chorale';
    const formDuration = parseInt(options.duration) || 2;
    const mode = options.mode || 'major';
    const key = options.key || 'C';
    const seed = options.seed || 'default';
    // Handle 0 correctly - don't use || 50 which makes 0 become 50
    const ornamentDensity = options.ornamentDensity !== undefined ? parseInt(options.ornamentDensity) : 50;

    // Create ornament configuration with voice-specific multipliers
    // Soprano gets most ornaments, bass gets least
    const ornamentConfig = {
      baseDensity: ornamentDensity / 100,  // Convert 0-100 to 0-1
      voiceMultipliers: [1.0, 0.7, 0.5, 0.3],  // Soprano, Alto, Tenor, Bass
      totalMeasures: formDuration,
      cadenceMeasures: 2  // Suppress ornaments in final 2 measures
    };

    // Check if this is a fugue form
    if (form.toLowerCase() === 'fugue') {
      return this.generateFugue(key, mode, formDuration, seed, ornamentConfig);
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

      // Add velocity for dynamics: Soprano (melody) louder, inner voices softer
      notes.push({ pitch: voicing.B, duration: noteDuration, startTime: startTime, voice: 3, velocity: 85 });
      notes.push({ pitch: voicing.T, duration: noteDuration, startTime: startTime, voice: 2, velocity: 75 });
      notes.push({ pitch: voicing.A, duration: noteDuration, startTime: startTime, voice: 1, velocity: 75 });
      notes.push({ pitch: voicing.S, duration: noteDuration, startTime: startTime, voice: 0, velocity: 95 });
    });

    // 4. Apply Melodic Ornamentation with configuration
    // Chain all ornament functions including trills, mordents, and turns for rapid figures
    const suspendedNotes = Melodic.addSuspensions(notes, progression, key, ornamentConfig);
    const withPassingTones = Melodic.addPassingTones(suspendedNotes, key, mode, ornamentConfig);
    const withNeighbors = Melodic.addNeighborTones(withPassingTones, key, ornamentConfig);
    const withAppog = Melodic.addAppoggiature(withNeighbors, progression, key, ornamentConfig);
    const with98 = Melodic.add98Suspension(withAppog, ornamentConfig);
    // Add rapid figures: trills, mordents, turns (use fractional beat times)
    const withTrills = Melodic.addTrills(with98, key, mode, ornamentConfig);
    const withMordents = Melodic.addMordents(withTrills, key, mode, ornamentConfig);
    const withTurns = Melodic.addTurns(withMordents, key, mode, ornamentConfig);

    // Final cleanup: remove any ornaments that create harsh dissonances between voices
    const ornamentedNotes = Melodic.cleanDissonances(withTurns);

    // Add humanization for organicity
    const humanizedNotes = Melodic.humanize(ornamentedNotes, 0.15);

    const numeralString = progression.map(p => {
      let n = p.numeral;
      if (p.inversion === 1) n += "6";
      if (p.inversion === 2) n += "6/4";
      return n;
    }).join(" - ");

    return {
      notes: humanizedNotes,
      meta: { key, mode, form, style: `Baroque ${form}`, progression: numeralString }
    };
  }

  generateFugue(key, mode = 'major', duration = 2, seed = 'default', ornamentConfig = null) {
    const rng = seedrandom(seed);
    const allNotes = [];
    let currentTime = 0;

    const subject = this.generateSubject(key, mode, rng);

    // Calculate subject duration
    const durationMap = {
      '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75, '16n': 0.25
    };
    const subjectLength = subject.reduce((acc, note) => acc + (durationMap[note.duration] || 1), 0);

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

    // First, fix base note dissonances in fugue counterpoint
    let ornamentedNotes = Melodic.fixFugueDissonances(allNotes, key, mode);
    ornamentedNotes = ornamentedNotes.sort((a, b) => a.startTime - b.startTime);

    if (ornamentConfig) {
      // Update config with actual total measures based on final time
      const totalBeats = currentTime + 16; // Approximate total beats
      const updatedConfig = {
        ...ornamentConfig,
        totalMeasures: Math.ceil(totalBeats / 4)
      };

      // Apply ornamentation chain including trills and mordents for baroque fugue style
      const withPassingTones = Melodic.addPassingTones(ornamentedNotes, key, mode, updatedConfig);
      const withNeighbors = Melodic.addNeighborTones(withPassingTones, key, updatedConfig);
      const with98 = Melodic.add98Suspension(withNeighbors, updatedConfig);
      const withTrills = Melodic.addTrills(with98, key, mode, updatedConfig);
      const withMordents = Melodic.addMordents(withTrills, key, mode, updatedConfig);

      // Final cleanup: remove dissonant ornaments
      ornamentedNotes = Melodic.cleanDissonances(withMordents);
    }

    // Add humanization for organicity
    ornamentedNotes = Melodic.humanize(ornamentedNotes, 0.15);

    return {
      notes: ornamentedNotes,
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

    // Rhythmic motifs for Baroque style
    const motifs = [
      ['4n', '8n', '8n', '4n', '4n'],
      ['8n', '8n', '8n', '8n', '4n', '4n'],
      ['4n.', '8n', '4n', '4n'],
      ['2n', '4n', '4n'],
      ['8n', '16n', '16n', '4n', '4n'],
      ['4n', '4n', '8n', '8n', '4n']
    ];

    const selectedMotif = motifs[Math.floor(rng() * motifs.length)];
    const subject = [];

    let currentDegree = rng() > 0.5 ? 0 : 4; // Start on tonic or dominant

    // Generate notes
    for (let i = 0; i < selectedMotif.length; i++) {
      const duration = selectedMotif[i];
      const octave = currentDegree > 3 ? '4' : '5';

      subject.push({
        pitch: scale[currentDegree] + octave,
        duration: duration
      });

      // Melodic movement
      const movement = rng();
      if (movement < 0.4) currentDegree += 1;      // Step up
      else if (movement < 0.7) currentDegree -= 1; // Step down
      else if (movement < 0.85) currentDegree += 2; // Skip up
      else currentDegree -= 2;                      // Skip down

      currentDegree = ((currentDegree % 7) + 7) % 7;
    }
    return subject;
  }

  transposeToAnswer(subject, key, mode) {
    return subject.map((note) => {
      let transposed = Note.transpose(note.pitch, '5P');
      const notePC = Note.pitchClass(note.pitch);
      const dominantPC = Note.pitchClass(Note.transpose(key, '5P'));
      if (notePC === dominantPC) transposed = Note.transpose(note.pitch, '4P');
      return {
        pitch: transposed || note.pitch,
        duration: note.duration
      };
    });
  }

  generateCountersubject(subject, key, mode, rng) {
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes && scaleData.notes.length > 0 ? scaleData.notes : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Define consonant intervals from the subject note
    // 3rds, 4ths, 5ths, 6ths, octaves are consonant
    const consonantSemitones = [3, 4, 5, 7, 8, 9, 12, 0]; // 3m, 3M, 4P, 5P, 6m, 6M, 8P, unison

    return subject.map((subjectNote) => {
      const subjectPitch = subjectNote.pitch;
      const subjectPC = Note.pitchClass(subjectPitch);

      // Try to find a consonant scale degree
      // Shuffle scale notes and pick first consonant one
      const shuffledScale = [...scale].sort(() => rng() - 0.5);
      let chosenPitch = null;

      for (const candidatePC of shuffledScale) {
        const candidatePitch = candidatePC + '3';
        const subjectWithOctave = subjectPC + '4'; // Subject is typically in octave 4
        const semitones = Math.abs(Interval.semitones(Interval.distance(candidatePitch, subjectWithOctave))) % 12;

        if (consonantSemitones.includes(semitones)) {
          chosenPitch = candidatePitch;
          break;
        }
      }

      // Fallback: return a third below the subject
      if (!chosenPitch) {
        const thirdBelow = Note.transpose(subjectPC + '3', '-3M');
        if (thirdBelow) {
          const tbPC = Note.pitchClass(thirdBelow);
          // Check if it's in scale, otherwise just use root
          if (scale.includes(tbPC)) {
            chosenPitch = tbPC + '3';
          }
        }
      }

      // Ultimate fallback: root of key
      if (!chosenPitch) chosenPitch = key + '3';

      return {
        pitch: chosenPitch,
        duration: subjectNote.duration // Match rhythm for now
      };
    });
  }

  realizeFugueExposition(key, mode, subject, rng) {
    const notes = [];

    // Calculate subject duration in beats
    const durationMap = {
      '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75, '16n': 0.25
    };

    const subjectDuration = subject.reduce((acc, note) => acc + (durationMap[note.duration] || 1), 0);

    const answer = this.transposeToAnswer(subject, key, mode);
    const countersubject = this.generateCountersubject(subject, key, mode, rng);

    const entryTimes = [0, subjectDuration, subjectDuration * 2, subjectDuration * 3];
    const voiceOctaves = ['5', '4', '4', '3'];
    const voices = [0, 1, 2, 3];

    voices.forEach((voice, entryIndex) => {
      const entryTime = entryTimes[entryIndex];
      const isAnswer = entryIndex % 2 === 1;
      const theme = isAnswer ? answer : subject;
      const baseOctave = parseInt(voiceOctaves[voice]);

      let currentNoteTime = entryTime;
      theme.forEach((note) => {
        const pitchPC = Note.pitchClass(note.pitch);
        const dur = durationMap[note.duration] || 1;
        notes.push({
          pitch: pitchPC + baseOctave,
          duration: note.duration,
          startTime: currentNoteTime,
          voice,
          velocity: 105 // Subject is prominent
        });
        currentNoteTime += dur;
      });

      if (entryIndex > 0) {
        const csVoice = voices[entryIndex - 1];
        const csOctave = parseInt(voiceOctaves[csVoice]);

        let csNoteTime = entryTime;
        countersubject.forEach((note) => {
          const pitchPC = Note.pitchClass(note.pitch);
          const dur = durationMap[note.duration] || 1;
          notes.push({
            pitch: pitchPC + csOctave,
            duration: note.duration,
            startTime: csNoteTime,
            voice: csVoice,
            velocity: 85 // Countersubject less prominent
          });
          csNoteTime += dur;
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

      // Create space: not all voices play all the time in episodes
      // Keep Soprano and Bass mostly active, inner voices can rest

      notes.push({ pitch: voicing.S, duration: index % 2 === 0 ? '4n' : '2n', startTime, voice: 0, velocity: 90 });

      if (rng() > 0.3) {
        notes.push({ pitch: voicing.A, duration: '2n', startTime, voice: 1, velocity: 70 });
      }

      if (rng() > 0.3) {
        notes.push({ pitch: voicing.T, duration: '2n', startTime, voice: 2, velocity: 70 });
      }

      notes.push({ pitch: voicing.B, duration: '2n', startTime, voice: 3, velocity: 85 });
    });
    return notes;
  }

  realizeMiddleEntries(key, mode, subject, rng) {
    const notes = [];
    const durationMap = {
      '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75, '16n': 0.25
    };
    const subjectDuration = subject.reduce((acc, note) => acc + (durationMap[note.duration] || 1), 0);

    const answer = this.transposeToAnswer(subject, key, mode);
    const entryTimes = [0, subjectDuration];
    const themes = [subject, answer];
    const entryVoices = [1, 2];
    const octaves = ['4', '3'];

    entryVoices.forEach((voice, entryIndex) => {
      const entryTime = entryTimes[entryIndex];
      const theme = themes[entryIndex];
      const baseOctave = parseInt(octaves[entryIndex]);

      let currentNoteTime = entryTime;
      theme.forEach((note) => {
        const pitchPC = Note.pitchClass(note.pitch);
        const dur = durationMap[note.duration] || 1;
        notes.push({
          pitch: pitchPC + baseOctave,
          duration: note.duration,
          startTime: currentNoteTime,
          voice,
          velocity: 100
        });
        currentNoteTime += dur;
      });
    });

    const progression = Progressions.generate(key, Math.ceil(subjectDuration / 2), 'middle', mode);
    const voicings = Leading.connectChords(progression.progression, rng);

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      if (startTime < subjectDuration) {
        notes.push({ pitch: voicing.S, duration: '2n', startTime, voice: 0, velocity: 75 });
        notes.push({ pitch: voicing.B, duration: '2n', startTime, voice: 3, velocity: 75 });
      }
    });
    return notes;
  }

  realizeFugueStretto(key, mode, subject, rng) {
    const notes = [];
    const durationMap = {
      '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75, '16n': 0.25
    };
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

      let currentNoteTime = entryTime;
      theme.forEach((note) => {
        const pitchPC = Note.pitchClass(note.pitch);
        const dur = durationMap[note.duration] || 1;
        notes.push({
          pitch: pitchPC + baseOctave,
          duration: note.duration,
          startTime: currentNoteTime,
          voice,
          velocity: 100
        });
        currentNoteTime += dur;
      });
    });
    return notes;
  }

  realizeFinalEntry(key, mode, subject, rng) {
    const notes = [];
    const durationMap = {
      '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75, '16n': 0.25
    };
    const subjectDuration = subject.reduce((acc, note) => acc + (durationMap[note.duration] || 1), 0);

    // Subject entry in bass (pedal point effect)
    let currentNoteTime = 0;
    subject.forEach((note) => {
      const pitchPC = Note.pitchClass(note.pitch);
      const dur = durationMap[note.duration] || 1;
      notes.push({
        pitch: pitchPC + '2',
        duration: note.duration,
        startTime: currentNoteTime,
        voice: 3,
        velocity: 110 // Loud bass entry
      });
      currentNoteTime += dur;
    });

    // Generate progression for upper voices during subject
    const progression = Progressions.generate(key, Math.ceil(subjectDuration / 2), 'final-upper', mode);
    const voicings = Leading.connectChords(progression.progression, rng);

    voicings.forEach((voicing, index) => {
      const startTime = index * 2;
      if (startTime < subjectDuration) {
        notes.push({ pitch: voicing.S, duration: '2n', startTime, voice: 0, velocity: 80 });
        notes.push({ pitch: voicing.A, duration: '2n', startTime, voice: 1, velocity: 80 });
        notes.push({ pitch: voicing.T, duration: '2n', startTime, voice: 2, velocity: 80 });
      }
    });

    // EXPLICIT FINAL CADENCE: Must resolve to tonic in ORIGINAL key
    // This ensures the piece ends properly regardless of any modulation
    const finalCadence = Progressions.getFinalCadence(mode);
    const cadenceStartTime = subjectDuration;

    // Realize the final cadence chords
    const cadenceChords = finalCadence.map(chord => {
      const chordName = require('tonal').Progression.fromRomanNumerals(key, [chord.numeral])[0];
      return {
        name: chordName,
        inversion: chord.inversion,
        numeral: chord.numeral,
        seventh: chord.numeral.includes('7')
      };
    });

    const cadenceVoicings = Leading.connectChords(cadenceChords, rng);

    cadenceVoicings.forEach((voicing, index) => {
      const startTime = cadenceStartTime + index * 2;
      const isLastChord = index === cadenceVoicings.length - 1;
      const duration = isLastChord ? '1n' : '2n';  // Final chord is longer

      notes.push({ pitch: voicing.S, duration, startTime, voice: 0, velocity: isLastChord ? 90 : 85 });
      notes.push({ pitch: voicing.A, duration, startTime, voice: 1, velocity: isLastChord ? 90 : 85 });
      notes.push({ pitch: voicing.T, duration, startTime, voice: 2, velocity: isLastChord ? 90 : 85 });
      notes.push({ pitch: voicing.B, duration, startTime, voice: 3, velocity: isLastChord ? 90 : 85 });
    });

    return notes;
  }
}

module.exports = Planner;
