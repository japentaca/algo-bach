/**
 * Kiosk / autoplay mode — an endless "concerto perpetuo".
 *
 * Every cycle randomizes all musical controls in the DOM, then reuses the normal
 * generate & play path exposed by player.js (window.BachPlayer). It waits for the
 * piece's `finished` promise, rests for PAUSE_BETWEEN_PIECES_MS and starts again.
 *
 * Presentation (one mode for the whole page): the hero, the slideshow, the invented
 * author and title, the progress bar and the score follow every piece through the
 * player's events (ui/main.js); this file adds the kiosk's own lines to the hero (piece
 * number, state, details, seed) and sets body.kiosk-on, which hides the controls.
 *
 * Entry: the "Iniciar" button (#kioskBtn), or ?kiosk / #kiosk in the URL (shows a "tap
 * to begin" overlay, because browsers only start audio after a user gesture; that
 * path also goes fullscreen).
 * Exit: Escape, leaving fullscreen, or the same button ("Detener").
 *
 * MIDI output settings are never touched.
 */
document.addEventListener('DOMContentLoaded', () => {
  // ---- Tunables ----------------------------------------------------------
  const PAUSE_BETWEEN_PIECES_MS = 4000;  // silence after a piece's reverb tail
  const GENERATE_TIMEOUT_MS = 90000;     // generation + sample loading must finish within this
  const RETRY_BASE_MS = 5000;            // first retry delay after an error
  const RETRY_MAX_MS = 60000;            // back-off ceiling
  const TEMPO_BY_FORM = {                // musically plausible quarter-note ranges
    Chorale: [56, 84],
    Prelude: [80, 132],
    Fugue: [70, 112],
    Ritornello: [96, 138],
    Variations: [72, 116],
    Suite: [76, 126],
    Passacaglia: [60, 92],
  };
  // Harpsichords: the piano's +4 — a plucked string dies away (-20 dB in ~2 s), so slow
  // chorales and held notes need to move on a little
  const TEMPO_SHIFT_BY_STYLE = { Brass: -6, Harp: -4, VscoBrass: -6, VscoTrumpetStrings: -3, HarpsichordFull: 4, Harpsichord8: 4 };
  // Articulation profile (the "Articulation" selector): mostly the Baroque-practice
  // plan, sometimes one manner for the whole piece. Pizzicato only where the ensemble
  // really plucks (every voice has a pizzicato: the VSCO string quartet).
  const ARTICULATION_WEIGHTS = { auto: 0.6, legato: 0.14, detached: 0.14, pizzicato: 0.12 };
  const ARTICULATION_ES = { auto: 'Articulación natural', legato: 'Todo legato', detached: 'Todo destacado', pizzicato: 'Todo pizzicato' };
  const KIOSK_VOICE_PROFILES = ['auto', 'auto', 'auto', 'auto'];  // no per-voice overrides
  // Reverb: always on in kiosk mode. Rooms suited to Baroque music (churches, halls),
  // each with a wet-mix range (%) set by its length: long tails get a little less mix.
  // The player crossfades dry = 1 - mix, wet = mix. 50% is the mix chosen by ear (the
  // manual default): with RoomHuge the reverb sits about level with the direct sound.
  // Only one room is drawn; the others stay selectable by hand in "El taller".
  // RoomHuge: RT60 ~3.1 s with an early decay (EDT) of ~1.8 s and a wide tail (L/R
  // correlation 0.15): a church-like tail heard in rests and phrase ends while the
  // counterpoint stays clear. The concert hall (RT60 1.55 s, 62% of its energy in the
  // first 80 ms) fused with the direct sound and was heard as too little reverb.
  const REVERB_SPACES = {
    'RoomHuge.mp3': [45, 55],  // around the 50% chosen by ear (slider steps of 5)
  };
  // Harpsichords: drier than the piano's -6. The VCSL samples are the far microphones
  // (the room is already in them) and a dense, sharp attack in every voice smears under
  // a long wet tail; the mix still stays >= 18% (PrimeXtraLong's 26-38 minus 8)
  const REVERB_SHIFT_BY_STYLE = {
    Strings: 3, Brass: 2, Harp: -3, VscoBrass: 2, VscoStrings: 3, HarpsichordFull: -8, Harpsichord8: -8,
    VscoOboeStrings: 2, VscoFluteStrings: 2, VscoTrumpetStrings: 2, VscoOboeBassoon: 2,
  };

  // Ensemble of each piece: any style the page can play (its option enabled), drawn
  // with these weights so the real recorded instruments come up most: the VSCO
  // quartets and Baroque scorings, then the harpsichords; the older one-layer
  // samples (Strings, Woodwinds, Brass, Harp, Mixed) now and then. Unlisted styles: 0.5.
  const STYLE_WEIGHTS = {
    VscoStrings: 1.3, VscoWoodwinds: 0.8, VscoBrass: 0.7,
    VscoOboeStrings: 0.8, VscoFluteStrings: 0.8, VscoTrumpetStrings: 0.6, VscoOboeBassoon: 0.6,
    HarpsichordFull: 0.7, Harpsichord8: 0.6,
    Strings: 0.25, Brass: 0.2, Harp: 0.3,
    // Never drawn: their one-layer flute and oboe samples have the vibrato in the take, a
    // 5-9 Hz swell of +-3-5 dB (flute) / +-1-2 dB (oboe) heard as a tremolo on every note.
    // The VSCO woodwinds and Baroque ensembles play those parts with a straight tone.
    Woodwinds: 0, Mixed: 0,
  };

  // Stereo seatings [S, A, T, B] scaled by a random width. Ensembles: the modern stage
  // (high voices left, low voices right) or the antiphonal Baroque seating (the two
  // upper parts facing each other across the stage). Harpsichord and harp: one instrument,
  // heard from the keyboard (treble right), kept narrower.
  const SEATINGS = {
    moderna: { label: 'Disposición moderna', pans: [-1, -0.35, 0.35, 0.8], weight: 0.65 },
    antifonale: { label: 'Disposición antifonal', pans: [-1, 1, -0.35, 0.35], weight: 0.35 },
  };
  const KEYBOARD_SEATING = { label: 'Desde el teclado', pans: [1, 0.35, -0.35, -1] };
  const KEYBOARD_STYLES = ['Harp', 'HarpsichordFull', 'Harpsichord8'];

  // ---- Labels (the details line of the hero) --------------------------------
  const AFFETTO_ES = { style: 'Afecto natural', delicate: 'Dolce', lyrical: 'Cantabile', bold: 'Con fuoco' };

  // ---- Elements ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const kioskBtn = $('kioskBtn');
  const overlay = $('kioskOverlay');
  const exitBtn = $('kioskExitBtn');  // optional: #kioskBtn toggles too
  const ui = {
    count: $('kioskCount'),
    details: $('kioskDetails'),
    seed: $('kioskSeed'),
    state: $('kioskState'),
  };
  const setText = (el, text) => { if (el) el.textContent = text; };

  if (!window.BachPlayer) {
    console.error('Kiosk: player API missing; kiosk disabled.');
    if (kioskBtn) kioskBtn.disabled = true;
    return;
  }
  const player = window.BachPlayer;

  // ---- State -------------------------------------------------------------
  let active = false;
  let runId = 0;              // bumps on every start/exit so stale loops end
  let pieceNo = 0;           // pieces that actually started playing
  let failures = 0;
  let wakeLock = null;
  let enteredFullscreen = false;
  let wakeSleep = null;       // resolver that cuts a pending sleep short on exit
  let savedSeedUi = null;

  // ---- Helpers -----------------------------------------------------------
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  function snap(value, input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const step = Number(input.step || 1) || 1;
    const snapped = Math.round((value - min) / step) * step + min;
    return Math.min(max, Math.max(min, snapped));
  }

  function setSelect(id, value) {
    const el = $(id);
    if (!el || value == null) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setRange(id, value) {
    const el = $(id);
    if (!el) return null;
    el.value = String(snap(value, el));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return Number(el.value);
  }

  function setCheck(id, checked) {
    const el = $(id);
    if (!el) return;
    el.checked = checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function optionValues(id, filter) {
    const el = $(id);
    if (!el) return [];
    const values = Array.from(el.options).filter(o => !o.disabled).map(o => o.value);
    return filter ? values.filter(filter) : values;
  }

  function optionText(id) {
    const el = $(id);
    const opt = el && el.options[el.selectedIndex];
    return opt ? opt.textContent.trim() : '';
  }

  function pickWeighted(values, weights) {
    if (!values.length) return null;
    let r = Math.random() * values.reduce((s, v) => s + (weights[v] || 0), 0);
    for (const v of values) {
      if (!(weights[v] > 0)) continue;  // weight 0: never drawn
      r -= weights[v];
      if (r <= 0) return v;
    }
    return values[values.length - 1];
  }

  /** Prefer earlier (shorter) options: weight 1/(i+1)^1.3 → ~61% / 25% / 15% for three. */
  function pickShortBiased(values) {
    const weights = values.map((_, i) => 1 / Math.pow(i + 1, 1.3));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < values.length; i++) {
      r -= weights[i];
      if (r <= 0) return values[i];
    }
    return values[values.length - 1];
  }

  /** Whether every voice of the style plucks for real (a global pizzicato makes sense). */
  function canPluck(styleName) {
    const style = typeof STYLE_PRESETS !== 'undefined' && STYLE_PRESETS[styleName];
    return !!style && typeof styleArticulations === 'function' && styleArticulations(style).includes('pizzicato');
  }

  /**
   * Wait until the page has enabled the styles whose samples the site has (VSCO,
   * SFZ harpsichords: player.js enables them when these checks resolve), so the draw
   * covers every ensemble from the first piece.
   */
  async function stylesReady() {
    const checks = [];
    if (typeof isVscoAvailable === 'function') checks.push(isVscoAvailable());
    if (typeof sfzAvailability === 'function') checks.push(sfzAvailability());
    await Promise.all(checks.map(p => Promise.resolve(p).catch(() => null)));
    await new Promise(r => setTimeout(r, 0));  // after player.js's own handlers
  }

  function makeSeed() {
    return 'kiosk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function sleep(ms, myRun) {
    return new Promise(resolve => {
      const id = setTimeout(done, ms);
      function done() {
        clearTimeout(id);
        if (wakeSleep === done) wakeSleep = null;
        resolve(active && myRun === runId);
      }
      wakeSleep = done;
    });
  }

  function withTimeout(promise, ms) {
    let id;
    const timeout = new Promise((_, reject) => {
      id = setTimeout(() => reject(new Error(`timed out after ${Math.round(ms / 1000)} s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
  }

  // ---- Randomizer --------------------------------------------------------
  /** Randomize every musical control and write it back into the DOM. Returns the choices. */
  function randomizeAll() {
    const c = {};
    c.key = pick(optionValues('keySelect'));
    c.mode = pick(optionValues('modeSelect'));
    c.form = pick(optionValues('formSelect'));
    const styles = optionValues('styleSelect');
    c.style = pickWeighted(styles, Object.fromEntries(styles.map(v => [v, STYLE_WEIGHTS[v] ?? 0.5])));
    c.duration = pickShortBiased(optionValues('durationSelect'));
    c.expressivity = pick(optionValues('expressivityPreset'));
    setSelect('keySelect', c.key);
    setSelect('modeSelect', c.mode);
    setSelect('formSelect', c.form);
    setSelect('styleSelect', c.style);
    setSelect('durationSelect', c.duration);
    setSelect('expressivityPreset', c.expressivity);

    c.randomTexture = chance(0.7);
    c.sparseOrnaments = chance(0.75);
    setCheck('randomTextureCheck', c.randomTexture);
    setCheck('sparseOrnamentsCheck', c.sparseOrnaments);

    c.ornamentDensity = setRange('ornamentDensity', rand(20, 80));

    const artOptions = optionValues('articulationSelect')
      .filter(v => v in ARTICULATION_WEIGHTS && (v !== 'pizzicato' || canPluck(c.style)));
    c.articulation = pickWeighted(artOptions, ARTICULATION_WEIGHTS) || 'auto';
    setSelect('articulationSelect', c.articulation);

    const [lo, hi] = TEMPO_BY_FORM[c.form] || [72, 120];
    const shift = TEMPO_SHIFT_BY_STYLE[c.style] || 0;
    c.tempo = setRange('tempoSlider', rand(lo, hi) + shift);

    const spaces = optionValues('impulseSelect', v => v in REVERB_SPACES);
    c.impulse = pick(spaces.length ? spaces : optionValues('impulseSelect', v => v !== 'none'));
    const [mixLo, mixHi] = REVERB_SPACES[c.impulse] || [40, 54];
    const mixShift = REVERB_SHIFT_BY_STYLE[c.style] || 0;
    c.reverbMix = setRange('reverbMix', rand(mixLo, mixHi) + mixShift);
    setSelect('impulseSelect', c.impulse);  // after the mix, so the change handler applies the new mix

    // Stereo seating for this piece (applied when the samplers are built)
    let seating;
    let width;
    if (KEYBOARD_STYLES.includes(c.style)) {
      seating = KEYBOARD_SEATING;
      width = rand(0.35, 0.5);
    } else {
      seating = chance(SEATINGS.moderna.weight) ? SEATINGS.moderna : SEATINGS.antifonale;
      width = rand(0.55, 0.8);
    }
    c.seating = seating.label;
    c.pans = seating.pans.map(p => Math.round(p * width * 100) / 100);
    if (player.setStereoLayout) player.setStereoLayout(c.pans);

    // Seed: a fresh explicit seed, so it is visible and reproducible
    c.seed = makeSeed();
    setCheck('randomizeCheck', false);
    setCheck('useSeedCheck', true);
    const seedInput = $('seedInput');
    if (seedInput) {
      seedInput.value = c.seed;
      seedInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return c;
  }

  function saveSeedUi() {
    savedSeedUi = {
      randomize: $('randomizeCheck') ? $('randomizeCheck').checked : true,
      useSeed: $('useSeedCheck') ? $('useSeedCheck').checked : false,
      seed: $('seedInput') ? $('seedInput').value : '',
    };
  }

  function restoreSeedUi() {
    if (!savedSeedUi) return;
    setCheck('randomizeCheck', savedSeedUi.randomize);
    setCheck('useSeedCheck', savedSeedUi.useSeed);
    if ($('seedInput')) $('seedInput').value = savedSeedUi.seed;
    savedSeedUi = null;
  }

  // ---- Kiosk lines of the hero ------------------------------------------------
  function describe(c, data, continuo) {
    const meta = (data && data.meta) || {};
    return [
      AFFETTO_ES[c.expressivity] || optionText('expressivityPreset'),
      ARTICULATION_ES[c.articulation] || optionText('articulationSelect'),
      continuo ? 'continuo de órgano en los tutti' : null,
      `Ornamentos ${c.ornamentDensity}%`,
      `${optionText('impulseSelect')} · ${c.reverbMix}% de reverberación`,
      c.seating,
      meta.bars ? `${Math.round(meta.bars)} compases` : optionText('durationSelect'),
    ].filter(Boolean).join(' · ');
  }

  function showCard(c, data, continuo = null) {
    setText(ui.count, `N.º ${pieceNo + (data ? 0 : 1)}`);
    setText(ui.details, data ? describe(c, data, continuo) : '');
    setText(ui.seed, `Semilla ${c.seed}`);
  }

  function setState(text) {
    setText(ui.state, text);
  }

  function announce() {
    window.dispatchEvent(new CustomEvent('bach:kiosk', { detail: { active } }));
  }

  // ---- The loop ------------------------------------------------------------
  async function loop(myRun) {
    await stylesReady();
    while (active && myRun === runId) {
      let choices = null;
      try {
        choices = randomizeAll();
        showCard(choices, null);
        setState('Componiendo…');

        // The kiosk picks its own (global) profile: the listener's per-voice choices are
        // ignored for its pieces (and left untouched in the page for after the kiosk)
        const result = await withTimeout(player.generateAndPlay({ voiceProfiles: KIOSK_VOICE_PROFILES }), GENERATE_TIMEOUT_MS);
        if (!active || myRun !== runId) break;
        if (!result || !result.ok) {
          throw (result && result.error) || new Error(result && result.aborted ? 'playback aborted' : 'generation failed');
        }

        failures = 0;
        pieceNo++;
        showCard(choices, result.data, result.continuo);
        setState(player.isMidiEnabled() ? 'Sonando · MIDI' : 'Sonando');

        const natural = await result.finished;
        if (!active || myRun !== runId) break;
        if (natural) setState('Intermedio…');
        if (!(await sleep(PAUSE_BETWEEN_PIECES_MS, myRun))) break;
      } catch (err) {
        if (!active || myRun !== runId) break;
        failures++;
        const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, failures - 1));
        console.error(`Kiosk: piece ${pieceNo + 1} failed (attempt ${failures}); retrying in ${wait / 1000} s`, err);
        try { player.stopPlayback(); } catch (e) { console.warn('Kiosk: stop after error failed', e); }
        setState(`Un momento… (${err && err.message ? err.message : 'error'}) — reintento en ${Math.round(wait / 1000)} s`);
        if (!(await sleep(wait, myRun))) break;
      }
    }
  }

  // ---- Wake lock & fullscreen ---------------------------------------------
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      console.info('Kiosk: wake lock unavailable:', e.message);
    }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (active && document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
  });

  function requestFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      const p = fn.call(el);
      enteredFullscreen = true;
      if (p && p.catch) p.catch(() => { enteredFullscreen = false; });
    } catch (e) {
      enteredFullscreen = false;
    }
  }

  function exitFullscreenIfOurs() {
    if (!enteredFullscreen) return;
    enteredFullscreen = false;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fsEl && fn) {
      try {
        const p = fn.call(document);
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
  }

  function onFullscreenChange() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    // The browser swallows the first Escape to leave fullscreen; treat that as "exit kiosk".
    if (!fsEl && enteredFullscreen && active) {
      enteredFullscreen = false;
      exitKiosk();
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ---- Enter / exit ----------------------------------------------------------
  /** Must be called from a user gesture (click / tap / key). */
  function startKiosk({ fullscreen = false } = {}) {
    if (active) return;
    hideOverlay();
    // Unlock audio inside the gesture; generateAndPlay will also call Tone.start().
    try { if (window.Tone && Tone.start) Tone.start(); } catch (e) { /* ignore */ }
    if (fullscreen) requestFullscreen();
    requestWakeLock();

    active = true;
    runId++;
    pieceNo = 0;
    failures = 0;
    saveSeedUi();
    try { player.stopPlayback(); } catch (e) { /* nothing playing */ }

    document.body.classList.add('kiosk-on');
    if (kioskBtn) kioskBtn.setAttribute('aria-pressed', 'true');
    window.scrollTo({ top: 0 });
    announce();

    loop(runId).catch(err => {
      // Should be unreachable (loop catches everything), but never die silently.
      console.error('Kiosk: loop crashed, restarting in 5 s', err);
      const myRun = runId;
      setTimeout(() => { if (active && myRun === runId) loop(myRun); }, 5000);
    });
  }

  function exitKiosk() {
    if (!active) {
      hideOverlay();
      return;
    }
    active = false;
    runId++;
    if (wakeSleep) wakeSleep();
    try { player.stopPlayback(); } catch (e) { console.warn('Kiosk: stop failed', e); }
    if (player.setStereoLayout) player.setStereoLayout(null);  // back to the style's default seating
    restoreSeedUi();
    releaseWakeLock();
    exitFullscreenIfOurs();

    document.body.classList.remove('kiosk-on');
    setState('');
    if (kioskBtn) {
      kioskBtn.setAttribute('aria-pressed', 'false');
      kioskBtn.focus({ preventScroll: true });
    }
    const status = $('status');
    if (status) status.innerText = 'Concierto detenido — Listo';
    announce();
  }

  // ---- "Tap to begin" overlay (for ?kiosk URLs) ---------------------------------
  function showOverlay() {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add('kiosk-armed');
    overlay.focus({ preventScroll: true });
  }

  function hideOverlay() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('kiosk-armed');
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      startKiosk({ fullscreen: true });
    });
  }

  document.addEventListener('keydown', (e) => {
    if (overlay && !overlay.hidden) {
      if (e.key === 'Escape') { hideOverlay(); return; }     // dismiss without starting
      if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      startKiosk({ fullscreen: true });
      return;
    }
    if (active && e.key === 'Escape') {
      e.preventDefault();
      exitKiosk();
    }
  });

  if (kioskBtn) {
    kioskBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (active) exitKiosk();
      else startKiosk({ fullscreen: false });
    });
  }
  if (exitBtn) exitBtn.addEventListener('click', (e) => { e.preventDefault(); exitKiosk(); });

  const params = new URLSearchParams(window.location.search);
  if (params.has('kiosk') || /^#(.*[&?])?kiosk\b/i.test(window.location.hash)) {
    showOverlay();
  }

  // Handy for debugging from the console
  window.BachKiosk = { start: startKiosk, exit: exitKiosk, randomize: randomizeAll, isActive: () => active };
});
