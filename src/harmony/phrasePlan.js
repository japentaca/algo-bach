const { Note } = require('tonal');
const Chords = require('../theory/chords');

/**
 * Phrase & tonal planner.
 *
 * The harmonic grid is one chord per half bar (a "slot" = 2 beats, 4/4).
 * Even slots are strong (downbeats), odd slots weak.
 *
 * A phrase (normally 4 bars = 8 slots) is:  body chords + cadence formula,
 * with the cadence aligned to the meter (cadential 6/4 and goal chord on
 * strong slots, the goal chord held for a whole bar).
 *
 * Longer pieces visit related keys (dominant, relative, subdominant...) the
 * way Baroque binary/ritornello movements do, entering each new key through a
 * pivot chord and confirming it with a cadence.
 */

// [numeral, inversion, weight]
const VOCAB = {
  major: {
    T: [['I', 0, 10], ['I', 1, 4], ['vi', 0, 5], ['iii', 0, 1]],
    S: [['IV', 0, 6], ['IV', 1, 2], ['ii', 0, 3], ['ii', 1, 5], ['ii7', 1, 2]],
    D: [['V', 0, 8], ['V', 1, 3], ['V7', 0, 4], ['V7', 1, 2], ['V7', 2, 1], ['vii°', 1, 2]]
  },
  minor: {
    T: [['i', 0, 10], ['i', 1, 4], ['VI', 0, 5], ['III', 0, 2]],
    S: [['iv', 0, 6], ['iv', 1, 3], ['ii°', 1, 5], ['iiø7', 1, 2]],
    D: [['V', 0, 8], ['V', 1, 3], ['V7', 0, 4], ['V7', 1, 2], ['V7', 2, 1], ['vii°', 1, 2], ['vii°7', 0, 2]]
  }
};

const FUNCTION_OF = {};
['major', 'minor'].forEach(mode => {
  FUNCTION_OF[mode] = {};
  Object.entries(VOCAB[mode]).forEach(([f, list]) => list.forEach(([n]) => { FUNCTION_OF[mode][n] = f; }));
});

const TRANSITIONS = {
  T: { T: 0.25, S: 0.5, D: 0.25 },
  S: { T: 0.08, S: 0.27, D: 0.65 },
  D: { T: 0.85, S: 0.02, D: 0.13 }
};

// Pre-dominant options before a cadence  [numeral, inversion, weight]
const PREDOMINANTS = {
  major: [['ii', 1, 5], ['IV', 0, 4], ['ii7', 1, 3], ['IV', 1, 1], ['V/V', 1, 1], ['V7/V', 0, 1]],
  minor: [['ii°', 1, 5], ['iv', 0, 4], ['iiø7', 1, 3], ['iv', 1, 1], ['V/V', 1, 1]]
};

