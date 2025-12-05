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
      'E3': 'flute-e3.mp3',
      'G3': 'flute-g3.mp3',
      'B3': 'flute-b3.mp3',
      'C4': 'flute-c4.mp3',
      'E4': 'flute-e4.mp3',
      'G4': 'flute-g4.mp3',
      'B4': 'flute-b4.mp3',
      'C5': 'flute-c5.mp3',
      'E5': 'flute-e5.mp3',
      'G5': 'flute-g5.mp3',
      'B5': 'flute-b5.mp3',
      'C6': 'flute-c6.mp3',
      'D#3': 'flute-dSHARP3.mp3',
      'D#4': 'flute-dSHARP4.mp3',
      'D#5': 'flute-dSHARP5.mp3',
      'A#3': 'flute-aSHARP3.mp3',
      'A#4': 'flute-aSHARP4.mp3',
      'A#5': 'flute-aSHARP5.mp3',
    }
  },
  'Oboe': {
    displayName: 'Oboe',
    range: 'A#3-G5',
    baseUrl: 'Orchestra/Oboe/',
    samples: {
      'B3': 'oboe-b3.mp3',
      'D4': 'oboe-d4.mp3',
      'F4': 'oboe-f4.mp3',
      'A4': 'oboe-a4.mp3',
      'B4': 'oboe-b4.mp3',
      'D5': 'oboe-d5.mp3',
      'F5': 'oboe-f5.mp3',
      'G5': 'oboe-g5.mp3',
      'C#4': 'oboe-cSHARP4.mp3',
      'C#5': 'oboe-cSHARP5.mp3',
      'D#4': 'oboe-dSHARP4.mp3',
      'D#5': 'oboe-dSHARP5.mp3',
      'F#4': 'oboe-fSHARP4.mp3',
      'F#5': 'oboe-fSHARP5.mp3',
      'G#4': 'oboe-gSHARP4.mp3',
      'G#5': 'oboe-gSHARP5.mp3',
    }
  },
  'Clarinet': {
    displayName: 'Clarinet',
    range: 'B3-D6',
    baseUrl: 'Orchestra/Clarinet/',
    samples: {
      'B3': 'clarinet-b3.mp3',
      'D4': 'clarinet-d4.mp3',
      'F4': 'clarinet-f4.mp3',
      'A4': 'clarinet-a4.mp3',
      'B4': 'clarinet-b4.mp3',
      'D5': 'clarinet-d5.mp3',
      'F5': 'clarinet-f5.mp3',
      'A5': 'clarinet-a5.mp3',
      'B5': 'clarinet-b5.mp3',
      'D6': 'clarinet-d6.mp3',
      'C#4': 'clarinet-cSHARP4.mp3',
      'C#5': 'clarinet-cSHARP5.mp3',
      'D#4': 'clarinet-dSHARP4.mp3',
      'D#5': 'clarinet-dSHARP5.mp3',
      'F#4': 'clarinet-fSHARP4.mp3',
      'F#5': 'clarinet-fSHARP5.mp3',
    }
  },
  'Bassoon': {
    displayName: 'Bassoon',
    range: 'A#1-G4',
    baseUrl: 'Orchestra/Bassoon/',
    samples: {
      'B1': 'bassoon-b1.mp3',
      'D2': 'bassoon-d2.mp3',
      'F2': 'bassoon-f2.mp3',
      'A2': 'bassoon-a2.mp3',
      'B2': 'bassoon-b2.mp3',
      'D3': 'bassoon-d3.mp3',
      'F3': 'bassoon-f3.mp3',
      'A3': 'bassoon-a3.mp3',
      'B3': 'bassoon-b3.mp3',
      'D4': 'bassoon-d4.mp3',
      'C#2': 'bassoon-cSHARP2.mp3',
      'C#3': 'bassoon-cSHARP3.mp3',
      'C#4': 'bassoon-cSHARP4.mp3',
      'F#2': 'bassoon-fSHARP2.mp3',
      'F#3': 'bassoon-fSHARP3.mp3',
      'F#4': 'bassoon-fSHARP4.mp3',
    }
  },
  'Horn': {
    displayName: 'Horn (French Horn)',
    range: 'E2-G4',
    baseUrl: 'Orchestra/Horn/',
    samples: {
      'E2': 'horn-e2.mp3',
      'G2': 'horn-g2.mp3',
      'B2': 'horn-b2.mp3',
      'D3': 'horn-d3.mp3',
      'E3': 'horn-e3.mp3',
      'G3': 'horn-g3.mp3',
      'B3': 'horn-b3.mp3',
      'D4': 'horn-d4.mp3',
      'E4': 'horn-e4.mp3',
      'G4': 'horn-g4.mp3',
      'F#2': 'horn-fSHARP2.mp3',
      'F#3': 'horn-fSHARP3.mp3',
      'F#4': 'horn-fSHARP4.mp3',
      'C#3': 'horn-cSHARP3.mp3',
      'C#4': 'horn-cSHARP4.mp3',
      'A#3': 'horn-aSHARP3.mp3',
    }
  },
  'Trumpet': {
    displayName: 'Trumpet',
    range: 'E3-E6',
    baseUrl: 'Orchestra/Trumpet/',
    samples: {
      'E3': 'trumpet-e3.mp3',
      'G3': 'trumpet-g3.mp3',
      'B3': 'trumpet-b3.mp3',
      'D4': 'trumpet-d4.mp3',
      'E4': 'trumpet-e4.mp3',
      'G4': 'trumpet-g4.mp3',
      'B4': 'trumpet-b4.mp3',
      'D5': 'trumpet-d5.mp3',
      'E5': 'trumpet-e5.mp3',
      'G5': 'trumpet-g5.mp3',
      'E6': 'trumpet-e6.mp3',
      'C#3': 'trumpet-cSHARP3.mp3',
      'C#4': 'trumpet-cSHARP4.mp3',
      'C#5': 'trumpet-cSHARP5.mp3',
      'F#3': 'trumpet-fSHARP3.mp3',
      'F#4': 'trumpet-fSHARP4.mp3',
      'F#5': 'trumpet-fSHARP5.mp3',
    }
  },
  'Tenor Trombone': {
    displayName: 'Tenor Trombone',
    range: 'E2-B4',
    baseUrl: 'Orchestra/Tenor Trombone/',
    samples: {
      'E2': 'tenor-trombone-e2.mp3',
      'G2': 'tenor-trombone-g2.mp3',
      'B2': 'tenor-trombone-b2.mp3',
      'D3': 'tenor-trombone-d3.mp3',
      'E3': 'tenor-trombone-e3.mp3',
      'G3': 'tenor-trombone-g3.mp3',
      'B3': 'tenor-trombone-b3.mp3',
      'D4': 'tenor-trombone-d4.mp3',
      'E4': 'tenor-trombone-e4.mp3',
      'G4': 'tenor-trombone-g4.mp3',
      'B4': 'tenor-trombone-b4.mp3',
      'F#2': 'tenor-trombone-fSHARP2.mp3',
      'F#3': 'tenor-trombone-fSHARP3.mp3',
      'F#4': 'tenor-trombone-fSHARP4.mp3',
      'C#3': 'tenor-trombone-cSHARP3.mp3',
      'C#4': 'tenor-trombone-cSHARP4.mp3',
    }
  },
  'Tuba': {
    displayName: 'Tuba',
    range: 'E1-G4',
    baseUrl: 'Orchestra/Tuba/',
    samples: {
      'E1': 'tuba-e1.mp3',
      'G1': 'tuba-g1.mp3',
      'B1': 'tuba-b1.mp3',
      'D2': 'tuba-d2.mp3',
      'E2': 'tuba-e2.mp3',
      'G2': 'tuba-g2.mp3',
      'B2': 'tuba-b2.mp3',
      'D3': 'tuba-d3.mp3',
      'E3': 'tuba-e3.mp3',
      'G3': 'tuba-g3.mp3',
      'D4': 'tuba-d4.mp3',
      'G4': 'tuba-g4.mp3',
      'F#1': 'tuba-fSHARP1.mp3',
      'F#2': 'tuba-fSHARP2.mp3',
      'F#3': 'tuba-fSHARP3.mp3',
      'C#2': 'tuba-cSHARP2.mp3',
      'C#3': 'tuba-cSHARP3.mp3',
    }
  },
  'Grand Piano': {
    displayName: 'Grand Piano',
    range: 'C1-C8',
    baseUrl: 'Orchestra/Grand Piano/',
    samples: {
      'C1': 'piano-c1.mp3',
      'C2': 'piano-c2.mp3',
      'C3': 'piano-c3.mp3',
      'C4': 'piano-c4.mp3',
      'C5': 'piano-c5.mp3',
      'C6': 'piano-c6.mp3',
      'C7': 'piano-c7.mp3',
      'E1': 'piano-e1.mp3',
      'E2': 'piano-e2.mp3',
      'E3': 'piano-e3.mp3',
      'E4': 'piano-e4.mp3',
      'E5': 'piano-e5.mp3',
      'E6': 'piano-e6.mp3',
      'E7': 'piano-e7.mp3',
      'G1': 'piano-g1.mp3',
      'G2': 'piano-g2.mp3',
      'G3': 'piano-g3.mp3',
      'G4': 'piano-g4.mp3',
      'G5': 'piano-g5.mp3',
      'G6': 'piano-g6.mp3',
      'G7': 'piano-g7.mp3',
      'B1': 'piano-b1.mp3',
      'B2': 'piano-b2.mp3',
      'B3': 'piano-b3.mp3',
      'B4': 'piano-b4.mp3',
      'B5': 'piano-b5.mp3',
      'B6': 'piano-b6.mp3',
    }
  },
  'Harp': {
    displayName: 'Harp',
    range: 'C2-C7',
    baseUrl: 'Orchestra/Harp/',
    samples: {
      'C2': 'harp-c2.mp3',
      'E2': 'harp-e2.mp3',
      'G2': 'harp-g2.mp3',
      'B2': 'harp-b2.mp3',
      'C3': 'harp-c3.mp3',
      'E3': 'harp-e3.mp3',
      'G3': 'harp-g3.mp3',
      'B3': 'harp-b3.mp3',
      'C4': 'harp-c4.mp3',
      'E4': 'harp-e4.mp3',
      'G4': 'harp-g4.mp3',
      'B4': 'harp-b4.mp3',
      'C5': 'harp-c5.mp3',
      'E5': 'harp-e5.mp3',
      'G5': 'harp-g5.mp3',
      'B5': 'harp-b5.mp3',
      'C6': 'harp-c6.mp3',
      'E6': 'harp-e6.mp3',
      'G6': 'harp-g6.mp3',
      'C7': 'harp-c7.mp3',
    }
  },
  'Chorus': {
    displayName: 'Chorus (SATB)',
    range: 'C2-C6',
    baseUrl: 'Orchestra/Chorus/',
    samples: {
      'C2': 'chorus-c2.mp3',
      'E2': 'chorus-e2.mp3',
      'G2': 'chorus-g2.mp3',
      'B2': 'chorus-b2.mp3',
      'C3': 'chorus-c3.mp3',
      'E3': 'chorus-e3.mp3',
      'G3': 'chorus-g3.mp3',
      'B3': 'chorus-b3.mp3',
      'C4': 'chorus-c4.mp3',
      'E4': 'chorus-e4.mp3',
      'G4': 'chorus-g4.mp3',
      'B4': 'chorus-b4.mp3',
      'C5': 'chorus-c5.mp3',
      'E5': 'chorus-e5.mp3',
      'G5': 'chorus-g5.mp3',
      'B5': 'chorus-b5.mp3',
      'C6': 'chorus-c6.mp3',
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
  }
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