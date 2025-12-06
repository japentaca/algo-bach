document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed");
  const playBtn = document.getElementById('playBtn');
  const statusDiv = document.getElementById('status');
  const formSelect = document.getElementById('formSelect');
  const durationSelect = document.getElementById('durationSelect');
  const styleSelect = document.getElementById('styleSelect');
  const expressivityPresetSelect = document.getElementById('expressivityPreset');
  const randomTextureCheck = document.getElementById('randomTextureCheck');
  const sparseOrnamentsCheck = document.getElementById('sparseOrnamentsCheck');

  // MIDI elements
  const midiEnabledCheck = document.getElementById('midiEnabledCheck');
  const midiOutputSelect = document.getElementById('midiOutputSelect');
  const autoPanBtn = document.getElementById('autoPanBtn');

  if (!playBtn) console.error("playBtn not found!");
  if (!statusDiv) console.error("statusDiv not found!");

  let samplers = [];
  let volumes = [];  // Volume nodes for dynamics control
  let panners = [];  // Panner nodes for stereo placement
  let limiter;
  let convolver;  // Convolver node for reverb
  let reverbGain;  // Gain node to control reverb mix
  let dryGain;     // Gain node to control dry signal
  let currentSeed = null;
  let currentStyle = 'Strings';  // Default style
  let currentImpulse = 'RoomConcertHall.mp3';  // Current impulse response file (default: Concert Hall)
  let midiInitialized = false;  // Track if MIDI has been initialized

  /**
   * Properly dispose all audio resources (samplers, volumes, panners)
   */
  function disposeAllAudioResources() {
    // Dispose samplers
    if (samplers.length > 0) {
      disposeSamplers(samplers);
    }

    // Dispose volume nodes
    if (volumes.length > 0) {
      volumes.forEach(volume => {
        if (volume && typeof volume.dispose === 'function') {
          volume.dispose();
        }
      });
    }

    // Dispose panner nodes
    if (panners.length > 0) {
      panners.forEach(panner => {
        if (panner && typeof panner.dispose === 'function') {
          panner.dispose();
        }
      });
    }

    // Clear arrays
    samplers = [];
    volumes = [];
    panners = [];

    console.log("✓ All audio resources disposed");
  }

  // Seed generation function
  function generateUniqueSeed() {
    return 'seed_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Update seed display
  function updateSeedDisplay() {
    const seedDisplay = document.getElementById('seedDisplay');
    if (seedDisplay) {
      seedDisplay.innerText = `Seed: ${currentSeed}`;
    }
  }

  // Handle style selection change
  if (styleSelect) {
    styleSelect.addEventListener('change', (e) => {
      currentStyle = e.target.value;
      console.log(`Style changed to: ${currentStyle}`);
    });
  }

  // Initialize MIDI on page load
  async function initializeMidi() {
    if (!midiInitialized) {
      midiInitialized = true;
      const success = await initMidi();
      if (success) {
        updateDeviceList();
        console.log("MIDI initialized successfully");
      } else {
        console.log("MIDI initialization failed or not supported");
        if (midiEnabledCheck) midiEnabledCheck.disabled = true;
      }
    }
  }

  // Initialize MIDI when page loads
  initializeMidi();

  // Handle MIDI enable/disable
  if (midiEnabledCheck) {
    midiEnabledCheck.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      if (enabled && midiOutputSelect.value) {
        selectOutputDevice(midiOutputSelect.value);
      }
      setMidiEnabled(enabled);
      console.log(`MIDI output ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  // Handle MIDI output device selection
  if (midiOutputSelect) {
    midiOutputSelect.addEventListener('change', (e) => {
      const deviceId = e.target.value;
      if (deviceId) {
        const success = selectOutputDevice(deviceId);
        if (success && midiEnabledCheck.checked) {
          setMidiEnabled(true);
        }
      } else {
        setMidiEnabled(false);
      }
    });
  }

  // Handle MIDI channel changes
  document.querySelectorAll('.midi-channel-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const voiceIndex = parseInt(e.target.dataset.voice);
      const channel = parseInt(e.target.value);
      setVoiceChannel(voiceIndex, channel);
      console.log(`Voice ${voiceIndex} channel set to ${channel}`);
    });
  });

  // Handle MIDI volume changes
  document.querySelectorAll('.midi-volume-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const voiceIndex = parseInt(e.target.dataset.voice);
      const volume = parseInt(e.target.value);
      setVoiceVolume(voiceIndex, volume);

      // Update display value
      const valueDisplay = e.target.parentElement.querySelector('.midi-volume-value');
      if (valueDisplay) valueDisplay.textContent = volume;
    });
  });

  // Handle MIDI pan changes
  document.querySelectorAll('.midi-pan-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const voiceIndex = parseInt(e.target.dataset.voice);
      const pan = parseInt(e.target.value);
      setVoicePan(voiceIndex, pan);

      // Update display value
      const valueDisplay = e.target.parentElement.querySelector('.midi-pan-value');
      if (valueDisplay) valueDisplay.textContent = pan;
    });
  });

  // Handle auto-pan button
  if (autoPanBtn) {
    autoPanBtn.addEventListener('click', () => {
      autoPanVoices(4);

      // Update UI sliders to reflect new pan values
      for (let i = 0; i < 4; i++) {
        const config = getVoiceConfig(i);
        const slider = document.querySelector(`.midi-pan-slider[data-voice="${i}"]`);
        const valueDisplay = document.querySelector(`.voice-control[data-voice="${i}"] .midi-pan-value`);

        if (slider && valueDisplay && config) {
          slider.value = config.pan;
          valueDisplay.textContent = config.pan;
        }
      }

      console.log("Auto-pan applied to all voices");
    });
  }

  // Handle impulse response selection
  const impulseSelect = document.getElementById('impulseSelect');
  if (impulseSelect) {
    impulseSelect.addEventListener('change', async (e) => {
      currentImpulse = e.target.value;
      console.log(`Impulse changed to: ${currentImpulse}`);

      // If convolver is already initialized, load the new impulse
      if (convolver) {
        if (currentImpulse === 'none') {
          // Disable reverb by setting wet gain to 0
          if (reverbGain) reverbGain.gain.value = 0;
          if (dryGain) dryGain.gain.value = 1;
          console.log("✓ Reverb disabled");
        } else {
          try {
            await convolver.load(`impulses/${currentImpulse}`);
            console.log(`✓ Impulse response loaded: ${currentImpulse}`);
            // Restore mix level when changing impulse
            const reverbMixSlider = document.getElementById('reverbMix');
            if (reverbMixSlider) {
              updateReverbMix(parseInt(reverbMixSlider.value));
            }
          } catch (error) {
            console.error(`Error loading impulse: ${error.message}`);
          }
        }
      }
    });
  }

  // Handle ornament density slider
  const ornamentDensitySlider = document.getElementById('ornamentDensity');
  const ornamentDensityValue = document.getElementById('ornamentDensityValue');
  if (ornamentDensitySlider) {
    ornamentDensitySlider.addEventListener('input', (e) => {
      const densityPercent = parseInt(e.target.value);
      if (ornamentDensityValue) {
        ornamentDensityValue.innerText = densityPercent;
      }
    });
  }

  // Handle tempo slider
  const tempoSlider = document.getElementById('tempoSlider');
  const tempoValue = document.getElementById('tempoValue');
  if (tempoSlider) {
    tempoSlider.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value);
      if (tempoValue) {
        tempoValue.innerText = bpm;
      }
      // Update Tone.js BPM in real-time if audio is initialized
      if (Tone.Transport.bpm.value !== bpm) {
        Tone.Transport.bpm.value = bpm;
        console.log(`Tempo set to ${bpm} BPM`);
      }
    });
  }

  // Handle reverb mix slider
  const reverbMixSlider = document.getElementById('reverbMix');
  const reverbMixValue = document.getElementById('reverbMixValue');
  if (reverbMixSlider) {
    reverbMixSlider.addEventListener('input', (e) => {
      const mixPercent = parseInt(e.target.value);

      if (reverbMixValue) {
        reverbMixValue.innerText = mixPercent;
      }

      // Update reverb mix only if reverb is not disabled
      if (currentImpulse !== 'none') {
        updateReverbMix(mixPercent);
      }
    });
  }

  async function initAudio() {
    console.log("Initializing Audio...");
    await Tone.start();
    console.log("Audio Context Started");

    if (!limiter) {
      // Create the main output limiter
      limiter = new Tone.Limiter(-1).toDestination();

      // Create dry/wet mix nodes
      dryGain = new Tone.Gain(0.75).connect(limiter);  // Default 75% dry (25% wet)
      reverbGain = new Tone.Gain(0.25).connect(limiter);  // Default 25% wet

      // Create the convolver (reverb) node
      convolver = new Tone.Convolver({ url: null, normalize: true }).connect(reverbGain);

      console.log("✓ Convolver, Gains, and Limiter initialized");
    }
  }

  /**
   * Update reverb mix based on slider value (0-100)
   */
  function updateReverbMix(mixPercent) {
    if (!dryGain || !reverbGain) return;

    const wetValue = mixPercent / 100;
    const dryValue = 1 - wetValue;

    reverbGain.gain.value = wetValue;
    dryGain.gain.value = dryValue;

    console.log(`Reverb mix updated: ${mixPercent}% wet, ${Math.round((1 - wetValue) * 100)}% dry`);
  }

  /**
   * Create samplers for the selected style with volume control nodes
   */
  async function setupSamplers(styleName) {
    // Dispose old samplers and audio nodes if they exist
    if (samplers.length > 0 || volumes.length > 0 || panners.length > 0) {
      console.log("Disposing old audio resources...");
      disposeAllAudioResources();
    }

    // Panning setup for stereo placement
    // Soprano (0): Right (0.4)
    // Alto (1): Center-Right (0.15)
    // Tenor (2): Center-Left (-0.15)
    // Bass (3): Left (-0.4)
    const pans = [0.4, 0.15, -0.15, -0.4];

    statusDiv.innerText = `Loading samples for ${STYLE_PRESETS[styleName].displayName}...`;
    console.log(`Setting up samplers for style: ${styleName}`);

    try {
      // Load all samplers for this style
      const loadedSamplers = await loadStyleSamplers(styleName);

      // Chain each sampler through a Volume node -> Panner -> split to (Dry + Convolver)
      for (let i = 0; i < 4; i++) {
        const volume = new Tone.Volume(0);
        const panner = new Tone.Panner(pans[i]);

        // Connect to both dry and reverb paths
        panner.connect(dryGain);
        panner.connect(convolver);

        volume.connect(panner);
        loadedSamplers[i].connect(volume);

        samplers.push(loadedSamplers[i]);
        volumes.push(volume);
        panners.push(panner);
      }

      console.log(`✓ Samplers setup complete for ${styleName}`);
      return true;
    } catch (error) {
      console.error(`Error loading samplers: ${error.message}`);
      statusDiv.innerText = `Error loading samples: ${error.message}`;
      return false;
    }
  }

  async function generateAndPlay() {
    console.log("Generate button clicked");
    statusDiv.innerText = "Initializing audio...";
    playBtn.disabled = true;

    try {
      // Check if MIDI is enabled
      const useMidi = isMidiEnabled();

      if (!useMidi) {
        // Initialize audio context only if not using MIDI
        await initAudio();

        // Load samplers for selected style
        const samplerSetupSuccess = await setupSamplers(currentStyle);
        if (!samplerSetupSuccess) {
          playBtn.disabled = false;
          return;
        }
      } else {
        // Dispose any existing samplers if switching to MIDI mode
        if (samplers.length > 0 || volumes.length > 0 || panners.length > 0) {
          console.log("Disposing audio resources for MIDI mode...");
          disposeAllAudioResources();
        }
      }

      const form = formSelect.value;
      const durationCategory = durationSelect.value;
      const keySelect = document.getElementById('keySelect');
      const modeSelect = document.getElementById('modeSelect');
      const selectedKey = keySelect ? keySelect.value : 'C';
      const selectedMode = modeSelect ? modeSelect.value : 'major';
      const randomizeCheck = document.getElementById('randomizeCheck');
      const expressivityPreset = expressivityPresetSelect ? expressivityPresetSelect.value : 'style';
      const randomTexture = randomTextureCheck ? randomTextureCheck.checked : true;
      const sparseOrnaments = sparseOrnamentsCheck ? sparseOrnamentsCheck.checked : true;

      // Generate or use manual seed
      if (!randomizeCheck || randomizeCheck.checked) {
        currentSeed = generateUniqueSeed();
      } else {
        const seedInput = document.getElementById('seedInput');
        currentSeed = seedInput ? seedInput.value || generateUniqueSeed() : generateUniqueSeed();
      }
      updateSeedDisplay();

      // Map duration category to number of bars
      let barsToGenerate = parseInt(durationCategory) * 30;

      // Get ornament density from slider
      const ornamentDensitySlider = document.getElementById('ornamentDensity');
      const ornamentDensity = ornamentDensitySlider ? parseInt(ornamentDensitySlider.value) : 50;

      console.log(`Fetching: /api/generate?key=${selectedKey}&mode=${selectedMode}&form=${form}&duration=${barsToGenerate}&seed=${encodeURIComponent(currentSeed)}&ornamentDensity=${ornamentDensity}&expressivity=${expressivityPreset}&randomTexture=${randomTexture}&sparseOrnaments=${sparseOrnaments}`);

      const response = await fetch(`/api/generate?key=${encodeURIComponent(selectedKey)}&mode=${selectedMode}&form=${form}&duration=${barsToGenerate}&seed=${encodeURIComponent(currentSeed)}&ornamentDensity=${ornamentDensity}&expressivity=${encodeURIComponent(expressivityPreset)}&randomTexture=${randomTexture}&sparseOrnaments=${sparseOrnaments}`);
      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      console.log("Data received:", data);
      console.log("Total notes:", data.notes.length);

      const outputMode = isMidiEnabled() ? 'MIDI' : 'Tone.js';
      statusDiv.innerHTML = `
                <strong>Playing:</strong> ${data.meta.style} in ${data.meta.key} ${data.meta.mode}<br>
                <strong>Style:</strong> ${STYLE_PRESETS[currentStyle].displayName}<br>
                <strong>Output:</strong> ${outputMode}<br>
                <strong>Progression:</strong> ${data.meta.progression}<br>
                <strong>Expressivity:</strong> ${expressivityPreset} | Random texture: ${randomTexture ? 'on' : 'off'} | Sparse cadences: ${sparseOrnaments ? 'on' : 'off'}
            `;

      const now = Tone.now() + 0.5;
      // Get tempo from slider (default 120 BPM)
      const tempoSlider = document.getElementById('tempoSlider');
      const bpm = tempoSlider ? parseInt(tempoSlider.value) : 120;
      Tone.Transport.bpm.value = bpm;

      // At 120 BPM, quarter note = 0.5 seconds
      // Beat duration scales with BPM: beatDuration = (60 / BPM) / 4 for quarter note
      // For 120 BPM: (60 / 120) / 4 = 0.5 / 4 = 0.125 for sixteenth, but we use quarter notes
      // Actually: At 120 BPM, quarter note = 0.5 seconds. This is fixed in Tone.Transport
      // But we need to scale the timing: timeInBeats = timeInBeats * (120 / actualBPM)
      const bpmScaleFactor = 120 / bpm;  // Scale factor relative to 120 BPM baseline
      const beatDuration = 0.5;  // Baseline: 0.5 seconds per quarter note at 120 BPM

      data.notes.forEach(note => {
        const humanizeStart = (Math.random() * 0.02) - 0.01;
        const humanizeDuration = (Math.random() * 0.05);
        const time = now + (note.startTime * beatDuration * bpmScaleFactor) + humanizeStart;

        let noteBeats = 2;
        if (note.duration === "4n") noteBeats = 1;
        if (note.duration === "8n") noteBeats = 0.5;
        if (note.duration === "16n") noteBeats = 0.25;
        if (note.duration === "32n") noteBeats = 0.125;
        if (note.duration === "4n.") noteBeats = 1.5;  // Dotted quarter
        if (note.duration === "8n.") noteBeats = 0.75;  // Dotted eighth

        const durationSecs = (noteBeats * beatDuration) - 0.02 + humanizeDuration;

        // Velocity for dynamics
        let velocity = 0.7 + (Math.random() * 0.1);
        if (note.voice === 3) velocity = 0.8;  // Bass slightly louder
        if (note.voice === 0) velocity = 0.8;  // Soprano slightly louder

        // Convert velocity to decibels for volume control
        const volumeDb = velocityToDb(velocity);

        // Trigger the correct sampler based on voice index
        const voiceIndex = Math.min(Math.max(note.voice, 0), 3);

        // Check if MIDI output is enabled
        if (isMidiEnabled()) {
          // Schedule MIDI on/off so notes respect their start times
          const delayMs = Math.max(0, (time - Tone.now()) * 1000);
          setTimeout(() => {
            noteOn(note.pitch, Math.round(velocity * 127), voiceIndex);
            setTimeout(() => {
              noteOff(note.pitch, voiceIndex);
            }, durationSecs * 1000);
          }, delayMs);
        } else {
          // Use Tone.js sampler
          // Set volume for this note
          volumes[voiceIndex].volume.value = volumeDb;

          // Trigger the note
          samplers[voiceIndex].triggerAttackRelease(note.pitch, durationSecs, time, velocity);
        }
      });

      const lastNote = data.notes[data.notes.length - 1];
      const lastNoteBeats = lastNote.duration === "32n" ? 0.125 :
        lastNote.duration === "16n" ? 0.25 :
          lastNote.duration === "8n" ? 0.5 :
            lastNote.duration === "4n" ? 1 :
              lastNote.duration === "4n." ? 1.5 : 2;
      const durationSecs = (lastNote.startTime * beatDuration) + (lastNoteBeats * beatDuration) + 3;

      setTimeout(() => {
        statusDiv.innerText = "Ready";
        playBtn.disabled = false;
      }, durationSecs * 1000);

    } catch (e) {
      console.error(e);
      statusDiv.innerText = "Error: " + e.message;
      playBtn.disabled = false;
    }
  }

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    generateAndPlay();
  });
  console.log("Event listener added to playBtn");
});
