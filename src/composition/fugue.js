const { Note } = require('tonal');
const Chords = require('../theory/chords');
const PhrasePlan = require('../harmony/phrasePlan');
const { voiceChords, RANGES, CENTERS } = require('../voices/voicing');
const Figuration = require('../voices/figuration');
const { addOrnaments } = require('../voices/ornaments');
const { toOutput } = require('./output');

/**
 * Fugue engine.
 *
 *  1. A subject is composed (many random candidates, scored for Baroque
 *     subject traits: clear tonic/dominant outline, mostly stepwise, single
 *     climax, rhythmic head + running tail, stable ending).
 *  2. Tonal answer (head 5th <-> 4th mutation) in the dominant.
 *  3. Countersubject written against the subject in invertible counterpoint
 *     at the octave (3rds/6ths on beats, no 5ths, complementary rhythm).
 *  4. Plan: exposition (staggered entries) – episodes (sequences on the
 *     subject head, modulating) – middle entries in related keys – stretto –
 *     final entry in the bass – cadence.
 *  5. All fixed lines are harmonized together (Viterbi over chords that fit
 *     the sounding notes), then the free voices are voice-led with the same
 *     DP engine used for chorales, with the fixed lines as constraints, and
 *     figured with diminutions.
 *
 * Unlike the old implementation, subjects keep their melodic contour in every
 * voice (whole-line octave placement instead of per-note pitch-class
 * re-octaving), and the harmony is derived from the subject rather than
 * generated independently and "fixed" afterwards.
 */

const mod12 = (n) => ((n % 12) + 12) % 12;

// ------------------------------------------------------------ subject

const HEADS = [[1, 1], [1.5, 0.5], [2], [0.5, 0.5, 1], [1, 0.5, 0.5]];
const BODIES = [[0.5, 0.5, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 0.5, 0.5], [0.5, 0.25, 0.25, 0.5, 0.5], [1, 0.5, 0.5], [0.5, 0.5, 1]];
const ENDS = [[1, 1], [2], [0.5, 0.5, 1], [1.5, 0.5]];

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

/** Applies minor-mode alterations (melodic minor logic) to a degree line. */
function alterations(degs, mode) {
  return degs.map((d, i) => {
    if (mode !== 'minor') return 0;
    const next = degs[i + 1];
    const r = Chords.mod(d, 7);
    if (r === 6 && next !== undefined && next === d + 1) return 1;                // #7 -> 8
    if (r === 5 && next !== undefined && next === d + 1 && degs[i + 2] === d + 2) return 1; // #6 #7 8
    if (r === 6 && (next === undefined || Chords.mod(next, 7) === 4 || Chords.mod(next, 7) === 2)) return 1; // dominant harmony
    return 0;
  });
}

function realize(line, tonic, mode, octave = 4) {
  const alts = alterations(line.map(n => n.deg), mode);
  return line.map((n, i) => ({ ...n, midi: Chords.degreeToMidi(n.deg, tonic, mode, alts[i], octave) }));
}

function composeSubject(tonic, mode, rng) {
  let best = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rhythm = [...pick(HEADS, rng), ...pick(BODIES, rng), ...pick(BODIES, rng), ...pick(ENDS, rng)];
    const degs = [rng() < 0.6 ? 0 : 4];
    for (let i = 1; i < rhythm.length; i++) {
      const prev = degs[i - 1];
      let step;
      if (i === 1) step = pick(prev === 0 ? [4, 2, -3, 4, 2] : [-4, 1, -2, 3], rng);
      else {
        const r = rng();
        const lastLeap = Math.abs(prev - degs[i - 2]) >= 3 ? -Math.sign(prev - degs[i - 2]) : 0;
        if (lastLeap && r < 0.75) step = lastLeap;          // recover after a leap
        else if (r < 0.72) step = rng() < 0.5 ? 1 : -1;
        else if (r < 0.9) step = rng() < 0.5 ? 2 : -2;
        else step = pick([3, -3, 4, -4], rng);
      }
      degs.push(prev + step);
    }
    const line = rhythm.map((dur, i) => ({ deg: degs[i], dur }));
    const score = scoreSubject(line, mode);
    if (score > bestScore) { bestScore = score; best = line; }
  }
  let t = 0;
  return best.map(n => { const o = { ...n, start: t }; t += n.dur; return o; });
}

