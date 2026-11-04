/**
 * Articulation director: decides how every note of a piece is played (sustain,
 * vibrato, staccato / spiccato, pizzicato, tremolo, and the soloist of a ritornello).
 *
 * Two levels, after Baroque practice:
 *   1. A plan per SECTION (meta.sections from the generator): each variation gets a
 *      character (cantabile, spiccato, pizzicato...), a fugue keeps its subject legato
 *      and detaches its episodes, a ritornello alternates tutti and solo. Without
 *      sections the whole piece gets one character from its form.
 *   2. Inside a section, decisions are made per FIGURE (a run of notes in one voice
 *      without rests, of one rhythmic kind), not per note, so a passage never sounds
 *      patched together: quick runs by step are slurred, quick leaps / broken chords
 *      and repeated notes are detached, a quick bass is détaché, long notes are held.
 * Vibrato is an ornament (as in the period): only long cadential notes, the climax of
 * a fugue subject, and the long notes of a cantabile or a soloist. Tremolo is the
 * rare "stile concitato" (Monteverdi) of a slow variation.
 * Messa di voce (a swell on a long note) is an ornament too: the final chord, the held
 * top note of a cadence, the long notes of a soloist or of a cantabile (see below).
 *
 * The plan is seeded by the piece's seed, so the same seed gives the same articulation.
 * Output: plan(data, opts) -> { profile, arts: [{art, solo, gainMul, slur, tight, swell?}] (one
 * per note, same order as data.notes), sections: [{..., character, text, startBeat, endBeat}] }.
 */
