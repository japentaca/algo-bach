/**
 * Score (partitura): the four voices of the piece as one long horizontal system
 * (barroco estocástico's scrolling parchment), rendered once per piece with abcjs and
 * followed during playback on requestAnimationFrame: the system scrolls under a fixed
 * reading point and the notes sounding now light up.
 *
 * Layout: four staves, one per voice (S and A treble, T treble-8, B bass). Two voices
 * per staff (grand staff) would need shared rhythms or stem splitting for every
 * crossing; four staves keep each line readable on its own, as in a Bach open score.
 *
 * Notation from the generator's notes ({pitch, beats, startTime, voice}): onsets carry
 * a few thousandths of a beat of humanizing jitter, so they are put on a 1/32-note grid
 * (GRID); pitches are already spelled ("F#4", "Bb3"); accidentals are written against
 * the key signature and those already written in the bar, as engraved. A note that
 * crosses a bar line is split and tied. Every emitted symbol is a token {beat, end};
 * the k-th note/rest abcjs lays out on staff v is token k of voice v, which gives the
 * maps for scrolling (beat -> x) and highlighting (beat -> SVG element).
 *
 * Timing: player.js plays the piece at a constant tempo on the audio clock
 * (`start` + beat * secsPerBeat, AudioContext time; wall clock with MIDI output), so the
 * score beat heard now is (clock - outputLatency - start) / secsPerBeat. The follower only
 * reads that clock; it never touches the audio scheduling.
 */

const GRID = 8;                 // positions per beat (32nd notes)
const BEATS_PER_BAR = 4;        // every form of the generator is in 4/4
const LEFT_PX = 120;            // clef + key signature + time signature
const MIN_BAR_PX = 150;
const PX_PER_SYMBOL = 21;       // width per symbol of the busiest voice in the bar
const READ_POINT = 0.3;         // the beat sounding now sits at 30% of the viewport

// Standard written lengths in 32nds (1 = 32nd ... 32 = whole), longest first
const LENGTHS = [32, 24, 16, 12, 8, 6, 4, 3, 2, 1];
const CLEFS = ['treble', 'treble', 'treble-8', 'bass'];
const NAMES = ['S', 'A', 'T', 'B'];

const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';
// Key signature (sharps > 0, flats < 0) of each tonic the page offers
const MAJOR_SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6 };
const MINOR_SIG = { A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7 };

function keySignature(key, mode) {
  const n = (mode === 'minor' ? MINOR_SIG : MAJOR_SIG)[key] ?? 0;
  const alter = {};
  for (const l of 'CDEFGAB') alter[l] = 0;
  for (let i = 0; i < Math.abs(n); i++) alter[(n > 0 ? SHARPS : FLATS)[i]] = n > 0 ? 1 : -1;
  return alter;
}

function parsePitch(pitch) {
  const m = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(pitch || '');
  if (!m) return null;
  const alter = { '##': 2, '#': 1, bb: -2, b: -1 }[m[2]] || 0;
  return { letter: m[1], alter, octave: parseInt(m[3], 10) };
}

const ACC = { '-2': '__', '-1': '_', 0: '=', 1: '^', 2: '^^' };

/** ABC note name without accidental: C4 = "C", C5 = "c", C6 = "c'", C3 = "C,". */
function abcName(letter, octave) {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5);
  return letter + ','.repeat(Math.max(0, 4 - octave));
}

function splitLength(units) {
  const out = [];
  let left = units;
  while (left > 0) {
    const l = LENGTHS.find(x => x <= left);
    out.push(l);
    left -= l;
  }
  return out;
}

/**
 * Builds the ABC of a piece. Returns { abc, tokens: [voice][k] = {beat, end, pitched}, bars }.
 */