function scoreSubject(line, mode) {
  const degs = line.map(n => n.deg);
  const max = Math.max(...degs), min = Math.min(...degs);
  let s = 0;
  const range = max - min;
  s += range >= 4 && range <= 7 ? 3 : -2 * Math.abs(range - 6); // fits every voice
  s += degs.filter(d => d === max).length === 1 ? 2 : -1;               // single climax
  const climaxPos = degs.indexOf(max) / degs.length;
  if (climaxPos > 0.3 && climaxPos < 0.8) s += 1.5;
  let steps = 0, repeats = 0, bigLeaps = 0;
  for (let i = 1; i < degs.length; i++) {
    const d = Math.abs(degs[i] - degs[i - 1]);
    if (d === 1) steps++;
    if (d === 0) repeats++;
    if (d > 4) bigLeaps++;
  }
  const stepRatio = steps / (degs.length - 1);
  s += stepRatio >= 0.5 && stepRatio <= 0.85 ? 2 : -2;
  s -= repeats * 1.5 + bigLeaps * 3;
  // Strong beats outline tonic / dominant harmony
  let t = 0;
  line.forEach(n => {
    if (t % 2 === 0) {
      const r = Chords.mod(n.deg, 7);
      if ([0, 2, 4].includes(r)) s += 0.8;
      else if ([1, 6].includes(r)) s += 0.3;
      else s -= 0.6;
    }
    t += n.dur;
  });
  const last = Chords.mod(degs[degs.length - 1], 7);
  s += last === 2 ? 2.5 : last === 0 ? 2 : last === 4 ? 0.5 : -3;
  if (Math.abs(degs[degs.length - 1] - degs[degs.length - 2]) > 2) s -= 1;
  // no augmented 2nd in minor (degrees 5 <-> 6)
  if (mode === 'minor') {
    for (let i = 1; i < degs.length; i++) {
      const a = Chords.mod(degs[i - 1], 7), b = Chords.mod(degs[i], 7);
      if ((a === 5 && b === 6) || (a === 6 && b === 5)) s -= 2;
    }
  }
  if (min < -5 || max > 10) s -= 3;
  return s;
}

/** Tonal answer: degrees in the dominant key, with head mutation 5 -> 4. */
function tonalAnswer(subject) {
  let head = true;
  return subject.map((n, i) => {
    let deg = n.deg;
    if (head && i < 3 && Chords.mod(deg, 7) === 4) deg -= 1;
    else if (i > 0 && Chords.mod(deg, 7) !== 0) head = false;
    return { ...n, deg };
  });
}

// ------------------------------------------------------------ countersubject

function soundingMidi(line, t) {
  let m = null;
  for (const n of line) {
    if (n.start > t + 1e-9) break;
    if (n.start + n.dur > t + 1e-9) m = n.midi;
  }
  return m;
}

/**
 * Countersubject above the (realized) subject, invertible at the octave.
 * Returns degree line (relative to the subject's key).
 */
