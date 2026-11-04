/**
 * Instrument Configuration & Sample Mapping
 * Maps instruments to sample URLs and defines style presets for SATB voices
 * Based on actual MP3 files in public/Orchestra/
 */

// Helper: Convert pitch notation (e.g., "C#4") to filename format (e.g., "cSHARP4")
function pitchToSampleName(pitch) {
  if (!pitch || pitch.length < 2) return pitch;

  const note = pitch[0].toLowerCase();
  const modifier = pitch.length > 2 ? pitch.substring(1, pitch.length - 1) : '';
  const octave = pitch[pitch.length - 1];

  let sampleModifier = modifier;
  if (modifier === '#') {
    sampleModifier = 'SHARP';
  } else if (modifier === 'b') {
    sampleModifier = 'FLAT';
  }

  return note + sampleModifier + octave;
}

// Helper: Convert note name with proper format variations
function normalizeNoteName(pitch) {
  // Handle various input formats
  // Examples: C4, c4, C#4, Cb4, C-4, etc.
  const match = pitch.match(/([A-Ga-g])([#b]?)(\d)/);
  if (!match) return pitch;

  const note = match[1].toLowerCase();
  const accidental = match[2];
  const octave = match[3];

  return note + accidental + octave;
}

/**
 * Sample mapping for each instrument folder
 * Maps normalized pitch names to relative file paths
 * Sparse samples: Tone.Sampler will interpolate missing notes
 */
const INSTRUMENT_SAMPLES = {
  'Violin': {
    displayName: 'Violin',
    range: 'G3-E7',
    baseUrl: 'Orchestra/Violin/',
    samples: {
      'G3': 'violin-g3.mp3',
      'E4': 'violin-e4.mp3',
      'G4': 'violin-g4.mp3',
      'E5': 'violin-e5.mp3',
      'G5': 'violin-g5.mp3',
      'E6': 'violin-e6.mp3',
      'G6': 'violin-g6.mp3',
      'C#4': 'violin-cSHARP4.mp3',
      'C#5': 'violin-cSHARP5.mp3',
      'C#6': 'violin-cSHARP6.mp3',
      'C#7': 'violin-cSHARP7.mp3',
      'A#3': 'violin-aSHARP3.mp3',
      'A#4': 'violin-aSHARP4.mp3',
      'A#5': 'violin-aSHARP5.mp3',
      'A#6': 'violin-aSHARP6.mp3',
    }
  },
  'Violas': {
    displayName: 'Violas',
    range: 'C3-C6',
    baseUrl: 'Orchestra/Violas/',
    samples: {
      'C3': 'violas-sus-c3.mp3',
      'D#3': 'violas-sus-dSHARP3.mp3',
      'F#3': 'violas-sus-fSHARP3.mp3',
      'A3': 'violas-sus-a3.mp3',
      'C4': 'violas-sus-c4.mp3',
      'D#4': 'violas-sus-dSHARP4.mp3',
      'F#4': 'violas-sus-fSHARP4.mp3',
      'A4': 'violas-sus-a4.mp3',
      'C5': 'violas-sus-c5.mp3',
      'D#5': 'violas-sus-dSHARP5.mp3',
      'F#5': 'violas-sus-fSHARP5.mp3',
      'A5': 'violas-sus-a5.mp3',
      'C6': 'violas-sus-c6.mp3',
    }
  },
  'Cello': {
    displayName: 'Cello',
    range: 'C2-A5',
    baseUrl: 'Orchestra/Cello/',
    samples: {
      'C2': 'cello-c2.mp3',
      'A2': 'cello-a2.mp3',
      'C3': 'cello-c3.mp3',
      'A3': 'cello-a3.mp3',
      'C4': 'cello-c4.mp3',
      'A4': 'cello-a4.mp3',
      'C5': 'cello-c5.mp3',
      'A5': 'cello-a5.mp3',
      'D#2': 'cello-dSHARP2.mp3',
      'D#3': 'cello-dSHARP3.mp3',
      'D#4': 'cello-dSHARP4.mp3',
      'D#5': 'cello-dSHARP5.mp3',
      'F#2': 'cello-fSHARP2.mp3',
      'F#3': 'cello-fSHARP3.mp3',
      'F#4': 'cello-fSHARP4.mp3',
      'F#5': 'cello-fSHARP5.mp3',
    }
  },
  'Basses': {
    displayName: 'Basses (Double Bass)',
    range: 'C1-A3',
    baseUrl: 'Orchestra/Basses/',
    samples: {
      'C1': 'basses-sus-c1.mp3',
      'D#1': 'basses-sus-dSHARP1.mp3',
      'F#1': 'basses-sus-fSHARP1.mp3',
      'A1': 'basses-sus-a1.mp3',
      'C2': 'basses-sus-c2.mp3',
      'D#2': 'basses-sus-dSHARP2.mp3',
      'F#2': 'basses-sus-fSHARP2.mp3',
      'A2': 'basses-sus-a2.mp3',
      'C3': 'basses-sus-c3.mp3',
      'D#3': 'basses-sus-dSHARP3.mp3',
      'F#3': 'basses-sus-fSHARP3.mp3',
      'A3': 'basses-sus-a3.mp3',
      'C4': 'basses-sus-c4.mp3',
    }
  },
  'Flute': {
    displayName: 'Flute',
    range: 'C3-C6',
    baseUrl: 'Orchestra/Flute/',
    samples: {
      'C3': 'flute-c3.mp3',
      'A3': 'flute-a3.mp3',
      'D#3': 'flute-dSHARP3.mp3',
      'F#3': 'flute-fSHARP3.mp3',
      'C4': 'flute-c4.mp3',
      'A4': 'flute-a4.mp3',
      'D#4': 'flute-dSHARP4.mp3',
      'F#4': 'flute-fSHARP4.mp3',
      'C5': 'flute-c5.mp3',
      'A5': 'flute-a5.mp3',
      'D#5': 'flute-dSHARP5.mp3',
      'F#5': 'flute-fSHARP5.mp3',
      'C6': 'flute-c6.mp3',
    }
  },
  'Oboe': {
    displayName: 'Oboe',
    range: 'A#3-C6',
    baseUrl: 'Orchestra/Oboe/',
    samples: {
      'E4': 'oboe-e4.mp3',
      'G4': 'oboe-g4.mp3',
      'A#4': 'oboe-aSHARP4.mp3',
      'C#4': 'oboe-cSHARP4.mp3',
      'E5': 'oboe-e5.mp3',
      'G5': 'oboe-g5.mp3',
      'A#5': 'oboe-aSHARP5.mp3',
      'C#5': 'oboe-cSHARP5.mp3',
      'A#3': 'oboe-aSHARP3.mp3',
      'C6': 'oboe-c6.mp3',
    }
  },
  'Clarinet': {
    displayName: 'Clarinet',
    range: 'B3-D6',
    baseUrl: 'Orchestra/Clarinet/',
    samples: {
      'B3': 'clarinet-b3.mp3',
      'D3': 'clarinet-d3.mp3',
      'F3': 'clarinet-f3.mp3',
      'G#3': 'clarinet-gSHARP3.mp3',
      'B4': 'clarinet-b4.mp3',
      'D4': 'clarinet-d4.mp3',
      'F4': 'clarinet-f4.mp3',
      'G#4': 'clarinet-gSHARP4.mp3',
      'B5': 'clarinet-b5.mp3',
      'D5': 'clarinet-d5.mp3',
      'F5': 'clarinet-f5.mp3',
      'G#5': 'clarinet-gSHARP5.mp3',
      'D6': 'clarinet-d6.mp3',
    }
  },
  'Bassoon': {
    displayName: 'Bassoon',
    range: 'A#1-G4',
    baseUrl: 'Orchestra/Bassoon/',
    samples: {
      'E2': 'bassoon-e2.mp3',
      'G2': 'bassoon-g2.mp3',
      'A#2': 'bassoon-aSHARP2.mp3',
      'C#2': 'bassoon-cSHARP2.mp3',
      'E3': 'bassoon-e3.mp3',
      'G3': 'bassoon-g3.mp3',
      'A#3': 'bassoon-aSHARP3.mp3',
      'C#3': 'bassoon-cSHARP3.mp3',
      'E4': 'bassoon-e4.mp3',
      'G4': 'bassoon-g4.mp3',
      'A#4': 'bassoon-aSHARP4.mp3',
      'C#4': 'bassoon-cSHARP4.mp3',
      'C#5': 'bassoon-cSHARP5.mp3',
      'A#1': 'bassoon-aSHARP1.mp3',
    }
  },
  'Horn': {
    displayName: 'Horn (French Horn)',
    range: 'E2-E5',
    baseUrl: 'Orchestra/Horn/',
    samples: {
      'E2': 'horn-e2.mp3',
      'G2': 'horn-g2.mp3',
      'A#2': 'horn-aSHARP2.mp3',
      'C#3': 'horn-cSHARP3.mp3',
      'E3': 'horn-e3.mp3',
      'G3': 'horn-g3.mp3',
      'A#3': 'horn-aSHARP3.mp3',
      'C#4': 'horn-cSHARP4.mp3',
      'E4': 'horn-e4.mp3',
      'G4': 'horn-g4.mp3',
      'A#4': 'horn-aSHARP4.mp3',
      'C#5': 'horn-cSHARP5.mp3',
      'E5': 'horn-e5.mp3',
    }
  },
  'Trumpet': {
    displayName: 'Trumpet',
    range: 'E3-E6',
    baseUrl: 'Orchestra/Trumpet/',
    samples: {
      'E3': 'trumpet-e3.mp3',
      'G3': 'trumpet-g3.mp3',
      'A#3': 'trumpet-aSHARP3.mp3',
      'C#4': 'trumpet-cSHARP4.mp3',
      'E4': 'trumpet-e4.mp3',
      'G4': 'trumpet-g4.mp3',
      'A#4': 'trumpet-aSHARP4.mp3',
      'C#5': 'trumpet-cSHARP5.mp3',
      'E5': 'trumpet-e5.mp3',
      'G5': 'trumpet-g5.mp3',
      'A#5': 'trumpet-aSHARP5.mp3',
      'C#6': 'trumpet-cSHARP6.mp3',
      'E6': 'trumpet-e6.mp3',
    }
  },
  'Tenor Trombone': {
    displayName: 'Tenor Trombone',
    range: 'E2-A#4',
    baseUrl: 'Orchestra/Tenor_Trombone/',
    samples: {
      'E2': 'tenor_trombone-e2.mp3',
      'G2': 'tenor_trombone-g2.mp3',
      'A#2': 'tenor_trombone-aSHARP2.mp3',
      'C#3': 'tenor_trombone-cSHARP3.mp3',
      'E3': 'tenor_trombone-e3.mp3',
      'G3': 'tenor_trombone-g3.mp3',
      'A#3': 'tenor_trombone-aSHARP3.mp3',
      'C#4': 'tenor_trombone-cSHARP4.mp3',
      'E4': 'tenor_trombone-e4.mp3',
      'G4': 'tenor_trombone-g4.mp3',
      'A#4': 'tenor_trombone-aSHARP4.mp3',
    }
  },
  'Tuba': {
    displayName: 'Tuba',
    range: 'E1-C#4',
    baseUrl: 'Orchestra/Tuba/',
    samples: {
      'E1': 'tuba-sus-e1.mp3',
      'G1': 'tuba-sus-g1.mp3',
      'A#1': 'tuba-sus-aSHARP1.mp3',
      'C#2': 'tuba-sus-cSHARP2.mp3',
      'E2': 'tuba-sus-e2.mp3',
      'G2': 'tuba-sus-g2.mp3',
      'A#2': 'tuba-sus-aSHARP2.mp3',
      'C#3': 'tuba-sus-cSHARP3.mp3',
      'E3': 'tuba-sus-e3.mp3',
      'G3': 'tuba-sus-g3.mp3',
      'A#3': 'tuba-sus-aSHARP3.mp3',
      'C#4': 'tuba-sus-cSHARP4.mp3',
    }
  },
  'Grand Piano': {
    displayName: 'Grand Piano',
    range: 'C1-C8',
    baseUrl: 'Orchestra/Grand_Piano/',
    samples: {
      'C1': 'piano-p-c1.mp3',
      'C2': 'piano-p-c2.mp3',
      'C3': 'piano-p-c3.mp3',
      'C4': 'piano-p-c4.mp3',
      'C5': 'piano-p-c5.mp3',
      'C6': 'piano-p-c6.mp3',
      'C7': 'piano-p-c7.mp3',
      'C8': 'piano-p-c8.mp3',
      'A1': 'piano-p-a1.mp3',
      'A2': 'piano-p-a2.mp3',
      'A3': 'piano-p-a3.mp3',
      'A4': 'piano-p-a4.mp3',
      'A5': 'piano-p-a5.mp3',
      'A6': 'piano-p-a6.mp3',
      'A7': 'piano-p-a7.mp3',
      'D#1': 'piano-p-dSHARP1.mp3',
      'D#2': 'piano-p-dSHARP2.mp3',
      'D#3': 'piano-p-dSHARP3.mp3',
      'D#4': 'piano-p-dSHARP4.mp3',
      'D#5': 'piano-p-dSHARP5.mp3',
      'D#6': 'piano-p-dSHARP6.mp3',
      'D#7': 'piano-p-dSHARP7.mp3',
      'F#1': 'piano-p-fSHARP1.mp3',
      'F#2': 'piano-p-fSHARP2.mp3',
      'F#3': 'piano-p-fSHARP3.mp3',
      'F#4': 'piano-p-fSHARP4.mp3',
      'F#5': 'piano-p-fSHARP5.mp3',
      'F#6': 'piano-p-fSHARP6.mp3',
      'F#7': 'piano-p-fSHARP7.mp3',
    }
  },
  'Harp': {
    displayName: 'Harp',
    range: 'C2-C7',
    baseUrl: 'Orchestra/Harp/',
    samples: {
      'C2': 'harp-c2.mp3',
      'A2': 'harp-a2.mp3',
      'D#2': 'harp-dSHARP2.mp3',
      'F#2': 'harp-fSHARP2.mp3',
      'C3': 'harp-c3.mp3',
      'A3': 'harp-a3.mp3',
      'D#3': 'harp-dSHARP3.mp3',
      'F#3': 'harp-fSHARP3.mp3',
      'C4': 'harp-c4.mp3',
      'A4': 'harp-a4.mp3',
      'D#4': 'harp-dSHARP4.mp3',
      'F#4': 'harp-fSHARP4.mp3',
      'C5': 'harp-c5.mp3',
      'A5': 'harp-a5.mp3',
      'D#5': 'harp-dSHARP5.mp3',
      'F#5': 'harp-fSHARP5.mp3',
      'C6': 'harp-c6.mp3',
      'A6': 'harp-a6.mp3',
      'D#6': 'harp-dSHARP6.mp3',
      'C7': 'harp-c7.mp3',
    }
  },
  'Chorus': {
    displayName: 'Chorus (SATB)',
    range: 'A2-F#5',
    baseUrl: 'Orchestra/Chorus/',
    samples: {
      // Male voices (Tenor/Bass) - octaves 2, 3, 4
      'A2': 'chorus-male-a2.mp3',
      'G2': 'chorus-male-g2.mp3',
      'A#2': 'chorus-male-aSHARP2.mp3',
      'B2': 'chorus-male-b2.mp3',
      'C3': 'chorus-male-c3.mp3',
      'C#3': 'chorus-male-cSHARP3.mp3',
      'D3': 'chorus-male-d3.mp3',
      'D#3': 'chorus-male-dSHARP3.mp3',
      'E3': 'chorus-male-e3.mp3',
      'F3': 'chorus-male-f3.mp3',
      'F#3': 'chorus-male-fSHARP3.mp3',
      'G#3': 'chorus-male-gSHARP3.mp3',
      'A3': 'chorus-male-a3.mp3',
      'C4': 'chorus-male-c4.mp3',
      'C#4': 'chorus-male-cSHARP4.mp3',
      'D4': 'chorus-male-d4.mp3',
      'D#4': 'chorus-male-dSHARP4.mp3',
      'E4': 'chorus-male-e4.mp3',
      'F4': 'chorus-male-f4.mp3',
      'F#4': 'chorus-male-fSHARP4.mp3',
      // Female voices (Soprano/Alto) - octaves 4, 5
      'A4': 'chorus-female-a4.mp3',
      'A#4': 'chorus-female-aSHARP4.mp3',
      'B4': 'chorus-female-b4.mp3',
      'G4': 'chorus-female-g4.mp3',
      'G#4': 'chorus-female-gSHARP4.mp3',
      'C5': 'chorus-female-c5.mp3',
      'C#5': 'chorus-female-cSHARP5.mp3',
      'D5': 'chorus-female-d5.mp3',
      'D#5': 'chorus-female-dSHARP5.mp3',
      'E5': 'chorus-female-e5.mp3',
      'F5': 'chorus-female-f5.mp3',
      'F#5': 'chorus-female-fSHARP5.mp3',
      'G5': 'chorus-female-g5.mp3',
      'G#5': 'chorus-female-gSHARP5.mp3',
      'A5': 'chorus-female-a5.mp3',
      'A#5': 'chorus-female-aSHARP5.mp3',
      'B5': 'chorus-female-b5.mp3',
      'C6': 'chorus-female-c6.mp3',
    }
  }
};

/**
 * Style presets: map SATB voice indices to instrument names
 * Voice indices: 0=Soprano, 1=Alto, 2=Tenor, 3=Bass
 */
const STYLE_PRESETS = {
  'Strings': {
    displayName: 'Strings (Quartet)',
    instruments: ['Violin', 'Violas', 'Cello', 'Basses']
  },
  'Choir': {
    displayName: 'Choir (Chorus)',
    instruments: ['Chorus', 'Chorus', 'Chorus', 'Chorus']
  },
  'Piano': {
    displayName: 'Piano (Solo)',
    instruments: ['Grand Piano', 'Grand Piano', 'Grand Piano', 'Grand Piano']
  },
  'Woodwinds': {
    displayName: 'Woodwinds (Quartet)',
    instruments: ['Flute', 'Oboe', 'Clarinet', 'Bassoon']
  },
  'Brass': {
    displayName: 'Brass (Quartet)',
    instruments: ['Trumpet', 'Horn', 'Tenor Trombone', 'Tuba']
  },
  'Mixed': {
    displayName: 'Mixed Orchestra',
    instruments: ['Flute', 'Oboe', 'Violin', 'Cello']
  },
  'Harp': {
    displayName: 'Harp (Solo)',
    instruments: ['Harp', 'Harp', 'Harp', 'Harp']
  },

  // ---- Velocity-layered styles (VSCO 2 CE samples served from carrilion) ----
  // `vsco` lists [S, A, T, B]: the catalog instrument / articulation of the voice's
  // sustained sound, plus `arts`, the other articulations it can play (see
  // articulation.js): vibrato, staccato (spiccato for strings), pizzicato, tremolo,
  // and `solo` (a solo instrument's articulations, for the concertino of a
  // ritornello). Each carries a trimDb relative to the style's, from the peak
  // short-term RMS (100 ms) of the samples at velocity 90 against the voice's sustain:
  // fully compensated for sustained articulations, 75% for the short ones (a short
  // note at the same peak sounds softer), then checked in playback (section RMS of
  // the same piece, auto against all-legato; the string spiccato needed 3 dB more:
  // its overlapping natural tails add up in fast runs). A missing
  // articulation falls back (pizzicato -> staccato -> shortened sustain, vibrato ->
  // sustain...). The layer of each note is chosen by its velocity (layeredSampler.js).
  // The "Key Switch" entries of the catalog mix several articulations: not used.
  //
  // `continuo` (optional): an organ that doubles the bass (voice 3) in the TUTTI
  // sections of a ritornello and rests in the solo episodes (player.js). The stop is
  // the VSCO manual 'Organ' / 'Loud' (Rode, Man3 "Open": an 8' principal chorus at
  // the written pitch): even level over the bass range (±3 dB from C2 to C4), speaks
  // in ~0.1 s and holds ~10 s before its recorded decay (`sustainSecs`). The other
  // VSCO organ sets were measured and left out: the quiet manual (a gedackt) varies
  // by up to 35 dB from note to note, the quiet pedal speaks in up to 0.5 s, and the
  // loud pedal is a full 16' chorus, too heavy for a continuo positive. 8' doubling:
  // the bass (E2–C4) is inside the manual (C2–C7); a 16' manual is not sampled.
  // trimDb is relative to the style's trimDb, set in playback for ~+1 dB in the tutti
  // (section RMS with / without organ, same seed, both orders); the solos are unchanged.
  // Not for VscoPiano (a keyboard is its own continuo) nor VscoBrass (the trombone bass
  // masks it: +0.2 dB at the strings' organ level, with the mix already ~2 dB under the
  // limiter).
  'VscoPiano': {
    displayName: 'VSCO Upright Piano (5 velocity layers)',
    engine: 'vsco',
    keyboard: true,
    release: 0.45,
    trimDb: 6,  // level-matched to the Grand Piano style (measured RMS)
    vsco: Array(4).fill({ instrument: 'VSUpright1', articulation: 'Default' }),
  },
  'VscoWoodwinds': {
    displayName: 'VSCO Woodwinds (2-3 velocity layers)',
    engine: 'vsco',
    release: 0.25,
    trimDb: 11,  // level-matched to the Woodwinds style (measured RMS)
    // Same absolute organ level as VscoStrings (style trim + continuo trim = 5.5 dB)
    continuo: { instrument: 'Organ', articulation: 'Loud', trimDb: -5.5, release: 0.12, sustainSecs: 9.5 },
    vsco: [
      {
        instrument: 'FluteSus', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'FluteSus', articulation: 'Sustain Vibrato', trimDb: -6 },
          staccato: { instrument: 'Flute', articulation: 'Staccato', trimDb: -6.5 },
        },
      },
      {
        instrument: 'OboeSus', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'OboeSus', articulation: 'Sustain Vibrato', trimDb: -3 },
          staccato: { instrument: 'Oboe', articulation: 'Staccato', trimDb: -5.5 },
        },
      },
      {
        instrument: 'Clarinet', articulation: 'Sustain',
        arts: { staccato: { instrument: 'Clarinet', articulation: 'Staccato', trimDb: -3.5 } },
      },
      {
        instrument: 'Bassoon', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'Bassoon', articulation: 'Vibrato', trimDb: -1.5 },
          staccato: { instrument: 'Bassoon', articulation: 'Staccato', trimDb: -3 },
        },
      },
    ],
  },
  'VscoBrass': {
    displayName: 'VSCO Brass (2-4 velocity layers)',
    engine: 'vsco',
    release: 0.3,
    trimDb: 9,  // level-matched to the Brass style (measured RMS)
    vsco: [
      {
        instrument: 'Trumpet', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'TrumpetSus', articulation: 'Sustain Vibrato', trimDb: 1 },
          staccato: { instrument: 'Trumpet', articulation: 'Staccato', trimDb: -3 },
        },
      },
      {
        instrument: 'French Horn', articulation: 'Sustain',
        arts: { staccato: { instrument: 'French Horn', articulation: 'Staccato', trimDb: -3.5 } },
      },
      {
        instrument: 'Trombone', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'Trombone', articulation: 'Vibrato', trimDb: -2.5 },
          staccato: { instrument: 'Trombone', articulation: 'Staccato', trimDb: -4 },
        },
      },
      {
        instrument: 'Trombone', articulation: 'Sustain',
        arts: {
          vibrato: { instrument: 'Trombone', articulation: 'Vibrato', trimDb: -2.5 },
          staccato: { instrument: 'Trombone', articulation: 'Staccato', trimDb: -4 },
        },
      },
    ],
  },
  // String quartet (violins I & II, viola, cello) from the VSCO sections. The
  // section sustains are recorded with vibrato (no plain sustain in VSCO), so
  // "vibrato" is the same sound. The first violin has the solo violin as concertino.
  'VscoStrings': {
    displayName: 'VSCO Strings (Quartet, articulations)',
    engine: 'vsco',
    release: 0.35,
    trimDb: 9.5,  // level-matched to the Strings style (measured RMS, legato)
    continuo: { instrument: 'Organ', articulation: 'Loud', trimDb: -4, release: 0.12, sustainSecs: 9.5 },
    vsco: [
      {
        instrument: 'ViolinEnsSus', articulation: 'Sustain Vibrato',
        arts: {
          staccato: { instrument: 'Violin', articulation: 'Spiccato', trimDb: -4 },
          pizzicato: { instrument: 'Violin', articulation: 'Pizzicato', trimDb: -3 },
          tremolo: { instrument: 'Violin', articulation: 'Tremolo', trimDb: -1 },
          solo: {
            sustain: { instrument: 'SViolin', articulation: 'Vibrato', trimDb: -4 },
            staccato: { instrument: 'SViolin', articulation: 'Spiccato', trimDb: -5 },
            pizzicato: { instrument: 'SViolin', articulation: 'Pizzicato', trimDb: -6 },
          },
        },
      },
      {
        instrument: 'ViolinEnsSus', articulation: 'Sustain Vibrato',
        arts: {
          staccato: { instrument: 'Violin', articulation: 'Spiccato', trimDb: -4 },
          pizzicato: { instrument: 'Violin', articulation: 'Pizzicato', trimDb: -3 },
          tremolo: { instrument: 'Violin', articulation: 'Tremolo', trimDb: -1 },
        },
      },
      {
        instrument: 'ViolaEnsSus', articulation: 'Sustain Vibrato',
        arts: {
          staccato: { instrument: 'Viola', articulation: 'Spiccato', trimDb: -7 },
          pizzicato: { instrument: 'Viola', articulation: 'Pizzicato', trimDb: -3.5 },
          tremolo: { instrument: 'Viola', articulation: 'Tremolo', trimDb: -3 },
        },
      },
      {
        instrument: 'CelloEnsSus', articulation: 'Sustain Vibrato',
        arts: {
          staccato: { instrument: 'Cello', articulation: 'Spiccato', trimDb: -5 },
          pizzicato: { instrument: 'Cello', articulation: 'Pizzicato', trimDb: -0.5 },
          tremolo: { instrument: 'Cello', articulation: 'Tremolo', trimDb: -1 },
        },
      },
    ],
  },
};

// Export for use in player.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    INSTRUMENT_SAMPLES,
    STYLE_PRESETS,
    pitchToSampleName,
    normalizeNoteName
  };
}