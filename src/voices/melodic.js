const { Note, Interval, Scale, Chord } = require('tonal');
const Scales = require('../theory/scales');

/**
 * Default ornament configuration
 */
const DEFAULT_ORNAMENT_CONFIG = {
  baseDensity: 0.5,           // 0-1, from slider (50% default)
  voiceMultipliers: [1.0, 0.7, 0.5, 0.3],  // Soprano, Alto, Tenor, Bass
  totalMeasures: 30,          // Total measures in piece
  cadenceMeasures: 2          // Final measures to suppress ornaments
};

/**
 * Helper to check if a note is in the cadence zone (final measures)
 */
function isInCadenceZone(note, config) {
  const beatsPerMeasure = 4;  // Assuming 4/4 time
  const totalBeats = config.totalMeasures * beatsPerMeasure;
  const cadenceStart = totalBeats - (config.cadenceMeasures * beatsPerMeasure);
  return note.startTime >= cadenceStart;
}

/**
 * Calculate effective probability for an ornament based on config and voice
 */
function getOrnamentProbability(voice, config, baseProb = 1.0) {
  const voiceMultiplier = config.voiceMultipliers[voice] || 0.5;
  return config.baseDensity * voiceMultiplier * baseProb;
}

/**
 * Helper to calculate note duration in beats
 */
function getDurationBeats(duration) {
  const durationMap = {
    '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
    '8n': 0.5, '8n.': 0.75, '16n': 0.25, '32n': 0.125
  };
  return durationMap[duration] || 2;
}

/**
 * Check if a proposed ornament pitch would create a harsh dissonance
 * against notes sounding in other voices at the same time
 * @param {string} ornamentPitch - The pitch of the proposed ornament
 * @param {number} ornamentTime - Start time of the ornament
 * @param {number} ornamentDuration - Duration of the ornament in beats
 * @param {number} ornamentVoice - Voice of the ornament
 * @param {object[]} allNotes - All notes in the piece
 * @returns {boolean} True if the ornament would cause a harsh dissonance
 */
function wouldCauseDissonance(ornamentPitch, ornamentTime, ornamentDuration, ornamentVoice, allNotes) {
  const ornamentEnd = ornamentTime + ornamentDuration;
  const harshIntervals = ['2m', '2M', '7m', '7M', '9m', '9M'];

  for (const note of allNotes) {
    // Skip same voice
    if (note.voice === ornamentVoice) continue;

    // Check if this note overlaps in time with the ornament
    const noteEnd = note.startTime + getDurationBeats(note.duration);
    const overlaps = note.startTime < ornamentEnd && noteEnd > ornamentTime;

    if (overlaps) {
      // Check the interval
      const interval = Interval.distance(ornamentPitch, note.pitch);
      const simple = Interval.simplify(interval);

      if (harshIntervals.includes(simple)) {
        return true; // Would cause harsh dissonance
      }
    }
  }

  return false; // No harsh dissonance
}

/**
 * Fix base note dissonances in fugue by adjusting to consonant pitches
 * This is for fugue counterpoint where base notes can clash
 * @param {object[]} notes - All notes
 * @param {string} key - Key for scale context
 * @param {string} mode - 'major' or 'minor'
 * @returns {object[]} Notes with base dissonances resolved
 */
