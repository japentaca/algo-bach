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
  // Continuo organ (VSCO styles with style.continuo): doubles the bass in the tutti of
  // a ritornello, rests in the solo episodes. Never with MIDI output.
  let continuo = null;       // { sampler, volume, panner } of the current piece
  let continuoOn = true;     // off only for A/B checks (setContinuo, next piece)
  let continuoInfo = null;   // stats of the current / last piece (continuoStats)
  // Messa di voce (articulation.js marks the swelled long notes): VSCO styles only, never
  // a keyboard style, the organ or MIDI.
  let messaOn = true;        // off only for A/B checks (setMessaDiVoce, next piece)
  let swellInfo = null;      // stats of the current / last piece (swellStats)
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

    disposeContinuo(now);

    // Clear arrays
    samplers = [];
    volumes = [];
    panners = [];

    console.log("✓ All audio resources disposed");
  }

  // ---- Continuo organ ------------------------------------------------------
  /** Release and dispose the organ and its nodes (part of disposeAllAudioResources). */
  function disposeContinuo(now = Tone.now()) {
    if (!continuo) return;
    const { sampler, volume, panner } = continuo;
    continuo = null;
    try { sampler.releaseAll(now); } catch (e) { /* ignore */ }
    try { sampler.dispose(); } catch (e) { /* ignore */ }
    // The sampler cuts its output 250 ms later (after its fade); its nodes go with it
    setTimeout(() => {
      try { volume.dispose(); } catch (e) { /* ignore */ }
      try { panner.dispose(); } catch (e) { /* ignore */ }
    }, 300);
  }

  /**
   * Which notes the organ doubles: the bass (voice 3) of every tutti section of a
   * ritornello. Returns null when the piece has no tutti (other forms) or no bass.
   */
  function continuoPlan(data, sections) {
    const tutti = sections
      .map((s, k) => ({ k, kind: s.kind, startBeat: s.startBeat, endBeat: s.endBeat }))
      .filter(s => s.kind === 'tutti' && Number.isFinite(s.startBeat) && Number.isFinite(s.endBeat));
    if (!tutti.length) return null;
    const notes = [];  // { i, section }
    data.notes.forEach((n, i) => {
      if (Math.min(Math.max(n.voice, 0), 3) !== 3) return;
      // Onsets carry a few thousandths of a beat of jitter: a bass note at 31.998 is the
      // downbeat of the section starting at 32
      const t = n.startTime + 0.05;
      const s = tutti.find(x => t >= x.startBeat && t < x.endBeat);
      if (s) notes.push({ i, section: s.k });
    });
    return notes.length ? { notes, tutti } : null;
  }

  /** Build the organ and load only the files of the notes it doubles (not connected yet). */
  async function prepareContinuo(style, data, plan) {
    const sampler = await createContinuoSampler(style);
    if (!sampler) return null;
    if (!Number.isFinite(sampler.trim) || sampler.trim <= 0) {
      console.warn('Continuo: bad trim, organ left out');
      return null;
    }
    // Notes outside the sampled range are not doubled (the manual reaches C2–C7)
    const inRange = plan.notes.filter(({ i }) => {
      const midi = noteToMidi(data.notes[i].pitch);
      return midi !== null && sampler.covers(midi, 0);
    });
    const files = await sampler.prepare(inRange.map(({ i }) => data.notes[i]));
    return { sampler, files, notes: inRange, outOfRange: plan.notes.length - inRange.length };
  }

  /** Put the prepared organ into the effects chain, near the bass (the continuo group). */
  function connectContinuo(sampler, styleName) {
    const pan = currentPans(styleName)[3] * 0.4;
    const volume = new Tone.Volume(0);
    const panner = new Tone.Panner(pan);
    panner.connect(dryGain);
    panner.connect(convolver);
    volume.connect(panner);
    sampler.connect(volume);
    continuo = { sampler, volume, panner };
  }

  /** Play one organ event (from the scheduler). Gains are checked: a NaN would poison the limiter. */
  function playContinuo(ev, time) {
    const info = continuoInfo;
    if (!Number.isFinite(ev.gain) || ev.gain <= 0 || !Number.isFinite(ev.dur) || ev.dur <= 0 || !Number.isFinite(time)) {
      if (info) info.skipped++;
      return;
    }
    // A pipe has no touch sensitivity: constant level; a keyboard: full attack, no slurs
    continuo.sampler.triggerAttackRelease(ev.pitch, ev.dur, time, ev.gain, 100, { keyboard: true });
    if (!info) return;
    info.played++;
    const sec = info.sections[ev.section];
    if (sec) sec.played++;
    if (!info.tutti.some(s => ev.beat + 0.05 >= s.startBeat && ev.beat + 0.05 < s.endBeat)) info.outsideTutti++;
    if (info.log.length < 4000) info.log.push([+ev.beat.toFixed(3), +(ev.beat + ev.beats).toFixed(3)]);
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
    if (samplers.length > 0 || volumes.length > 0 || panners.length > 0 || continuo) {
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

    if (samplers.length > 0 || volumes.length > 0 || panners.length > 0 || continuo) {
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
        if (samplers.length > 0 || volumes.length > 0 || panners.length > 0 || continuo) {
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

      // Continuo organ: the bass doubled in the tutti of a ritornello (VSCO styles with
      // a continuo stop, Tone output only)
      const sections = (artPlan ? artPlan.sections : (data.meta && data.meta.sections)) || [];
      const wantsOrgan = !useMidi && continuoOn && style.engine === 'vsco' && !!style.continuo
        && typeof createContinuoSampler === 'function';
      const organPlan = wantsOrgan ? continuoPlan(data, sections) : null;
      continuoInfo = {
        enabled: false,
        reason: useMidi ? 'midi' : !style.continuo || style.engine !== 'vsco' ? 'style' : !continuoOn ? 'off' : !organPlan ? 'no tutti' : null,
        stop: style.continuo ? `${style.continuo.instrument} / ${style.continuo.articulation}` : null,
        files: 0, planned: 0, played: 0, skipped: 0, outOfRange: 0, outsideTutti: 0,
        tutti: organPlan ? organPlan.tutti : [],
        sections: sections.map(s => ({ kind: s.kind, startBeat: s.startBeat, endBeat: s.endBeat, planned: 0, played: 0 })),
        log: [],
      };
      let organNotes = null;

      // Messa di voce: which planned swells are passed on, and the stats of the piece
      const swellOn = messaOn && realArticulations && !style.keyboard;
      const sectionIndexAt = (beat) => {
        for (let k = sections.length - 1; k >= 0; k--) if (beat >= sections[k].startBeat - 1e-3) return k;
        return 0;
      };
      swellInfo = {
        enabled: swellOn,
        reason: useMidi ? 'midi' : style.engine !== 'vsco' ? 'style' : style.keyboard ? 'keyboard' : !messaOn ? 'off' : null,
        planned: 0, passed: 0, played: 0,
        voices: [0, 1, 2, 3].map(() => ({ planned: 0, played: 0 })),
        contexts: {},
        sections: sections.map(s => ({ text: s.text || s.kind, startBeat: s.startBeat, endBeat: s.endBeat, planned: 0, played: 0 })),
        log: [],  // [beat, voice, pitch, ctx, depth, peak, played] of the swells passed on
      };
      if (artPlan) {
        artPlan.arts.forEach((a, i) => {
          if (!a.swell) return;
          const n = data.notes[i];
          const v = Math.min(Math.max(n.voice, 0), 3);
          swellInfo.planned++;
          swellInfo.voices[v].planned++;
          const c = swellInfo.contexts[a.swell.ctx] || (swellInfo.contexts[a.swell.ctx] = { planned: 0, played: 0 });
          c.planned++;
          const sec = swellInfo.sections[sectionIndexAt(n.startTime + 0.05)];
          if (sec) sec.planned++;
        });
      }

      if (!useMidi) {
        // Load samplers for selected style (layered styles: only this piece's files and articulations)
        const annotated = data.notes.map((n, i) => ({ ...n, art: artOf(i).art, solo: artOf(i).solo }));
        // The organ loads alongside (only the files of the notes it doubles)
        const [samplerSetupSuccess, organ] = await Promise.all([
          setupSamplers(currentStyle, annotated),
          organPlan
            ? prepareContinuo(style, data, organPlan).catch(err => {
              console.warn(`Continuo unavailable: ${err.message}`);
              return null;
            })
            : null,
        ]);
        if (superseded() || !samplerSetupSuccess) {
          if (organ) organ.sampler.dispose();
          if (superseded()) return { ok: false, aborted: true };
          playBtn.disabled = false;
          return { ok: false, error: new Error(`Could not load samples for ${currentStyle}`) };
        }
        if (organ && organ.notes.length) {
          connectContinuo(organ.sampler, currentStyle);
          organNotes = organ.notes;
          Object.assign(continuoInfo, { enabled: true, files: organ.files, planned: organ.notes.length, outOfRange: organ.outOfRange });
          organ.notes.forEach(({ section }) => { if (continuoInfo.sections[section]) continuoInfo.sections[section].planned++; });
          console.log(`✓ Continuo organ (${continuoInfo.stop}): ${organ.notes.length} bass notes in ${organPlan.tutti.length} tutti, ${organ.files} files`);
        } else if (organ) {
          organ.sampler.dispose();
          continuoInfo.reason = 'out of range';
        } else if (organPlan) {
          continuoInfo.reason = 'unavailable';
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
                ${continuoInfo.enabled ? `<br><strong>Continuo:</strong> organ (8' principal) doubling the bass in the tutti` : ''}
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
        const { art, solo, gainMul, slur, tight, swell } = artOf(i);
        // Without articulation samples a detached note is just a shorter note
        if (!realArticulations && (art === 'staccato' || art === 'pizzicato') && typeof shortArticulationLength === 'function') {
          dur = shortArticulationLength(dur);
        }

        // Velocity for dynamics: use the generator's phrase-shaped velocity when present
        let velocity = note.velocity ? note.velocity / 127 : 0.7 + (Math.random() * 0.1);
        velocity = Math.max(0.2, Math.min(1, velocity));

        return {
          at,
          play: { art, solo, slur: !!slur, tight: !!tight, swell: swellOn && swell ? swell : null },
          i,
          dur: Math.max(0.03, dur),
          pitch: note.pitch,
          voice: Math.min(Math.max(note.voice, 0), 3),
          midiVelocity: Math.round(velocity * 127),
          // Per-note gain with a squared curve (40·log10(v), the usual MIDI/DLS
          // velocity curve): v=0.55 → -10 dB, v=0.8 → -4 dB, v=1 → 0 dB.
          // Tone applies it as a linear gain on the note's own buffer source.
          gain: velocity * velocity * (gainMul || 1),
        };
      });

      // Organ events: with the bass note (same humanized onset), an organist's touch.
      // Détaché / pizzicato bass → half length; held notes → slightly lifted, so
      // repeated notes speak again. Never past the end of the tutti.
      const secsPerBeat = beatDuration * bpmScaleFactor;
      if (continuo && organNotes) {
        organNotes.forEach(({ i, section }) => {
          const note = data.notes[i];
          const bass = events[i];
          const beats = beatsOf(note);
          const len = beats * secsPerBeat;
          const detached = bass.play.art === 'staccato' || bass.play.art === 'pizzicato';
          let dur = detached ? Math.max(0.1, len * 0.5) : len - Math.min(0.08, len * 0.12);
          const sec = sections[section];
          if (sec) dur = Math.min(dur, (sec.endBeat - note.startTime) * secsPerBeat - 0.02);
          if (!(dur > 0.05)) return;
          events.push({ at: bass.at, organ: true, pitch: note.pitch, dur, gain: 1, section, beat: note.startTime, beats });
        });
      }
      events.sort((a, b) => a.at - b.at);

      // Just-in-time scheduling: only notes starting within SCHEDULE_AHEAD_SECS are
      // handed to Tone / MIDI. Scheduling a whole piece up front created thousands of
      // buffer sources at once, and a stopped piece left them all pending, which
      // saturated the audio thread (clock running at ~0.1x, pieces "playing" silently).
      clearScheduler();
      const info = swellInfo;
      const noteSwell = (ev, note, played) => {
        info.passed++;
        const s = ev.play.swell;
        if (info.log.length < 2000) info.log.push([note.startTime, ev.voice, ev.pitch, s.ctx, s.depth, s.peak, played]);
        if (!played) return;
        info.played++;
        info.voices[ev.voice].played++;
        if (info.contexts[s.ctx]) info.contexts[s.ctx].played++;
        const sec = info.sections[sectionIndexAt(note.startTime + 0.05)];
        if (sec) sec.played++;
      };
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
            } else if (ev.organ) {
              if (continuo) playContinuo(ev, Math.max(time, Tone.now()));
            } else if (samplers[ev.voice]) {
              // Works for both Tone.Sampler and Tone.PolySynth. A late tick plays the
              // note slightly late instead of dropping it.
              // The MIDI velocity (5th argument) picks the layer of velocity-layered
              // samplers; the 6th ({art, solo, slur, tight, swell}) picks the articulation
              // and phrasing of VSCO styles. Tone.Sampler ignores both.
              const swelled = samplers[ev.voice].triggerAttackRelease(ev.pitch, ev.dur, Math.max(time, Tone.now()), ev.gain, ev.midiVelocity, ev.play);
              if (ev.play.swell) noteSwell(ev, data.notes[ev.i], swelled === true);
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

      // Section timeline (for the kiosk card): seconds from the first note; the tutti
      // where the organ plays say so
      const organIn = (k) => continuoInfo.enabled && continuoInfo.sections[k] && continuoInfo.sections[k].planned > 0;
      const articulation = artPlan ? {
        profile: artPlan.profile,
        real: realArticulations,
        sections: artPlan.sections.map((s, k) => ({
          ...s,
          text: organIn(k) ? `${s.text} · con organo` : s.text,
          atSecs: s.startBeat * secsPerBeat,
          endSecs: s.endBeat * secsPerBeat,
        })),
      } : null;
      const continuoSummary = continuoInfo.enabled
        ? { stop: continuoInfo.stop, notes: continuoInfo.planned, files: continuoInfo.files }
        : null;

      return { ok: true, data, durationSecs, finished, articulation, continuo: continuoSummary, startsInSecs: 0.5 };

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
    // Round robins in use per voice and articulation (take index -> notes played)
    roundRobinStats: () => samplers.map(s => (s && s.roundRobinStats ? s.roundRobinStats() : null)),
    // Continuo organ of the current / last piece: notes planned and played (per
    // section), files loaded, notes played outside a tutti (should be 0), and the
    // [startBeat, endBeat] of every organ note played (`log`)
    continuoStats: () => (continuoInfo ? {
      ...continuoInfo,
      sounding: !!continuo,
      tutti: continuoInfo.tutti.map(s => ({ ...s })),
      sections: continuoInfo.sections.map(s => ({ ...s })),
      log: continuoInfo.log.slice(),
    } : null),
    // A/B checks: the organ on/off from the next piece
    setContinuo: (on) => { continuoOn = !!on; },
    // Messa di voce of the current / last piece: swells planned by the articulation plan,
    // passed to the samplers and really shaped (`played`), per voice, context (final,
    // cadence, cadence-inner, solo, cantabile) and section; `log` of the swells passed
    // on: [beat, voice, pitch, ctx, depth dB, peak, played]
    swellStats: () => (swellInfo ? {
      ...swellInfo,
      voices: swellInfo.voices.map(v => ({ ...v })),
      contexts: JSON.parse(JSON.stringify(swellInfo.contexts)),
      sections: swellInfo.sections.map(s => ({ ...s })),
      log: swellInfo.log.map(r => r.slice()),
    } : null),
    // A/B checks: the messa di voce on/off from the next piece
    setMessaDiVoce: (on) => { messaOn = !!on; },
  };
  window.setContinuo = window.BachPlayer.setContinuo;
  window.setMessaDiVoce = window.BachPlayer.setMessaDiVoce;
});