function composeCountersubject(subjectMidi, tonic, mode, rng) {
  const total = subjectMidi.reduce((s, n) => s + n.dur, 0);
  // Complementary rhythm, per beat
  const rhythm = [];
  for (let b = 0; b < total; b++) {
    const notesInBeat = subjectMidi.filter(n => n.start >= b && n.start < b + 1).length;
    if (b === 0) rhythm.push({ start: 0.5, dur: 0.5 });          // enter after the subject's first note
    else if (notesInBeat >= 2) rhythm.push({ start: b, dur: 1 });
    else rhythm.push({ start: b, dur: 0.5 }, { start: b + 0.5, dur: 0.5 });
  }
  const keySet = Chords.keyPitchClassSet(tonic, mode);
  const subjMin = Math.min(...subjectMidi.map(n => n.midi));
  const subjMax = Math.max(...subjectMidi.map(n => n.midi));
  const lo = subjMin + 1, hi = subjMax + 12;

  let beam = [{ seq: [], cost: 0 }];
  rhythm.forEach((slot, i) => {
    const s = soundingMidi(subjectMidi, slot.start);
    const sPrev = i > 0 ? soundingMidi(subjectMidi, rhythm[i - 1].start) : null;
    const accented = slot.start % 1 === 0;
    const next = [];
    beam.forEach(state => {
      const prev = state.seq.length ? state.seq[state.seq.length - 1] : null;
      for (let m = lo; m <= hi; m++) {
        if (!keySet.has(mod12(m))) continue;
        // stay above the subject but within an octave (invertible at the octave)
        if (s !== null && (m <= s || m - s > 12)) continue;
        let cost = 0;
        const ic = s === null ? 3 : mod12(m - s);
        const consonant = [3, 4, 8, 9].includes(ic);
        if (accented) {
          if (consonant) cost += 0;
          else if (ic === 0) cost += 2.5;
          else if (ic === 7) cost += 6;      // would invert to a 4th
          else cost += 60;
        } else if (!consonant) {
          if (prev === null || Math.abs(m - prev) > 2) cost += 25;
          else cost += ic === 7 || ic === 0 ? 3 : 1;
        }
        // subject notes that start under this note must also be consonant on beats
        subjectMidi.forEach(n => {
          if (n.start > slot.start && n.start < slot.start + slot.dur && n.start % 1 === 0) {
            const ic2 = mod12(m - n.midi);
            if (![3, 4, 8, 9, 0].includes(ic2)) cost += 8;
          }
          if (n.start > slot.start && n.start < slot.start + slot.dur && (m <= n.midi || m - n.midi > 12)) {
            cost += 40;
          }
        });
        if (prev !== null) {
          const d = Math.abs(m - prev);
          cost += d === 0 ? 3 : d <= 2 ? 0 : d <= 4 ? 1.5 : d <= 7 ? 3 : d === 12 ? 5 : 30;
          if (d === 6) cost += 15;
          if (state.lastNC && d > 2) cost += 25;  // dissonance must be left by step
          // parallel perfects with the subject
          if (sPrev !== null && s !== null) {
            const ip = mod12(prev - sPrev), ds = s - sPrev, dc = m - prev;
            if (ds !== 0 && dc !== 0 && Math.sign(ds) === Math.sign(dc) && ip === ic && (ic === 0 || ic === 7)) cost += 100;
            if (ds !== 0 && dc !== 0 && Math.sign(ds) !== Math.sign(dc)) cost -= 0.5;
          }
        }
        // parallels between consecutive beats (across an intervening eighth)
        if (accented && slot.start >= 1 && s !== null) {
          const prevBeatIdx = rhythm.findIndex(r => r.start <= slot.start - 1 + 1e-9 && r.start + r.dur > slot.start - 1 + 1e-9);
          const sb = soundingMidi(subjectMidi, slot.start - 1);
          const cb = prevBeatIdx >= 0 ? state.seq[prevBeatIdx] : undefined;
          if (sb !== null && cb !== undefined) {
            const ib = mod12(cb - sb), ds = s - sb, dc = m - cb;
            if (ds !== 0 && dc !== 0 && Math.sign(ds) === Math.sign(dc) && ib === ic && (ic === 0 || ic === 7)) cost += 100;
          }
        }
        cost += rng() * 0.8;
        next.push({ seq: [...state.seq, m], cost: state.cost + cost, lastNC: !consonant && !accented });
      }
    });
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, 30);
  });
  const best = beam[0].seq;
  return rhythm.map((slot, i) => {
    const { degree } = Chords.midiToDegree(best[i], tonic, mode);
    return { deg: degree, dur: slot.dur, start: slot.start };
  });
}

// ------------------------------------------------------------ placement

function placeLine(line, voice, relation = null) {
  // relation: { line: otherMidiLine, above: bool } keeps the right side of another line
  let best = null, bestCost = Infinity;
  for (const shift of [-36, -24, -12, 0, 12, 24]) {
    const shifted = line.map(n => ({ ...n, midi: n.midi + shift }));
    const [lo, hi] = RANGES[voice];
    let cost = 0;
    shifted.forEach(n => {
      if (n.midi < lo) cost += (lo - n.midi) * 4;
      if (n.midi > hi) cost += (n.midi - hi) * 4;
    });
    const mean = shifted.reduce((s, n) => s + n.midi, 0) / shifted.length;
    cost += Math.abs(mean - CENTERS[voice]) * 0.3;
    if (relation) {
      shifted.forEach(n => {
        const o = soundingMidi(relation.line, n.start);
        if (o === null) return;
        if (relation.above && n.midi <= o) cost += 4;
        if (!relation.above && n.midi >= o) cost += 4;
      });
    }
    if (cost < bestCost) { bestCost = cost; best = shifted; }
  }
  return best;
}

// ------------------------------------------------------------ harmonization

const HARM_VOCAB = {
  major: [['I', 'T'], ['vi', 'T'], ['iii', 'T'], ['IV', 'S'], ['ii', 'S'], ['V', 'D'], ['V7', 'D'], ['vii°', 'D']],
  minor: [['i', 'T'], ['VI', 'T'], ['III', 'T'], ['iv', 'S'], ['ii°', 'S'], ['V', 'D'], ['V7', 'D'], ['vii°', 'D'], ['VII', 'S']]
};
const FTRANS = { T: { T: 0.3, S: 0.4, D: 0.3 }, S: { T: 0.15, S: 0.25, D: 0.6 }, D: { T: 0.75, S: 0.1, D: 0.15 } };