function fixFugueDissonances(notes, key, mode = 'major') {
  const harshIntervals = ['2m', '2M', '7m', '7M', '9m', '9M'];
  const consonantSemitones = [0, 3, 4, 5, 7, 8, 9, 12]; // unison, 3m, 3M, 4P, 5P, 6m, 6M, 8P

  const scaleType = mode === 'minor' ? 'natural minor' : 'major';
  const scaleData = Scale.get(`${key} ${scaleType}`);
  const scale = scaleData.notes && scaleData.notes.length > 0 ? scaleData.notes : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Sort by time
  const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);
  const adjusted = new Set();

  for (let i = 0; i < sortedNotes.length; i++) {
    if (adjusted.has(i)) continue;

    const note = sortedNotes[i];
    const noteEnd = note.startTime + getDurationBeats(note.duration);

    for (let j = 0; j < sortedNotes.length; j++) {
      if (i === j) continue;
      if (adjusted.has(i)) break; // Stop if we already adjusted this note

      const other = sortedNotes[j];
      if (note.voice === other.voice) continue;

      const otherEnd = other.startTime + getDurationBeats(other.duration);
      const overlaps = note.startTime < otherEnd && noteEnd > other.startTime;

      if (overlaps) {
        const interval = Interval.distance(note.pitch, other.pitch);
        const simple = Interval.simplify(interval);

        if (harshIntervals.includes(simple)) {
          // Determine which note to adjust: prefer adjusting non-subject notes
          // In a fugue, lower voices often have the subject, upper voices are freer
          const noteToAdjust = (note.voice > other.voice) ? i : j;
          const referenceNote = (noteToAdjust === i) ? other : note;
          const targetNote = sortedNotes[noteToAdjust];

          // Skip if already adjusted
          if (adjusted.has(noteToAdjust)) continue;

          // Find a consonant pitch in the same octave
          const originalOctave = Note.octave(targetNote.pitch);
          const refPC = Note.pitchClass(referenceNote.pitch);
          const refWithOctave = refPC + '4';

          for (const candidatePC of scale) {
            const candidatePitch = candidatePC + originalOctave;
            const semitones = Math.abs(Interval.semitones(Interval.distance(candidatePitch, refWithOctave))) % 12;

            if (consonantSemitones.includes(semitones)) {
              targetNote.pitch = candidatePitch;
              adjusted.add(noteToAdjust);
              break;
            }
          }
        }
      }
    }
  }

  return sortedNotes.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Post-process notes to remove any ornaments that create harsh dissonances
 * and clean up duplicate notes at the same time/voice
 * This is a final cleanup pass after all ornaments have been applied
 * @param {object[]} notes - All notes including ornaments
 * @returns {object[]} Notes with dissonant ornaments removed/replaced
 */
function removeDissonantOrnaments(notes) {
  const harshIntervals = ['2m', '2M', '7m', '7M', '9m', '9M'];

  // Sort by time
  const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

  // First pass: identify ornaments that create dissonances
  const toRemove = new Set();

  for (let i = 0; i < sortedNotes.length; i++) {
    if (toRemove.has(i)) continue;

    const note = sortedNotes[i];
    const noteEnd = note.startTime + getDurationBeats(note.duration);
    const noteIsOrnament = note.type && note.type !== 'base' && note.type !== 'resolution';

    for (let j = 0; j < sortedNotes.length; j++) {
      if (i === j) continue;
      if (toRemove.has(j)) continue;

      const other = sortedNotes[j];
      if (note.voice === other.voice) continue;

      const otherEnd = other.startTime + getDurationBeats(other.duration);
      const overlaps = note.startTime < otherEnd && noteEnd > other.startTime;

      if (overlaps) {
        const interval = Interval.distance(note.pitch, other.pitch);
        const simple = Interval.simplify(interval);

        if (harshIntervals.includes(simple)) {
          const otherIsOrnament = other.type && other.type !== 'base' && other.type !== 'resolution';

          // Remove the ornament, keep the base note
          if (noteIsOrnament && !otherIsOrnament) {
            toRemove.add(i);
            break;
          } else if (!noteIsOrnament && otherIsOrnament) {
            toRemove.add(j);
          } else if (noteIsOrnament && otherIsOrnament) {
            // Both are ornaments - remove whichever has higher index
            if (i > j) {
              toRemove.add(i);
              break;
            } else {
              toRemove.add(j);
            }
          }
          // If both are base notes, leave them (voice leading issue, not ornament issue)
        }
      }
    }
  }

  // Build result excluding removed notes
  const result = sortedNotes.filter((_, i) => !toRemove.has(i));

  return result.sort((a, b) => a.startTime - b.startTime);
}