function weightedPick(items, weightOf, rng) {
  const total = items.reduce((s, it) => s + Math.max(0, weightOf(it)), 0);
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

/** Root-motion multiplier (diatonic degree difference, ascending, mod 7). */
function rootMotionFactor(prev, next) {
  const diff = Chords.mod(next.degree - prev.degree, 7);
  if (diff === 0) {
    if (prev.numeral === next.numeral && prev.inversion === next.inversion) return 0.05;
    return 0.7; // I -> I6 etc.
  }
  return { 3: 1.6, 4: 1.0, 5: 1.1, 2: 0.6, 1: 0.9, 6: 0.45 }[diff];
}

function makeChord(numeral, inversion, tonic, mode, extra = {}) {
  const c = Chords.realizeNumeral(numeral, tonic, mode);
  const inv = Math.min(inversion, c.pcs.length - 1);
  return { ...c, inversion: inv, bassPC: c.pcs[inv], beats: 2, ...extra };
}

/**
 * Builds the cadence formula for a phrase of `len` slots.
 * Returns { chords (with slot offsets), bodyLength }.
 */
function cadenceFormula(type, len, tonic, mode, rng) {
  const tonicNumeral = mode === 'minor' ? 'i' : 'I';
  const pd = () => {
    const [n, inv] = weightedPick(PREDOMINANTS[mode], x => x[2], rng);
    return makeChord(n, inv, tonic, mode, { role: 'predominant' });
  };
  const goal = (numeral, inv = 0, extra = {}) =>
    makeChord(numeral, inv, tonic, mode, { beats: 4, role: 'goal', cadence: type, ...extra });

  let formula;
  if (type === 'PAC' || type === 'IAC' || type === 'DC') {
    const goalChord = type === 'DC'
      ? goal(mode === 'minor' ? 'VI' : 'vi')
      : goal(tonicNumeral, 0, { sopranoTarget: type === 'PAC' ? 'root' : 'notRoot' });
    const useCad64 = len >= 6 && rng() < 0.55;
    if (useCad64) {
      // PD (weak) | I6/4 (strong) V(7) (weak) | I (bar)
      formula = [pd(), makeChord(tonicNumeral, 2, tonic, mode, { role: 'cad64' }),
        makeChord(rng() < 0.5 ? 'V7' : 'V', 0, tonic, mode, { role: 'dominant' }), goalChord];
    } else {
      // PD (strong) V7 (weak) | I (bar)
      formula = [pd(), makeChord(rng() < 0.6 ? 'V7' : 'V', 0, tonic, mode, { role: 'dominant' }), goalChord];
    }
  } else if (type === 'PHC') {
    // Phrygian half cadence (minor): iv6 -> V
    formula = [makeChord('iv', 1, tonic, mode, { role: 'predominant' }),
      goal('V', 0)];
  } else {
    // Half cadence: PD (weak) | V (bar)
    formula = [pd(), goal('V', 0)];
  }
  const slots = formula.reduce((s, c) => s + c.beats / 2, 0);
  return { formula, bodyLength: Math.max(0, len - slots) };
}

/**
 * Samples the body of a phrase with a functional Markov chain,
 * root-motion preferences and metric rules. Several candidates are drawn and
 * the best scoring one (with a little randomness) is kept.
 */
function sampleBody(length, tonic, mode, rng, { startChord, cadenceFirst, startSlot = 0 }) {
  const vocab = VOCAB[mode];
  const all = Object.entries(vocab).flatMap(([f, list]) => list.map(([n, inv, w]) => ({ n, inv, w, f })));
  const realized = {};
  const get = (n, inv) => {
    const k = `${n}|${inv}`;
    if (!realized[k]) realized[k] = makeChord(n, inv, tonic, mode);
    return realized[k];
  };

  let best = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < 24; attempt++) {
    const body = [];
    let score = 0;
    let prev = startChord;
    let prevF = startChord ? (FUNCTION_OF[mode][startChord.numeral] || 'T') : null;

    for (let i = 0; i < length; i++) {
      const slot = startSlot + i;
      let pick;
      if (i === 0 && !startChord) {
        pick = { n: mode === 'minor' ? 'i' : 'I', inv: 0, f: 'T', w: 1 };
      } else {
        pick = weightedPick(all, (c) => {
          const chord = get(c.n, c.inv);
          let w = c.w * TRANSITIONS[prevF][c.f];
          w *= rootMotionFactor(prev, chord);
          // A seventh chord / leading-tone chord must resolve to tonic function
          if ((prev.seventh || prev.isDominant) && c.f !== 'T') w *= 0.08;
          // Same chord from weak to strong slot = syncopated harmony
          if (slot % 2 === 0 && prev.numeral === c.n) w *= 0.15;
          // Inversions on strong slots are a bit weaker
          if (slot % 2 === 0 && c.inv > 0) w *= 0.7;
          return w;
        }, rng);
      }
      const chord = get(pick.n, pick.inv);
      if (prev) score += Math.log(rootMotionFactor(prev, chord) + 0.01);
      body.push(chord);
      prev = chord;
      prevF = pick.f;
    }

    // Transition into the cadence
    if (prev && cadenceFirst) {
      score += Math.log(rootMotionFactor(prev, cadenceFirst) + 0.01) * 1.5;
      if (prev.isDominant || prev.seventh) score -= 3; // D -> PD retrogression
      if (prev.numeral === cadenceFirst.numeral) score -= 2;
    }
    // Variety
    score += new Set(body.map(c => c.numeral)).size * 0.4;
    score += rng() * 1.5;

    if (score > bestScore) { bestScore = score; best = body; }
  }
  return best.map(c => ({ ...c }));
}

