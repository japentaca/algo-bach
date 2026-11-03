/**
 * SATB voice-leading engine (dynamic programming / beam search).
 *
 * The old engine chose each chord greedily from 2 options per voice and used
 * C major for every tendency-tone rule. This one enumerates every legal
 * voicing of every chord and finds the cheapest path through the whole
 * progression (Viterbi with a beam), so a locally good move can't paint the
 * voices into a corner a few chords later.
 *
 * Voices are arrays [S, A, T, B] of MIDI numbers (null = voice silent).
 * Some voices can be "fixed" (e.g. a fugue subject) – the engine then writes
 * the remaining voices around them.
 */

const RANGES = [[60, 79], [55, 74], [48, 67], [40, 60]];   // S A T B (comfortable)
const CENTERS = [70, 63, 56, 48];
const MOTION_WEIGHT = [1.0, 1.25, 1.25, 0.55];

const mod12 = (n) => ((n % 12) + 12) % 12;

function motionCost(ad, voice) {
  if (ad === 0) return voice === 0 ? 0.8 : 0.3;
  if (ad <= 2) return 1;
  if (ad <= 4) return 1.7;          // thirds: good melodic skips (room for passing tones)
  if (ad === 5) return 3.5;
  if (ad === 6) return 12;          // tritone leap
  if (ad === 7) return voice === 3 ? 2.5 : 5;
  if (ad <= 9) return 8;
  if (ad <= 11) return 14;
  if (ad === 12) return voice === 3 ? 3 : 10;
  return 40;
}

/** Is a 3-semitone move an augmented 2nd (b6 <-> #7) in a minor key? */
function isAugmentedSecond(a, b, chord) {
  if (chord.mode !== 'minor' || Math.abs(a - b) !== 3) return false;
  const tonicPC = chord.keyPC;
  const b6 = mod12(tonicPC + 8), s7 = mod12(tonicPC + 11);
  const pa = mod12(a), pb = mod12(b);
  return (pa === b6 && pb === s7) || (pa === s7 && pb === b6);
}

function bassPCs(chord, freeInversion) {
  if (!freeInversion) return [chord.bassPC];
  // root or first inversion (never an accidental 6/4); diminished triads only in 6
  return chord.quality === 'dim' ? [chord.pcs[1]] : [chord.pcs[0], chord.pcs[1]];
}

function candidates(chord, fixed, active, freeInversion = false) {
  const bassSet = bassPCs(chord, freeInversion);
  const opts = [0, 1, 2, 3].map(v => {
    if (fixed && fixed[v] !== null && fixed[v] !== undefined) return [fixed[v]];
    if (active && !active[v]) return [null];
    const [lo, hi] = RANGES[v];
    const out = [];
    const bassConstrained = v === 3 && !(fixed && fixed[3] != null);
    for (let m = lo; m <= hi; m++) {
      const pc = mod12(m);
      if (bassConstrained ? bassSet.includes(pc) : chord.pcs.includes(pc)) out.push(m);
    }
    return out;
  });

  const isFixed = (v) => fixed && fixed[v] !== null && fixed[v] !== undefined;
  const result = [];
  for (const s of opts[0]) for (const a of opts[1]) for (const t of opts[2]) for (const b of opts[3]) {
    const v = [s, a, t, b];
    let ok = true;
    // ordering & spacing among present voices
    let upper = null;
    for (let i = 0; i < 4 && ok; i++) {
      if (v[i] === null) continue;
      if (upper !== null) {
        const bothFixed = isFixed(i) && isFixed(upper);
        if (!bothFixed) {
          if (v[i] >= v[upper]) ok = false;
          const limit = i === 3 ? 24 : 12;
          if (v[upper] - v[i] > limit && upper === i - 1) ok = false;
        }
      }
      upper = i;
    }
    if (!ok) continue;

    // completeness: root and third must sound when 3+ voices are present
    const present = v.filter(x => x !== null);
    if (present.length >= 3) {
      const pcs = new Set(present.map(mod12));
      if (!pcs.has(chord.pcs[0]) || !pcs.has(chord.pcs[1])) continue;
    }
    result.push(v);
  }
  return result;
}

