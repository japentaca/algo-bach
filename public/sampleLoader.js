/**
 * Sample Loader Utility
 * Handles loading and initialization of Tone.Sampler instances
 */

/**
 * Create a sampler for a given instrument
 * @param {string} instrumentName - Name of the instrument (must exist in INSTRUMENT_SAMPLES)
 * @returns {Promise<Tone.Sampler>} Promise that resolves when sampler is loaded
 */
async function createSampler(instrumentName) {
  if (!INSTRUMENT_SAMPLES[instrumentName]) {
    throw new Error(`Instrument not found: ${instrumentName}`);
  }

  const config = INSTRUMENT_SAMPLES[instrumentName];

  // Convert sample mapping to Tone.Sampler format
  const sampleMap = {};
  for (const [note, file] of Object.entries(config.samples)) {
    sampleMap[note] = file;
  }

  return new Promise((resolve, reject) => {
    try {
      const sampler = new Tone.Sampler(
        sampleMap,
        function onSamplesLoaded() {
          console.log(`✓ Sampler loaded for ${instrumentName}`);
          resolve(sampler);
        },
        config.baseUrl
      );
    } catch (error) {
      reject(new Error(`Failed to create sampler for ${instrumentName}: ${error.message}`));
    }
  });
}

/**
 * Create a monophonic sampler wrapper using Tone.PolySynth with 1 voice
 * This ensures only one note plays at a time, cutting off previous notes
 * @param {string} instrumentName - Name of the instrument (must exist in INSTRUMENT_SAMPLES)
 * @returns {Promise<Tone.PolySynth>} Promise that resolves when monophonic sampler is loaded
 */
async function createMonophonicSampler(instrumentName) {
  if (!INSTRUMENT_SAMPLES[instrumentName]) {
    throw new Error(`Instrument not found: ${instrumentName}`);
  }

  const config = INSTRUMENT_SAMPLES[instrumentName];

  // Convert sample mapping to Tone.Sampler format
  const sampleMap = {};
  for (const [note, file] of Object.entries(config.samples)) {
    sampleMap[note] = file;
  }

  return new Promise((resolve, reject) => {
    try {
      // Factory function that creates a new Tone.Sampler instance for each voice
      function createSamplerVoice() {
        return new Tone.Sampler(sampleMap, undefined, config.baseUrl);
      }

      // Wrap in PolySynth with 1 voice to enforce monophony
      // This automatically cuts off previous notes when new ones start
      const monoSampler = new Tone.PolySynth(1, createSamplerVoice);

      // Wait for samples to load by creating a temporary test sampler
      const testSampler = new Tone.Sampler(
        sampleMap,
        function onSamplesLoaded() {
          console.log(`✓ Monophonic sampler loaded for ${instrumentName}`);
          testSampler.dispose();
          resolve(monoSampler);
        },
        config.baseUrl
      );
    } catch (error) {
      reject(new Error(`Failed to create monophonic sampler for ${instrumentName}: ${error.message}`));
    }
  });
}

/**
 * Load all samplers for a given style
 * @param {string} styleName - Style preset name
 * @param {Array<boolean>} monoModes - Optional array of 4 booleans indicating monophonic mode per voice
 * @returns {Promise<Array<Tone.Sampler|Tone.PolySynth>>} Array of 4 samplers (Soprano, Alto, Tenor, Bass)
 */
async function loadStyleSamplers(styleName, monoModes = [false, false, false, false]) {
  if (!STYLE_PRESETS[styleName]) {
    throw new Error(`Style not found: ${styleName}`);
  }

  const style = STYLE_PRESETS[styleName];
  const instrumentNames = style.instruments;

  console.log(`Loading samplers for style: ${styleName}`);
  console.log(`Instruments: ${instrumentNames.join(', ')}`);
  console.log(`Monophonic modes: ${monoModes.join(', ')}`);

  try {
    // Load all 4 samplers in parallel with appropriate mode
    const samplerPromises = instrumentNames.map((name, index) => {
      const isMonophonic = monoModes[index] || false;
      return isMonophonic ? createMonophonicSampler(name) : createSampler(name);
    });
    const samplers = await Promise.all(samplerPromises);

    console.log(`✓ All samplers loaded for ${styleName}`);
    return samplers;
  } catch (error) {
    throw new Error(`Failed to load samplers for style ${styleName}: ${error.message}`);
  }
}

/**
 * Convert velocity (0-1) to decibels using a logarithmic curve
 * Maps 0 (silence) to -24dB and 1 (normal) to 0dB
 * @param {number} velocity - Velocity value 0-1
 * @returns {number} Volume in decibels
 */
function velocityToDb(velocity) {
  if (velocity <= 0) return -Infinity;
  if (velocity >= 1) return 0;

  // Logarithmic curve: quieter at low velocities, more linear at higher
  // Formula: dB = 20 * log10(velocity)
  // Scaled to map 0.1 → -20dB, 1.0 → 0dB
  return 20 * Math.log10(velocity);
}

/**
 * Dispose of samplers to free memory
 * Handles cleanup of audio buffers and resources
 * @param {Array<Tone.Sampler>} samplers - Array of samplers to dispose
 */
function disposeSamplers(samplers) {
  if (Array.isArray(samplers)) {
    samplers.forEach((sampler, index) => {
      if (sampler) {
        try {
          // Disconnect before disposing
          if (typeof sampler.disconnect === 'function') {
            sampler.disconnect();
          }
          // Dispose the sampler
          if (typeof sampler.dispose === 'function') {
            sampler.dispose();
          }
          console.log(`✓ Sampler ${index} disposed and disconnected`);
        } catch (error) {
          console.warn(`Warning disposing sampler ${index}: ${error.message}`);
        }
      }
    });
  }
}