function harmonize(slots, fixedNotes, rng) {
  const options = slots.map((slot) => {
    if (slot.forced) return [{ chord: slot.forced, f: slot.forcedF || 'T', score: 0 }];
    const inSlot = fixedNotes.filter(n => n.start < slot.start + slot.beats && n.start + n.dur > slot.start);
    const bassAtStart = (() => {
      const sounding = inSlot.filter(n => n.start <= slot.start + 1e-9);
      if (!sounding.length) return null;
      return sounding.reduce((a, b) => (a.midi < b.midi ? a : b));
    })();
    const bassVoiceFixed = inSlot.some(n => n.voice === 3);
    const out = [];
    HARM_VOCAB[slot.mode].forEach(([numeral, f]) => {
      [0, 1].forEach(inv => {
        if ((numeral.includes('°')) && inv === 0) return;
        const chord = PhrasePlan.makeChord(numeral, inv, slot.key, slot.mode);
        let score = 0;
        inSlot.forEach(n => {
          const on = Math.max(n.start, slot.start) - slot.start;
          const len = Math.min(n.start + n.dur, slot.start + slot.beats) - Math.max(n.start, slot.start);
          const metric = on === 0 ? 2 : on === 1 ? 1.2 : on % 0.5 === 0 ? 0.6 : 0.35;
          const w = metric * Math.min(1.5, len + 0.25);
          score += chord.pcs.includes(mod12(n.midi)) ? w : -1.3 * w;
        });
        if (bassVoiceFixed && bassAtStart && bassAtStart.voice === 3) {
          const pc = mod12(bassAtStart.midi);
          if (pc !== chord.bassPC) return; // bass determines the inversion
        } else if (bassAtStart && !slot.bassFree) {
          if (mod12(bassAtStart.midi) === chord.pcs[2]) score -= 1.5; // implied 6/4
        }
        if (inv === 0) score += 0.4;
        if (slot.prefer && slot.prefer === f) score += 2;
        score += rng() * 0.6;
        out.push({ chord, f, score });
      });
    });
    // Fixed bass may require an inversion not covered above: add root/first/second
    if (out.length === 0) {
      HARM_VOCAB[slot.mode].forEach(([numeral, f]) => {
        const c0 = PhrasePlan.makeChord(numeral, 0, slot.key, slot.mode);
        const idx = bassAtStart ? c0.pcs.indexOf(mod12(bassAtStart.midi)) : 0;
        if (idx >= 0) out.push({ chord: PhrasePlan.makeChord(numeral, idx, slot.key, slot.mode), f, score: -1 });
      });
    }
    if (out.length === 0) out.push({ chord: PhrasePlan.makeChord(slot.mode === 'minor' ? 'i' : 'I', 0, slot.key, slot.mode), f: 'T', score: -5 });
    return out;
  });

  // Viterbi (maximize)
  let layer = options[0].map(o => ({ o, total: o.score, back: -1 }));
  const layers = [layer];
  for (let i = 1; i < options.length; i++) {
    const keyChange = slots[i].key !== slots[i - 1].key || slots[i].mode !== slots[i - 1].mode;
    const nextLayer = options[i].map(o => {
      let best = -Infinity, bi = 0;
      layer.forEach((st, j) => {
        const a = st.o, b = o;
        let tr = Math.log(PhrasePlanRoot(a.chord, b.chord) + 0.02);
        if (!keyChange) tr += Math.log(FTRANS[a.f][b.f] + 0.02);
        if ((a.chord.seventh || a.chord.isDominant) && b.f !== 'T' && !keyChange) tr -= 2.5;
        if (a.chord.numeral === b.chord.numeral && a.chord.inversion === b.chord.inversion && slots[i].start % 4 === 0) tr -= 1.5;
        const total = st.total + tr + o.score;
        if (total > best) { best = total; bi = j; }
      });
      return { o, total: best, back: bi };
    });
    layers.push(nextLayer);
    layer = nextLayer;
  }
  let idx = layer.reduce((bi, st, i) => (st.total > layer[bi].total ? i : bi), 0);
  const chosen = new Array(slots.length);
  for (let i = slots.length - 1; i >= 0; i--) {
    chosen[i] = layers[i][idx].o.chord;
    idx = layers[i][idx].back;
  }
  return chosen.map((c, i) => ({ ...c, start: slots[i].start, beats: slots[i].beats, phrase: slots[i].block, phraseIndex: i, role: slots[i].role || c.role, cadence: slots[i].cadence }));
}

