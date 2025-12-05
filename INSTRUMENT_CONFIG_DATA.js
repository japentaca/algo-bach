/**
 * INSTRUMENT CONFIGURATION - Generated from Actual Sample Inventory
 * 
 * This file contains complete mappings extracted from all available samples
 * in the public/Orchestra/ folders as of December 5, 2025.
 * 
 * Format: Each note maps to exact filename as found on disk.
 * Tonal.js Sampler will interpolate between defined notes.
 * 
 * Naming conventions in filenames:
 * - Lowercase note + SHARP/FLAT + octave: e.g., aSHARP3, dSHARP4
 * - Uppercase variants: e.g., A2, CSHARP3
 * - Prefixes for articulations: e.g., violas-piz-rr1-, horns-sus-
 */

const INSTRUMENT_SAMPLES_COMPLETE = {

  // ==================== STRINGS ====================

  'Violin': {
    baseUrl: 'Orchestra/Violin/',
    displayName: 'Violin (Solo)',
    range: 'G3-E7',
    samples: {
      'G3': 'violin-g3.mp3',
      'A#3': 'violin-aSHARP3.mp3',
      'A#4': 'violin-aSHARP4.mp3',
      'A#5': 'violin-aSHARP5.mp3',
      'A#6': 'violin-aSHARP6.mp3',
      'C#4': 'violin-cSHARP4.mp3',
      'C#5': 'violin-cSHARP5.mp3',
      'C#6': 'violin-cSHARP6.mp3',
      'C#7': 'violin-cSHARP7.mp3',
      'E4': 'violin-e4.mp3',
      'E5': 'violin-e5.mp3',
      'E6': 'violin-e6.mp3',
      'G4': 'violin-g4.mp3',
      'G5': 'violin-g5.mp3',
      'G6': 'violin-g6.mp3',
    }
  },

  'Violas': {
    baseUrl: 'Orchestra/Violas/',
    displayName: 'Violas (Ensemble)',
    range: 'C3-C6',
    articulations: ['pizzicato_rr1', 'pizzicato_rr2', 'sustained'],
    samples: {
      'C3': 'violas-sus-c3.mp3',      // Using sustained as default
      'A3': 'violas-sus-a3.mp3',
      'D#3': 'violas-sus-dSHARP3.mp3',
      'F#3': 'violas-sus-fSHARP3.mp3',
      'C4': 'violas-sus-c4.mp3',
      'A4': 'violas-sus-a4.mp3',
      'D#4': 'violas-sus-dSHARP4.mp3',
      'F#4': 'violas-sus-fSHARP4.mp3',
      'C5': 'violas-sus-c5.mp3',
      'A5': 'violas-sus-a5.mp3',
      'D#5': 'violas-sus-dSHARP5.mp3',
      'F#5': 'violas-sus-fSHARP5.mp3',
      'C6': 'violas-sus-c6.mp3',
    },
    variants: {
      'pizzicato_rr1': 'violas-piz-rr1-',
      'pizzicato_rr2': 'violas-piz-rr2-',
      'sustained': 'violas-sus-'
    }
  },

  'Cello': {
    baseUrl: 'Orchestra/Cello/',
    displayName: 'Cello (Solo)',
    range: 'C2-A5',
    samples: {
      'C2': 'cello-c2.mp3',
      'A2': 'cello-a2.mp3',
      'D#2': 'cello-dSHARP2.mp3',
      'F#2': 'cello-fSHARP2.mp3',
      'C3': 'cello-c3.mp3',
      'A3': 'cello-a3.mp3',
      'D#3': 'cello-dSHARP3.mp3',
      'F#3': 'cello-fSHARP3.mp3',
      'C4': 'cello-c4.mp3',
      'A4': 'cello-a4.mp3',
      'D#4': 'cello-dSHARP4.mp3',
      'F#4': 'cello-fSHARP4.mp3',
      'C5': 'cello-c5.mp3',
      'A5': 'cello-a5.mp3',
      'D#5': 'cello-dSHARP5.mp3',
      'F#5': 'cello-fSHARP5.mp3',
    }
  },

  'Celli': {
    baseUrl: 'Orchestra/Celli/',
    displayName: 'Celli (Ensemble)',
    range: 'C2-C5',
    articulations: ['pizzicato_rr1', 'pizzicato_rr2', 'staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'C2': 'celli-sus-c2.mp3',
      'A2': 'celli-sus-a2.mp3',
      'D#2': 'celli-sus-dSHARP2.mp3',
      'F#2': 'celli-sus-fSHARP2.mp3',
      'C3': 'celli-sus-c3.mp3',
      'A3': 'celli-sus-a3.mp3',
      'D#3': 'celli-sus-dSHARP3.mp3',
      'F#3': 'celli-sus-fSHARP3.mp3',
      'C4': 'celli-sus-c4.mp3',
      'A4': 'celli-sus-a4.mp3',
      'D#4': 'celli-sus-dSHARP4.mp3',
      'F#4': 'celli-sus-fSHARP4.mp3',
      'C5': 'celli-sus-c5.mp3',
    },
    variants: {
      'pizzicato_rr1': 'celli-piz-rr1-',
      'pizzicato_rr2': 'celli-piz-rr2-',
      'staccato_rr1': 'celli-stc-rr1-',
      'staccato_rr2': 'celli-stc-rr2-',
      'sustained': 'celli-sus-'
    }
  },

  'Basses': {
    baseUrl: 'Orchestra/Basses/',
    displayName: 'Basses (Ensemble, Pizzicato/Staccato/Sustained)',
    range: 'C1-A3',
    articulations: ['pizzicato_rr1', 'pizzicato_rr2', 'staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'C1': 'basses-sus-c1.mp3',
      'A1': 'basses-sus-a1.mp3',
      'D#1': 'basses-sus-dSHARP1.mp3',
      'F#1': 'basses-sus-fSHARP1.mp3',
      'C2': 'basses-sus-c2.mp3',
      'A2': 'basses-sus-a2.mp3',
      'D#2': 'basses-sus-dSHARP2.mp3',
      'F#2': 'basses-sus-fSHARP2.mp3',
      'C3': 'basses-sus-c3.mp3',
      'A3': 'basses-sus-a3.mp3',
      'D#3': 'basses-sus-dSHARP3.mp3',
      'F#3': 'basses-sus-fSHARP3.mp3',
      'C4': 'basses-sus-c4.mp3',
    },
    variants: {
      'pizzicato_rr1': 'basses-piz-rr1-',
      'pizzicato_rr2': 'basses-piz-rr2-',
      'staccato_rr1': 'basses-stc-rr1-',
      'staccato_rr2': 'basses-stc-rr2-',
      'sustained': 'basses-sus-'
    }
  },

  // ==================== WOODWINDS ====================

  'Flute': {
    baseUrl: 'Orchestra/Flute/',
    displayName: 'Flute (Solo)',
    range: 'C3-C6',
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

  'Flutes': {
    baseUrl: 'Orchestra/Flutes/',
    displayName: 'Flutes (Ensemble)',
    range: 'C3-C5',
    articulations: ['staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'C3': 'flutes-sus-c3.mp3',
      'A3': 'flutes-sus-a3.mp3',
      'D#3': 'flutes-sus-dSHARP3.mp3',
      'F#3': 'flutes-sus-fSHARP3.mp3',
      'C4': 'flutes-sus-c4.mp3',
      'A4': 'flutes-sus-a4.mp3',
      'D#4': 'flutes-sus-dSHARP4.mp3',
      'F#4': 'flutes-sus-fSHARP4.mp3',
      'C5': 'flutes-sus-c5.mp3',
      'A5': 'flutes-sus-a5.mp3',
      'D#5': 'flutes-sus-dSHARP5.mp3',
      'F#5': 'flutes-sus-fSHARP5.mp3',
    },
    variants: {
      'staccato_rr1': 'flutes-stc-rr1-',
      'staccato_rr2': 'flutes-stc-rr2-',
      'sustained': 'flutes-sus-'
    }
  },

  'Piccolo': {
    baseUrl: 'Orchestra/Piccolo/',
    displayName: 'Piccolo (High Register)',
    range: 'C4-C6',
    samples: {
      'C4': 'piccolo-c4.mp3',
      'A4': 'piccolo-a4.mp3',
      'D#4': 'piccolo-dSHARP4.mp3',
      'F#4': 'piccolo-fSHARP4.mp3',
      'C5': 'piccolo-c5.mp3',
      'A5': 'piccolo-a5.mp3',
      'D#5': 'piccolo-dSHARP5.mp3',
      'F#5': 'piccolo-fSHARP5.mp3',
      'C6': 'piccolo-c6.mp3',
      'D#6': 'piccolo-dSHARP6.mp3',
      'F#6': 'piccolo-fSHARP6.mp3',
    }
  },

  'Oboe': {
    baseUrl: 'Orchestra/Oboe/',
    displayName: 'Oboe (Solo)',
    range: 'G4-G5',
    samples: {
      'A#3': 'oboe-aSHARP3.mp3',
      'A#4': 'oboe-aSHARP4.mp3',
      'A#5': 'oboe-aSHARP5.mp3',
      'C#4': 'oboe-cSHARP4.mp3',
      'C#5': 'oboe-cSHARP5.mp3',
      'E4': 'oboe-e4.mp3',
      'E5': 'oboe-e5.mp3',
      'G4': 'oboe-g4.mp3',
      'G5': 'oboe-g5.mp3',
      'C6': 'oboe-c6.mp3',
    }
  },

  'Oboes': {
    baseUrl: 'Orchestra/Oboes/',
    displayName: 'Oboes (Ensemble, Sustained)',
    range: 'A#3-G5',
    samples: {
      'A#3': 'oboes-sus-aSHARP3.mp3',
      'A#4': 'oboes-sus-aSHARP4.mp3',
      'A#5': 'oboes-sus-aSHARP5.mp3',
      'C#4': 'oboes-sus-cSHARP4.mp3',
      'C#5': 'oboes-sus-cSHARP5.mp3',
      'C#6': 'oboes-sus-cSHARP6.mp3',
      'E4': 'oboes-sus-e4.mp3',
      'E5': 'oboes-sus-e5.mp3',
      'E6': 'oboes-sus-e6.mp3',
      'G4': 'oboes-sus-g4.mp3',
      'G5': 'oboes-sus-g5.mp3',
    }
  },

  'Clarinet': {
    baseUrl: 'Orchestra/Clarinet/',
    displayName: 'Clarinet (Solo)',
    range: 'B3-D6',
    samples: {
      'B3': 'clarinet-b3.mp3',
      'B4': 'clarinet-b4.mp3',
      'B5': 'clarinet-b5.mp3',
      'D3': 'clarinet-d3.mp3',
      'D4': 'clarinet-d4.mp3',
      'D5': 'clarinet-d5.mp3',
      'D6': 'clarinet-d6.mp3',
      'F3': 'clarinet-f3.mp3',
      'F4': 'clarinet-f4.mp3',
      'F5': 'clarinet-f5.mp3',
      'G#3': 'clarinet-gSHARP3.mp3',
      'G#4': 'clarinet-gSHARP4.mp3',
      'G#5': 'clarinet-gSHARP5.mp3',
    }
  },

  'Clarinets': {
    baseUrl: 'Orchestra/Clarinets/',
    displayName: 'Clarinets (Ensemble, Sustained)',
    range: 'B3-D6',
    samples: {
      'B3': 'clarinets-sus-b3.mp3',
      'B4': 'clarinets-sus-b4.mp3',
      'B5': 'clarinets-sus-b5.mp3',
      'D3': 'clarinets-sus-d3.mp3',
      'D4': 'clarinets-sus-d4.mp3',
      'D5': 'clarinets-sus-d5.mp3',
      'D6': 'clarinets-sus-d6.mp3',
      'F3': 'clarinets-sus-f3.mp3',
      'F4': 'clarinets-sus-f4.mp3',
      'F5': 'clarinets-sus-f5.mp3',
      'G#3': 'clarinets-sus-gSHARP3.mp3',
      'G#4': 'clarinets-sus-gSHARP4.mp3',
      'G#5': 'clarinets-sus-gSHARP5.mp3',
    }
  },

  'Bass Clarinet': {
    baseUrl: 'Orchestra/Bass Clarinet/',
    displayName: 'Bass Clarinet (Low Register)',
    range: 'B2-D5',
    samples: {
      'B2': 'bass_clarinet-b2.mp3',
      'B3': 'bass_clarinet-b3.mp3',
      'B4': 'bass_clarinet-b4.mp3',
      'D2': 'bass_clarinet-d2.mp3',
      'D3': 'bass_clarinet-d3.mp3',
      'D4': 'bass_clarinet-d4.mp3',
      'D5': 'bass_clarinet-d5.mp3',
      'F2': 'bass_clarinet-f2.mp3',
      'F3': 'bass_clarinet-f3.mp3',
      'F4': 'bass_clarinet-f4.mp3',
      'G#2': 'bass_clarinet-gSHARP2.mp3',
      'G#3': 'bass_clarinet-gSHARP3.mp3',
      'G#4': 'bass_clarinet-gSHARP4.mp3',
    }
  },

  'Cor Anglais': {
    baseUrl: 'Orchestra/Cor Anglais/',
    displayName: 'Cor Anglais (English Horn)',
    range: 'B3-D5',
    samples: {
      'B3': 'cor_anglais-b3.mp3',
      'B4': 'cor_anglais-b4.mp3',
      'D4': 'cor_anglais-d4.mp3',
      'D5': 'cor_anglais-d5.mp3',
      'F3': 'cor_anglais-f3.mp3',
      'F4': 'cor_anglais-f4.mp3',
      'F5': 'cor_anglais-f5.mp3',
      'G#3': 'cor_anglais-gSHARP3.mp3',
      'G#4': 'cor_anglais-gSHARP4.mp3',
    }
  },

  'Bassoon': {
    baseUrl: 'Orchestra/Bassoon/',
    displayName: 'Bassoon (Solo)',
    range: 'A#1-G4',
    samples: {
      'A#1': 'bassoon-aSHARP1.mp3',
      'A#2': 'bassoon-aSHARP2.mp3',
      'A#3': 'bassoon-aSHARP3.mp3',
      'A#4': 'bassoon-aSHARP4.mp3',
      'C#2': 'bassoon-cSHARP2.mp3',
      'C#3': 'bassoon-cSHARP3.mp3',
      'C#4': 'bassoon-cSHARP4.mp3',
      'C#5': 'bassoon-cSHARP5.mp3',
      'E2': 'bassoon-e2.mp3',
      'E3': 'bassoon-e3.mp3',
      'E4': 'bassoon-e4.mp3',
      'G2': 'bassoon-g2.mp3',
      'G3': 'bassoon-g3.mp3',
      'G4': 'bassoon-g4.mp3',
    }
  },

  'Bassoons': {
    baseUrl: 'Orchestra/Bassoons/',
    displayName: 'Bassoons (Ensemble, Sustained)',
    range: 'A#1-G4',
    samples: {
      'A#1': 'bassoons-sus-aSHARP1.mp3',
      'A#2': 'bassoons-sus-aSHARP2.mp3',
      'A#3': 'bassoons-sus-aSHARP3.mp3',
      'A#4': 'bassoons-sus-aSHARP4.mp3',
      'C#2': 'bassoons-sus-cSHARP2.mp3',
      'C#3': 'bassoons-sus-cSHARP3.mp3',
      'C#4': 'bassoons-sus-cSHARP4.mp3',
      'C#5': 'bassoons-sus-cSHARP5.mp3',
      'E2': 'bassoons-sus-e2.mp3',
      'E3': 'bassoons-sus-e3.mp3',
      'E4': 'bassoons-sus-e4.mp3',
      'E5': 'bassoons-sus-e5.mp3',
      'G2': 'bassoons-sus-g2.mp3',
      'G3': 'bassoons-sus-g3.mp3',
      'G4': 'bassoons-sus-g4.mp3',
    }
  },

  'Contrabassoon': {
    baseUrl: 'Orchestra/Contrabassoon/',
    displayName: 'Contrabassoon (Extreme Low)',
    range: 'A#0-G3',
    samples: {
      'A#0': 'contrabassoon-aSHARP0.mp3',
      'A#1': 'contrabassoon-aSHARP1.mp3',
      'A#2': 'contrabassoon-aSHARP2.mp3',
      'A#3': 'contrabassoon-aSHARP3.mp3',
      'C#1': 'contrabassoon-cSHARP1.mp3',
      'C#2': 'contrabassoon-cSHARP2.mp3',
      'C#3': 'contrabassoon-cSHARP3.mp3',
      'E1': 'contrabassoon-e1.mp3',
      'E2': 'contrabassoon-e2.mp3',
      'E3': 'contrabassoon-e3.mp3',
      'G1': 'contrabassoon-g1.mp3',
      'G2': 'contrabassoon-g2.mp3',
      'G3': 'contrabassoon-g3.mp3',
    }
  },

  'Alto Flute': {
    baseUrl: 'Orchestra/Alto Flute/',
    displayName: 'Alto Flute (Lower Soprano)',
    range: 'G3-G6',
    samples: {
      'A#3': 'alto_flute-aSHARP3.mp3',
      'A#4': 'alto_flute-aSHARP4.mp3',
      'A#5': 'alto_flute-aSHARP5.mp3',
      'C#4': 'alto_flute-cSHARP4.mp3',
      'C#5': 'alto_flute-cSHARP5.mp3',
      'C#6': 'alto_flute-cSHARP6.mp3',
      'E4': 'alto_flute-e4.mp3',
      'E5': 'alto_flute-e5.mp3',
      'E6': 'alto_flute-e6.mp3',
      'G3': 'alto_flute-g3.mp3',
      'G4': 'alto_flute-g4.mp3',
      'G5': 'alto_flute-g5.mp3',
      'G6': 'alto_flute-g6.mp3',
    }
  },

  // ==================== BRASS ====================

  'Horn': {
    baseUrl: 'Orchestra/Horn/',
    displayName: 'Horn (Solo)',
    range: 'E2-G4',
    samples: {
      'A#2': 'horn-aSHARP2.mp3',
      'A#3': 'horn-aSHARP3.mp3',
      'A#4': 'horn-aSHARP4.mp3',
      'C#3': 'horn-cSHARP3.mp3',
      'C#4': 'horn-cSHARP4.mp3',
      'C#5': 'horn-cSHARP5.mp3',
      'E2': 'horn-e2.mp3',
      'E3': 'horn-e3.mp3',
      'E4': 'horn-e4.mp3',
      'E5': 'horn-e5.mp3',
      'G2': 'horn-g2.mp3',
      'G3': 'horn-g3.mp3',
      'G4': 'horn-g4.mp3',
    }
  },

  'Horns': {
    baseUrl: 'Orchestra/Horns/',
    displayName: 'Horns (Ensemble)',
    range: 'E2-G4',
    articulations: ['staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'A#2': 'horns-sus-aSHARP2.mp3',
      'A#3': 'horns-sus-aSHARP3.mp3',
      'A#4': 'horns-sus-aSHARP4.mp3',
      'C#3': 'horns-sus-cSHARP3.mp3',
      'C#4': 'horns-sus-cSHARP4.mp3',
      'E2': 'horns-sus-e2.mp3',
      'E3': 'horns-sus-e3.mp3',
      'E4': 'horns-sus-e4.mp3',
      'G2': 'horns-sus-g2.mp3',
      'G3': 'horns-sus-g3.mp3',
      'G4': 'horns-sus-g4.mp3',
    },
    variants: {
      'staccato_rr1': 'horns-stc-rr1-',
      'staccato_rr2': 'horns-stc-rr2-',
      'sustained': 'horns-sus-'
    }
  },

  'Trumpet': {
    baseUrl: 'Orchestra/Trumpet/',
    displayName: 'Trumpet (Solo)',
    range: 'E3-E6',
    samples: {
      'A#3': 'trumpet-aSHARP3.mp3',
      'A#4': 'trumpet-aSHARP4.mp3',
      'A#5': 'trumpet-aSHARP5.mp3',
      'C#4': 'trumpet-cSHARP4.mp3',
      'C#5': 'trumpet-cSHARP5.mp3',
      'C#6': 'trumpet-cSHARP6.mp3',
      'E3': 'trumpet-e3.mp3',
      'E4': 'trumpet-e4.mp3',
      'E5': 'trumpet-e5.mp3',
      'E6': 'trumpet-e6.mp3',
      'G3': 'trumpet-g3.mp3',
      'G4': 'trumpet-g4.mp3',
      'G5': 'trumpet-g5.mp3',
    }
  },

  'Trumpets': {
    baseUrl: 'Orchestra/Trumpets/',
    displayName: 'Trumpets (Ensemble)',
    range: 'E3-E6',
    articulations: ['staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'A#3': 'trumpets-sus-aSHARP3.mp3',
      'A#4': 'trumpets-sus-aSHARP4.mp3',
      'A#5': 'trumpets-sus-aSHARP5.mp3',
      'C#4': 'trumpets-sus-cSHARP4.mp3',
      'C#5': 'trumpets-sus-cSHARP5.mp3',
      'C#6': 'trumpets-sus-cSHARP6.mp3',
      'E3': 'trumpets-sus-e3.mp3',
      'E4': 'trumpets-sus-e4.mp3',
      'E5': 'trumpets-sus-e5.mp3',
      'E6': 'trumpets-sus-e6.mp3',
      'G3': 'trumpets-sus-g3.mp3',
      'G4': 'trumpets-sus-g4.mp3',
      'G5': 'trumpets-sus-g5.mp3',
    },
    variants: {
      'staccato_rr1': 'trumpets-stc-rr1-',
      'staccato_rr2': 'trumpets-stc-rr2-',
      'sustained': 'trumpets-sus-'
    }
  },

  'Tenor Trombone': {
    baseUrl: 'Orchestra/Tenor Trombone/',
    displayName: 'Tenor Trombone (Solo)',
    range: 'E2-B4',
    samples: {
      'A#2': 'tenor_trombone-aSHARP2.mp3',
      'A#3': 'tenor_trombone-aSHARP3.mp3',
      'A#4': 'tenor_trombone-aSHARP4.mp3',
      'C#3': 'tenor_trombone-cSHARP3.mp3',
      'C#4': 'tenor_trombone-cSHARP4.mp3',
      'E2': 'tenor_trombone-e2.mp3',
      'E3': 'tenor_trombone-e3.mp3',
      'E4': 'tenor_trombone-e4.mp3',
      'G2': 'tenor_trombone-g2.mp3',
      'G3': 'tenor_trombone-g3.mp3',
      'G4': 'tenor_trombone-g4.mp3',
    }
  },

  'Trombones': {
    baseUrl: 'Orchestra/Trombones/',
    displayName: 'Trombones (Ensemble)',
    range: 'E2-E5',
    articulations: ['staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'A#2': 'trombones-sus-aSHARP2.mp3',
      'A#3': 'trombones-sus-aSHARP3.mp3',
      'A#4': 'trombones-sus-aSHARP4.mp3',
      'C#3': 'trombones-sus-cSHARP3.mp3',
      'C#4': 'trombones-sus-cSHARP4.mp3',
      'C#5': 'trombones-sus-cSHARP5.mp3',
      'E2': 'trombones-sus-e2.mp3',
      'E3': 'trombones-sus-e3.mp3',
      'E4': 'trombones-sus-e4.mp3',
      'E5': 'trombones-sus-e5.mp3',
      'G2': 'trombones-sus-g2.mp3',
      'G3': 'trombones-sus-g3.mp3',
      'G4': 'trombones-sus-g4.mp3',
    },
    variants: {
      'staccato_rr1': 'trombones-stc-rr1-',
      'staccato_rr2': 'trombones-stc-rr2-',
      'sustained': 'trombones-sus-'
    }
  },

  'Bass Trombone': {
    baseUrl: 'Orchestra/Bass Trombone/',
    displayName: 'Bass Trombone (Low Register)',
    range: 'E1-G4',
    samples: {
      'A#1': 'bass_trombone-aSHARP1.mp3',
      'A#2': 'bass_trombone-aSHARP2.mp3',
      'A#3': 'bass_trombone-aSHARP3.mp3',
      'C#2': 'bass_trombone-cSHARP2.mp3',
      'C#3': 'bass_trombone-cSHARP3.mp3',
      'C#4': 'bass_trombone-cSHARP4.mp3',
      'E1': 'bass_trombone-e1.mp3',
      'E2': 'bass_trombone-e2.mp3',
      'E3': 'bass_trombone-e3.mp3',
      'E4': 'bass_trombone-e4.mp3',
      'G1': 'bass_trombone-g1.mp3',
      'G2': 'bass_trombone-g2.mp3',
      'G3': 'bass_trombone-g3.mp3',
      'G4': 'bass_trombone-g4.mp3',
    }
  },

  'Tuba': {
    baseUrl: 'Orchestra/Tuba/',
    displayName: 'Tuba (Ensemble & Solo)',
    range: 'E1-G4',
    articulations: ['staccato_rr1', 'staccato_rr2', 'sustained'],
    samples: {
      'A1': 'tuba-sus-aSHARP1.mp3',
      'A#2': 'tuba-sus-aSHARP2.mp3',
      'A#3': 'tuba-sus-aSHARP3.mp3',
      'C#2': 'tuba-sus-cSHARP2.mp3',
      'C#3': 'tuba-sus-cSHARP3.mp3',
      'C#4': 'tuba-sus-cSHARP4.mp3',
      'E1': 'tuba-sus-e1.mp3',
      'E2': 'tuba-sus-e2.mp3',
      'E3': 'tuba-sus-e3.mp3',
      'G1': 'tuba-sus-g1.mp3',
      'G2': 'tuba-sus-g2.mp3',
      'G3': 'tuba-sus-g3.mp3',
    },
    variants: {
      'staccato_rr1': 'tuba-stc-rr1-',
      'staccato_rr2': 'tuba-stc-rr2-',
      'sustained': 'tuba-sus-'
    }
  },

  // ==================== KEYBOARD ====================

  'Grand Piano': {
    baseUrl: 'Orchestra/Grand Piano/',
    displayName: 'Grand Piano (Full Range)',
    range: 'C1-C8',
    dynamics: ['forte', 'piano'],
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
    },
    variants: {
      'forte': 'piano-f-',
      'piano': 'piano-p-'
    }
  },

  // ==================== PLUCKED/HARP ====================

  'Harp': {
    baseUrl: 'Orchestra/Harp/',
    displayName: 'Harp (Plucked)',
    range: 'C2-C7',
    samples: {
      'C2': 'harp-c2.mp3',
      'C3': 'harp-c3.mp3',
      'C4': 'harp-c4.mp3',
      'C5': 'harp-c5.mp3',
      'C6': 'harp-c6.mp3',
      'C7': 'harp-c7.mp3',
      'A2': 'harp-a2.mp3',
      'A3': 'harp-a3.mp3',
      'A4': 'harp-a4.mp3',
      'A5': 'harp-a5.mp3',
      'A6': 'harp-a6.mp3',
      'D#2': 'harp-dSHARP2.mp3',
      'D#3': 'harp-dSHARP3.mp3',
      'D#4': 'harp-dSHARP4.mp3',
      'D#5': 'harp-dSHARP5.mp3',
      'D#6': 'harp-dSHARP6.mp3',
      'F#2': 'harp-fSHARP2.mp3',
      'F#3': 'harp-fSHARP3.mp3',
      'F#4': 'harp-fSHARP4.mp3',
      'F#5': 'harp-fSHARP5.mp3',
      'F#6': 'harp-fSHARP6.mp3',
    }
  },

  // ==================== CHOIR/VOICE ====================

  'Chorus': {
    baseUrl: 'Orchestra/Chorus/',
    displayName: 'Chorus (SATB/Mixed)',
    range: 'G2-G5',
    genderParts: {
      'soprano': 'chorus-female- (A4-G5)',
      'alto': 'chorus-female- (A4-G5)',
      'tenor': 'chorus-male- (G2-G3)',
      'bass': 'chorus-male- (G2-G3)'
    },
    samples: {
      // Female (Soprano/Alto range)
      'C5': 'chorus-female-c5.mp3',
      'C6': 'chorus-female-c6.mp3',
      'A4': 'chorus-female-a4.mp3',
      'A5': 'chorus-female-a5.mp3',
      'A#4': 'chorus-female-aSHARP4.mp3',
      'A#5': 'chorus-female-aSHARP5.mp3',
      'B4': 'chorus-female-b4.mp3',
      'B5': 'chorus-female-b5.mp3',
      'C#5': 'chorus-female-cSHARP5.mp3',
      'D5': 'chorus-female-d5.mp3',
      'D#5': 'chorus-female-dSHARP5.mp3',
      'E5': 'chorus-female-e5.mp3',
      'F5': 'chorus-female-f5.mp3',
      'F#5': 'chorus-female-fSHARP5.mp3',
      'G4': 'chorus-female-g4.mp3',
      'G5': 'chorus-female-g5.mp3',
      'G#4': 'chorus-female-gSHARP4.mp3',
      'G#5': 'chorus-female-gSHARP5.mp3',
    },
    maleSamples: {
      // Male (Tenor/Bass range)
      'C3': 'chorus-male-c3.mp3',
      'C4': 'chorus-male-c4.mp3',
      'A2': 'chorus-male-a2.mp3',
      'A3': 'chorus-male-a3.mp3',
      'A#2': 'chorus-male-aSHARP2.mp3',
      'A#3': 'chorus-male-aSHARP3.mp3',
      'B2': 'chorus-male-b2.mp3',
      'B3': 'chorus-male-b3.mp3',
      'C#3': 'chorus-male-cSHARP3.mp3',
      'C#4': 'chorus-male-cSHARP4.mp3',
      'D3': 'chorus-male-d3.mp3',
      'D4': 'chorus-male-d4.mp3',
      'D#3': 'chorus-male-dSHARP3.mp3',
      'D#4': 'chorus-male-dSHARP4.mp3',
      'E3': 'chorus-male-e3.mp3',
      'E4': 'chorus-male-e4.mp3',
      'F3': 'chorus-male-f3.mp3',
      'F4': 'chorus-male-f4.mp3',
      'F#3': 'chorus-male-fSHARP3.mp3',
      'F#4': 'chorus-male-fSHARP4.mp3',
      'G2': 'chorus-male-g2.mp3',
      'G3': 'chorus-male-g3.mp3',
      'G#2': 'chorus-male-gSHARP2.mp3',
      'G#3': 'chorus-male-gSHARP3.mp3',
    }
  },

  // ==================== PERCUSSION (MELODIC) ====================

  'Chimes': {
    baseUrl: 'Orchestra/Chimes/',
    displayName: 'Chimes (Percussion)',
    range: 'C3-C6',
    samples: {
      'C3': 'chimes-c3.mp3',
      'C4': 'chimes-c4.mp3',
      'C5': 'chimes-c5.mp3',
      'C6': 'chimes-c6.mp3',
      'A3': 'chimes-a3.mp3',
      'A4': 'chimes-a4.mp3',
      'A5': 'chimes-a5.mp3',
      'D#3': 'chimes-dSHARP3.mp3',
      'D#4': 'chimes-dSHARP4.mp3',
      'D#5': 'chimes-dSHARP5.mp3',
      'F#3': 'chimes-fSHARP3.mp3',
      'F#4': 'chimes-fSHARP4.mp3',
      'F#5': 'chimes-fSHARP5.mp3',
    }
  },

  'Glockenspiel': {
    baseUrl: 'Orchestra/Glocken/',
    displayName: 'Glockenspiel (Mallet Percussion)',
    range: 'C3-C6',
    samples: {
      'C3': 'glockenspiel-c3.mp3',
      'C4': 'glockenspiel-c4.mp3',
      'C5': 'glockenspiel-c5.mp3',
      'C6': 'glockenspiel-c6.mp3',
      'A3': 'glockenspiel-a3.mp3',
      'A4': 'glockenspiel-a4.mp3',
      'A5': 'glockenspiel-a5.mp3',
      'D#3': 'glockenspiel-dSHARP3.mp3',
      'D#4': 'glockenspiel-dSHARP4.mp3',
      'D#5': 'glockenspiel-dSHARP5.mp3',
      'F#3': 'glockenspiel-fSHARP3.mp3',
      'F#4': 'glockenspiel-fSHARP4.mp3',
      'F#5': 'glockenspiel-fSHARP5.mp3',
    }
  },

  'Xylophone': {
    baseUrl: 'Orchestra/xylophone/',
    displayName: 'Xylophone (Mallet Percussion)',
    range: 'G2-G5',
    samples: {
      'G2': 'xylophone-g2.mp3',
      'G3': 'xylophone-g3.mp3',
      'G4': 'xylophone-g4.mp3',
      'G5': 'xylophone-g5.mp3',
      'A#2': 'xylophone-aSHARP2.mp3',
      'A#3': 'xylophone-aSHARP3.mp3',
      'A#4': 'xylophone-aSHARP4.mp3',
      'A#5': 'xylophone-aSHARP5.mp3',
      'C#3': 'xylophone-cSHARP3.mp3',
      'C#4': 'xylophone-cSHARP4.mp3',
      'C#5': 'xylophone-cSHARP5.mp3',
      'E3': 'xylophone-e3.mp3',
      'E4': 'xylophone-e4.mp3',
      'E5': 'xylophone-e5.mp3',
    }
  }
};

module.exports = { INSTRUMENT_SAMPLES_COMPLETE };
