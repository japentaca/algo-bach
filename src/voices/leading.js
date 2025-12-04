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
      const cost = Leading.evaluateTransition(prevVoicing, voicing);
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
              candidates.push({ S: s, A: a, T: t, B: b });
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
  evaluateTransition: (v1, v2) => {
    let cost = 0;

    // 1. Smoothness (minimize movement)
    const distS = Math.abs(Interval.semitones(Interval.distance(v1.S, v2.S)));
    const distA = Math.abs(Interval.semitones(Interval.distance(v1.A, v2.A)));
    const distT = Math.abs(Interval.semitones(Interval.distance(v1.T, v2.T)));
    const distB = Math.abs(Interval.semitones(Interval.distance(v1.B, v2.B)));

    cost += (distS + distA + distT + distB);

    // 2. Forbidden Parallels (5ths and 8ves)
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
        }
      }
    }

    return cost;
  },

  findNearestChordTone: (prevNote, chordNotes, voicePart) => {
    // Legacy helper, kept if needed but mostly replaced by generateCandidateVoicings
    const opts = Leading.getVoiceOptions(prevNote, chordNotes, voicePart);
    return opts[0] || prevNote;
  },

  findNearestNote: (prevNote, targetPitchClass, voicePart) => {
    return Leading.findNearestChordTone(prevNote, [targetPitchClass], voicePart);
  }
};

module.exports = Leading;