function PhrasePlanRoot(a, b) {
  const diff = Chords.mod(b.degree - a.degree, 7);
  if (diff === 0) return a.inversion === b.inversion ? 0.2 : 0.7;
  return { 3: 1.6, 4: 1.0, 5: 1.1, 2: 0.6, 1: 0.9, 6: 0.45 }[diff];
}

// ------------------------------------------------------------ main

function generate({ key, mode, bars, rng, density }) {
  const home = { key, mode };
  const domKey = { key: Note.pitchClass(Note.transpose(key, '5P')), mode };
  const subject = composeSubject(key, mode, rng);
  const L = subject.reduce((s, n) => s + n.dur, 0); // 8 beats
  const subjMidi = realize(subject, key, mode);
  const csDeg = composeCountersubject(subjMidi, key, mode, rng);
  const answerDeg = tonalAnswer(subject);

  const fixed = [];          // {voice, midi, start, dur, type}
  const slots = [];          // {start, beats, key, mode, block, voices: ['fixed'|'free'|'rest' x4]}
  let t = 0;
  let block = 0;
  // Formal sections (meta.sections): exposition, episode, entry, stretto, final, cadence
  const sections = [];
  const mark = (kind, startBeat, extra = {}) => sections.push({ kind, index: sections.length, startBeat, endBeat: t, ...extra });

  const addSlots = (beats, keyCtx, voiceStates, extra = {}) => {
    for (let b = 0; b < beats; b += 2) {
      slots.push({ start: t + b, beats: 2, key: keyCtx.key, mode: keyCtx.mode, block, voices: [...voiceStates], ...extra });
    }
  };
  const addLine = (line, voice, type, offset, relation = null) => {
    const placed = placeLine(line.map(n => ({ ...n, start: n.start + offset })), voice, relation);
    placed.forEach(n => fixed.push({ voice, midi: n.midi, start: n.start, dur: n.dur, type }));
    return placed;
  };

  // ---- Exposition
  const orders = [[1, 0, 2, 3], [0, 1, 2, 3], [2, 1, 0, 3], [1, 2, 0, 3], [0, 2, 1, 3]];
  const order = pick(orders, rng);
  let lastTheme = null;
  const expoStart = t;
  order.forEach((voice, i) => {
    const isAnswer = i % 2 === 1;
    const k = isAnswer ? domKey : home;
    const themeDeg = isAnswer ? answerDeg : subject;
    const theme = addLine(realize(themeDeg, k.key, k.mode), voice, isAnswer ? 'answer' : 'subject', t);
    const states = ['rest', 'rest', 'rest', 'rest'];
    order.slice(0, i + 1).forEach(v => { states[v] = 'free'; });
    states[voice] = 'fixed';
    if (i >= 1) {
      const csVoice = order[i - 1];
      addLine(realize(csDeg, k.key, k.mode), csVoice, 'countersubject', t, { line: theme, above: csVoice < voice });
      states[csVoice] = 'fixed';
    }
    addSlots(L, k, states, { role: i === 0 ? 'entry' : null });
    lastTheme = { voice, key: k };
    t += L;
    block++;
  });
  mark('exposition', expoStart, { voices: order });

  // ---- Middle groups: episode + entry in a related key
  const related = PhrasePlan.relatedKeys(key, mode).map(r => ({ key: r.tonic, mode: r.mode }));
  const fixedLen = 4 * L + L /* final episode */ + L * 1.5 /* stretto */ + L /* final entry */ + 8 /* cadence */;
  const groups = Math.max(1, Math.min(40, Math.round((bars * 4 - fixedLen) / (2 * L))));
  let prevKey = home;
  let lastEntryVoice = order[3];

  const episode = (fromKey, toKey) => {
    const episodeStart = t;
    // Sequence on the subject head, descending by step, plus a free bar to the new dominant
    const head = subject.filter(n => n.start < 2);
    const voicesAvail = [0, 1, 2, 3].filter(v => v !== lastEntryVoice);
    const X = pick(voicesAvail.filter(v => v <= 1), rng) ?? 0;
    const Y = pick([2, 3].filter(v => v !== X), rng);
    const reps = Math.max(1, L / 2 - 1);
    const startDeg = rng() < 0.5 ? 4 : 2;
    const seq = [];
    for (let r = 0; r < reps; r++) {
      head.forEach(n => seq.push({ deg: n.deg + startDeg - r, dur: n.dur, start: n.start + 2 * r }));
    }
    const xLine = addLine(realize(seq, fromKey.key, fromKey.mode), X, 'episode', t);
    // Imitation below (3rd / 6th / octave), 1 or 2 beats later; keep the option
    // with no dissonance on any beat, otherwise leave the voice free
    const xRel = xLine.map(z => ({ ...z, start: z.start - t }));
    let bestY = null, bestClash = Infinity;
    for (const offset of [2, 5, 7]) {
      for (const delay of [1, 2]) {
        const yDeg = seq.map(n => ({ ...n, deg: n.deg - offset, start: n.start + delay }))
          .filter(n => n.start + n.dur <= reps * 2);
        if (yDeg.length < 3) continue;
        const yReal = realize(yDeg, fromKey.key, fromKey.mode);
        let clash = 0;
        const samples = [];
        for (let b = delay; b < reps * 2; b += 0.25) {
          const x = soundingMidi(xRel, b), y = soundingMidi(yReal, b);
          if (x === null || y === null) continue;
          const ic = mod12(x - y);
          if (b % 1 === 0 && ![0, 3, 4, 7, 8, 9].includes(ic)) clash += 1;
          if (b % 1 !== 0 && [1, 11].includes(ic)) clash += 0.5;
          samples.push({ b, x, y, ic });
        }
        // parallel perfects between consecutive changes and consecutive beats
        const parallelBetween = (p, c) => p && c && c.x !== p.x && c.y !== p.y &&
          Math.sign(c.x - p.x) === Math.sign(c.y - p.y) && p.ic === c.ic && (c.ic === 0 || c.ic === 7);
        let last = null;
        samples.forEach(sm => {
          if (last && (sm.x !== last.x || sm.y !== last.y)) { if (parallelBetween(last, sm)) clash += 2; last = sm; }
          if (!last) last = sm;
          if (sm.b % 1 === 0) {
            const prevBeat = samples.find(q => q.b === sm.b - 1);
            if (parallelBetween(prevBeat, sm)) clash += 2;
          }
        });
        clash += rng() * 0.3;
        if (clash < bestClash) { bestClash = clash; bestY = yReal; }
      }
    }
    const states = ['free', 'free', 'free', 'free'];
    states[X] = 'fixed';
    if (bestY && bestClash < 1) {
      addLine(bestY, Y, 'episode', t, { line: xLine, above: Y < X });
      states[Y] = 'fixed';
    }
    // one free voice rests for textural contrast
    const restable = [0, 1, 2, 3].filter(v => states[v] === 'free' && v !== 3);
    if (restable.length && rng() < 0.6) states[pick(restable, rng)] = 'rest';
    addSlots(reps * 2, fromKey, states);
    t += reps * 2;
    addSlots(2, toKey, ['free', 'free', 'free', 'free'], { prefer: 'D' });
    t += 2;
    block++;
    mark('episode', episodeStart, { key: fromKey.key, mode: fromKey.mode });
  };

  for (let g = 0; g < groups; g++) {
    const k = related[g % Math.min(related.length, 4)];
    episode(prevKey, k);
    const candidates = [0, 1, 2, 3].filter(v => v !== lastEntryVoice);
    const voice = pick(candidates, rng);
    const entryStart = t;
    const theme = addLine(realize(subject, k.key, k.mode), voice, 'subject', t);
    const csVoice = voice === 0 ? 1 : voice === 3 ? 2 : (rng() < 0.5 ? voice - 1 : voice + 1);
    addLine(realize(csDeg, k.key, k.mode), csVoice, 'countersubject', t, { line: theme, above: csVoice < voice });
    const states = ['free', 'free', 'free', 'free'];
    states[voice] = 'fixed';
    states[csVoice] = 'fixed';
    addSlots(L, k, states, { prefer: null });
    slots[slots.length - L / 2].prefer = 'T';
    t += L;
    block++;
    mark('entry', entryStart, { key: k.key, mode: k.mode, voice });
    lastEntryVoice = voice;
    prevKey = k;
  }

  // ---- Return: episode to the tonic, stretto
  episode(prevKey, home);
  const stretto = findStretto(subject, key, mode);
  if (stretto) {
    const [v1, v2] = stretto.voices;
    const a = addLine(realize(subject, key, mode), v1, 'subject', t);
    addLine(realize(subject, key, mode).map(n => ({ ...n, midi: n.midi + stretto.shift, start: n.start + stretto.delay })), v2, 'subject', t,
      { line: a, above: v2 < v1 });
    const total = L + stretto.delay;
    for (let b = 0; b < total; b += 2) {
      const states = ['free', 'free', 'free', 'free'];
      const tt = b;
      if (tt < L) states[v1] = 'fixed';
      if (tt + 2 > stretto.delay) states[v2] = 'fixed';
      slots.push({ start: t + b, beats: 2, key, mode, block, voices: states });
    }
    const strettoStart = t;
    t += total;
    block++;
    mark('stretto', strettoStart, { voices: [v1, v2] });
  }

  // ---- Final entry in the bass + cadence
  const finalStart = t;
  addLine(realize(subject, key, mode), 3, 'subject', t);
  addSlots(L, home, ['free', 'free', 'free', 'fixed']);
  t += L;
  block++;
  mark('final', finalStart, { voice: 3 });
  const cadenceStart = t;
  const tonicN = mode === 'minor' ? 'i' : 'I';
  const cad = [
    { chord: PhrasePlan.makeChord(mode === 'minor' ? 'iv' : 'IV', 0, key, mode), f: 'S', beats: 2, role: 'predominant' },
    { chord: PhrasePlan.makeChord(tonicN, 2, key, mode), f: 'T', beats: 2, role: 'cad64' },
    { chord: PhrasePlan.makeChord('V7', 0, key, mode), f: 'D', beats: 4, role: 'dominant' },
    { chord: PhrasePlan.makeChord(mode === 'minor' && rng() < 0.5 ? 'I' : tonicN, 0, key, mode, { sopranoTarget: 'root' }), f: 'T', beats: 4, role: 'goal', cadence: 'PAC' }
  ];
  cad.forEach(c => {
    slots.push({ start: t, beats: c.beats, key, mode, block, voices: ['free', 'free', 'free', 'free'], forced: c.chord, forcedF: c.f, role: c.role, cadence: c.cadence });
    t += c.beats;
  });
  mark('cadence', cadenceStart);

  // ---- Harmonize & voice
  const chords = harmonize(slots, fixed, rng);
  const fixedAt = (voice, slot) => {
    const notes = fixed.filter(n => n.voice === voice && n.start < slot.start + slot.beats && n.start + n.dur > slot.start);
    if (!notes.length) return null;
    const atStart = notes.find(n => n.start <= slot.start + 1e-9);
    return (atStart || notes[0]).midi;
  };
  const fixedArr = slots.map(s => s.voices.map((st, v) => (st === 'fixed' ? fixedAt(v, s) : null)));
  const activeArr = slots.map((s, i) => s.voices.map((st, v) => st === 'free' || (st === 'fixed' && fixedArr[i][v] !== null)));
  const fixedExitArr = slots.map(s => s.voices.map((st, v) => {
    if (st !== 'fixed') return null;
    const notes = fixed.filter(n => n.voice === v && n.start < s.start + s.beats && n.start + n.dur > s.start);
    return notes.length ? notes.reduce((a, b) => (a.start > b.start ? a : b)).midi : null;
  }));
  // pitch each fixed voice sounds on the last beat of the slot (accented parallels across eighths)
  const fixedLastBeatArr = slots.map(s => s.voices.map((st, v) => {
    if (st !== 'fixed') return null;
    return soundingMidi(fixed.filter(n => n.voice === v).sort((a, b) => a.start - b.start), s.start + s.beats - 1);
  }));
  const voicings = voiceChords(chords, {
    rng, jitter: 2, fixed: fixedArr, active: activeArr,
    fixedExit: fixedExitArr, fixedLastBeat: fixedLastBeatArr, freeInversion: true
  });
  // the DP may have chosen another inversion: keep chord data consistent
  chords.forEach((c, k) => {
    const b = voicings[k][3];
    if (b !== null && slots[k].voices[3] === 'free' && mod12(b) !== c.bassPC) {
      c.inversion = c.pcs.indexOf(mod12(b));
      c.bassPC = mod12(b);
    }
  });

  // ---- Free voices: diminutions; fixed voices: the lines themselves
  const lines = [[], [], [], []];
  fixed.forEach(n => {
    const ci = slots.findIndex(s => n.start >= s.start - 1e-9 && n.start < s.start + s.beats);
    lines[n.voice].push({ ...n, chordIndex: ci });
  });
  const FREE_CELLS = [[[1, 1]], [[0.5, 0.5, 0.5, 0.5]], [[1, 0.5, 0.5]], [[0.5, 0.5, 1]], [[2]]];
  slots.forEach((s, k) => {
    const chord = chords[k];
    // busier fixed lines -> calmer free voices
    const fixedOnsets = fixed.filter(n => n.start >= s.start && n.start < s.start + s.beats).length;
    for (let v = 0; v < 4; v++) {
      if (s.voices[v] !== 'free') continue;
      const m = voicings[k][v];
      if (m === null) continue;
      const nextFree = k + 1 < slots.length && slots[k + 1].voices[v] === 'free' ? voicings[k + 1][v] : null;
      let cell;
      if (s.beats !== 2 || nextFree === null || s.forced) cell = [s.beats];
      else if (fixedOnsets >= 8) cell = rng() < 0.6 ? [2] : [1, 1];
      else if (fixedOnsets >= 5) cell = pick(FREE_CELLS.slice(0, 4), rng)[0];
      else cell = pick(FREE_CELLS.slice(1, 4), rng)[0];
      if (rng() > 0.4 + density * 0.6 && cell.length > 1) cell = [1, 1];
      const neighbor = (dir) => {
        for (let u = v + dir; u >= 0 && u < 4; u += dir) if (voicings[k][u] !== null) return voicings[k][u];
        return null;
      };
      const up = neighbor(-1), down = neighbor(1);
      const bounds = { min: down !== null ? down + 1 : 0, max: up !== null ? up - 1 : 127 };
      let seq = cell.length > 1 ? Figuration.diminish(m, nextFree, chord, cell, rng, null, v, bounds) : [m];
      if (!seq) { seq = [m]; cell = [s.beats]; }
      let tt = s.start;
      seq.forEach((p, i) => {
        lines[v].push({ voice: v, midi: p, start: tt, dur: cell[i], type: i === 0 ? 'chord' : (chord.pcs.includes(mod12(p)) ? 'arpeggiation' : 'passing'), chordIndex: k });
        tt += cell[i];
      });
    }
  });
  lines.forEach(l => l.sort((a, b) => a.start - b.start));
  Figuration.repair(lines, chords, voicings, { allowRepitch: true });

  let notes = lines.flat();
  notes = addOrnaments(notes, chords, { rng, density });

  // velocity: thematic entries stand out
  notes.forEach(n => {
    if (n.type === 'subject' || n.type === 'answer') n.velocity = [100, 88, 86, 96][n.voice];
    else if (n.type === 'countersubject') n.velocity = [86, 76, 74, 82][n.voice];
  });

  const out = toOutput(notes, chords, { rng });
  const keyName = (k) => `${k.key}${k.mode === 'minor' ? 'm' : ''}`;
  return {
    notes: out,
    meta: {
      key, mode, form: 'Fugue', style: 'Baroque Fugue',
      bars: t / 4,
      progression: `Exposition (${order.map(v => 'SATB'[v]).join('-')}) - ` +
        Array.from({ length: groups }, (_, g) => `Episode - Entry in ${keyName(related[g % Math.min(related.length, 4)])}`).join(' - ') +
        ` - Episode${stretto ? ' - Stretto' : ''} - Final entry (bass) - Cadence`,
      subject: subjMidi.map(n => Chords.spellMidi(n.midi, key, mode)).join(' '),
      phraseMarkers: slots.reduce((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && last.key === s.key && last.mode === s.mode) last.endBeat = s.start + s.beats;
        else acc.push({ index: acc.length, key: s.key, mode: s.mode, startBeat: s.start, endBeat: s.start + s.beats });
        return acc;
      }, []),
      sections
    }
  };
}