const Melodic = {
  /**
   * Adds passing tones to a set of notes.
   * @param {object[]} notes - Array of { pitch, duration, startTime, voice }
   * @param {string} key - e.g., "C"
   * @param {string} mode - 'major' or 'minor'
   * @param {object} config - Ornament configuration (optional)
   */
  addPassingTones: (notes, key, mode = 'major', config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        if (!next) {
          ornamentedNotes.push(current);
          continue;
        }

        // Skip ornaments in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Check probability based on voice and density
        const prob = getOrnamentProbability(voiceIndex, config, 1.0);
        if (Math.random() > prob) {
          ornamentedNotes.push(current);
          continue;
        }

        // Check for Thirds (Major or Minor)
        const interval = Interval.distance(current.pitch, next.pitch);
        const semitones = Math.abs(Interval.semitones(interval));

        if (semitones === 3 || semitones === 4) {
          // Found a third! Try to add a passing tone.
          const isAscending = Note.midi(next.pitch) > Note.midi(current.pitch);
          const passingPitch = Melodic.findPassingTone(current.pitch, next.pitch, key, mode, isAscending);

          if (passingPitch) {
            // Check if passing tone would cause dissonance with other voices
            if (wouldCauseDissonance(passingPitch, current.startTime + 1, 1, current.voice, notes)) {
              ornamentedNotes.push(current);
              continue;
            }

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
   * @param {object} config - Ornament configuration (optional)
   */
  addSuspensions: (notes, progression, key, config = DEFAULT_ORNAMENT_CONFIG) => {
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

          // Skip if in cadence zone (final measures)
          if (isInCadenceZone(targetNote, config)) {
            currentNotes.forEach(n => finalNotes.push(n));
            continue;
          }

          // Check probability based on voice and density
          const prob = getOrnamentProbability(targetNote.voice, config, 0.8);
          if (Math.random() > prob) {
            currentNotes.forEach(n => finalNotes.push(n));
            continue;
          }

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

  /**
   * Finds appropriate passing tone between two pitches.
   * Uses melodic minor (raised 6th/7th) when ascending in minor keys.
   * @param {string} p1 - First pitch
   * @param {string} p2 - Second pitch
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {boolean} isAscending - Direction of melodic motion
   */
  findPassingTone: (p1, p2, key = 'C', mode = 'major', isAscending = true) => {
    const midi1 = Note.midi(p1);
    const midi2 = Note.midi(p2);

    // For minor mode ascending, use melodic minor (raised 6th and 7th)
    if (mode === 'minor' && isAscending) {
      const lower = midi1 < midi2 ? midi1 : midi2;
      const passingMidi = lower + (Math.abs(midi1 - midi2) === 4 ? 2 : 2);
      const passingNote = Note.fromMidi(passingMidi);
      const passingPC = Note.pitchClass(passingNote);

      // Check if this is scale degree 6 or 7 - if so, raise it
      const minorScale = Scale.get(`${key} minor`).notes;
      const degree6 = minorScale[5]; // 0-indexed, so 5 = 6th degree
      const degree7 = minorScale[6]; // 7th degree

      if (passingPC === degree6 || passingPC === degree7) {
        // Raise by semitone for melodic minor ascending
        return Note.fromMidi(passingMidi + 1);
      }
      return passingNote;
    }

    // Standard passing tone logic for major or descending minor
    if (Math.abs(midi1 - midi2) === 4) {
      const midMidi = (midi1 + midi2) / 2;
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
   * @param {object} config - Ornament configuration (optional)
   */
  addNeighborTones: (notes, key, config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    const scale = Scale.get(`${key} major`).notes;
    const scaleSet = new Set(scale);

    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        // Skip if in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Calculate probability based on voice and density (base 40% chance)
        const prob = getOrnamentProbability(voiceIndex, config, 0.4);
        if (!next || Math.random() > prob) {
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

          // Check if neighbor would cause harsh dissonance with other voices
          if (wouldCauseDissonance(neighborPitch, current.startTime + 1, 1, current.voice, notes)) {
            ornamentedNotes.push(current);
            continue;
          }

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
   * @param {object} config - Ornament configuration (optional)
   */
  addAppoggiature: (notes, progression, key, config = DEFAULT_ORNAMENT_CONFIG) => {
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
      const sopranoNote = currentNotes.find(n => n.voice === 0);

      // Check if soprano note exists and is not in cadence zone
      if (sopranoNote && !isInCadenceZone(sopranoNote, config)) {
        // Calculate probability based on voice (soprano) and density (base 40% chance)
        const prob = getOrnamentProbability(0, config, 0.4);

        if (Math.random() <= prob && currentNotes.length > 0) {
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
   * @param {object} config - Ornament configuration (optional)
   */
  add98Suspension: (notes, config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];
        const next = voiceNotes[i + 1];

        // Skip if in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Calculate probability based on voice and density (base 30% chance)
        const prob = getOrnamentProbability(voiceIndex, config, 0.3);
        if (!next || Math.random() > prob) {
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
  },

  /**
   * Adds trills to notes (rapid alternation between main note and upper neighbor)
   * Trills use 16th or 32nd notes for rapid figures
   * @param {object[]} notes - Array of notes
   * @param {string} key - Key of the piece
   * @param {string} mode - 'major' or 'minor'
   * @param {object} config - Ornament configuration (optional)
   */
  addTrills: (notes, key, mode = 'major', config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];

        // Skip if in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Only add trills to longer notes (half notes or longer)
        const durationBeats = current.duration === '1n' ? 4 :
          current.duration === '2n' ? 2 :
            current.duration === '4n' ? 1 : 0.5;

        if (durationBeats < 2) {
          ornamentedNotes.push(current);
          continue;
        }

        // Calculate probability - trills are rare, mainly on soprano
        const prob = getOrnamentProbability(voiceIndex, config, 0.15);
        if (Math.random() > prob) {
          ornamentedNotes.push(current);
          continue;
        }

        // Find upper neighbor for trill
        const currentPC = Note.pitchClass(current.pitch);
        const currentOctave = Note.octave(current.pitch);
        const currentMidi = Note.midi(current.pitch);

        const scaleIndex = scale.findIndex(n => n === currentPC);
        if (scaleIndex === -1) {
          ornamentedNotes.push(current);
          continue;
        }

        // Get upper neighbor (next scale degree)
        const upperPC = scale[(scaleIndex + 1) % scale.length];
        const upperMidi = currentMidi + (scale.indexOf(upperPC) > scaleIndex ?
          (Note.midi(upperPC + currentOctave) - currentMidi) :
          (Note.midi(upperPC + (currentOctave + 1)) - currentMidi));

        // Calculate semitones to upper neighbor for proper octave
        let upperPitch;
        const tentativeUpper = Note.fromMidi(currentMidi + 1);
        const tentativeUpper2 = Note.fromMidi(currentMidi + 2);
        if (scale.includes(Note.pitchClass(tentativeUpper))) {
          upperPitch = tentativeUpper;
        } else if (scale.includes(Note.pitchClass(tentativeUpper2))) {
          upperPitch = tentativeUpper2;
        } else {
          upperPitch = tentativeUpper2; // Default to whole step
        }

        // Check if trill upper pitch would cause dissonance
        if (wouldCauseDissonance(upperPitch, current.startTime, durationBeats, current.voice, notes)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Create trill with 16th notes (4 alternations per beat)
        const trillDuration = "16n";
        const trillStep = 0.25; // 16th note = 0.25 beats
        const numAlternations = Math.floor(durationBeats / trillStep) - 2; // Leave room for resolution

        for (let t = 0; t < numAlternations; t++) {
          const trillTime = current.startTime + (t * trillStep);
          const isMainNote = t % 2 === 0;

          ornamentedNotes.push({
            pitch: isMainNote ? current.pitch : upperPitch,
            duration: trillDuration,
            startTime: trillTime,
            voice: current.voice,
            type: 'trill'
          });
        }

        // End on main note (resolution)
        ornamentedNotes.push({
          pitch: current.pitch,
          duration: "8n",
          startTime: current.startTime + (numAlternations * trillStep),
          voice: current.voice,
          type: 'trill-resolution'
        });
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Adds mordents (rapid 3-note figures: main-lower-main or main-upper-main)
   * @param {object[]} notes - Array of notes
   * @param {string} key - Key of the piece
   * @param {string} mode - 'major' or 'minor'
   * @param {object} config - Ornament configuration (optional)
   */
  addMordents: (notes, key, mode = 'major', config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];

        // Skip if in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Only on notes with at least 1 beat duration
        const durationBeats = current.duration === '1n' ? 4 :
          current.duration === '2n' ? 2 :
            current.duration === '4n' ? 1 : 0.5;

        if (durationBeats < 1) {
          ornamentedNotes.push(current);
          continue;
        }

        // Calculate probability - mordents are fairly common, especially on soprano
        const prob = getOrnamentProbability(voiceIndex, config, 0.25);
        if (Math.random() > prob) {
          ornamentedNotes.push(current);
          continue;
        }

        const currentPC = Note.pitchClass(current.pitch);
        const currentMidi = Note.midi(current.pitch);
        const scaleIndex = scale.findIndex(n => n === currentPC);

        if (scaleIndex === -1) {
          ornamentedNotes.push(current);
          continue;
        }

        // Choose upper or lower mordent (50/50)
        const isUpper = Math.random() > 0.5;
        let neighborPitch;

        if (isUpper) {
          // Upper mordent: find next scale degree up
          const tentative = Note.fromMidi(currentMidi + 1);
          const tentative2 = Note.fromMidi(currentMidi + 2);
          neighborPitch = scale.includes(Note.pitchClass(tentative)) ? tentative : tentative2;
        } else {
          // Lower mordent: find next scale degree down
          const tentative = Note.fromMidi(currentMidi - 1);
          const tentative2 = Note.fromMidi(currentMidi - 2);
          neighborPitch = scale.includes(Note.pitchClass(tentative)) ? tentative : tentative2;
        }

        // Check if mordent neighbor would cause dissonance
        if (wouldCauseDissonance(neighborPitch, current.startTime, 0.25, current.voice, notes)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Mordent uses 32nd notes (very fast)
        const mordentStep = 0.125; // 32nd note

        // Main note (32nd)
        ornamentedNotes.push({
          pitch: current.pitch,
          duration: "32n",
          startTime: current.startTime,
          voice: current.voice,
          type: 'mordent'
        });

        // Neighbor note (32nd)
        ornamentedNotes.push({
          pitch: neighborPitch,
          duration: "32n",
          startTime: current.startTime + mordentStep,
          voice: current.voice,
          type: 'mordent'
        });

        // Return to main note (remaining duration)
        const remainingBeats = durationBeats - (mordentStep * 2);
        const remainingDuration = remainingBeats >= 1.5 ? "2n" :
          remainingBeats >= 0.75 ? "4n" :
            remainingBeats >= 0.375 ? "8n" : "16n";

        ornamentedNotes.push({
          pitch: current.pitch,
          duration: remainingDuration,
          startTime: current.startTime + (mordentStep * 2),
          voice: current.voice,
          type: 'mordent-resolution'
        });
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Adds turns (4-note figures: upper-main-lower-main)
   * @param {object[]} notes - Array of notes
   * @param {string} key - Key of the piece  
   * @param {string} mode - 'major' or 'minor'
   * @param {object} config - Ornament configuration (optional)
   */
  addTurns: (notes, key, mode = 'major', config = DEFAULT_ORNAMENT_CONFIG) => {
    const ornamentedNotes = [];
    const scaleType = mode === 'minor' ? 'natural minor' : 'major';
    const scaleData = Scale.get(`${key} ${scaleType}`);
    const scale = scaleData.notes || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Group by voice
    const voices = [[], [], [], []];
    notes.forEach(n => voices[n.voice].push(n));

    voices.forEach((voiceNotes, voiceIndex) => {
      for (let i = 0; i < voiceNotes.length; i++) {
        const current = voiceNotes[i];

        // Skip if in cadence zone
        if (isInCadenceZone(current, config)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Need at least quarter note for turn
        const durationBeats = current.duration === '1n' ? 4 :
          current.duration === '2n' ? 2 :
            current.duration === '4n' ? 1 : 0.5;

        if (durationBeats < 1) {
          ornamentedNotes.push(current);
          continue;
        }

        // Turns are less common - around 15% base probability
        const prob = getOrnamentProbability(voiceIndex, config, 0.15);
        if (Math.random() > prob) {
          ornamentedNotes.push(current);
          continue;
        }

        const currentPC = Note.pitchClass(current.pitch);
        const currentMidi = Note.midi(current.pitch);
        const scaleIndex = scale.findIndex(n => n === currentPC);

        if (scaleIndex === -1) {
          ornamentedNotes.push(current);
          continue;
        }

        // Find upper and lower neighbors
        const upperTest1 = Note.fromMidi(currentMidi + 1);
        const upperTest2 = Note.fromMidi(currentMidi + 2);
        const upperPitch = scale.includes(Note.pitchClass(upperTest1)) ? upperTest1 : upperTest2;

        const lowerTest1 = Note.fromMidi(currentMidi - 1);
        const lowerTest2 = Note.fromMidi(currentMidi - 2);
        const lowerPitch = scale.includes(Note.pitchClass(lowerTest1)) ? lowerTest1 : lowerTest2;

        // Check if turn neighbors would cause dissonance
        if (wouldCauseDissonance(upperPitch, current.startTime, 0.5, current.voice, notes) ||
          wouldCauseDissonance(lowerPitch, current.startTime, 0.75, current.voice, notes)) {
          ornamentedNotes.push(current);
          continue;
        }

        // Turn uses 16th notes
        const turnStep = 0.25;

        // Upper neighbor
        ornamentedNotes.push({
          pitch: upperPitch,
          duration: "16n",
          startTime: current.startTime,
          voice: current.voice,
          type: 'turn'
        });

        // Main note
        ornamentedNotes.push({
          pitch: current.pitch,
          duration: "16n",
          startTime: current.startTime + turnStep,
          voice: current.voice,
          type: 'turn'
        });

        // Lower neighbor
        ornamentedNotes.push({
          pitch: lowerPitch,
          duration: "16n",
          startTime: current.startTime + (turnStep * 2),
          voice: current.voice,
          type: 'turn'
        });

        // Return to main (remaining duration)
        const remainingBeats = durationBeats - (turnStep * 3);
        const remainingDuration = remainingBeats >= 1.5 ? "2n" :
          remainingBeats >= 0.75 ? "4n" :
            remainingBeats >= 0.375 ? "8n" : "16n";

        ornamentedNotes.push({
          pitch: current.pitch,
          duration: remainingDuration,
          startTime: current.startTime + (turnStep * 3),
          voice: current.voice,
          type: 'turn-resolution'
        });
      }
    });

    return ornamentedNotes.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Post-process to remove ornaments that cause harsh dissonances
   * Call this after all ornaments have been applied
   * @param {object[]} notes - All notes including ornaments
   * @returns {object[]} Cleaned notes without dissonant ornaments
   */
  cleanDissonances: (notes) => {
    return removeDissonantOrnaments(notes);
  },

  /**
   * Fix base note dissonances in fugue counterpoint
   * Adjusts clashing base notes to consonant pitches
   * @param {object[]} notes - All notes
   * @param {string} key - Key for scale context
   * @param {string} mode - 'major' or 'minor'
   * @returns {object[]} Notes with base dissonances resolved
   */
  fixFugueDissonances: (notes, key, mode = 'major') => {
    return fixFugueDissonances(notes, key, mode);
  },

  /**
   * Humanize the performance by adding micro-timing variations and velocity dynamics
   * @param {object[]} notes - The notes to humanize
   * @param {number} amount - Amount of variation (0-1)
   * @returns {object[]} Humanized notes
   */
  humanize: (notes, amount = 0.1) => {
    return notes.map(note => {
      // Timing variation: +/- amount * 0.1 beats
      const timingOffset = (Math.random() * 2 - 1) * amount * 0.1;

      // Velocity variation: +/- amount * 20
      // If velocity exists, use it, otherwise default to 80
      const baseVelocity = note.velocity || 80;
      const velocityVar = (Math.random() * 2 - 1) * amount * 20;
      const velocity = Math.max(1, Math.min(127, Math.round(baseVelocity + velocityVar)));

      return {
        ...note,
        startTime: Math.max(0, note.startTime + timingOffset),
        velocity: velocity
      };
    });
  }
};

module.exports = Melodic;

