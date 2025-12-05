document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed");
  const playBtn = document.getElementById('playBtn');
  const statusDiv = document.getElementById('status');
  const formSelect = document.getElementById('formSelect');
  const durationSelect = document.getElementById('durationSelect');
  const styleSelect = document.getElementById('styleSelect');

  if (!playBtn) console.error("playBtn not found!");
  if (!statusDiv) console.error("statusDiv not found!");

  let samplers = [];
  let volumes = [];  // Volume nodes for dynamics control
  let limiter;
  let convolver;  // Convolver node for reverb
  let reverbGain;  // Gain node to control reverb mix
  let dryGain;     // Gain node to control dry signal
  let currentSeed = null;
  let currentStyle = 'Strings';  // Default style
  let currentImpulse = 'RoomConcertHall.mp3';  // Current impulse response file (default: Concert Hall)

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
    
    console.log(`Reverb mix updated: ${mixPercent}% wet, ${Math.round((1-wetValue)*100)}% dry`);
  }

  /**
   * Create samplers for the selected style with volume control nodes
   */
  async function setupSamplers(styleName) {
    // Dispose old samplers if they exist
    if (samplers.length > 0) {
      console.log("Disposing old samplers...");
      disposeSamplers(samplers);
      samplers = [];
      volumes = [];
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
      // Initialize audio context
      await initAudio();

      // Load samplers for selected style
      const samplerSetupSuccess = await setupSamplers(currentStyle);
      if (!samplerSetupSuccess) {
        playBtn.disabled = false;
        return;
      }

      const form = formSelect.value;
      const durationCategory = durationSelect.value;
      const keySelect = document.getElementById('keySelect');
      const modeSelect = document.getElementById('modeSelect');
      const selectedKey = keySelect ? keySelect.value : 'C';
      const selectedMode = modeSelect ? modeSelect.value : 'major';
      const randomizeCheck = document.getElementById('randomizeCheck');

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

      console.log(`Fetching: /api/generate?key=${selectedKey}&mode=${selectedMode}&form=${form}&duration=${barsToGenerate}&seed=${encodeURIComponent(currentSeed)}`);

      const response = await fetch(`/api/generate?key=${encodeURIComponent(selectedKey)}&mode=${selectedMode}&form=${form}&duration=${barsToGenerate}&seed=${encodeURIComponent(currentSeed)}`);
      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      console.log("Data received:", data);
      console.log("Total notes:", data.notes.length);

      statusDiv.innerHTML = `
                <strong>Playing:</strong> ${data.meta.style} in ${data.meta.key} ${data.meta.mode}<br>
                <strong>Style:</strong> ${STYLE_PRESETS[currentStyle].displayName}<br>
                <strong>Progression:</strong> ${data.meta.progression}
            `;

      const now = Tone.now() + 0.5;
      // At 120 BPM, quarter note = 0.5 seconds
      // Each "beat unit" in our system = quarter note
      const beatDuration = 0.5;

      data.notes.forEach(note => {
        const humanizeStart = (Math.random() * 0.02) - 0.01;
        const humanizeDuration = (Math.random() * 0.05);
        const time = now + (note.startTime * beatDuration) + humanizeStart;

        let noteBeats = 2;
        if (note.duration === "4n") noteBeats = 1;
        if (note.duration === "8n") noteBeats = 0.5;

        const durationSecs = (noteBeats * beatDuration) - 0.05 + humanizeDuration;

        // Velocity for dynamics
        let velocity = 0.7 + (Math.random() * 0.1);
        if (note.voice === 3) velocity = 0.8;  // Bass slightly louder
        if (note.voice === 0) velocity = 0.8;  // Soprano slightly louder

        // Convert velocity to decibels for volume control
        const volumeDb = velocityToDb(velocity);

        // Trigger the correct sampler based on voice index
        const voiceIndex = Math.min(Math.max(note.voice, 0), 3);

        // Set volume for this note
        volumes[voiceIndex].volume.value = volumeDb;

        // Trigger the note
        samplers[voiceIndex].triggerAttackRelease(note.pitch, durationSecs, time, velocity);
      });

      const lastNote = data.notes[data.notes.length - 1];
      const lastNoteBeats = lastNote.duration === "4n" ? 1 : lastNote.duration === "8n" ? 0.5 : 2;
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