/** Finds a stretto (second entry overlapping the first) with few clashes. */
function findStretto(subject, key, mode) {
  const base = realize(subject, key, mode);
  const options = [];
  for (const delay of [4, 2, 6]) {
    for (const shift of [-12, -24, 12]) {
      const second = base.map(n => ({ ...n, midi: n.midi + shift, start: n.start + delay }));
      let bad = 0, par = 0, prev = null;
      for (let b = delay; b < 8; b += 0.5) {
        const a = soundingMidi(base, b), c = soundingMidi(second, b);
        if (a === null || c === null) continue;
        const ic = mod12(a - c);
        if (b % 1 === 0 && ![0, 3, 4, 7, 8, 9].includes(ic)) bad++;
        if (prev && (ic === 0 || ic === 7) && prev.ic === ic && a !== prev.a && c !== prev.c &&
          Math.sign(a - prev.a) === Math.sign(c - prev.c)) par++;
        prev = { a, c, ic };
      }
      options.push({ delay, shift, cost: bad * 2 + par * 4 + delay * 0.1 });
    }
  }
  options.sort((a, b) => a.cost - b.cost);
  const best = options[0];
  if (best.cost > 3) return null;
  const voices = best.shift > 0 ? [2, 0] : best.shift === -12 ? [0, 2] : [1, 3];
  return { ...best, voices };
}

module.exports = { generate, composeSubject, tonalAnswer, composeCountersubject };
