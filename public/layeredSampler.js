/**
 * Velocity-layered sampler for the VSCO 2 CE samples indexed by carrilion.
 *
 * Same surface as the Tone.Sampler the player uses (triggerAttackRelease,
 * releaseAll, connect, disconnect, dispose), plus:
 *   - per-note velocity layers: the layer whose [lovel, hivel] range holds the
 *     note's MIDI velocity replaces the main sample (pick_layer, as in carrilion),
 *   - per-sample gain (dB) from the catalog: carrilion normalizes the layers to
 *     the same level, so the layer gives the TIMBRE and the player's velocity
 *     gain curve gives the LOUDNESS,
 *   - lazy loading: only the files a given piece needs are fetched (prepare()).
 *
 * Decoded buffers are shared by all samplers through a small LRU cache, so the
 * kiosk does not refetch the same files piece after piece.
 */
(function () {
  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /** "C#4" / "Bb2" / "E#3" / "Cbb4" → MIDI number, or null. */
  function noteToMidi(name) {
    const m = /^([A-Ga-g])(#{1,2}|b{1,2}|x)?(-?\d+)$/.exec(String(name).trim());
    if (!m) return null;
    let pc = NOTE_INDEX[m[1].toUpperCase()];
    const acc = m[2] || '';
    if (acc === 'x') pc += 2;
    else if (acc[0] === '#') pc += acc.length;
    else if (acc[0] === 'b') pc -= acc.length;
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  }

  /** The layer whose velocity range holds `velocity`; in a gap (or past an end) the closest. */
  function pickLayer(layers, velocity) {
    for (let i = 0; i < layers.length; i++) {
      if (velocity <= layers[i].hivel) {
        if (velocity >= layers[i].lovel || i === 0) return layers[i];
        return (layers[i].lovel - velocity) < (velocity - layers[i - 1].hivel) ? layers[i] : layers[i - 1];
      }
    }
    return layers[layers.length - 1];
  }

  // ---- Shared buffer cache (LRU on decoded AudioBuffers) ----------------------
  const CACHE_MAX = 400;  // decoded files kept across pieces (~1–2 MB each)
  const cache = new Map();  // url -> Promise<AudioBuffer>

  function loadBuffer(url) {
    if (cache.has(url)) {
      const p = cache.get(url);
      cache.delete(url);  // refresh LRU position
      cache.set(url, p);
      return p;
    }
    const p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.arrayBuffer();
      })
      .then(data => Tone.getContext().rawContext.decodeAudioData(data));
    p.catch(() => cache.delete(url));  // let a failed file be retried later
    cache.set(url, p);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  }

  // ---- Recorded attack of a sample (for slurred notes) --------------------------
  const SLUR_FADE = 0.012;     // fade-in of a slurred note (s)
  const TIGHT_RELEASE = 0.06;  // release of a note followed by a slurred one (s)
  const QUICK_NOTE = 0.45;     // notes shorter than this (s) skip half of a slow attack
  const attackCache = new WeakMap();  // AudioBuffer -> seconds

  // ---- Messa di voce (swell on a long note, articulation.js) ------------------------
  const SWELL_MAX_DB = 9;        // deepest start / end below the note's level
  const SWELL_MIN_NOTE = 0.8;    // a note shorter than this (s, as played) is not swelled

  /**
   * The swell of a note, or null: { lo, hi: linear factors at start and end (<= 1),
   * peakAt: seconds after the attack }. `span` = seconds from the end of the attack to
   * the release. A note followed by a slurred one (tight) diminishes only half as much,
   * so the slurred note does not jump back up to full level.
   */
  function swellShape(swell, span, tight) {
    if (!swell || !(span >= SWELL_MIN_NOTE)) return null;
    const depth = Math.min(SWELL_MAX_DB, Number(swell.depth));
    const peak = Math.min(0.85, Math.max(0.15, Number(swell.peak)));
    if (!(depth >= 0.3) || !Number.isFinite(peak)) return null;
    const lo = Math.pow(10, -depth / 20);
    const hi = Math.pow(10, -(tight ? depth / 2 : depth) / 20);
    return { lo, hi, peakAt: span * peak };
  }

  /**
   * Where the recorded attack ends: the first 10 ms window whose RMS reaches half
   * (-6 dB) of the loudest window in the first 1.5 s, capped at 0.3 s.
   */
  function attackOffset(buffer) {
    if (attackCache.has(buffer)) return attackCache.get(buffer);
    const data = buffer.getChannelData(0);
    const win = Math.max(1, Math.round(buffer.sampleRate * 0.01));
    const limit = Math.min(data.length, Math.round(buffer.sampleRate * 1.5));
    const rms = [];
    for (let i = 0; i + win <= limit; i += win) {
      let s = 0;
      for (let j = i; j < i + win; j++) s += data[j] * data[j];
      rms.push(Math.sqrt(s / win));
    }
    const peak = Math.max(0, ...rms);
    let k = rms.findIndex(r => r >= peak * 0.5);
    if (k < 0) k = 0;
    const secs = Math.min(0.3, Math.max(0, k * 0.01 - 0.005));
    attackCache.set(buffer, secs);
    return secs;
  }

  // ---- Round robins: level of each take ------------------------------------------
  // The catalog's gain was measured on the main take; another take of the same note
  // can be louder or softer. Each take is matched to the main one by its peak RMS
  // over 100 ms (the measure the articulation levels were calibrated with). A take
  // more than 6 dB away was really played at another dynamic (VSCO pizz: 8 of 70
  // pairs, up to 13 dB): its timbre would not match even at the same level, so it is
  // left out of the round robin.
  const levelCache = new WeakMap();  // AudioBuffer -> peak 100 ms RMS (first 2 s)
  const TAKE_MATCH_LIMIT = 2;        // takes within ±6 dB of the main one are used
  let roundRobinsOn = true;          // off only for A/B checks (setRoundRobins)

  function peakRms(buffer) {
    if (levelCache.has(buffer)) return levelCache.get(buffer);
    // Measured on the mono sum: the player's panners fold each sample to mono, and the
    // stereo section takes differ more per channel than in the sum
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const block = Math.max(1, Math.round(buffer.sampleRate * 0.01));
    const limit = Math.min(left.length, Math.round(buffer.sampleRate * 2));
    const sums = [];
    for (let i = 0; i + block <= limit; i += block) {
      let s = 0;
      for (let j = i; j < i + block; j++) {
        const m = (left[j] + right[j]) * 0.5;
        s += m * m;
      }
      sums.push(s);
    }
    let peak = 0;
    for (let k = 0; k < sums.length; k++) {
      let s = 0;
      const n = Math.min(10, sums.length - k);
      for (let j = 0; j < n; j++) s += sums[k + j];
      peak = Math.max(peak, Math.sqrt(s / (n * block)));
    }
    levelCache.set(buffer, peak);
    return peak;
  }

  // ---- Articulation maps (fetched once per instrument/articulation) -------------
  const articulationCache = new Map();

  function fetchArticulation(instrument, articulation) {
    const key = `${instrument}|${articulation}`;
    if (!articulationCache.has(key)) {
      const q = `instrument=${encodeURIComponent(instrument)}&articulation=${encodeURIComponent(articulation)}`;
      const p = fetch(`/api/vsco/articulation?${q}`).then(r => {
        if (!r.ok) throw new Error(`VSCO ${instrument} / ${articulation}: ${r.status}`);
        return r.json();
      });
      p.catch(() => articulationCache.delete(key));
      articulationCache.set(key, p);
    }
    return articulationCache.get(key);
  }

  let vscoStatus = null;
  /** Whether the server can serve the VSCO samples (cached). */
  function isVscoAvailable() {
    if (!vscoStatus) {
      vscoStatus = fetch('/api/vsco/status')
        .then(r => (r.ok ? r.json() : { available: false }))
        .then(s => !!s.available)
        .catch(() => false);
    }
    return vscoStatus;
  }

  class LayeredSampler {
    /**
     * @param {object} detail  { baseUrl, samples: {note: {path, root, gain}}, velocity: {note: [layers]} }
     * @param {object} [opts]  { attack (s), release (s), trimDb, layerCenter, layerSpread,
     *                          natural: play each sample to its own end, whatever the
     *                          written length (staccato / spiccato / pizzicato) }
     */
    constructor(detail, opts = {}) {
      this.baseUrl = detail.baseUrl;
      this.attack = opts.attack ?? 0.006;
      this.release = opts.release ?? 0.3;
      this.trim = Math.pow(10, (opts.trimDb ?? 0) / 20);
      // The generator's velocities sit in a narrow band (~60–110), which would keep a
      // piano on its mf layer for the whole piece. For CHOOSING the layer only, they
      // are spread around `center` by `spread` (82 / 1.9: 60 → 22, 82 → 64, 100 → 98,
      // 110 → 117). Loudness still follows the original velocity (the player's gain).
      this.layerCenter = opts.layerCenter ?? 82;
      this.layerSpread = opts.layerSpread ?? 1.9;
      this.natural = !!opts.natural;
      // Recorded sustain before the sample's own decay (s, at the root pitch): a longer
      // note is cut there with the normal release, instead of fading with the recording
      // (organ pipes hold as long as the key is down; their samples do not)
      this.sustainSecs = opts.sustainSecs > 0 ? opts.sustainSecs : null;
      this.buffers = new Map();   // path -> AudioBuffer (files prepared for this sampler)
      this.rr = new Map();        // main path -> { takes: [paths], next } (round robins in use)
      this.takeGain = new Map();  // alternate take path -> linear level match to the main take
      this.rrCounts = {};         // take index -> notes played (for checks)
      this.active = new Set();    // { source, gain } of sounding / scheduled notes
      this.disposed = false;

      // midi -> { main, layers } from the catalog's per-note entries
      this.zones = new Map();
      for (const [name, sample] of Object.entries(detail.samples || {})) {
        const midi = noteToMidi(name);
        if (midi === null || !sample || !sample.path) continue;
        const layers = (detail.velocity && detail.velocity[name]) || null;
        this.zones.set(midi, {
          main: sample,
          layers: layers && layers.length ? [...layers].sort((a, b) => a.lovel - b.lovel) : null,
        });
      }
      this.zoneKeys = [...this.zones.keys()].sort((a, b) => a - b);

      const raw = Tone.getContext().rawContext;
      this.output = raw.createGain();
    }

    /** The zone for a MIDI note: exact, else the nearest mapped note. */
    zoneFor(midi) {
      if (this.zones.has(midi)) return this.zones.get(midi);
      let best = null;
      let bestDist = Infinity;
      for (const k of this.zoneKeys) {
        const d = Math.abs(k - midi);
        if (d < bestDist) { bestDist = d; best = k; }
      }
      return best === null ? null : this.zones.get(best);
    }

    /** Whether the sampled range reaches `midi` (within `tolerance` semitones of its ends). */
    covers(midi, tolerance = 2) {
      if (!this.zoneKeys.length) return false;
      return midi >= this.zoneKeys[0] - tolerance && midi <= this.zoneKeys[this.zoneKeys.length - 1] + tolerance;
    }

    /** Velocity used to pick the layer (see layerCenter / layerSpread). */
    layerVelocity(velocity) {
      const v = this.layerCenter + (velocity - this.layerCenter) * this.layerSpread;
      return Math.max(1, Math.min(127, Math.round(v)));
    }

    /** The catalog sample {path, root, gain} for a note at a MIDI velocity. */
    sampleFor(midi, velocity) {
      const zone = this.zoneFor(midi);
      if (!zone) return null;
      return zone.layers ? pickLayer(zone.layers, this.layerVelocity(velocity)) : zone.main;
    }

    /**
     * Fetch and decode the files needed for these notes ([{pitch, velocity}]).
     * Without notes, every file of the articulation is loaded.
     */
    async prepare(notes) {
      const paths = new Set();
      const rrSamples = new Map();  // main path -> sample entry, for the round robins
      if (notes && notes.length) {
        // In time order, to find the notes played again right after themselves
        const ordered = notes.map((n, i) => ({ n, i }))
          .sort((a, b) => ((a.n.startTime ?? a.i) - (b.n.startTime ?? b.i)) || (a.i - b.i));
        let prev = null;
        for (const { n } of ordered) {
          const midi = noteToMidi(n.pitch);
          if (midi === null) continue;
          const s = this.sampleFor(midi, n.velocity ?? 90);
          if (!s) continue;
          paths.add(s.path);
          // Round robins where the same recording would be heard twice in a row:
          // every short (natural) sample, and repeated notes of sustained ones
          if (roundRobinsOn && s.alts && s.alts.length && (this.natural || (prev && prev.path === s.path))) rrSamples.set(s.path, s);
          prev = s;
        }
      } else {
        for (const z of this.zones.values()) {
          paths.add(z.main.path);
          if (z.layers) z.layers.forEach(l => paths.add(l.path));
        }
      }
      const altPaths = new Set();
      rrSamples.forEach(s => s.alts.forEach(a => { if (!paths.has(a)) altPaths.add(a); }));
      const load = async p => {
        const buf = await loadBuffer(this.baseUrl + p.split('/').map(encodeURIComponent).join('/'));
        this.buffers.set(p, buf);
        if (!this.natural) attackOffset(buf);  // measured now, not while scheduling
        return buf;
      };
      await Promise.all([...paths].map(load));
      // A missing alternate take only costs its round robin, never the note
      await Promise.all([...altPaths].map(p => load(p).catch(err => {
        console.warn(`VSCO round robin unavailable (${p}): ${err.message}`);
      })));
      rrSamples.forEach((s, main) => {
        const mainBuf = this.buffers.get(main);
        const takes = [main];
        for (const a of s.alts) {
          const buf = this.buffers.get(a);
          if (!buf) continue;
          const ref = peakRms(mainBuf);
          const lvl = peakRms(buf);
          const match = ref > 0 && lvl > 0 ? ref / lvl : 0;
          if (!(match >= 1 / TAKE_MATCH_LIMIT && match <= TAKE_MATCH_LIMIT)) {
            this.rejectedTakes = (this.rejectedTakes || 0) + 1;
            continue;
          }
          this.takeGain.set(a, match);
          takes.push(a);
        }
        if (takes.length > 1) this.rr.set(main, { takes, next: 0 });
      });
      return paths.size + altPaths.size;
    }

    /** The take (path) to play for a catalog sample: alternates the round robins in use. */
    takeFor(sample) {
      const rr = this.rr.get(sample.path);
      if (!rr) return sample.path;
      const i = rr.next;
      rr.next = (i + 1) % rr.takes.length;
      this.rrCounts[i] = (this.rrCounts[i] || 0) + 1;
      return rr.takes[i];
    }

    /**
     * Play a note. `gain` is the player's velocity gain (linear); `velocity` the
     * MIDI velocity (1–127) used to choose the layer. `phrasing`:
     *   slur  – the note continues a slurred figure (trill, mordent, quick legato run):
     *           the sample starts after its recorded attack, with a short fade-in, as a
     *           note changed under one bow / breath is not attacked again;
     *   tight – a slurred note follows: release quickly, so two pitches do not blur;
     *   keyboard – a struck instrument: always its full attack, and no swell;
     *   swell – messa di voce {depth dB, peak 0..1}: the note starts `depth` dB under its
     *           level, reaches it at `peak` of its length and diminishes again before
     *           the release (exponential ramps: even in dB). Never above the level, so
     *           peaks and the limiter are unchanged. Not on keyboards, the organ
     *           (sustainSecs) or short (natural) samples.
     * Returns true when the note was swelled.
     */
    triggerAttackRelease(pitch, duration, time, gain = 1, velocity = 90, phrasing = null) {
      if (this.disposed) return;
      const midi = noteToMidi(pitch);
      if (midi === null) throw new Error(`Bad pitch ${pitch}`);
      const sample = this.sampleFor(midi, velocity);
      if (!sample) return;
      const take = this.takeFor(sample);
      const buffer = this.buffers.get(take);
      if (!buffer) return;  // not prepared (should not happen): skip rather than stall

      const raw = Tone.getContext().rawContext;
      const start = Math.max(time, raw.currentTime);
      const level = gain * this.trim * (sample.gain ? Math.pow(10, sample.gain / 20) : 1)
        * (this.takeGain.get(take) ?? 1);
      const rate = Math.pow(2, (midi - (sample.root ?? midi)) / 12);
      // Short articulations sound their own recorded length (attack, decay and room)
      const slur = !!(phrasing && phrasing.slur) && !this.natural;
      // A quick note that is not slurred still cannot wait for a slow recorded attack
      // (section violins: ~0.25 s): it starts halfway into it. Long notes keep theirs.
      const quick = !slur && !this.natural && duration < QUICK_NOTE && !(phrasing && phrasing.keyboard);
      const offset = slur ? attackOffset(buffer) : quick ? attackOffset(buffer) * 0.5 : 0;
      const attack = offset > 0 ? Math.max(this.attack, SLUR_FADE) : this.attack;
      const release = phrasing && phrasing.tight && !this.natural ? Math.min(this.release, TIGHT_RELEASE) : this.release;
      let length = this.natural ? buffer.duration / rate - this.release : duration;
      if (this.sustainSecs && !this.natural) length = Math.min(length, this.sustainSecs / rate - offset);
      const end = start + Math.max(0.02, length);

      const source = raw.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;

      const env = raw.createGain();
      const canSwell = !this.natural && !this.sustainSecs && !(phrasing && phrasing.keyboard) && level > 0 && Number.isFinite(level);
      const sw = canSwell && phrasing && phrasing.swell ? swellShape(phrasing.swell, end - (start + attack), phrasing.tight) : null;
      env.gain.setValueAtTime(0, start);
      if (sw) {
        // soft start -> full level at the peak -> diminuendo, then the usual release
        const peakTime = start + attack + sw.peakAt;
        env.gain.linearRampToValueAtTime(level * sw.lo, start + attack);
        env.gain.exponentialRampToValueAtTime(level, peakTime);
        env.gain.exponentialRampToValueAtTime(level * sw.hi, end);
      } else {
        env.gain.linearRampToValueAtTime(level, start + attack);
        env.gain.setValueAtTime(level, end);
      }
      env.gain.setTargetAtTime(0, end, release / 4);

      source.connect(env);
      env.connect(this.output);
      source.start(start, Math.min(offset, buffer.duration * 0.5));
      source.stop(end + release * 1.5);

      const voice = { source, env };
      this.active.add(voice);
      source.onended = () => {
        this.active.delete(voice);
        try { env.disconnect(); } catch (e) { /* already gone */ }
      };
      return !!sw;
    }

    /** Fade out and stop every sounding or scheduled note. */
    releaseAll(time) {
      const raw = Tone.getContext().rawContext;
      const t = Math.max(time ?? raw.currentTime, raw.currentTime);
      this.active.forEach(({ source, env }) => {
        try {
          // Hold the value reached at t: cancelling in the middle of a long ramp (a
          // swell) would snap the gain back to the ramp's start value, a click
          if (typeof env.gain.cancelAndHoldAtTime === 'function') env.gain.cancelAndHoldAtTime(t);
          else env.gain.cancelScheduledValues(t);
          env.gain.setTargetAtTime(0, t, 0.03);
          source.stop(t + 0.15);
        } catch (e) { /* not started yet or already stopped */ }
      });
    }

    connect(destination) {
      Tone.connect(this.output, destination);
      return this;
    }

    disconnect() {
      try { this.output.disconnect(); } catch (e) { /* not connected */ }
      return this;
    }

    dispose() {
      this.releaseAll();
      this.disposed = true;
      // Let the short fade finish before cutting the output
      setTimeout(() => this.disconnect(), 250);
      this.buffers.clear();
      this.rr.clear();
      return this;
    }
  }

  // ---- Several articulations per voice -------------------------------------------
  // Fallback chains: the first articulation the voice has (and whose range reaches
  // the note) is used. 'short' = the sustained sample cut short (a detached note on an
  // instrument without short samples, e.g. the piano).
  const FALLBACK = {
    sustain: ['sustain'],
    vibrato: ['vibrato', 'sustain'],
    staccato: ['staccato', 'short'],
    pizzicato: ['pizzicato', 'staccato', 'short'],
    tremolo: ['tremolo', 'sustain'],
    short: ['short'],
  };
  // A soloist without a solo instrument plays its sustained notes with vibrato
  const SOLO_FALLBACK = { sustain: ['sustain', 'vibrato'], vibrato: ['sustain', 'vibrato'] };
  // Articulations whose samples are played to their natural end
  const NATURAL = new Set(['staccato', 'pizzicato']);

  /** Length of a detached note made by cutting a sustained sample (s). */
  function shortLength(duration) {
    return Math.min(duration, Math.max(0.07, Math.min(0.3, duration * 0.5)));
  }

  /**
   * One voice of a VSCO style with all its articulations: a LayeredSampler per
   * articulation, created (and its files loaded) only for the articulations the
   * piece actually uses. triggerAttackRelease takes as 6th argument the articulation
   * name, or { art, solo, slur, tight, swell } (see LayeredSampler.triggerAttackRelease).
   */
  class ArticulatedSampler {
    /**
     * @param {object} part   style.vsco[i]: { instrument, articulation, arts: {name: spec, solo: {name: spec}} }
     * @param {object} style  the style preset (attack, release, trimDb, layer options)
     */
    constructor(part, style) {
      this.style = style;
      const arts = part.arts || {};
      this.specs = { sustain: { instrument: part.instrument, articulation: part.articulation, trimDb: part.trimDb } };
      for (const [name, spec] of Object.entries(arts)) {
        if (name !== 'solo') this.specs[name] = spec;
      }
      for (const [name, spec] of Object.entries(arts.solo || {})) this.specs[`solo.${name}`] = spec;
      this.samplers = new Map();  // spec key -> LayeredSampler (only the used ones are kept)
      this.resolved = new Map();  // "art|solo|midi" -> { key, short }
      this.counts = {};           // resolved articulation -> notes played (for checks)
      this.loaded = {};           // spec key -> files loaded
      this.output = Tone.getContext().rawContext.createGain();
      this.disposed = false;
    }

    /** Build (map only, no audio files) the samplers of these spec keys. */
    async ensureSamplers(keys) {
      const missing = [...keys].filter(k => this.specs[k] && !this.samplers.has(k));
      const details = await Promise.all(missing.map(k =>
        fetchArticulation(this.specs[k].instrument, this.specs[k].articulation).catch(err => {
          console.warn(`VSCO articulation unavailable (${k}): ${err.message}`);
          return null;
        })));
      missing.forEach((k, i) => {
        if (!details[i]) return;
        const spec = this.specs[k];
        const artName = k.replace(/^solo\./, '');
        this.samplers.set(k, new LayeredSampler(details[i], {
          attack: spec.attack ?? this.style.attack,
          release: spec.release ?? this.style.release,
          trimDb: (this.style.trimDb ?? 0) + (spec.trimDb ?? 0),
          layerCenter: this.style.layerCenter,
          layerSpread: this.style.layerSpread,
          natural: NATURAL.has(artName),
        }));
      });
    }

    /** Ordered spec keys tried for an articulation ('short' = cut sustain). */
    chain(art, solo) {
      const base = FALLBACK[art] || FALLBACK.sustain;
      const tries = [];
      if (solo) (SOLO_FALLBACK[art] || base).forEach(a => { if (a !== 'short') tries.push(`solo.${a}`); });
      tries.push(...base);
      return tries;
    }

    /** { key, short } that will play a note: the first articulation of the chain that reaches it. */
    resolve(art = 'sustain', solo = false, midi) {
      const id = `${art}|${solo ? 1 : 0}|${midi}`;
      if (this.resolved.has(id)) return this.resolved.get(id);
      let result = { key: 'sustain', short: false };
      for (const k of this.chain(art, solo)) {
        if (k === 'short') { result = { key: 'sustain', short: true }; break; }
        const s = this.samplers.get(k);
        if (s && s.covers(midi)) { result = { key: k, short: false }; break; }
      }
      this.resolved.set(id, result);
      return result;
    }

    /**
     * Load the maps of the articulations these notes ([{pitch, velocity, art, solo}])
     * may use, then only the audio files of the resolved articulation x note x layer.
     */
    async prepare(notes) {
      const all = notes && notes.length ? notes : [];
      const keys = new Set(['sustain']);
      new Set(all.map(n => `${n.art || 'sustain'}|${n.solo ? 1 : 0}`)).forEach(p => {
        const [art, solo] = p.split('|');
        this.chain(art, solo === '1').forEach(k => keys.add(k === 'short' ? 'sustain' : k));
      });
      await this.ensureSamplers(keys);
      if (!this.samplers.has('sustain')) throw new Error('sustained articulation unavailable');

      const groups = new Map();  // key -> notes
      for (const n of all) {
        const midi = noteToMidi(n.pitch);
        if (midi === null) continue;
        const { key } = this.resolve(n.art, n.solo, midi);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(n);
      }
      // Keep only the samplers something resolved to (the maps stay cached)
      for (const k of [...this.samplers.keys()]) {
        if (k !== 'sustain' && !groups.has(k)) this.samplers.delete(k);
      }
      let files = 0;
      await Promise.all([...this.samplers.entries()].map(async ([k, s]) => {
        const group = groups.get(k);
        const count = await s.prepare(group && group.length ? group : (all.length ? [all[0]] : null));
        this.loaded[k] = count;
        files += count;
        s.output.connect(this.output);
      }));
      return files;
    }

    triggerAttackRelease(pitch, duration, time, gain = 1, velocity = 90, play = 'sustain') {
      if (this.disposed) return;
      const p = typeof play === 'string' ? { art: play } : { ...(play || {}) };
      if (this.style.keyboard) {
        p.slur = p.tight = false;  // a hammer always strikes
        p.swell = null;            // and a struck note cannot swell
      }
      const art = p.art || 'sustain';
      const solo = !!p.solo;
      const midi = noteToMidi(pitch);
      if (midi === null) throw new Error(`Bad pitch ${pitch}`);
      const r = this.resolve(art, solo, midi);
      const sampler = this.samplers.get(r.key) || this.samplers.get('sustain');
      if (!sampler) return;
      const label = r.short ? 'short' : r.key;
      this.counts[label] = (this.counts[label] || 0) + 1;
      if (p.slur && !r.short && !sampler.natural) this.counts.slurred = (this.counts.slurred || 0) + 1;
      // A swell only on a sustained sample (not on a cut 'short' note nor a natural one)
      const swell = p.swell && !r.short && !sampler.natural ? p.swell : null;
      const swelled = sampler.triggerAttackRelease(pitch, r.short ? shortLength(duration) : duration, time, gain, velocity,
        r.short ? { keyboard: !!this.style.keyboard } : { slur: p.slur, tight: p.tight, keyboard: !!this.style.keyboard, swell });
      if (swelled === true) this.counts.swelled = (this.counts.swelled || 0) + 1;
      return swelled === true;
    }

    releaseAll(time) {
      this.samplers.forEach(s => s.releaseAll(time));
    }

    /** Round robins per articulation: { key: { samples, takes: {index: notes}, gainsDb } } (for checks). */
    roundRobinStats() {
      const out = {};
      this.samplers.forEach((s, k) => {
        if (!s.rr.size && !Object.keys(s.rrCounts).length && !s.rejectedTakes) return;
        out[k] = {
          samples: s.rr.size,
          rejected: s.rejectedTakes || 0,
          takes: { ...s.rrCounts },
          gainsDb: [...s.takeGain.values()].map(g => Math.round(200 * Math.log10(g)) / 10),
        };
      });
      return out;
    }

    connect(destination) {
      Tone.connect(this.output, destination);
      return this;
    }

    disconnect() {
      try { this.output.disconnect(); } catch (e) { /* not connected */ }
      return this;
    }

    dispose() {
      this.disposed = true;
      this.samplers.forEach(s => s.dispose());
      setTimeout(() => this.disconnect(), 250);
      return this;
    }
  }

  /** The four articulated samplers of a VSCO style (no files yet: call prepare(notes)). */
  async function createLayeredStyleSamplers(style) {
    return style.vsco.map(part => new ArticulatedSampler(part, style));
  }

  /**
   * The continuo organ of a VSCO style (style.continuo), or null if the style has
   * none or the stop is unavailable. No files yet: call prepare(notes).
   */
  async function createContinuoSampler(style) {
    const spec = style && style.engine === 'vsco' ? style.continuo : null;
    if (!spec) return null;
    const detail = await fetchArticulation(spec.instrument, spec.articulation).catch(err => {
      console.warn(`VSCO continuo unavailable (${spec.instrument} / ${spec.articulation}): ${err.message}`);
      return null;
    });
    if (!detail) return null;
    return new LayeredSampler(detail, {
      attack: spec.attack ?? 0.006,
      release: spec.release ?? 0.12,
      trimDb: (style.trimDb ?? 0) + (spec.trimDb ?? 0),
      sustainSecs: spec.sustainSecs,
    });
  }

  /**
   * Articulations a style really plays (for the articulation plan and its labels):
   * those every voice has, plus 'solo' if any voice has a solo instrument.
   */
  function styleArticulations(style) {
    if (!style || style.engine !== 'vsco') return ['sustain'];
    const sets = style.vsco.map(p => new Set(['sustain', ...Object.keys(p.arts || {})]));
    const all = [...sets[0]].filter(a => a !== 'solo' && sets.every(s => s.has(a)));
    if (sets.some(s => s.has('solo'))) all.push('solo');
    return all;
  }

  window.LayeredSampler = LayeredSampler;
  window.ArticulatedSampler = ArticulatedSampler;
  window.styleArticulations = styleArticulations;
  window.shortArticulationLength = shortLength;
  window.sampleAttackOffset = attackOffset;  // for checks
  window.setRoundRobins = on => { roundRobinsOn = !!on; };  // for A/B checks (next piece)
  window.createLayeredStyleSamplers = createLayeredStyleSamplers;
  window.createContinuoSampler = createContinuoSampler;
  window.isVscoAvailable = isVscoAvailable;
  window.noteToMidi = noteToMidi;
})();