function staticCost(v, chord, rng, jitter, fixed) {
  let cost = 0;
  const present = [];
  v.forEach((m, i) => {
    if (m === null) return;
    present.push(m);
    const free = !(fixed && fixed[i] !== null && fixed[i] !== undefined);
    if (free) {
      cost += Math.abs(m - CENTERS[i]) * 0.08;
      if (i === 0 && m > 77) cost += (m - 77) * 1.5;
    }
  });
  const count = (pc) => present.filter(m => mod12(m) === pc).length;

  if (chord.leadingTonePC !== null && chord.leadingTonePC !== undefined && count(chord.leadingTonePC) > 1) cost += 40;
  if (chord.seventhPC !== null && chord.seventhPC !== undefined && count(chord.seventhPC) > 1) cost += 40;

  if (present.length === 4) {
    const [root, third, fifth] = chord.pcs;
    if (chord.seventh) {
      if (count(chord.seventhPC) === 0) cost += 6;
    } else if (chord.inversion === 0) {
      if (count(root) < 2) cost += count(third) > 1 ? (chord.quality === 'major' ? 6 : 2) : 2;
      if (count(fifth) === 0) cost += 1;
    } else if (chord.inversion === 2) {
      if (count(chord.bassPC) < 2) cost += 6; // double the bass in 6/4 chords
    } else if (chord.inversion === 1) {
      if (chord.quality === 'dim') {
        if (count(chord.bassPC) < 2) cost += 3; // vii°6 / ii°6: double the bass
      } else if (count(chord.bassPC) > 1) cost += 3;
    }
  }

  if (v[0] !== null && chord.sopranoTarget) {
    const isRoot = mod12(v[0]) === chord.pcs[0];
    if (chord.sopranoTarget === 'root' && !isRoot) cost += 25;
    if (chord.sopranoTarget === 'notRoot' && isRoot) cost += 10;
  }
  if (rng && jitter) cost += rng() * jitter;
  return cost;
}

/** Parallel 5ths/8ves cost only (used for extra checkpoints inside a span). */
function parallelCost(p, c) {
  let cost = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (p[i] === null || p[j] === null || c[i] === null || c[j] === null) continue;
      const di = c[i] - p[i], dj = c[j] - p[j];
      if (di === 0 || dj === 0) continue;
      const ip = mod12(p[i] - p[j]), ic = mod12(c[i] - c[j]);
      if ((ic === 0 || ic === 7) && ip === ic) cost += Math.sign(di) === Math.sign(dj) ? 1000 : 60;
    }
  }
  return cost;
}

function transitionCost(p, c, chordP, chordC) {
  let cost = 0;
  for (let v = 0; v < 4; v++) {
    if (p[v] === null || c[v] === null) continue;
    const d = c[v] - p[v];
    cost += motionCost(Math.abs(d), v) * MOTION_WEIGHT[v];
    if (isAugmentedSecond(p[v], c[v], chordC)) cost += 25;

    // Leading tone resolution
    const lt = chordP.leadingTonePC;
    if (lt !== null && lt !== undefined && mod12(p[v]) === lt) {
      const target = mod12(lt + 1);
      const sameDominant = chordC.leadingTonePC === lt;
      if (!sameDominant && chordC.pcs.includes(target) && d !== 1) {
        if (v === 0 || v === 3) cost += 30;
        else cost += (d === -3 || d === -4) ? 4 : 10; // inner voice may fall to the 5th
      }
    }
    // Chordal seventh resolves down by step
    const sev = chordP.seventhPC;
    if (sev !== null && sev !== undefined && mod12(p[v]) === sev) {
      if (d === -1 || d === -2) { /* ok */ } else if (d === 0 && chordC.pcs.includes(mod12(c[v]))) cost += 2;
      else cost += 25;
    }
  }

  // Parallels / hidden perfects / overlaps
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (p[i] === null || p[j] === null || c[i] === null || c[j] === null) continue;
      const di = c[i] - p[i], dj = c[j] - p[j];
      if (di === 0 && dj === 0) continue;
      const ip = mod12(p[i] - p[j]), ic = mod12(c[i] - c[j]);
      const perfectNow = ic === 0 || ic === 7;
      if (perfectNow && ip === ic && di !== 0 && dj !== 0) {
        cost += Math.sign(di) === Math.sign(dj) ? 1000 : 60;
      } else if (perfectNow && i === 0 && j === 3 && di !== 0 && dj !== 0 &&
        Math.sign(di) === Math.sign(dj) && Math.abs(di) > 2) {
        cost += 12; // hidden 5th/8ve in outer voices with a leaping soprano
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const j = i + 1;
    if ([p[i], p[j], c[i], c[j]].some(x => x === null)) continue;
    if (c[j] > p[i] || c[i] < p[j]) cost += 6; // voice overlap
  }
  // Contrary outer voices are good
  if (p[0] !== null && p[3] !== null && c[0] !== null && c[3] !== null) {
    const ds = c[0] - p[0], db = c[3] - p[3];
    if (ds !== 0 && db !== 0 && Math.sign(ds) !== Math.sign(db)) cost -= 1;
  }
  return cost;
}

