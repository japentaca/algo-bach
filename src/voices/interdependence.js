const { Note, Interval } = require('tonal');
const seedrandom = require('seedrandom');

/**
 * Voice Interdependence Engine
 * Creates dialogue and interaction between voices
 */

const VoiceInterdependence = {
  /**
   * Creates imitative entries between voices
   * @param {object[]} notes - Array of note objects
   * @param {string} key - Tonic key
   * @param {string} mode - 'major' or 'minor'
   * @param {string} seed - Random seed
   * @param {number} imitationDelay - Delay in beats between entries (default 2)
   * @returns {object[]} Notes with imitative entries added
   */
  addImitation: (notes, key, mode = 'major', seed = 'default', imitationDelay = 2) => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Group notes by voice
    const voices = [[], [], [], []];
    notes.forEach(n => {
      if (n.voice < 3) voices[n.voice].push(n);
    });

    // Find melodic motifs in soprano (first 4-6 notes)
    const sopranoMotif = voices[0].slice(0, Math.min(6, voices[0].length));
    if (sopranoMotif.length < 3) return notes; // Too short for meaningful imitation

    // Create imitative entries in alto and tenor
    const entryVoices = [1, 2]; // Alto and tenor
    const entryTimes = [imitationDelay, imitationDelay * 2];

    entryVoices.forEach((voice, index) => {
      const entryTime = entryTimes[index];
      const shouldImitate = rng() > 0.3; // 70% chance of imitation

      if (shouldImitate) {
        // Transpose motif for this voice
        const transposition = voice === 1 ? '-5P' : '-8P'; // Alto down 5th, Tenor down 8ve
        const transposedMotif = sopranoMotif.map(note => ({
          ...note,
          pitch: Note.transpose(note.pitch, transposition),
          startTime: note.startTime + entryTime,
          voice: voice,
          type: 'imitation'
        }));

        result.push(...transposedMotif);
      }
    });

    return result.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Creates call-and-response between voice pairs
   * @param {object[]} notes - Array of note objects
   * @param {string} key - Tonic key
   * @param {string} seed - Random seed
   * @returns {object[]} Notes with call-and-response patterns
   */
  addCallAndResponse: (notes, key, seed = 'default') => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Group notes by voice
    const voices = [[], [], [], []];
    notes.forEach(n => {
      if (n.voice < 3) voices[n.voice].push(n);
    });

    // Define voice pairs for call-and-response
    const voicePairs = [
      { call: 0, response: 1 }, // Soprano calls, Alto responds
      { call: 2, response: 3 }  // Tenor calls, Bass responds
    ];

    voicePairs.forEach(pair => {
      const callNotes = voices[pair.call];
      const responseNotes = voices[pair.response];

      if (callNotes.length < 2 || responseNotes.length < 2) return;

      // Find a clear call phrase (first 2-3 notes)
      const callPhrase = callNotes.slice(0, 3);
      const callEnd = callPhrase[callPhrase.length - 1].startTime;

      // Create response that mirrors call rhythm
      const shouldRespond = rng() > 0.4; // 60% chance of response

      if (shouldRespond) {
        const responseDelay = 1 + Math.floor(rng() * 2); // 1-2 beats delay
        const responseStart = callEnd + responseDelay;

        // Find appropriate response notes (modify existing or create new)
        const responsePhrase = responseNotes.filter(n =>
          n.startTime >= responseStart && n.startTime < responseStart + 4
        );

        if (responsePhrase.length > 0) {
          // Mark as call-and-response
          callPhrase.forEach(n => {
            const idx = result.findIndex(r =>
              r.voice === n.voice &&
              Math.abs(r.startTime - n.startTime) < 0.1
            );
            if (idx !== -1) {
              result[idx].type = 'call';
            }
          });

          responsePhrase.forEach(n => {
            const idx = result.findIndex(r =>
              r.voice === n.voice &&
              Math.abs(r.startTime - n.startTime) < 0.1
            );
            if (idx !== -1) {
              result[idx].type = 'response';
            }
          });
        }
      }
    });

    return result;
  },

  /**
   * Creates contrary motion between voice pairs
   * @param {object[]} notes - Array of note objects
   * @param {string} key - Tonic key
   * @param {string} seed - Random seed
   * @returns {object[]} Notes with enhanced contrary motion
   */
  enhanceContraryMotion: (notes, key, seed = 'default') => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Group notes by voice
    const voices = [[], [], [], []];
    notes.forEach(n => {
      if (n.voice < 4) voices[n.voice].push(n);
    });

    // Define voice pairs for contrary motion
    const voicePairs = [
      { upper: 0, lower: 3 }, // Soprano-Bass
      { upper: 1, lower: 2 }  // Alto-Tenor
    ];

    voicePairs.forEach(pair => {
      const upperNotes = voices[pair.upper];
      const lowerNotes = voices[pair.lower];

      // Find opportunities for contrary motion
      for (let i = 0; i < upperNotes.length - 1; i++) {
        const upperCurrent = upperNotes[i];
        const upperNext = upperNotes[i + 1];

        // Find corresponding lower voice notes
        const lowerCurrent = lowerNotes.find(n =>
          Math.abs(n.startTime - upperCurrent.startTime) < 0.5
        );
        const lowerNext = lowerNotes.find(n =>
          Math.abs(n.startTime - upperNext.startTime) < 0.5
        );

        if (lowerCurrent && lowerNext) {
          // Check if motion is already contrary
          const upperDirection = Note.midi(upperNext.pitch) - Note.midi(upperCurrent.pitch);
          const lowerDirection = Note.midi(lowerNext.pitch) - Note.midi(lowerCurrent.pitch);

          const isContrary = (upperDirection * lowerDirection) < 0;

          // If not contrary and opportunity exists, modify lower voice
          if (!isContrary && rng() > 0.6) { // 40% chance to modify
            // Find a note that creates contrary motion
            const currentMidi = Note.midi(lowerCurrent.pitch);
            const targetDirection = -upperDirection; // Opposite direction

            // Try to find a chord tone in opposite direction
            const step = targetDirection > 0 ? 2 : -2; // Step in opposite direction
            const candidateMidi = currentMidi + step;
            const candidatePitch = Note.fromMidi(candidateMidi);

            // Check if candidate is in scale
            const scaleType = 'major'; // Simplified - should use actual mode
            const scale = require('tonal').Scale.get(`${key} ${scaleType}`).notes;
            const candidatePC = Note.pitchClass(candidatePitch);

            if (scale.includes(candidatePC)) {
              // Modify the note
              const idx = result.findIndex(n =>
                n.voice === lowerNext.voice &&
                Math.abs(n.startTime - lowerNext.startTime) < 0.1
              );
              if (idx !== -1) {
                result[idx].pitch = candidatePitch;
                result[idx].type = 'contrary-motion';
              }
            }
          }
        }
      }
    });

    return result;
  },

  /**
   * Distributes arpeggiation across voices
   * @param {object[]} notes - Array of note objects
   * @param {object[]} progression - Chord progression
   * @param {string} key - Tonic key
   * @param {string} seed - Random seed
   * @returns {object[]} Notes with distributed arpeggiation
   */
  distributeArpeggiation: (notes, progression, key, seed = 'default') => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Group notes by chord
    const notesByChord = {};
    notes.forEach(n => {
      const chordIndex = Math.floor(n.startTime / 2);
      if (!notesByChord[chordIndex]) notesByChord[chordIndex] = [];
      notesByChord[chordIndex].push(n);
    });

    // For each chord, check if arpeggiation is appropriate
    Object.keys(notesByChord).forEach(chordIndex => {
      const chordNotes = notesByChord[chordIndex];
      const chordData = progression[parseInt(chordIndex)];

      if (!chordData) return;

      // Check if all voices are sounding simultaneously (block chord)
      const uniqueStartTimes = [...new Set(chordNotes.map(n => n.startTime))];
      const isBlockChord = uniqueStartTimes.length === 1;

      // 40% chance to arpeggiate block chords
      if (isBlockChord && rng() > 0.6) {
        // Get chord tones
        const chordTones = require('tonal').Chord.get(chordData.name).notes;

        // Create arpeggiated version
        const baseTime = chordNotes[0].startTime;
        const arpeggioDelay = 0.5; // Half beat between notes

        // Sort voices by pitch (high to low for descending arpeggio)
        const sortedVoices = [...chordNotes].sort((a, b) =>
          Note.midi(b.pitch) - Note.midi(a.pitch)
        );

        // Apply timing offsets
        sortedVoices.forEach((note, index) => {
          const idx = result.findIndex(n =>
            n.voice === note.voice &&
            Math.abs(n.startTime - baseTime) < 0.1
          );

          if (idx !== -1) {
            result[idx].startTime = baseTime + (index * arpeggioDelay);
            result[idx].type = 'arpeggio';
          }
        });
      }
    });

    return result.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Creates voice crossing for expressive effect
   * @param {object[]} notes - Array of note objects
   * @param {string} key - Tonic key
   * @param {string} seed - Random seed
   * @returns {object[]} Notes with strategic voice crossing
   */
  addVoiceCrossing: (notes, key, seed = 'default') => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Group notes by voice
    const voices = [[], [], [], []];
    notes.forEach(n => {
      if (n.voice < 3) voices[n.voice].push(n);
    });

    // Look for opportunities between adjacent voices
    const voicePairs = [
      { upper: 0, lower: 1 }, // Soprano-Alto
      { upper: 1, lower: 2 }  // Alto-Tenor
    ];

    voicePairs.forEach(pair => {
      const upperNotes = voices[pair.upper];
      const lowerNotes = voices[pair.lower];

      // Find potential crossing points
      for (let i = 0; i < upperNotes.length; i++) {
        const upperNote = upperNotes[i];

        // Find corresponding lower note
        const lowerNote = lowerNotes.find(n =>
          Math.abs(n.startTime - upperNote.startTime) < 0.5
        );

        if (lowerNote) {
          // Check if voices are close (potential crossing)
          const upperMidi = Note.midi(upperNote.pitch);
          const lowerMidi = Note.midi(lowerNote.pitch);
          const interval = Math.abs(upperMidi - lowerMidi);

          // If interval is small (3rd or less), consider crossing
          if (interval <= 4 && rng() > 0.8) { // 20% chance
            // Swap pitches for expressive effect
            const upperIdx = result.findIndex(n =>
              n.voice === upperNote.voice &&
              Math.abs(n.startTime - upperNote.startTime) < 0.1
            );
            const lowerIdx = result.findIndex(n =>
              n.voice === lowerNote.voice &&
              Math.abs(n.startTime - lowerNote.startTime) < 0.1
            );

            if (upperIdx !== -1 && lowerIdx !== -1) {
              // Swap pitches
              const tempPitch = result[upperIdx].pitch;
              result[upperIdx].pitch = result[lowerIdx].pitch;
              result[lowerIdx].pitch = tempPitch;

              // Mark as voice crossing
              result[upperIdx].type = 'voice-crossing';
              result[lowerIdx].type = 'voice-crossing';
            }
          }
        }
      }
    });

    return result;
  },

  /**
   * Adds motivic development between voices
   * @param {object[]} notes - Array of note objects
   * @param {string} key - Tonic key
   * @param {string} seed - Random seed
   * @returns {object[]} Notes with motivic development
   */
  addMotivicDevelopment: (notes, key, seed = 'default') => {
    const rng = seedrandom(seed);
    const result = [...notes];

    // Extract motivic material from soprano
    const sopranoNotes = notes.filter(n => n.voice === 0);
    if (sopranoNotes.length < 4) return notes;

    // Define a simple motif (first 4 notes with rhythm)
    const motif = sopranoNotes.slice(0, 4).map(n => ({
      pitch: n.pitch,
      duration: n.duration,
      interval: n.pitch ? Note.midi(n.pitch) : null
    }));

    // Calculate intervals for motif
    for (let i = 1; i < motif.length; i++) {
      if (motif[i].interval && motif[i - 1].interval) {
        motif[i].interval = motif[i].interval - motif[i - 1].interval;
      }
    }

    // Develop motif in other voices
    const developmentVoices = [1, 2]; // Alto and Tenor

    developmentVoices.forEach(voice => {
      const shouldDevelop = rng() > 0.5; // 50% chance

      if (shouldDevelop) {
        // Find development point (middle of piece)
        const voiceNotes = notes.filter(n => n.voice === voice);
        if (voiceNotes.length < 4) return;

        const developmentStart = Math.floor(voiceNotes.length / 2);
        const developmentNotes = voiceNotes.slice(developmentStart, developmentStart + 4);

        // Apply motivic transformation
        const transformation = rng();
        let transformedMotif;

        if (transformation < 0.33) {
          // Inversion
          transformedMotif = motif.map((n, i) => {
            if (i === 0) return n;
            return {
              ...n,
              interval: -n.interval
            };
          });
        } else if (transformation < 0.66) {
          // Retrograde
          transformedMotif = [...motif].reverse();
        } else {
          // Transposition
          const transposition = rng() > 0.5 ? '3M' : '-3M';
          transformedMotif = motif.map(n => ({
            ...n,
            pitch: n.pitch ? Note.transpose(n.pitch, transposition) : null
          }));
        }

        // Apply transformation to notes
        developmentNotes.forEach((note, i) => {
          if (i < transformedMotif.length && transformedMotif[i].pitch) {
            const idx = result.findIndex(n =>
              n.voice === note.voice &&
              Math.abs(n.startTime - note.startTime) < 0.1
            );

            if (idx !== -1) {
              result[idx].pitch = transformedMotif[i].pitch;
              result[idx].type = 'motivic-development';
            }
          }
        });
      }
    });

    return result;
  }
};

module.exports = VoiceInterdependence;