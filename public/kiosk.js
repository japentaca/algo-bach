/**
 * Kiosk / autoplay mode — an endless "concerto perpetuo".
 *
 * Every cycle randomizes all musical controls in the DOM, then reuses the normal
 * generate & play path exposed by player.js (window.BachPlayer). It waits for the
 * piece's `finished` promise, rests for PAUSE_BETWEEN_PIECES_MS and starts again.
 *
 * Entry: the "Kiosk" button, or ?kiosk / #kiosk in the URL (shows a "tap to begin"
 * overlay, because browsers only start audio after a user gesture).
 * Exit: Escape, leaving fullscreen, or the "Exit kiosk" button.
 *
 * MIDI output settings are never touched.
 */
document.addEventListener('DOMContentLoaded', () => {
  // ---- Tunables ----------------------------------------------------------
  const PAUSE_BETWEEN_PIECES_MS = 4000;  // silence after a piece's reverb tail
  const SECTION_LEAD_SECS = 0.5;         // the first note sounds this long after playback starts
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
  };
  const TEMPO_SHIFT_BY_STYLE = { Choir: -8, Brass: -6, Harp: -4, Piano: 4, VscoBrass: -6, VscoPiano: 4 };
  // Articulation profile (the "Articulation" selector): mostly the Baroque-practice
  // plan, sometimes one manner for the whole piece. Pizzicato only where the ensemble
  // really plucks (VSCO strings).
  const ARTICULATION_WEIGHTS = { auto: 0.6, legato: 0.14, detached: 0.14, pizzicato: 0.12 };
  const PIZZICATO_STYLES = ['VscoStrings'];
  const ARTICULATION_IT = { auto: 'Articolazione naturale', legato: 'Tutto legato', detached: 'Tutto staccato', pizzicato: 'Tutto pizzicato' };
  const KIOSK_VOICE_PROFILES = ['auto', 'auto', 'auto', 'auto'];  // no per-voice overrides
  // Reverb: always on in kiosk mode. Rooms suited to Baroque music (churches, halls),
  // each with a wet-mix range (%) set by its length: long tails get a little less mix.
  // The player crossfades dry = 1 - mix, wet = mix; ~35% puts the hall clearly audible
  // (about 6 dB under the direct sound) without washing the counterpoint out.
  const REVERB_SPACES = {
    'RoomConcertHall.mp3': [32, 46],
    'RoomLarge.mp3': [34, 48],
    'RoomHuge.mp3': [28, 40],
    'PlateMedium.mp3': [32, 46],
    'PlateLarge.mp3': [26, 38],
    'PrimeMed.mp3': [36, 50],
    'PrimeLong.mp3': [30, 44],
    'PrimeXtraLong.mp3': [26, 38],
  };
  const REVERB_SHIFT_BY_STYLE = { Choir: 6, Strings: 3, Brass: 2, Harp: -3, Piano: -6, VscoBrass: 2, VscoPiano: -6, VscoStrings: 3 };

  // Stereo seatings [S, A, T, B] scaled by a random width. Ensembles: the modern stage
  // (high voices left, low voices right) or the antiphonal Baroque seating (the two
  // upper parts facing each other across the stage). Piano and harp: one instrument,
  // heard from the keyboard (treble right), kept narrower.
  const SEATINGS = {
    moderna: { label: 'Disposizione moderna', pans: [-1, -0.35, 0.35, 0.8], weight: 0.65 },
    antifonale: { label: 'Disposizione antifonale', pans: [-1, 1, -0.35, 0.35], weight: 0.35 },
  };
  const KEYBOARD_SEATING = { label: 'Dalla tastiera', pans: [1, 0.35, -0.35, -1] };
  const KEYBOARD_STYLES = ['Piano', 'Harp', 'VscoPiano'];

  // ---- Italianate labels -------------------------------------------------
  const FORM_IT = {
    Chorale: 'Corale', Prelude: 'Preludio', Fugue: 'Fuga', Ritornello: 'Ritornello',
    Variations: 'Variazioni', Suite: 'Suite',
  };
  const KEY_IT = {
    C: 'Do', 'C#': 'Do♯', D: 'Re', Eb: 'Mi♭', E: 'Mi', F: 'Fa', 'F#': 'Fa♯',
    G: 'Sol', Ab: 'La♭', A: 'La', Bb: 'Si♭', B: 'Si',
  };
  const MODE_IT = { major: 'maggiore', minor: 'minore' };
  const STYLE_IT = {
    Strings: "Quartetto d'archi", Piano: 'Pianoforte', Woodwinds: 'Quartetto di legni',
    Brass: 'Quartetto di ottoni', Choir: 'Coro', Harp: 'Arpa', Mixed: 'Orchestra',
    VscoPiano: 'Pianoforte verticale (VSCO)', VscoWoodwinds: 'Quartetto di legni (VSCO)',
    VscoBrass: 'Quartetto di ottoni (VSCO)', VscoStrings: "Quartetto d'archi (VSCO)",
  };
  const AFFETTO_IT = { style: 'Affetto naturale', delicate: 'Dolce', lyrical: 'Cantabile', bold: 'Con fuoco' };

  function tempoMarking(bpm) {
    if (bpm < 60) return 'Largo';
    if (bpm < 72) return 'Adagio';
    if (bpm < 88) return 'Andante';
    if (bpm < 108) return 'Moderato';
    if (bpm < 132) return 'Allegro';
    if (bpm < 160) return 'Vivace';
    return 'Presto';
  }

  // ---- Elements ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const kioskBtn = $('kioskBtn');
  const stage = $('kioskStage');
  const overlay = $('kioskOverlay');
  const exitBtn = $('kioskExitBtn');
  const ui = {
    count: $('kioskCount'),
    title: $('kioskTitle'),
    subtitle: $('kioskSubtitle'),
    section: $('kioskSection'),
    details: $('kioskDetails'),
    seed: $('kioskSeed'),
    state: $('kioskState'),
    bar: $('kioskProgress'),
    fill: $('kioskProgressFill'),
    elapsed: $('kioskElapsed'),
    total: $('kioskTotal'),
  };

  if (!window.BachPlayer || !stage) {
    console.error('Kiosk: player API or kiosk markup missing; kiosk disabled.');
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
  let progressTimer = null;
  let wakeSleep = null;       // resolver that cuts a pending sleep short on exit
  let savedSeedUi = null;
  let sectionTimeline = null;  // [{atSecs, endSecs, text}] of the piece playing
  let shownSection = null;

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
      r -= weights[v] || 0;
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

  const fmt = (secs) => {
    const s = Math.max(0, Math.round(secs));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // ---- Randomizer --------------------------------------------------------
  /** Randomize every musical control and write it back into the DOM. Returns the choices. */
  function randomizeAll() {
    const c = {};
    c.key = pick(optionValues('keySelect'));
    c.mode = pick(optionValues('modeSelect'));
    c.form = pick(optionValues('formSelect'));
    c.style = pick(optionValues('styleSelect'));
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
      .filter(v => v in ARTICULATION_WEIGHTS && (v !== 'pizzicato' || PIZZICATO_STYLES.includes(c.style)));
    c.articulation = pickWeighted(artOptions, ARTICULATION_WEIGHTS) || 'auto';
    setSelect('articulationSelect', c.articulation);

    const [lo, hi] = TEMPO_BY_FORM[c.form] || [72, 120];
    const shift = TEMPO_SHIFT_BY_STYLE[c.style] || 0;
    c.tempo = setRange('tempoSlider', rand(lo, hi) + shift);

    const spaces = optionValues('impulseSelect', v => v in REVERB_SPACES);
    c.impulse = pick(spaces.length ? spaces : optionValues('impulseSelect', v => v !== 'none'));
    const [mixLo, mixHi] = REVERB_SPACES[c.impulse] || [30, 44];
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

  // ---- Now-playing card ----------------------------------------------------
  function describe(c, data, continuo) {
    const meta = (data && data.meta) || {};
    const form = meta.form || c.form;
    const key = meta.key || c.key;
    const mode = meta.mode || c.mode;
    const title = `${FORM_IT[form] || form} in ${KEY_IT[key] || key} ${MODE_IT[mode] || mode}`;
    const ensemble = STYLE_IT[c.style] || optionText('styleSelect');
    const subtitle = `${ensemble} · ${tempoMarking(c.tempo)} ♩ = ${c.tempo}`;
    const impulse = optionText('impulseSelect');
    const details = [
      AFFETTO_IT[c.expressivity] || optionText('expressivityPreset'),
      ARTICULATION_IT[c.articulation] || optionText('articulationSelect'),
      continuo ? "continuo d'organo nei tutti" : null,
      `Ornamenti ${c.ornamentDensity}%`,
      `${impulse} · ${c.reverbMix}% riverbero`,
      c.seating,
      meta.bars ? `${Math.round(meta.bars)} battute` : optionText('durationSelect'),
    ].filter(Boolean).join(' · ');
    return { title, subtitle, details };
  }

  function showCard(c, data, continuo = null) {
    const d = describe(c, data, continuo);
    ui.count.textContent = `No. ${pieceNo + (data ? 0 : 1)}`;
    ui.title.textContent = d.title;
    ui.subtitle.textContent = d.subtitle;
    ui.details.textContent = d.details;
    ui.seed.textContent = `Seed ${c.seed}`;
  }

  function setState(text) {
    ui.state.textContent = text;
  }

  function startProgress(totalSecs) {
    stopProgress();
    const t0 = performance.now();
    ui.total.textContent = fmt(totalSecs);
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const pct = Math.min(100, (elapsed / totalSecs) * 100);
      ui.fill.style.width = pct.toFixed(2) + '%';
      ui.bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      ui.elapsed.textContent = fmt(Math.min(elapsed, totalSecs));
      updateSection(elapsed);
    };
    tick();
    progressTimer = setInterval(tick, 500);
  }

  /** Show the section playing at `elapsed` s ("Variazione III · pizzicato"), with a short fade. */
  function updateSection(elapsed) {
    if (!ui.section) return;
    const t = elapsed - SECTION_LEAD_SECS;
    const sec = sectionTimeline && (sectionTimeline.filter(s => t >= s.atSecs - 0.05).pop() || sectionTimeline[0]);
    const text = sec ? sec.text : '';
    if (text === shownSection) return;
    shownSection = text;
    ui.section.hidden = !text;
    ui.section.classList.add('is-changing');
    setTimeout(() => {
      if (shownSection !== text) return;
      ui.section.textContent = text;
      ui.section.classList.remove('is-changing');
    }, shownSection && ui.section.textContent ? 400 : 0);
  }

  function setSections(articulation) {
    sectionTimeline = articulation && articulation.sections && articulation.sections.length
      ? articulation.sections.map(s => ({ atSecs: s.atSecs, endSecs: s.endSecs, text: s.text }))
      : null;
    shownSection = null;
    if (ui.section) {
      ui.section.textContent = '';
      ui.section.hidden = true;
    }
  }

  function stopProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
  }

  function resetProgress() {
    stopProgress();
    ui.fill.style.width = '0%';
    ui.bar.setAttribute('aria-valuenow', '0');
    ui.elapsed.textContent = '0:00';
    ui.total.textContent = '–:––';
  }

  // ---- The loop ------------------------------------------------------------
  async function loop(myRun) {
    while (active && myRun === runId) {
      let choices = null;
      try {
        choices = randomizeAll();
        resetProgress();
        showCard(choices, null);
        setSections(null);
        setState('Componendo… (composing)');

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
        setSections(result.articulation);
        setState(player.isMidiEnabled() ? 'In esecuzione · MIDI' : 'In esecuzione');
        startProgress(result.durationSecs);

        const natural = await result.finished;
        stopProgress();
        if (!active || myRun !== runId) break;
        if (natural) {
          ui.fill.style.width = '100%';
          setState('Intermezzo…');
        }
        if (!(await sleep(PAUSE_BETWEEN_PIECES_MS, myRun))) break;
      } catch (err) {
        if (!active || myRun !== runId) break;
        failures++;
        const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, failures - 1));
        console.error(`Kiosk: piece ${pieceNo + 1} failed (attempt ${failures}); retrying in ${wait / 1000} s`, err);
        try { player.stopPlayback(); } catch (e) { console.warn('Kiosk: stop after error failed', e); }
        stopProgress();
        setState(`Un momento… (${err && err.message ? err.message : 'error'}) — riprovo tra ${Math.round(wait / 1000)} s`);
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
    stage.hidden = false;
    if (kioskBtn) kioskBtn.setAttribute('aria-pressed', 'true');
    if (exitBtn) exitBtn.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });

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
    stopProgress();
    setSections(null);
    try { player.stopPlayback(); } catch (e) { console.warn('Kiosk: stop failed', e); }
    if (player.setStereoLayout) player.setStereoLayout(null);  // back to the style's default seating
    restoreSeedUi();
    releaseWakeLock();
    exitFullscreenIfOurs();

    document.body.classList.remove('kiosk-on');
    stage.hidden = true;
    if (kioskBtn) {
      kioskBtn.setAttribute('aria-pressed', 'false');
      kioskBtn.focus({ preventScroll: true });
    }
    const status = $('status');
    if (status) status.innerText = 'Kiosk stopped — Ready';
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