export function buildAbc(data) {
  const meta = data.meta || {};
  const notes = data.notes || [];
  const sigAlter = keySignature(meta.key, meta.mode);
  const unitsPerBar = BEATS_PER_BAR * GRID;

  // 1) per voice: quantized, monophonic events
  const voices = [[], [], [], []];
  notes.forEach(n => {
    const v = Math.min(Math.max(n.voice | 0, 0), 3);
    const p = parsePitch(n.pitch);
    if (!p) return;
    const on = Math.max(0, Math.round(n.startTime * GRID));
    const len = Math.max(1, Math.round((n.beats || 1) * GRID));
    voices[v].push({ on, off: on + len, p });
  });
  let endUnits = 0;
  voices.forEach(evs => {
    evs.sort((a, b) => a.on - b.on || b.off - a.off);
    // same onset: keep the first (the longest); a note ends where the next begins
    for (let i = evs.length - 1; i > 0; i--) if (evs[i].on === evs[i - 1].on) evs.splice(i, 1);
    for (let i = 0; i < evs.length - 1; i++) evs[i].off = Math.min(evs[i].off, evs[i + 1].on);
    if (evs.length) endUnits = Math.max(endUnits, evs[evs.length - 1].off);
  });
  const bars = Math.max(1, Math.ceil(endUnits / unitsPerBar));
  const totalUnits = bars * unitsPerBar;

  // 2) symbols that never cross a bar line, rests in the gaps
  const symbolsPerBar = new Array(bars).fill(0);
  const voiceSyms = voices.map(evs => {
    const syms = [];
    let pos = 0;
    const span = (p, len) => {
      let left = len;
      while (left > 0) {
        const room = unitsPerBar - (pos % unitsPerBar);
        const chunk = Math.min(left, room);
        for (const l of splitLength(chunk)) {
          left -= l;
          syms.push({ p, on: pos, len: l, tie: !!p && left > 0 });
          pos += l;
        }
      }
    };
    evs.forEach(ev => {
      if (ev.on > pos) span(null, ev.on - pos);
      if (ev.off > ev.on) span(ev.p, ev.off - ev.on);
    });
    if (pos < totalUnits) span(null, totalUnits - pos);
    const perBar = new Array(bars).fill(0);
    syms.forEach(s => { perBar[Math.floor(s.on / unitsPerBar)]++; });
    perBar.forEach((c, b) => { symbolsPerBar[b] = Math.max(symbolsPerBar[b], c); });
    return syms;
  });

  // 3) serialize: accidentals against key signature + bar, beams within the beat
  const tonic = meta.key || 'C';
  let abc = `X:1\nM:4/4\nL:1/32\nK:${tonic}${meta.mode === 'minor' ? 'm' : ''}\n`;
  const tokens = [];
  voiceSyms.forEach((syms, v) => {
    abc += `V:${v + 1} clef=${CLEFS[v]} name="${NAMES[v]}"\n`;
    let out = '';
    let barAlter = {};
    const toks = [];
    syms.forEach((s, i) => {
      if (s.on % unitsPerBar === 0) barAlter = {};
      let head = 'z';
      if (s.p) {
        const { letter, alter, octave } = s.p;
        const k = letter + octave;
        const current = k in barAlter ? barAlter[k] : sigAlter[letter];
        head = (current !== alter ? ACC[alter] : '') + abcName(letter, octave);
        barAlter[k] = alter;
      }
      out += head + s.len + (s.tie ? '-' : '');
      toks.push({ beat: s.on / GRID, end: (s.on + s.len) / GRID, pitched: !!s.p });
      const end = s.on + s.len;
      if (end % unitsPerBar === 0) {
        out += end >= totalUnits ? ' |]' : ' | ';
      } else {
        const next = syms[i + 1];
        // beam the eighths and shorter of one beat together
        const beam = s.p && s.len < GRID && next && next.p && next.len < GRID
          && Math.floor(s.on / GRID) === Math.floor(next.on / GRID);
        out += beam ? '' : ' ';
      }
    });
    abc += out + '\n';  // the whole voice on one line: one long system
    tokens.push(toks);
  });
  const width = LEFT_PX + symbolsPerBar.reduce((s, c) => s + Math.max(MIN_BAR_PX, c * PX_PER_SYMBOL), 0);
  return { abc, tokens, bars, width };
}

export default class Score {
  constructor({ viewport, notation, onError } = {}) {
    this.viewport = viewport;
    this.notation = notation;
    this.onError = onError || ((e) => console.warn('Score:', e));
    this.raf = null;
    this.timing = null;
    this.points = null;   // [{beat, x}] increasing
    this.queue = null;    // [{beat, end, el}] by beat
    this.ptr = 0;
    this.active = [];
    this.stats = null;
  }

  clear(message) {
    this.stop();
    this.points = this.queue = null;
    this.notation.style.transform = '';
    this.notation.innerHTML = message ? `<p class="empty">${message}</p>` : '';
  }

  /** Render once per piece (call it while the samples load, not as playback starts). */
  render(data) {
    this.stop();
    const t0 = performance.now();
    this.points = this.queue = null;
    this.bars = 0;
    try {
      if (typeof ABCJS === 'undefined') throw new Error('abcjs not loaded');
      const built = buildAbc(data);
      this.bars = built.bars;
      this.totalBeats = built.bars * BEATS_PER_BAR;
      this.notation.style.transform = 'translateX(0px)';
      const tunes = ABCJS.renderAbc(this.notation, built.abc, {
        staffwidth: built.width,
        add_classes: true,
        paddingleft: 4, paddingright: 16, paddingtop: 6, paddingbottom: 6,
        scale: 1,
      });
      this._maps(tunes[0], built.tokens);
      this.lastRender = { ms: Math.round(performance.now() - t0), bars: built.bars, width: built.width,
        symbols: built.tokens.map(t => t.length), abcBytes: built.abc.length };
      return true;
    } catch (e) {
      this.onError(e);
      this.notation.innerHTML = '<p class="empty">Partitura no disponible</p>';
      return false;
    }
  }