/** Related keys for the tonal plan. */
function relatedKeys(tonic, mode) {
  const t = (iv) => Note.pitchClass(Note.transpose(tonic, iv));
  if (mode === 'major') {
    return [
      { tonic: t('5P'), mode: 'major', label: 'V' },
      { tonic: t('6M'), mode: 'minor', label: 'vi' },
      { tonic: t('4P'), mode: 'major', label: 'IV' },
      { tonic: t('2M'), mode: 'minor', label: 'ii' },
      { tonic: t('3M'), mode: 'minor', label: 'iii' }
    ];
  }
  return [
    { tonic: t('3m'), mode: 'major', label: 'III' },
    { tonic: t('5P'), mode: 'minor', label: 'v' },
    { tonic: t('4P'), mode: 'minor', label: 'iv' },
    { tonic: t('6m'), mode: 'major', label: 'VI' },
    { tonic: t('7m'), mode: 'major', label: 'VII' }
  ];
}

/** Chooses a pivot chord: diatonic in both the old and the new key. */
function pivotChord(prevKey, newKey, rng) {
  const vocab = VOCAB[newKey.mode];
  const options = Object.entries(vocab)
    .filter(([f]) => f !== 'D')
    .flatMap(([, list]) => list.filter(x => x[1] === 0))
    .map(([n, inv, w]) => ({ chord: makeChord(n, inv, newKey.tonic, newKey.mode), w }))
    .filter(o => Chords.chordFitsKey(o.chord, prevKey.tonic, prevKey.mode) &&
      o.chord.numeral !== (newKey.mode === 'minor' ? 'i' : 'I'));
  if (options.length === 0) return null;
  return weightedPick(options, o => o.w, rng).chord;
}

/**
 * Plans a whole piece.
 * @param {object} p - { tonic, mode, bars, rng, modulate }
 * @returns {{ chords: object[], phrases: object[] }}
 */
