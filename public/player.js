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
  const articulationSelect = document.getElementById('articulationSelect');
  let lastArticulationPlan = null;

  // MIDI elements
  const midiEnabledCheck = document.getElementById('midiEnabledCheck');
  const midiOutputSelect = document.getElementById('midiOutputSelect');
  const autoPanBtn = document.getElementById('autoPanBtn');

  if (!playBtn) console.error("playBtn not found!");
  if (!statusDiv) console.error("statusDiv not found!");

  let samplers = [];
  let volumes = [];  // Volume nodes for dynamics control
  let panners = [];  // Panner nodes for stereo placement
  let monoModes = [false, false, false, false];  // Monophonic mode state for each voice
  let limiter;
  let convolver;  // Convolver node for reverb
  let reverbGain;  // Gain node to control reverb mix
  let dryGain;     // Gain node to control dry signal
  let currentSeed = null;
  let currentStyle = 'Strings';  // Default style
  let currentImpulse = 'RoomConcertHall.mp3';  // Current impulse response file (default: Concert Hall)
  let midiInitialized = false;  // Track if MIDI has been initialized
  let loadedImpulse = null;     // Impulse file currently loaded into the convolver

  // Playback bookkeeping so a piece can be stopped / superseded cleanly (used by kiosk mode)
  let playToken = 0;                 // Incremented on every new play and on stop
  const pendingTimers = new Set();   // setTimeout ids belonging to the current piece
  const activeMidiNotes = new Map(); // "pitch|voice" -> {pitch, voice} currently sounding via MIDI
  let resolveFinished = null;        // Resolver of the current piece's `finished` promise

  // ---- Stereo layout ------------------------------------------------------
  // Default seating [S, A, T, B]: ensembles as on a concert stage (high voices left,
  // low voices right, bass a little in from the edge); one-instrument styles as heard
  // from the keyboard (treble right, bass left), narrower.
  const ENSEMBLE_PANS = [-0.55, -0.2, 0.2, 0.45];
  const KEYBOARD_PANS = [0.35, 0.12, -0.12, -0.35];
  const KEYBOARD_STYLES = ['Piano', 'Harp'];
  let panOverride = null;  // set by setStereoLayout (kiosk); null = style default

  function currentPans(styleName) {
    if (panOverride) return panOverride;
    const keyboard = KEYBOARD_STYLES.includes(styleName)
      || !!(STYLE_PRESETS[styleName] && STYLE_PRESETS[styleName].keyboard);
    return keyboard ? KEYBOARD_PANS : ENSEMBLE_PANS;
  }

  /**
   * Override the stereo position of the four voices ([S, A, T, B], each -1..1), or
   * pass null to go back to the style default. Applies to the next piece and, if
   * samplers are loaded, right away.
   */
  function setStereoLayout(pans) {
    panOverride = Array.isArray(pans) && pans.length === 4
      ? pans.map(p => Math.max(-1, Math.min(1, Number(p) || 0)))
      : null;
    const now = currentPans(currentStyle);
    panners.forEach((panner, i) => {
      try { panner.pan.rampTo(now[i], 0.3); } catch (e) { /* disposed */ }
    });
  }

  // Just-in-time note scheduler (see generateAndPlay)
  const SCHEDULE_AHEAD_SECS = 2.0;   // hand notes to Tone/MIDI this far ahead of their onset
  const SCHEDULER_TICK_MS = 100;     // how often the scheduler tops up (background tabs: ~1/s, still inside the window)
  let schedulerId = null;

  function clearScheduler() {
    if (schedulerId !== null) {
      clearInterval(schedulerId);
      schedulerId = null;
    }
  }

  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimers.delete(id);
      fn();
    }, ms);
    pendingTimers.add(id);
    return id;
  }

  /**
   * Properly dispose all audio resources (samplers, volumes, panners)
   */
  function disposeAllAudioResources() {
    clearScheduler();

    // Stop sounding/pending sources first: dispose alone only disconnects them, the
    // native buffer sources would stay scheduled until their own end.
    const now = Tone.now();
    samplers.forEach(s => {
      try { if (s && typeof s.releaseAll === 'function') s.releaseAll(now); } catch (e) { /* ignore */ }
    });

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

    // Velocity-layered (VSCO) styles stay disabled unless the server can serve the samples
    if (typeof isVscoAvailable === 'function') {
      isVscoAvailable().then(available => {
        Array.from(styleSelect.options).forEach(opt => {
          const preset = STYLE_PRESETS[opt.value];
          if (preset && preset.engine === 'vsco') {
            opt.disabled = !available;
            opt.title = available ? '' : 'VSCO samples not found (set SOUNDFONTS_DIR on the server)';
          }
        });
        console.log(`VSCO velocity-layered styles ${available ? 'enabled' : 'unavailable'}`);
      });
    }
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
      try {
        await applyImpulse();
      } catch (error) {
        console.error(`Error loading impulse: ${error.message}`);
      }
    });
  }

  /**
   * Make the convolver match `currentImpulse` (loads the file once) and apply the mix.
   * No-op until initAudio() has created the convolver.
   */
  async function applyImpulse() {
    if (!convolver) return;
    if (currentImpulse === 'none') {
      // Disable reverb by setting wet gain to 0
      if (reverbGain) reverbGain.gain.value = 0;
      if (dryGain) dryGain.gain.value = 1;
      console.log("✓ Reverb disabled");
      return;
    }
    if (loadedImpulse !== currentImpulse) {
      const target = currentImpulse;
      await convolver.load(`impulses/${target}`);
      loadedImpulse = target;
      console.log(`✓ Impulse response loaded: ${target}`);
    }
    // Restore mix level when changing impulse
    const reverbMixSlider = document.getElementById('reverbMix');
    if (reverbMixSlider) {
      updateReverbMix(parseInt(reverbMixSlider.value));
    }
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
   * @param {string} styleName - The style to load
   * @param {Array<boolean>} monoModes - Optional array indicating monophonic mode per voice
   */
  async function setupSamplers(styleName, notes = null, monoModes = [false, false, false, false]) {
    // Dispose old samplers and audio nodes if they exist
    if (samplers.length > 0 || volumes.length > 0 || panners.length > 0) {
      console.log("Disposing old audio resources...");
      disposeAllAudioResources();
    }

    // Stereo placement per voice [S, A, T, B] (-1 = left, +1 = right). Tone.Panner
    // folds each (stereo) sample to mono first, so these are real positions.
    const pans = currentPans(styleName);
    const style = STYLE_PRESETS[styleName];

    statusDiv.innerText = `Loading samples for ${style.displayName}...`;
    console.log(`Setting up samplers for style: ${styleName}`);

    try {
      let loadedSamplers;
      if (style.engine === 'vsco') {
        // Velocity-layered samples: fetch only the files (note × layer) this piece uses
        loadedSamplers = await createLayeredStyleSamplers(style);
        // (each note carries its articulation: only the articulations used are loaded)
        const counts = await Promise.all(loadedSamplers.map((s, i) =>
          s.prepare(notes ? notes.filter(n => Math.min(Math.max(n.voice, 0), 3) === i) : null)));
        console.log(`✓ VSCO files loaded per voice: [${counts.join(', ')}]`,
          loadedSamplers.map(s => s.loaded || {}));
      } else {
        // Load all samplers for this style with monophonic modes
        loadedSamplers = await loadStyleSamplers(styleName, monoModes);
      }

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
      console.log(`Monophonic modes: [${monoModes.join(', ')}]`);
      return true;
    } catch (error) {
      console.error(`Error loading samplers: ${error.message}`);
      statusDiv.innerText = `Error loading samples: ${error.message}`;
      return false;
    }
  }

  /**
   * Stop whatever is playing right now: cancel pending timers, silence MIDI notes,
   * dispose samplers (which also drops their scheduled sources) and settle `finished`.
   */
  function stopPlayback() {
    playToken++;
    clearScheduler();
    pendingTimers.forEach(id => clearTimeout(id));
    pendingTimers.clear();

    activeMidiNotes.forEach(({ pitch, voice }) => {
      try { noteOff(pitch, voice); } catch (e) { /* ignore */ }
    });
    activeMidiNotes.clear();

    if (samplers.length > 0 || volumes.length > 0 || panners.length > 0) {
      disposeAllAudioResources();
    }

    if (resolveFinished) {
      const resolve = resolveFinished;
      resolveFinished = null;
      resolve(false);
    }

    statusDiv.innerText = "Stopped";
    playBtn.disabled = false;
  }

  /**
   * Generate a piece from the current DOM settings and play it.
   * Resolves once playback is scheduled with
   *   { ok: true, data, durationSecs, finished }  — `finished` resolves true at the natural end
   *                                                 (last note + 3 s tail), false if stopped;
   *   { ok: false, error } on failure, or { ok: false, aborted: true } if superseded by stop/new play.
   */
  async function generateAndPlay() {
    console.log("Generate button clicked");
    const token = ++playToken;
    const superseded = () => token !== playToken;
    statusDiv.innerText = "Initializing audio...";
    playBtn.disabled = true;

    try {
      // Check if MIDI is enabled
      const useMidi = isMidiEnabled();

      if (!useMidi) {
        // Initialize audio context only if not using MIDI
        await initAudio();
        try {
          await applyImpulse();
        } catch (error) {
          console.error(`Error loading impulse: ${error.message}`);
        }
        if (superseded()) return { ok: false, aborted: true };
        // Samplers are built after the piece arrives (below), so layered styles can
        // fetch only the files the piece needs.
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
      if (superseded()) return { ok: false, aborted: true };
      console.log("Data received:", data);
      console.log("Total notes:", data.notes.length);

      // Get tempo from slider (default 120 BPM)
      const tempoSlider = document.getElementById('tempoSlider');
      const bpm = tempoSlider ? parseInt(tempoSlider.value) : 120;

      // Articulation of every note (articulation.js): a plan per section, decided per
      // figure. VSCO styles play it with real samples; the others (and MIDI) only
      // shorten the detached notes.
      const style = STYLE_PRESETS[currentStyle];
      const realArticulations = !useMidi && style.engine === 'vsco' && typeof styleArticulations === 'function';
      const articulationProfile = articulationSelect ? articulationSelect.value : 'auto';
      const artPlan = window.BachArticulation
        ? BachArticulation.plan(data, {
          profile: articulationProfile, bpm, seed: currentSeed,
          caps: realArticulations ? styleArticulations(style) : ['sustain'],
        })
        : null;
      lastArticulationPlan = artPlan;
      const artOf = (i) => (artPlan ? artPlan.arts[i] : { art: 'sustain', solo: false, gainMul: 1 });
      if (artPlan) console.log('Articulation plan:', artPlan.profile, artPlan.summary, artPlan.sections.map(s => s.text));

      if (!useMidi) {
        // Load samplers for selected style (layered styles: only this piece's files and articulations)
        const annotated = data.notes.map((n, i) => ({ ...n, art: artOf(i).art, solo: artOf(i).solo }));
        const samplerSetupSuccess = await setupSamplers(currentStyle, annotated);
        if (superseded()) return { ok: false, aborted: true };
        if (!samplerSetupSuccess) {
          playBtn.disabled = false;
          return { ok: false, error: new Error(`Could not load samples for ${currentStyle}`) };
        }
      }

      const outputMode = isMidiEnabled() ? 'MIDI' : 'Tone.js';
      statusDiv.innerHTML = `
                <strong>Playing:</strong> ${data.meta.style} in ${data.meta.key} ${data.meta.mode}<br>
                <strong>Style:</strong> ${STYLE_PRESETS[currentStyle].displayName}<br>
                <strong>Output:</strong> ${outputMode}<br>
                <strong>Progression:</strong> ${data.meta.progression}<br>
                <strong>Expressivity:</strong> ${expressivityPreset} | Random texture: ${randomTexture ? 'on' : 'off'} | Sparse cadences: ${sparseOrnaments ? 'on' : 'off'}<br>
                <strong>Articulation:</strong> ${artPlan ? `${BachArticulation.PROFILES[artPlan.profile]}${realArticulations ? '' : ' (durations only)'} — ${[...new Set(artPlan.sections.map(s => s.text))].slice(0, 6).join(' · ')}` : 'n/a'}
            `;

      const useMidiOut = isMidiEnabled();
      // Time base: the audio clock for Tone playback; the wall clock for MIDI (the
      // AudioContext is never started in MIDI mode, so its clock may be frozen).
      const clock = useMidiOut ? () => performance.now() / 1000 : () => Tone.now();
      const start = clock() + 0.5;
      Tone.Transport.bpm.value = bpm;

      // At 120 BPM, quarter note = 0.5 seconds
      // Beat duration scales with BPM: beatDuration = (60 / BPM) / 4 for quarter note
      // For 120 BPM: (60 / 120) / 4 = 0.5 / 4 = 0.125 for sixteenth, but we use quarter notes
      // Actually: At 120 BPM, quarter note = 0.5 seconds. This is fixed in Tone.Transport
      // But we need to scale the timing: timeInBeats = timeInBeats * (120 / actualBPM)
      const bpmScaleFactor = 120 / bpm;  // Scale factor relative to 120 BPM baseline
      const beatDuration = 0.5;  // Baseline: 0.5 seconds per quarter note at 120 BPM

      // Exact length in beats (new generator sends `beats`; fall back to the note name)
      const BEATS_BY_NAME = { '1n': 4, '2n.': 3, '2n': 2, '4n.': 1.5, '4n': 1, '8n.': 0.75, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
      const beatsOf = (n) => n.beats || BEATS_BY_NAME[n.duration] || 2;

      // Precompute every note (offset from `start`, length, dynamics), sorted by onset
      const events = data.notes.map((note, i) => {
        const humanizeStart = (Math.random() * 0.02) - 0.01;
        const humanizeDuration = (Math.random() * 0.05);
        const at = (note.startTime * beatDuration * bpmScaleFactor) + humanizeStart;
        let dur = (beatsOf(note) * beatDuration * bpmScaleFactor) - 0.02 + humanizeDuration;
        const { art, solo, gainMul, slur, tight } = artOf(i);
        // Without articulation samples a detached note is just a shorter note
        if (!realArticulations && (art === 'staccato' || art === 'pizzicato') && typeof shortArticulationLength === 'function') {
          dur = shortArticulationLength(dur);
        }

        // Velocity for dynamics: use the generator's phrase-shaped velocity when present
        let velocity = note.velocity ? note.velocity / 127 : 0.7 + (Math.random() * 0.1);
        velocity = Math.max(0.2, Math.min(1, velocity));

        return {
          at,
          play: { art, solo, slur: !!slur, tight: !!tight },
          dur: Math.max(0.03, dur),
          pitch: note.pitch,
          voice: Math.min(Math.max(note.voice, 0), 3),
          midiVelocity: Math.round(velocity * 127),
          // Per-note gain with a squared curve (40·log10(v), the usual MIDI/DLS
          // velocity curve): v=0.55 → -10 dB, v=0.8 → -4 dB, v=1 → 0 dB.
          // Tone applies it as a linear gain on the note's own buffer source.
          gain: velocity * velocity * (gainMul || 1),
        };
      }).sort((a, b) => a.at - b.at);

      // Just-in-time scheduling: only notes starting within SCHEDULE_AHEAD_SECS are
      // handed to Tone / MIDI. Scheduling a whole piece up front created thousands of
      // buffer sources at once, and a stopped piece left them all pending, which
      // saturated the audio thread (clock running at ~0.1x, pieces "playing" silently).
      clearScheduler();
      let next = 0;
      const pump = () => {
        if (superseded()) { clearScheduler(); return; }
        const horizon = clock() + SCHEDULE_AHEAD_SECS;
        while (next < events.length && start + events[next].at <= horizon) {
          const ev = events[next++];
          const time = start + ev.at;
          try {
            if (useMidiOut) {
              const midiKey = `${ev.pitch}|${ev.voice}`;
              later(() => {
                noteOn(ev.pitch, ev.midiVelocity, ev.voice);
                activeMidiNotes.set(midiKey, { pitch: ev.pitch, voice: ev.voice });
                later(() => {
                  noteOff(ev.pitch, ev.voice);
                  activeMidiNotes.delete(midiKey);
                }, ev.dur * 1000);
              }, Math.max(0, (time - clock()) * 1000));
            } else if (samplers[ev.voice]) {
              // Works for both Tone.Sampler and Tone.PolySynth. A late tick plays the
              // note slightly late instead of dropping it.
              // The MIDI velocity (5th argument) picks the layer of velocity-layered
              // samplers; the 6th ({art, solo, slur, tight}) picks the articulation and
              // phrasing of VSCO styles. Tone.Sampler ignores both.
              samplers[ev.voice].triggerAttackRelease(ev.pitch, ev.dur, Math.max(time, Tone.now()), ev.gain, ev.midiVelocity, ev.play);
            }
          } catch (err) {
            console.warn(`Skipping note ${ev.pitch} (voice ${ev.voice}): ${err.message}`);
          }
        }
        if (next >= events.length) clearScheduler();
      };
      schedulerId = setInterval(pump, SCHEDULER_TICK_MS);
      pump();

      const endBeats = data.notes.reduce((m, n) => Math.max(m, n.startTime + beatsOf(n)), 0);
      const durationSecs = (endBeats * beatDuration * bpmScaleFactor) + 3;

      if (resolveFinished) resolveFinished(false);  // settle a previous piece's promise, if any
      let settle;
      const finished = new Promise(resolve => { settle = resolve; });
      resolveFinished = settle;
      later(() => {
        if (resolveFinished === settle) resolveFinished = null;
        settle(true);
        if (superseded()) return;  // a newer piece owns the UI now
        statusDiv.innerText = "Ready";
        playBtn.disabled = false;
      }, durationSecs * 1000);

      // Section timeline (for the kiosk card): seconds from the first note
      const secsPerBeat = beatDuration * bpmScaleFactor;
      const articulation = artPlan ? {
        profile: artPlan.profile,
        real: realArticulations,
        sections: artPlan.sections.map(s => ({ ...s, atSecs: s.startBeat * secsPerBeat, endSecs: s.endBeat * secsPerBeat })),
      } : null;

      return { ok: true, data, durationSecs, finished, articulation, startsInSecs: 0.5 };

    } catch (e) {
      console.error(e);
      if (superseded()) return { ok: false, aborted: true };
      statusDiv.innerText = "Error: " + e.message;
      playBtn.disabled = false;
      return { ok: false, error: e };
    }
  }

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    generateAndPlay();
  });
  console.log("Event listener added to playBtn");

  // Small public surface for kiosk.js (endless autoplay)
  window.BachPlayer = {
    generateAndPlay,
    stopPlayback,
    setStereoLayout,
    isMidiEnabled: () => (typeof isMidiEnabled === 'function' ? isMidiEnabled() : false),
    // Checks / debugging: the last articulation plan, and the notes each voice actually
    // played per resolved articulation (VSCO styles)
    lastArticulationPlan: () => lastArticulationPlan,
    articulationStats: () => samplers.map(s => (s && s.counts ? { ...s.counts } : null)),
  };
});
