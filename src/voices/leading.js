const { Note, Interval, Chord } = require('tonal');
const Rules = require('../theory/rules');
const Allocator = require('./allocator');

/**
 * Voice Leading Engine
 * Connects chords smoothly while respecting Bach's counterpoint rules.
 */

const Leading = {
  /**
   * Connects a sequence of chords into 4-part harmony.
   * @param {object[]} chordProgression - Array of { name, inversion, numeral }
   */
  connectChords: (chordProgression) => {
    const voicings = [];

    // 1. Initial Voicing
    let currentVoicing = Leading.createInitialVoicing(chordProgression[0]);
    voicings.push(currentVoicing);

    // 2. Connect subsequent chords
    for (let i = 1; i < chordProgression.length; i++) {
      const nextChordData = chordProgression[i];
      const nextVoicing = Leading.findBestVoicing(currentVoicing, nextChordData);
      voicings.push(nextVoicing);
      currentVoicing = nextVoicing;
    }

    return voicings;
  },

  /**
   * Creates a standard initial voicing for the first chord.
   */
  createInitialVoicing: (chordData) => {
    const chordName = chordData.name || chordData; // Handle both object and string (legacy)
    const notes = Chord.get(chordName).notes;
    const root = notes[0];

    // Simple closed position for start
    return {
      S: root + "5",
      A: notes[2] ? notes[2] + "4" : root + "4", // 5th
      T: notes[1] ? notes[1] + "4" : root + "4", // 3rd
      B: root + "3"
    };
  },

  /**
   * Finds the best voicing for the next chord given the previous voicing.
   */
  findBestVoicing: (prevVoicing, nextChordData) => {
    const chordName = nextChordData.name;
    const inversion = nextChordData.inversion;
    const chordNotes = Chord.get(chordName).notes;

    // Determine Bass Note based on Inversion
    // 0 = Root (index 0), 1 = 3rd (index 1), 2 = 5th (index 2)
    // Note: This assumes standard triad order [Root, 3rd, 5th] from Tonal
    let bassTarget = chordNotes[0];
    if (inversion === 1 && chordNotes[1]) bassTarget = chordNotes[1];
    if (inversion === 2 && chordNotes[2]) bassTarget = chordNotes[2];

    // Generate candidate voicings
    // We PASS the forced bass target to the generator
    const candidates = Leading.generateCandidateVoicings(prevVoicing, chordNotes, bassTarget);

    if (candidates.length === 0) {
      // Fallback: Try to generate a simple voicing ignoring strict leading rules
      // Or just return the previous voicing to prevent crash (though this repeats the chord)
      // Better: Create a new voicing from scratch for this chord
      return Leading.createInitialVoicing(nextChordData);
    }

    let bestVoicing = null;
    let minCost = Infinity;

    candidates.forEach(voicing => {
      const cost = Leading.evaluateTransition(prevVoicing, voicing, 'C', nextChordData);
      if (cost < minCost) {
        minCost = cost;
        bestVoicing = voicing;
      }
    });

    return bestVoicing || candidates[0];
  },

  /**
   * Generates candidate voicings.
   * @param {string} bassTarget - The specific note name (pitch class) required for the bass.
   */
  generateCandidateVoicings: (prevVoicing, chordNotes, bassTarget) => {
    // Bass MUST match the bassTarget (for inversions)
    // We only search for octaves of the bassTarget for the Bass voice.
    const optsB = Leading.getVoiceOptions(prevVoicing.B, [bassTarget], 'BASS');

    // Upper voices can be any chord tone
    const optsT = Leading.getVoiceOptions(prevVoicing.T, chordNotes, 'TENOR');
    const optsA = Leading.getVoiceOptions(prevVoicing.A, chordNotes, 'ALTO');
    const optsS = Leading.getVoiceOptions(prevVoicing.S, chordNotes, 'SOPRANO');

    const candidates = [];

    // Cartesian product of options
    // Limit total candidates to avoid explosion (e.g., take top 2 per voice = 16 combos)
    optsB.slice(0, 2).forEach(b => {
      optsT.slice(0, 2).forEach(t => {
        optsA.slice(0, 2).forEach(a => {
          optsS.slice(0, 2).forEach(s => {
            // Check for voice crossing (S > A > T > B)
            if (Note.midi(s) > Note.midi(a) &&
              Note.midi(a) > Note.midi(t) &&
              Note.midi(t) > Note.midi(b)) {

              // Check voice spacing: S-A ≤ 8ve, A-T ≤ 8ve (bass can exceed octave from tenor)
              const saSpacing = Note.midi(s) - Note.midi(a);
              const atSpacing = Note.midi(a) - Note.midi(t);

              if (saSpacing <= 12 && atSpacing <= 12) {
                candidates.push({ S: s, A: a, T: t, B: b });
              }
            }
          });
        });
      });
    });

    return candidates;
  },

  getVoiceOptions: (prevNote, chordNotes, voicePart) => {
    const options = [];
    const currentOctave = Note.octave(prevNote);
    const octaves = [currentOctave - 1, currentOctave, currentOctave + 1];

    octaves.forEach(oct => {
      chordNotes.forEach(tone => {
        const candidate = tone + oct;
        if (Allocator.isWithinRange(candidate, voicePart)) {
          const dist = Math.abs(Interval.semitones(Interval.distance(prevNote, candidate)));
          options.push({ note: candidate, dist: dist });
        }
      });
    });

    return options.sort((a, b) => a.dist - b.dist).map(o => o.note);
  },

  /**
   * Evaluates a transition between two voicings.
   * Returns a cost (lower is better).
   * Infinity = Forbidden.
   */
  evaluateTransition: (v1, v2, key = 'C', chordData = null) => {
    let cost = 0;

    // 1. Smoothness (minimize movement)
    const distS = Math.abs(Interval.semitones(Interval.distance(v1.S, v2.S)));
    const distA = Math.abs(Interval.semitones(Interval.distance(v1.A, v2.A)));
    const distT = Math.abs(Interval.semitones(Interval.distance(v1.T, v2.T)));
    const distB = Math.abs(Interval.semitones(Interval.distance(v1.B, v2.B)));

    cost += (distS + distA + distT + distB);

    // 2. Forbidden Parallels and Hidden 5ths/8ves
    const voices = ['S', 'A', 'T', 'B'];
    for (let i = 0; i < voices.length; i++) {
      for (let j = i + 1; j < voices.length; j++) {
        const p1 = voices[i]; // e.g., 'S'
        const p2 = voices[j]; // e.g., 'A'

        const intervalOld = Rules.analyzeInterval(v1[p1], v1[p2]);
        const intervalNew = Rules.analyzeInterval(v2[p1], v2[p2]);

        // If both are Perfect 5ths or both are Perfect 8ves/Unisons
        if (Rules.isPerfectFifthOrOctave(intervalOld.simple) &&
          Rules.isPerfectFifthOrOctave(intervalNew.simple)) {

          // Check motion
          const motion = Rules.analyzeMotion(v1[p1], v2[p1], v1[p2], v2[p2]);
          if (motion === 'parallel') {
            return Infinity; // FORBIDDEN!
          }

          // Penalize hidden (similar) motion to perfect intervals
          if (motion === 'similar') {
            cost += 50; // Hidden 5ths/8ves penalty
          }
        }
      }
    }

    // 3. Seventh Chord Resolution (if present)
    // Seventh should resolve down by step in any voice
    if (chordData && chordData.seventh) {
      const resolveSeventhChord = Leading.check7thResolution(v1, v2, chordData);
      cost += resolveSeventhChord;
    }

    return cost;
  },

  /**
   * Checks if 7th chord resolves properly (7th resolves down)
   * @param {object} v1 - Current voicing with potential 7th
   * @param {object} v2 - Next voicing
   * @param {object} chordData - Chord information
   * @returns {number} Penalty if not resolved (0-30)
   */
  check7thResolution: (v1, v2, chordData) => {
    const Scales = require('../theory/scales');
    let penalty = 0;

    // Find the 7th of the chord (if it's a 7th chord)
    // For dominant 7th (V7), the 7th is a major 7th from root
    if (chordData.numeral === 'V' || chordData.numeral === 'V7') {
      // Get chord notes to identify the 7th
      try {
        const chord = Chord.get(chordData.name);
        if (chord.notes.length >= 4) {
          // Usually 4th note is the 7th in extended chords
          const seventhPC = Note.pitchClass(chord.notes[3]);
          const voices = ['S', 'A', 'T', 'B'];

          // Check each voice - if it has the 7th, it should resolve down
          voices.forEach(voice => {
            if (Note.pitchClass(v1[voice]) === seventhPC) {
              // The 7th should move down by step in v2
              const v1Midi = Note.midi(v1[voice]);
              const v2Midi = Note.midi(v2[voice]);
              const diff = v2Midi - v1Midi;

              // Should be -2 (down 1 step, either major or minor)
              if (diff !== -1 && diff !== -2) {
                penalty += 20; // Unresolved or wrongly resolved 7th
              }
            }
          });
        }
      } catch (e) {
        // Silently fail if chord analysis isn't available
      }
    }

    return penalty;
  },

  findNearestChordTone: (prevNote, chordNotes, voicePart) => {
    // Legacy helper, kept if needed but mostly replaced by generateCandidateVoicings
    const opts = Leading.getVoiceOptions(prevNote, chordNotes, voicePart);
    return opts[0] || prevNote;
  },

  findNearestNote: (prevNote, targetPitchClass, voicePart) => {
    return Leading.findNearestChordTone(prevNote, [targetPitchClass], voicePart);
  },

  /**
   * Validates doubling rules for a voicing.
   * @param {object} voicing - { S, A, T, B } voicing
   * @param {object} chordData - Chord information
   * @param {string} key - Tonic for determining leading tone
   * @returns {number} Penalty cost (0 if valid, >0 if violated)
   */
  validateDoubling: (voicing, chordData, key = 'C') => {
    const Scales = require('../theory/scales');
    let cost = 0;

    // Count occurrences of each pitch class
    const voiceNotes = [voicing.S, voicing.A, voicing.T, voicing.B];
    const pitchClasses = voiceNotes.map(note => Note.pitchClass(note));

    // Forbidden: Doubling leading tone
    const leadingTone = Scales.getLeadingTone(key);
    const leadingTonePC = Note.pitchClass(leadingTone);

    const leadingToneCount = pitchClasses.filter(pc => pc === leadingTonePC).length;
    if (leadingToneCount > 1) {
      cost += 100; // Severe penalty for doubling leading tone
    }

    // Prefer doubling root in root position
    if (chordData.inversion === 0) {
      const chordNotes = Chord.get(chordData.name).notes;
      const rootPC = Note.pitchClass(chordNotes[0]);
      const rootCount = pitchClasses.filter(pc => pc === rootPC).length;

      if (rootCount === 1) {
        cost += 5; // Penalty if not doubled (preference, not rule)
      }
    }

    return cost;
  }
};

module.exports = Leading;