/**
 * Voices a chord progression.
 * @param {object[]} chords - realized chords (pcs, bassPC, leadingTonePC, ...)
 * @param {object} opts - { rng, jitter, beam, fixed: [[S,A,T,B]|null], active: [[bool x4]|null], start: [S,A,T,B] }
 * @returns {Array<Array<number|null>>}
 */
function voiceChords(chords, opts = {}) {
  const { rng = null, jitter = 2, beam = 40, maxCandidates = 140 } = opts;
  const { Note } = require('tonal');
  let layer = null;
  const layers = [];

  chords.forEach((chord, k) => {
    if (chord.keyPC === undefined) chord.keyPC = Note.chroma(chord.key || 'C');
    const fixed = opts.fixed ? opts.fixed[k] : null;
    const active = opts.active ? opts.active[k] : null;
    let cands = candidates(chord, fixed, active, opts.freeInversion);
    if (cands.length === 0) {
      // Relax: allow incomplete chords by dropping the completeness rule
      cands = relaxedCandidates(chord, fixed, active);
    }
    let scored = cands.map(v => {
      let s = staticCost(v, chord, rng, jitter, fixed);
      if (opts.freeInversion && v[3] !== null && mod12(v[3]) !== chord.bassPC) s += 1.5;
      return { v, s };
    });
    scored.sort((a, b) => a.s - b.s);
    scored = scored.slice(0, maxCandidates);

    const next = [];
    if (!layer) {
      scored.forEach(({ v, s }) => next.push({ v, cost: s, back: -1 }));
    } else {
      const prevChord = chords[k - 1];
      // Fixed voices may move inside the previous span: use the pitch they
      // actually leave from (their last note) when judging the connection.
      const exit = opts.fixedExit ? opts.fixedExit[k - 1] : null;
      const beatBefore = opts.fixedLastBeat ? opts.fixedLastBeat[k - 1] : null;
      const sub = (pv, arr) => (arr ? pv.map((x, u) => (arr[u] !== null && arr[u] !== undefined ? arr[u] : x)) : pv);
      const prevOf = (pv) => sub(pv, exit);
      scored.forEach(({ v, s }) => {
        let best = Infinity, bestIdx = -1;
        for (let i = 0; i < layer.length; i++) {
          let c = layer[i].cost + transitionCost(prevOf(layer[i].v), v, prevChord, chord);
          if (beatBefore) c += parallelCost(sub(layer[i].v, beatBefore), v);
          if (c < best) { best = c; bestIdx = i; }
        }
        next.push({ v, cost: best + s, back: bestIdx });
      });
    }
    next.sort((a, b) => a.cost - b.cost);
    layer = next.slice(0, beam);
    layers.push(layer);
  });

  // Backtrack
  const out = new Array(chords.length);
  let idx = 0;
  for (let k = chords.length - 1; k >= 0; k--) {
    const state = layers[k][idx];
    out[k] = state.v;
    idx = state.back;
  }
  return out;
}

function relaxedCandidates(chord, fixed, active) {
  // Same as candidates() but without completeness & spacing (fallback only)
  const opts = [0, 1, 2, 3].map(v => {
    if (fixed && fixed[v] !== null && fixed[v] !== undefined) return [fixed[v]];
    if (active && !active[v]) return [null];
    const [lo, hi] = RANGES[v];
    const out = [];
    for (let m = lo - 3; m <= hi + 3; m++) if (chord.pcs.includes(mod12(m))) out.push(m);
    return out;
  });
  const result = [];
  for (const s of opts[0]) for (const a of opts[1]) for (const t of opts[2]) for (const b of opts[3]) {
    const v = [s, a, t, b];
    const present = v.filter(x => x !== null);
    let ok = true;
    for (let i = 1; i < present.length; i++) if (present[i] > present[i - 1]) ok = false;
    if (ok) result.push(v);
  }
  return result.length ? result : [opts.map(o => o[0])];
}

module.exports = { voiceChords, transitionCost, parallelCost, staticCost, RANGES, CENTERS };