  // The k-th note element abcjs laid out on staff v is token k of voice v
  _maps(tune, tokens) {
    const perVoice = [[], [], [], []];
    (tune.lines || []).forEach(line => {
      (line.staff || []).forEach((staff, v) => {
        const elems = (staff.voices && staff.voices[0]) || [];
        elems.forEach(el => {
          if (el.el_type === 'note' && el.abselem && v < 4) perVoice[v].push(el.abselem);
        });
      });
    });
    const queue = [];
    const pts = [];
    perVoice.forEach((abs, v) => {
      const toks = tokens[v] || [];
      if (abs.length !== toks.length) console.warn(`Score: voice ${v}: ${abs.length} symbols, ${toks.length} tokens`);
      const n = Math.min(abs.length, toks.length);
      for (let k = 0; k < n; k++) {
        const el = abs[k].elemset && abs[k].elemset[0];
        if (!el) continue;
        if (Number.isFinite(abs[k].x)) pts.push({ beat: toks[k].beat, x: abs[k].x });
        if (toks[k].pitched) queue.push({ beat: toks[k].beat, end: toks[k].end, el, v });
      }
    });
    queue.sort((a, b) => a.beat - b.beat);
    pts.sort((a, b) => a.beat - b.beat || a.x - b.x);
    // keep one x per beat and only increasing x
    const points = [];
    pts.forEach(p => {
      const last = points[points.length - 1];
      if (last && p.beat <= last.beat + 1e-6) return;
      if (last && p.x <= last.x) return;
      points.push(p);
    });
    const svg = this.notation.querySelector('svg');
    const w = svg ? (svg.width.baseVal.value || svg.getBoundingClientRect().width) : 0;
    if (points.length) points.push({ beat: this.totalBeats, x: Math.max(points[points.length - 1].x + 1, w - 20) });
    this.points = points.length >= 2 ? points : null;
    this.queue = queue;
  }

  xAt(beat) {
    const p = this.points;
    if (!p) return 0;
    if (beat <= p[0].beat) return p[0].x;
    let lo = 0, hi = p.length - 1;
    if (beat >= p[hi].beat) return p[hi].x;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].beat <= beat) lo = mid; else hi = mid;
    }
    const a = p[lo], b = p[hi];
    return a.x + (beat - a.beat) / (b.beat - a.beat) * (b.x - a.x);
  }

  /** The score beat heard now, from the clock player.js schedules on. */
  beatNow() {
    const t = this.timing;
    if (!t) return null;
    let now;
    if (t.clock === 'wall') now = performance.now() / 1000;
    else {
      const raw = Tone.getContext().rawContext;
      now = raw.currentTime - (raw.outputLatency || 0);
    }
    return (now - t.start) / t.secsPerBeat;
  }

  scrollTo(beat) {
    if (!this.points) return;
    const anchor = Math.max(this.points[0].x, this.viewport.clientWidth * READ_POINT);
    const dx = Math.max(0, this.xAt(beat) - anchor);
    this.notation.style.transform = `translateX(${-dx.toFixed(1)}px)`;
  }

  _paint(beat) {
    const q = this.queue;
    if (!q) return;
    while (this.ptr < q.length && q[this.ptr].beat <= beat) {
      const n = q[this.ptr++];
      if (n.end <= beat) continue;  // already over (a late frame): never lit
      n.el.classList.add('note-played');
      this.active.push(n);
      if (this.stats) {
        this.stats.lit++;
        if (this.stats.lags.length < 5000) this.stats.lags.push(beat - n.beat);
      }
    }
    if (this.active.length) {
      this.active = this.active.filter(n => {
        if (n.end > beat) return true;
        n.el.classList.remove('note-played');
        return false;
      });
    }
  }

  _unpaint() {
    this.active.forEach(n => n.el.classList.remove('note-played'));
    this.active = [];
    this.ptr = 0;
  }

  /** Follow playback: timing = { start, secsPerBeat, clock: 'audio' | 'wall' }. */
  follow(timing) {
    this.stop();
    this.timing = timing;
    this.stats = { lit: 0, lags: [], frames: 0 };
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const beat = this.beatNow();
      if (beat === null) return;
      this.stats.frames++;
      const b = Math.min(Math.max(beat, 0), this.totalBeats || 0);
      this.currentBeat = beat;
      this.scrollTo(b);
      this._paint(beat);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.timing = null;
    this._unpaint();
  }

  /** Lit elements now, with their beats (checks). */
  litNow() {
    return this.active.map(n => ({ beat: n.beat, end: n.end, v: n.v }));
  }
}
