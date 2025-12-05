const { Note, Interval, Scale, Chord } = require('tonal');

const Melodic = {
  /**
   * Adds passing tones to a set of notes.
   * @param {object[]} notes - Array of { pitch, duration, startTime, voice }
   * @param {string} key - e.g., "C"
   */
  addPassingTones: (notes, key) => {
    const ornamentedNotes = [];
    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach(voiceNotes => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        if (!next) {
          ornamentedNotes.push(current);
          continue;
        }

        // Check for Thirds (Major or Minor)
        const interval = Interval.distance(current.pitch, next.pitch);
        const semitones = Math.abs(Interval.semitones(interval));

        if (semitones === 3 || semitones === 4) {
          // Found a third! Try to add a passing tone.
          const passingPitch = Melodic.findPassingTone(current.pitch, next.pitch);

          if (passingPitch) {
            // 1. Shorten current note
            ornamentedNotes.push({
              pitch: current.pitch,
              duration: "4n",
              startTime: current.startTime,
              voice: current.voice
            });

            // 2. Add Passing Tone
            ornamentedNotes.push({
              pitch: passingPitch,
              duration: "4n",
              startTime: current.startTime + 1, // +1 beat
              voice: current.voice,
              type: 'passing'
            });
          } else {
            ornamentedNotes.push(current);
          }
        } else {
          ornamentedNotes.push(current);
        }
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Adds 4-3 suspensions at cadences.
   * @param {object[]} notes - Array of notes
   * @param {object[]} progression - Array of { name, inversion, numeral }
   * @param {string} key - Key of the piece
   */
  addSuspensions: (notes, progression, key) => {
    // We rebuild the notes array
    let finalNotes = [];

    // Group notes by chord index (startTime / 2)
    const notesByChord = {};
    notes.forEach(n => {
      const chordIndex = n.startTime / 2;
      if (!notesByChord[chordIndex]) notesByChord[chordIndex] = [];
      notesByChord[chordIndex].push(n);
    });

    for (let i = 0; i < progression.length; i++) {
      const currentChord = progression[i];
      const nextChord = progression[i + 1];
      const currentNotes = notesByChord[i] || [];

      // Check for V - I cadence
      if (currentChord.numeral === 'V' && nextChord && nextChord.numeral === 'I') {

        // Find the voice with the 3rd of the V chord (The Leading Tone)
        const chordObj = Chord.get(currentChord.name);
        const thirdOfChord = chordObj.notes[1]; // Assuming [Root, 3rd, 5th]

        // Find the note in currentNotes that matches this pitch class
        const targetNoteIndex = currentNotes.findIndex(n => Note.pitchClass(n.pitch) === thirdOfChord);

        if (targetNoteIndex !== -1) {
          const targetNote = currentNotes[targetNoteIndex];

          // Check Preparation: Did this voice have the 4th (Root of I) in the previous chord?
          const suspensionPitchClass = Note.pitchClass(Chord.get(nextChord.name).notes[0]); // Root of I

          // Look at previous chord (i-1)
          const prevNotes = notesByChord[i - 1];
          if (prevNotes) {
            const prepNote = prevNotes.find(n => n.voice === targetNote.voice && Note.pitchClass(n.pitch) === suspensionPitchClass);

            if (prepNote) {
              // VALID SUSPENSION!
              // Calculate specific pitches
              const resolutionPitch = targetNote.pitch;
              // The suspension pitch is the pitch class of the Tonic (next chord root) in the same octave.
              const suspPitch = Note.pitchClass(suspensionPitchClass) + Note.octave(resolutionPitch);

              // Mark original note as replaced
              targetNote.isSuspensionTarget = true;

              // Add the Suspension Note
              finalNotes.push({
                pitch: suspPitch,
                duration: "4n",
                startTime: targetNote.startTime,
                voice: targetNote.voice,
                type: 'suspension'
              });

              // Add the Resolution Note (Delayed)
              finalNotes.push({
                pitch: resolutionPitch,
                duration: "4n",
                startTime: targetNote.startTime + 1,
                voice: targetNote.voice,
                type: 'resolution'
              });
            }
          }
        }
      }

      // Add all notes for this chord that weren't replaced
      currentNotes.forEach(n => {
        if (!n.isSuspensionTarget) {
          finalNotes.push(n);
        }
      });
    }

    return finalNotes.sort((a, b) => a.startTime - b.startTime);
  },

  findPassingTone: (p1, p2) => {
    const midi1 = Note.midi(p1);
    const midi2 = Note.midi(p2);
    const midMidi = (midi1 + midi2) / 2;

    if (Math.abs(midi1 - midi2) === 4) {
      return Note.fromMidi(Math.round(midMidi));
    } else if (Math.abs(midi1 - midi2) === 3) {
      const lower = midi1 < midi2 ? midi1 : midi2;
      return Note.fromMidi(lower + 2); // Major 2nd from bottom
    }
    return null;
  },

  /**
   * Adds neighbor tones (approach by step, return by step)
   * @param {object[]} notes - Array of notes
   * @param {string} key - Key of the piece
   */
  addNeighborTones: (notes, key) => {
    const ornamentedNotes = [];
    const scale = Scale.get(`${key} major`).notes;
    const scaleSet = new Set(scale);

    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach(voiceNotes => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        if (!next || Math.random() > 0.4) {
          // 60% chance to skip neighbor tones (for variety)
          ornamentedNotes.push(current);
          continue;
        }

        // Find a neighbor tone (step above or below)
        const currentPC = Note.pitchClass(current.pitch);
        const currentOctave = Note.octave(current.pitch);

        // Try to find a neighbor note in the scale
        const scaleIndex = scale.findIndex(n => n === currentPC);
        if (scaleIndex !== -1) {
          // Get upper or lower neighbor
          const neighbor = Math.random() > 0.5
            ? scale[(scaleIndex + 1) % scale.length]
            : scale[(scaleIndex - 1 + scale.length) % scale.length];

          const neighborPitch = neighbor + currentOctave;

          // Add current note shortened
          ornamentedNotes.push({
            ...current,
            duration: "4n"
          });

          // Add neighbor tone
          ornamentedNotes.push({
            pitch: neighborPitch,
            duration: "4n",
            startTime: current.startTime + 1,
            voice: current.voice,
            type: 'neighbor'
          });
        } else {
          ornamentedNotes.push(current);
        }
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Adds appoggiaturas (accented non-chord tone resolving by step)
   * @param {object[]} notes - Array of notes
   * @param {object[]} progression - Chord progression
   * @param {string} key - Key of the piece
   */
  addAppoggiature: (notes, progression, key) => {
    const ornamentedNotes = [];

    // Group notes by chord index
    const notesByChord = {};
    notes.forEach(n => {
      const chordIndex = Math.floor(n.startTime / 2);
      if (!notesByChord[chordIndex]) notesByChord[chordIndex] = [];
      notesByChord[chordIndex].push(n);
    });

    for (let i = 0; i < progression.length; i++) {
      const currentNotes = notesByChord[i] || [];

      // Randomly add appoggiaturas to soprano voice
      if (Math.random() > 0.6 && currentNotes.length > 0) {
        const sopranoNote = currentNotes.find(n => n.voice === 0);

        if (sopranoNote) {
          const midi = Note.midi(sopranoNote.pitch);
          // Appoggiatura approaches from a step away
          const approachMidi = Math.random() > 0.5 ? midi + 2 : midi - 2;
          const approachPitch = Note.fromMidi(approachMidi);

          // Add the appoggiatura (non-harmonic tone, accented)
          ornamentedNotes.push({
            pitch: approachPitch,
            duration: "4n",
            startTime: sopranoNote.startTime - 1,
            voice: 0,
            type: 'appoggiatura'
          });

          // Modify original note to be resolution
          ornamentedNotes.push({
            ...sopranoNote,
            duration: "4n",
            startTime: sopranoNote.startTime,
            type: 'resolution'
          });

          // Add other voices
          currentNotes.filter(n => n.voice !== 0).forEach(n => {
            ornamentedNotes.push(n);
          });
        } else {
          currentNotes.forEach(n => ornamentedNotes.push(n));
        }
      } else {
        currentNotes.forEach(n => ornamentedNotes.push(n));
      }
    }

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Adds 9-8 suspensions (upper voice anticipation)
   * @param {object[]} notes - Array of notes
   */
  add98Suspension: (notes) => {
    const ornamentedNotes = [];
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach(voiceNotes => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        if (!next || Math.random() > 0.3) {
          ornamentedNotes.push(current);
          continue;
        }

        // Create a 9-8 suspension if next note is lower
        const currentMidi = Note.midi(current.pitch);
        const nextMidi = Note.midi(next.pitch);

        if (nextMidi < currentMidi && nextMidi >= currentMidi - 2) {
          // Can create suspension
          ornamentedNotes.push({
            ...current,
            duration: "4n"
          });

          ornamentedNotes.push({
            pitch: Note.fromMidi(currentMidi),
            duration: "4n",
            startTime: current.startTime + 1,
            voice: current.voice,
            type: 'suspension'
          });
        } else {
          ornamentedNotes.push(current);
        }
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  }
};

module.exports = Melodic;