(function () {
  const ORNAMENT_TYPES = new Set([
    'trill', 'trill-resolution', 'mordent', 'mordent-resolution',
    'suspension', 'resolution', 'anticipation', 'appoggiatura', 'neighbor-return',
  ]);
  const THEME_TYPES = new Set(['subject', 'answer', 'countersubject']);
  const ARPEGGIO_TYPES = new Set(['arpeggio', 'arpeggiation', 'octave']);

  /** Profiles of the "Articulation" selector. */
  const PROFILES = {
    auto: 'Auto',
    legato: 'Legato',
    detached: 'Detached',
    pizzicato: 'Pizzicato',
  };

  // Characters a variation may take, by its texture (see planner.js VARIATION_TEXTURES)
  const TEXTURE_CHOICES = {
    chorale: ['cantabile', 'legato'],
    eighths: ['naturale', 'staccato', 'pizzicato-acc'],
    sixteenths: ['legato', 'staccato'],
    long: ['cantabile', 'pizzicato-acc', 'concitato'],
    arpeggio: ['staccato', 'pizzicato', 'legato'],
    dotted: ['staccato', 'naturale'],
  };
  const CHARACTER_WEIGHT = { concitato: 0.35 };  // a rarity

  const FORM_CHARACTER = { Chorale: 'cantabile', Prelude: 'naturale', Suite: 'naturale' };
  const FORM_IT = {
    Chorale: 'Corale', Prelude: 'Preludio', Fugue: 'Fuga', Ritornello: 'Ritornello',
    Variations: 'Variazioni', Suite: 'Suite',
  };

  // ---- Seeded RNG (the player's seed + form) ------------------------------------
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weightedPick(options, rng) {
    const w = options.map(o => CHARACTER_WEIGHT[o] ?? 1);
    let r = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < options.length; i++) {
      r -= w[i];
      if (r <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const roman = (n) => ROMAN[n] || String(n);

  const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(pitch) {
    if (typeof noteToMidi === 'function') return noteToMidi(pitch);
    const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(pitch);
    if (!m) return null;
    const acc = m[2] || '';
    return (parseInt(m[3], 10) + 1) * 12 + NOTE_PC[m[1]] + (acc[0] === '#' ? acc.length : acc[0] === 'b' ? -acc.length : 0);
  }

  // ---- Section plan ----------------------------------------------------------------
  function planSections(data, profile, caps, rng, endBeat) {
    const meta = data.meta || {};
    const form = meta.form || '';
    const src = meta.sections && meta.sections.length
      ? meta.sections
      : [{ kind: 'piece', index: 0, startBeat: 0, endBeat }];
    const sections = src.map(s => ({ ...s }));
    const has = (c) => {
      if (c === 'pizzicato' || c === 'pizzicato-acc') return caps.has('pizzicato');
      if (c === 'concitato') return caps.has('tremolo');
      return true;
    };

    let prev = null;
    const used = new Map();  // character -> times used (variations prefer fresh ones)
    sections.forEach(s => {
      let c;
      switch (s.kind) {
        case 'theme': c = 'cantabile'; break;
        case 'variation': {
          const pool = (TEXTURE_CHOICES[s.texture] || ['naturale']).filter(has);
          const notLast = pool.filter(x => x !== prev);
          const candidates = notLast.length ? notLast : pool;
          const least = Math.min(...candidates.map(x => used.get(x) || 0));
          c = weightedPick(candidates.filter(x => (used.get(x) || 0) === least), rng);
          break;
        }
        case 'episode': c = 'episodio'; break;
        case 'exposition': case 'entry': case 'stretto': case 'final': c = 'fugato'; break;
        case 'cadence': c = 'legato'; break;
        case 'tutti': c = 'tutti'; break;
        case 'solo': c = 'solo'; break;
        default: c = FORM_CHARACTER[form] || 'naturale';
      }
      s.character = c;
      used.set(c, (used.get(c) || 0) + 1);
      prev = c;
    });

    // A set of string variations always gets one pizzicato variation
    const vars = sections.filter(s => s.kind === 'variation');
    if (caps.has('pizzicato') && vars.length >= 3 && !vars.some(s => /^pizzicato/.test(s.character))) {
      const target = vars.find(s => s.texture === 'arpeggio') || vars.find(s => s.texture === 'long') || vars[vars.length - 1];
      target.character = target.texture === 'long' ? 'pizzicato-acc' : 'pizzicato';
    }

    // A fixed profile replaces the characters (the tutti / solo orchestration stays)
    const forced = { legato: 'legato', detached: 'staccato', pizzicato: 'pizzicato' }[profile];
    if (forced) {
      sections.forEach(s => {
        s.soloSection = s.kind === 'solo';
        s.character = forced;
      });
    } else {
      sections.forEach(s => { s.soloSection = s.kind === 'solo'; });
    }
    // Per-section coin for the solo accompaniment (pizzicato bass or not)
    sections.forEach(s => { s.pizzBass = caps.has('pizzicato') && rng() < 0.5; });
    return sections;
  }

  // ---- Figures -------------------------------------------------------------------
  /** Split one voice (sorted notes) into figures: no rests, one rhythmic kind, one section. */
  function figuresOf(voiceNotes, sectionOf, phraseOf, secsPerBeat) {
    const figures = [];
    let cur = null;
    const quick = (n) => n.beats * secsPerBeat < 0.55;
    voiceNotes.forEach((n, i) => {
      const prev = voiceNotes[i - 1];
      const gap = prev ? n.startTime - (prev.startTime + prev.beats) : Infinity;
      const brk = !cur || gap > 0.12 || sectionOf(n) !== sectionOf(prev) || phraseOf(n) !== phraseOf(prev) ||
        quick(n) !== quick(prev);
      if (brk) {
        cur = { notes: [] };
        figures.push(cur);
      }
      cur.notes.push(n);
    });
    figures.forEach(f => {
      const ns = f.notes;
      let steps = 0, leaps = 0, repeats = 0, arps = 0, moves = 0;
      for (let i = 1; i < ns.length; i++) {
        const d = Math.abs(ns[i].midi - ns[i - 1].midi);
        moves++;
        if (d === 0) repeats++;
        else if (d <= 2) steps++;
        else leaps++;
      }
      ns.forEach(n => { if (ARPEGGIO_TYPES.has(n.type)) arps++; });
      f.secs = ns.reduce((s, n) => s + n.beats, 0) / ns.length * secsPerBeat;
      f.step = moves ? steps / moves : 0;
      f.leap = moves ? leaps / moves : 0;
      f.repeat = moves ? repeats / moves : 0;
      f.arp = arps / ns.length;
    });
    return figures;
  }

  /**
   * Baroque default for a figure: 'sustain' or 'staccato'. `coin(kind, p)` is shared by
   * every voice of the same phrase, so a figuration spread over several voices (a broken
   * chord, imitative runs) gets one articulation.
   */
  function naturalFigure(f, voice, coin, crisp) {
    if (f.secs >= 0.55) return 'sustain';
    if (f.notes.length === 1) return voice === 3 && crisp ? 'staccato' : 'sustain';
    // broken chords (also a chord spread over the voices, where each voice repeats its note)
    if (f.arp >= 0.5 && voice !== 3) return coin('leaps', f.secs < 0.3 ? 0.65 : 0.5) ? 'staccato' : 'sustain';
    if (f.repeat >= 0.5) return 'staccato';                                       // repeated notes (drum bass)
    if (voice === 3) return crisp || coin('bass', 0.85) ? 'staccato' : 'sustain';  // détaché bass
    if (f.leap >= 0.5) return coin('leaps', f.secs < 0.3 ? 0.65 : 0.5) ? 'staccato' : 'sustain';
    if (f.step >= 0.6) return coin('steps', 0.25) ? 'staccato' : 'sustain';        // runs by step: slurred
    return coin('mixed', 0.5) ? 'staccato' : 'sustain';
  }

  // ---- The plan --------------------------------------------------------------------
  /**
   * @param {object} data  generator output { notes, meta }
   * @param {object} opts  { profile: 'auto'|'legato'|'detached'|'pizzicato', bpm, seed, caps: [articulations] }
   */
  function plan(data, opts = {}) {
    const profile = PROFILES[opts.profile] ? opts.profile : 'auto';
    const caps = new Set(opts.caps || ['sustain']);
    const secsPerBeat = 60 / (opts.bpm || 120);
    const rng = seeded(`${opts.seed || 'default'}|${(data.meta && data.meta.form) || ''}|articulation`);
    const notes = data.notes.map((n, i) => ({
      ...n, i, beats: n.beats || 1, midi: midiOf(n.pitch), voice: Math.min(Math.max(n.voice, 0), 3),
    }));
    const endBeat = notes.reduce((m, n) => Math.max(m, n.startTime + n.beats), 0);
    const sections = planSections(data, profile, caps, rng, endBeat);
    const sectionIndexAt = (beat) => {
      for (let k = sections.length - 1; k >= 0; k--) if (beat >= sections[k].startBeat - 1e-6) return k;
      return 0;
    };
    const sectionOf = (n) => (n ? sectionIndexAt(n.startTime + 1e-3) : -1);
    // Phrases (4 bars) bound figures too, so a long texture is decided phrase by phrase
    const phraseStarts = ((data.meta && data.meta.phraseMarkers) || []).map(m => m.startBeat).sort((a, b) => a - b);
    const phraseLen = phraseStarts.length > 1 ? phraseStarts[1] - phraseStarts[0] : 16;
    const lastMarked = phraseStarts.length ? phraseStarts[phraseStarts.length - 1] : 0;
    const phraseOf = (n) => {
      if (!n) return -1;
      const t = n.startTime + 1e-3;
      if (t >= lastMarked + phraseLen) return 1000 + Math.floor(t / phraseLen);  // past the markers (variations)
      let k = 0;
      while (k + 1 < phraseStarts.length && t >= phraseStarts[k + 1]) k++;
      return k;
    };

    const arts = notes.map(() => ({ art: 'sustain', solo: false, gainMul: 1 }));
    const coins = new Map();  // "section|phrase|kind" -> detached?
    const byVoice = [[], [], [], []];
    notes.forEach(n => byVoice[n.voice].push(n));
    byVoice.forEach(v => v.sort((a, b) => a.startTime - b.startTime));

    for (let voice = 0; voice < 4; voice++) {
      const figures = figuresOf(byVoice[voice], sectionOf, phraseOf, secsPerBeat);
      figures.forEach(f => {
        const sec = sections[sectionOf(f.notes[0])];
        const where = `${sectionOf(f.notes[0])}|${phraseOf(f.notes[0])}`;
        const coin = (kind, p) => {
          const k = `${where}|${kind}`;
          if (!coins.has(k)) coins.set(k, rng() < p);
          return coins.get(k);
        };
        const c = sec.character;
        const soloist = sec.soloSection && voice === 0;
        let figArt;
        switch (c) {
          case 'legato': case 'cantabile': figArt = 'sustain'; break;
          case 'staccato': figArt = null; break;  // per note below
          case 'pizzicato': figArt = 'pizzicato'; break;
          case 'pizzicato-acc': figArt = voice === 0 ? 'sustain' : 'pizzicato'; break;
          case 'concitato': figArt = (voice === 1 || voice === 2) && f.secs >= 0.45 ? 'tremolo' : naturalFigure(f, voice, coin, false); break;
          case 'solo':
            if (soloist) figArt = naturalFigure(f, voice, coin, false);
            else if (voice === 3 && sec.pizzBass) figArt = 'pizzicato';
            else figArt = f.secs < 0.55 ? 'staccato' : 'sustain';
            break;
          case 'tutti': figArt = naturalFigure(f, voice, coin, true); break;
          default: figArt = naturalFigure(f, voice, coin, false);  // naturale, fugato, episodio
        }
        f.notes.forEach(n => {
          let art = figArt;
          const secs = n.beats * secsPerBeat;
          if (c === 'staccato') art = n.beats <= 1 && secs < 0.9 ? 'staccato' : 'sustain';
          if (c === 'fugato' && THEME_TYPES.has(n.type)) art = 'sustain';           // the subject sings
          if (c === 'episodio' && n.type === 'episode') art = secs < 0.9 ? 'staccato' : 'sustain';  // episodes detached
          if (ORNAMENT_TYPES.has(n.type) && art !== 'pizzicato') art = 'sustain';   // trills, suspensions: slurred
          const a = arts[n.i];
          a.art = art;
          a.solo = soloist;
          if (sec.soloSection && !soloist) a.gainMul = 0.72;  // the ripieno accompanies the soloist (-3 dB)
        });
      });
    }

    // ---- Vibrato: an ornament on long, expressive notes -----------------------------
    const vib = (n, p) => {
      const a = arts[n.i];
      if (a.art === 'sustain' && rng() < p) a.art = 'vibrato';
    };
    const cadenceBeats = new Set();
    ((data.meta && data.meta.phraseMarkers) || []).forEach(m => cadenceBeats.add(m.endBeat));
    sections.forEach(s => cadenceBeats.add(s.endBeat));
    // (onsets carry a few thousandths of a beat of jitter: a whole note at 59.998 still
    // belongs to the cadence at 64)
    const cadenceAt = (n) => {
      const end = n.startTime + n.beats;
      for (const b of cadenceBeats) if (Math.abs(end - b) <= 0.5 && n.startTime >= b - 4 - 0.05) return b;
      return null;
    };
    const nearCadence = (n) => cadenceAt(n) !== null;
    notes.forEach(n => {
      const secs = n.beats * secsPerBeat;
      const sec = sections[sectionOf(n)];
      const isEnd = n.startTime + n.beats >= endBeat - 0.25;
      if (isEnd && secs >= 0.8 && (n.voice === 0 || n.voice === 3)) vib(n, 1);                 // the final chord blooms
      else if (n.voice === 0 && secs >= 0.9 && nearCadence(n)) vib(n, sec.character === 'cantabile' ? 1 : 0.7);
      else if (n.voice === 0 && secs >= 1.6 && sec.character === 'cantabile') vib(n, 0.35);
      else if (arts[n.i].solo && secs >= 0.9) vib(n, 0.8);
    });
    // Climax of each fugue subject / answer entry: its highest note, if long enough
    byVoice.forEach(v => {
      let group = [];
      const flush = () => {
        if (group.length >= 4) {
          const top = group.reduce((a, b) => (b.midi > a.midi ? b : a));
          if (top.beats >= 1 && top.beats * secsPerBeat >= 0.5) vib(top, 1);
        }
        group = [];
      };
      v.forEach((n, k) => {
        const theme = n.type === 'subject' || n.type === 'answer';
        const prev = v[k - 1];
        if (!theme || (prev && n.startTime - (prev.startTime + prev.beats) > 1)) flush();
        if (theme) group.push(n);
      });
      flush();
    });

    // ---- Slurs: a figure under one bow / breath ----------------------------------------
    // A note connected to the previous one, both sustained, that is quick or an
    // ornament (trill, mordent, the resolution of a suspension) is slurred: the player
    // skips the sample's recorded attack, and the previous note releases quickly.
    const SUSTAINED = new Set(['sustain', 'vibrato']);
    byVoice.forEach(v => {
      for (let k = 1; k < v.length; k++) {
        const n = v[k], p = v[k - 1];
        const a = arts[n.i], b = arts[p.i];
        const connected = n.startTime > p.startTime && n.startTime - (p.startTime + p.beats) <= 0.05;
        if (!connected || !SUSTAINED.has(a.art) || !SUSTAINED.has(b.art) || a.solo !== b.solo) continue;
        if (ORNAMENT_TYPES.has(n.type) || n.beats * secsPerBeat < 0.4) {
          a.slur = true;
          b.tight = true;
        }
      }
    });

    // ---- Messa di voce: a long note begun softly, swelled and diminished --------------
    // (Caccini, Tosi, Geminiani's "swelling of the sound"). An ornament, like the vibrato
    // it goes with, so it is placed by context and never on every long note:
    //   - the final chord: every voice together, gently (top voice 4 dB, inner voices
    //     60%, bass 30%), peaking early (30%) and dying away with the piece;
    //   - the held top note of a cadence that carries the cadential vibrato (every
    //     cadence of a cantabile, ~70% elsewhere): 5 dB on a PAC / HC / section end,
    //     3.5 dB on an IAC or an unnamed phrase end, none on a deceptive cadence (it
    //     does not come to rest). On the strong ones the inner voices holding the same
    //     chord swell with it at half depth, peaking at the same moment; the bass stays even;
    //   - a soloist (6 dB): its long cadence notes, and inside a phrase only its longest
    //     (then highest) long note, the phrase's high point; a cantabile top voice
    //     (4 dB): likewise one note per phrase, among the long vibrato notes (>= 1.6 s)
    //     the vibrato rule picked. Alone: the accompaniment stays even under them.
    // Only sustained notes (sustain / vibrato) of at least SWELL_MIN_SECS: a swell needs
    // ~0.5 s to rise and as much to die away to be heard as one and not as an accent
    // (the section strings' recorded attack alone takes ~0.25 s). Up to 2 s the swell is
    // proportionally shallower. Never a slurred note (it continues a figure). No RNG:
    // the vibrato plan above already made the per-cadence choices.
    // arts[i].swell = { depth: dB below the note's level at its start (and end), peak:
    // where it reaches its full level (0..1 of the note), ctx }. The player shapes it
    // (layeredSampler.js); the peak is the note's normal level, never above.
    const SWELL_MIN_SECS = 1.2;
    const CADENCE_DEPTH = { PAC: 5, HC: 5, PHC: 5, IAC: 3.5, DC: 0 };
    const cadenceType = new Map();  // cadence beat -> PAC / HC / IAC / DC / 'section' / ''
    ((data.meta && data.meta.phraseMarkers) || []).forEach(m => cadenceType.set(m.endBeat, m.cadence || ''));
    sections.forEach(s => { if (!cadenceType.get(s.endBeat)) cadenceType.set(s.endBeat, 'section'); });
    const cadenceDepth = (b) => {
      const t = cadenceType.get(b);
      return t === 'section' ? 5 : (CADENCE_DEPTH[t] ?? 3.5);
    };
    const swellable = (n) => {
      const a = arts[n.i];
      return SUSTAINED.has(a.art) && !a.slur && n.beats * secsPerBeat >= SWELL_MIN_SECS;
    };
    const lengthScale = (n) => Math.min(1, Math.max(0.6, n.beats * secsPerBeat / 2));
    const round1 = (x) => Math.round(x * 10) / 10;
    const setSwell = (n, depth, peakBeat, ctx) => {
      const d = round1(depth * lengthScale(n));
      if (!(d >= 0.5)) return;
      // the peak at an absolute moment (beats), so the voices of a chord swell together
      const peak = Math.min(0.85, Math.max(0.15, (peakBeat - n.startTime) / n.beats));
      arts[n.i].swell = { depth: d, peak: Math.round(peak * 100) / 100, ctx };
    };
    const INNER = { 1: 1, 2: 1 };
    // Final chord: the last long note of each voice
    const finals = notes.filter(n => n.startTime + n.beats >= endBeat - 0.25 && swellable(n));
    if (finals.length) {
      const top = finals.find(n => n.voice === 0);
      const chordStart = top ? top.startTime : Math.min(...finals.map(n => n.startTime));
      const peakBeat = chordStart + (endBeat - chordStart) * 0.3;
      finals.forEach(n => setSwell(n, 4 * (n.voice === 0 ? 1 : n.voice === 3 ? 0.3 : 0.6), peakBeat, 'final'));
    }
    // Cadences, soloists, cantabile
    const inPhrase = new Map();  // "section|phrase" -> the best mid-phrase candidate
    notes.forEach(n => {
      if (n.voice !== 0 || arts[n.i].swell || !swellable(n)) return;
      const a = arts[n.i];
      const sec = sections[sectionOf(n)];
      const b = cadenceAt(n);
      if (a.solo && b !== null) {
        setSwell(n, 6, n.startTime + n.beats * 0.45, 'solo');
      } else if (a.solo || (b === null && sec.character === 'cantabile' && a.art === 'vibrato' &&
          n.beats * secsPerBeat >= 1.6)) {
        // inside a phrase only its longest (then highest) such note: its high point
        const k = `${sectionOf(n)}|${phraseOf(n)}`;
        const best = inPhrase.get(k);
        if (!best || n.beats > best.beats || (n.beats === best.beats && n.midi > best.midi)) inPhrase.set(k, n);
      } else if (b !== null && a.art === 'vibrato') {
        const depth = cadenceDepth(b);
        if (!(depth > 0)) return;
        const peakBeat = n.startTime + n.beats * 0.4;
        setSwell(n, depth, peakBeat, 'cadence');
        // on a full close the inner voices holding the chord breathe with the top voice
        if (depth < 5) return;
        notes.forEach(m => {
          if (!INNER[m.voice] || arts[m.i].swell || arts[m.i].solo || !swellable(m)) return;
          if (Math.abs(m.startTime - n.startTime) > 0.5 || cadenceAt(m) !== b) return;
          setSwell(m, depth * 0.5, peakBeat, 'cadence-inner');
        });
      }
    });
    inPhrase.forEach(n => {
      if (arts[n.i].solo) setSwell(n, 6, n.startTime + n.beats * 0.45, 'solo');
      else setSwell(n, 4, n.startTime + n.beats * 0.5, 'cantabile');
    });

    // ---- Labels ------------------------------------------------------------------
    const form = (data.meta && data.meta.form) || '';
    sections.forEach(s => {
      s.characterLabel = characterLabel(s.character, caps);
      s.label = sectionLabel(s, form);
      s.text = s.kind === 'tutti' || s.kind === 'solo'
        ? `${s.label} · ${s.kind === 'solo' ? (caps.has('solo') ? 'violino solo' : 'solo') : 'tutti'}` +
          (profile !== 'auto' ? ` · ${s.characterLabel}` : '')
        : `${s.label} · ${s.characterLabel}`;
    });

    const summary = {};
    arts.forEach(a => {
      const k = a.solo ? `solo.${a.art}` : a.art;
      summary[k] = (summary[k] || 0) + 1;
      if (a.slur) summary.slurred = (summary.slurred || 0) + 1;
      if (a.swell) summary.swelled = (summary.swelled || 0) + 1;
    });
    return { profile, arts, sections, summary };
  }

  function characterLabel(c, caps) {
    const strings = caps.has('pizzicato');
    switch (c) {
      case 'staccato': case 'episodio': return strings ? 'spiccato' : 'staccato';
      case 'pizzicato': return strings ? 'pizzicato' : 'staccato';
      case 'pizzicato-acc': return 'arco e pizzicato';
      case 'concitato': return 'stile concitato';
      case 'fugato': return 'legato';
      default: return c;  // cantabile, legato, naturale, solo
    }
  }

  function sectionLabel(s, form) {
    switch (s.kind) {
      case 'theme': return 'Tema';
      case 'variation': return `Variazione ${roman(s.index)}`;
      case 'exposition': return 'Esposizione';
      case 'episode': return 'Divertimento';
      case 'entry': return 'Entrata';
      case 'stretto': return 'Stretto';
      case 'final': return 'Entrata finale';
      case 'cadence': return 'Cadenza';
      case 'tutti': return 'Ritornello';
      case 'solo': return 'Episodio';
      default: return FORM_IT[form] || form || 'Pezzo';
    }
  }

  window.BachArticulation = { plan, PROFILES };
})();