function planPiece({ tonic, mode, bars, rng, modulate = true, phraseBars = 4 }) {
  const totalSlots = Math.max(4, Math.round(bars) * 2);
  const phraseSlots = phraseBars * 2;
  const nPhrases = Math.max(1, Math.round(totalSlots / phraseSlots));

  // Phrase lengths (even, >= 4)
  const lengths = Array(nPhrases).fill(phraseSlots);
  lengths[nPhrases - 1] = Math.max(4, lengths[nPhrases - 1] + (totalSlots - phraseSlots * nPhrases));

  // Tonal plan
  const home = { tonic, mode };
  const related = relatedKeys(tonic, mode);
  const keys = [];
  const cadences = [];
  let relIdx = 0;
  for (let i = 0; i < nPhrases; i++) {
    const last = i === nPhrases - 1;
    if (i === 0 || last || !modulate || nPhrases < 3) {
      keys.push(home);
      if (last) cadences.push('PAC');
      else if (i === 0) cadences.push(nPhrases === 2 || rng() < 0.6 ? 'HC' : 'IAC');
      else cadences.push(rng() < 0.5 ? 'HC' : 'IAC');
    } else if (i === nPhrases - 2 && nPhrases >= 5) {
      // Return to the home key before the end (retransition on the dominant)
      keys.push(home);
      cadences.push(rng() < 0.6 ? 'HC' : 'DC');
    } else {
      // Primary related key first (V / III), then others
      const used = new Set(keys.map(k => k.label));
      let pickFrom = relIdx === 0 ? [related[0]] : related.slice(1, 4).filter(k => !used.has(k.label));
      if (pickFrom.length === 0) pickFrom = related.filter(k => k.label !== keys[keys.length - 1].label);
      const k = pickFrom[Math.floor(rng() * pickFrom.length)];
      relIdx++;
      keys.push({ tonic: k.tonic, mode: k.mode, label: k.label });
      cadences.push(rng() < 0.8 ? 'PAC' : 'IAC');
    }
  }
  // Minor-key half cadences are sometimes Phrygian
  cadences.forEach((c, i) => {
    if (c === 'HC' && keys[i].mode === 'minor' && rng() < 0.35) cadences[i] = 'PHC';
    if (c === 'DC' && i === nPhrases - 1) cadences[i] = 'PAC';
  });

  const chords = [];
  const phrases = [];
  let slot = 0;
  let prevKey = null;
  let lastChord = null;

  for (let i = 0; i < nPhrases; i++) {
    const key = keys[i];
    const len = lengths[i];
    const { formula, bodyLength } = cadenceFormula(cadences[i], len, key.tonic, key.mode, rng);

    let startChord = null;
    const changesKey = prevKey && (prevKey.tonic !== key.tonic || prevKey.mode !== key.mode);
    let body;
    if (changesKey && bodyLength >= 2) {
      const pivot = pivotChord(prevKey, key, rng);
      if (pivot) {
        startChord = { ...pivot, role: 'pivot' };
        body = [startChord, ...sampleBody(bodyLength - 1, key.tonic, key.mode, rng,
          { startChord, cadenceFirst: formula[0], startSlot: slot + 1 })];
      }
    }
    if (!body) {
      // After a deceptive cadence continue from vi; otherwise start on tonic
      body = sampleBody(bodyLength, key.tonic, key.mode, rng, {
        startChord: null, cadenceFirst: formula[0], startSlot: slot
      });
    }

    const phraseChords = [...body, ...formula];
    const startSlot = slot;
    phraseChords.forEach((c, idx) => {
      c.start = slot * 2; // in beats
      c.phrase = i;
      c.phraseIndex = idx;
      c.phraseLength = phraseChords.length;
      slot += c.beats / 2;
      chords.push(c);
    });
    phrases.push({
      index: i,
      key: key.tonic,
      mode: key.mode,
      cadence: cadences[i],
      startBeat: startSlot * 2,
      endBeat: slot * 2,
      label: key.label || 'tonic'
    });
    prevKey = key;
    lastChord = phraseChords[phraseChords.length - 1];
  }

  // Picardy third at the very end of minor pieces (common Baroque practice)
  if (mode === 'minor' && lastChord && rng() < 0.4) {
    const pic = makeChord('I', 0, tonic, 'minor', { beats: lastChord.beats, role: 'goal', cadence: 'PAC', sopranoTarget: 'root' });
    Object.assign(lastChord, { ...pic, start: lastChord.start, phrase: lastChord.phrase, phraseIndex: lastChord.phraseIndex, phraseLength: lastChord.phraseLength, picardy: true });
  }

  return { chords, phrases };
}

/** Human readable Roman-numeral string, e.g. "I - ii6 - V7 - I". */
function describe(chords) {
  const figures = (c) => {
    if (c.seventh) return ['7', '6/5', '4/3', '4/2'][c.inversion] || '7';
    return ['', '6', '6/4'][c.inversion] || '';
  };
  let currentKey = null;
  return chords.map((c, i) => {
    const base = c.numeral.replace('7', '');
    let s = base + figures(c);
    const k = `${c.key} ${c.mode}`;
    if (k !== currentKey && i > 0) s = `[${c.key}${c.mode === 'minor' ? 'm' : ''}] ` + s;
    currentKey = k;
    return s;
  }).join(' - ');
}

module.exports = { planPiece, describe, makeChord, cadenceFormula, sampleBody, VOCAB, relatedKeys };
