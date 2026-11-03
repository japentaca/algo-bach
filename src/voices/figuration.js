const Chords = require('../theory/chords');
const { RANGES } = require('./voicing');

/**
 * Figuration: turns the voiced chord skeleton into idiomatic textures.
 *
 * Instead of stacking block chords and then mutating them with independent
 * post-processing passes (which re-introduced dissonances and doubled notes),
 * every texture here is derived from the voice-led skeleton, keeps each voice
 * monophonic, uses only notes of the local key (including the chord's own
 * chromatic tones) and finishes with a repair pass that removes any
 * embellishment that creates parallel 5ths/8ves or accented clashes.
 */

const mod12 = (n) => ((n % 12) + 12) % 12;
const HARD_RANGES = [[60, 81], [55, 74], [48, 67], [40, 60]];

// ---------------------------------------------------------------- scales

/**
 * 7-note scale (as pitch-class set) to use for melodic motion over a chord.
 * Letter-based: the chord's own (possibly chromatic) tones replace the
 * diatonic note with the same letter. Minor uses melodic minor ascending,
 * natural descending, and avoids the augmented 2nd.
 */
function localScale(chord, dir = 0) {
  const scale = Chords.keyScale(chord.key, chord.mode);
  const byLetter = {};
  scale.forEach(n => { byLetter[n[0]] = mod12(require('tonal').Note.chroma(n)); });
  const letters = scale.map(n => n[0]);
  if (chord.mode === 'minor' && dir > 0) {
    byLetter[letters[5]] = mod12(byLetter[letters[5]] + 1);
    byLetter[letters[6]] = mod12(byLetter[letters[6]] + 1);
  }
  (chord.names || []).forEach((n, i) => { byLetter[n[0]] = chord.pcs[i]; });
  if (chord.mode === 'minor') {
    const six = byLetter[letters[5]], seven = byLetter[letters[6]];
    if (mod12(seven - six) === 3) {
      // Augmented second between 6 and 7: raise 6 unless the chord holds it
      const chordHasSix = (chord.names || []).some(n => n[0] === letters[5]);
      if (!chordHasSix) byLetter[letters[5]] = mod12(six + 1);
      else byLetter[letters[6]] = mod12(seven - 1);
    }
  }
  return new Set(Object.values(byLetter));
}

/** Scale notes strictly between a and b (in order from a to b). */
function scalePath(a, b, scaleSet) {
  const out = [];
  const dir = Math.sign(b - a);
  if (dir === 0) return out;
  for (let m = a + dir; dir > 0 ? m < b : m > b; m += dir) {
    if (scaleSet.has(mod12(m))) out.push(m);
  }
  return out;
}

function stepFrom(m, dir, scaleSet) {
  for (let d = 1; d <= 2; d++) {
    const c = m + dir * d;
    if (scaleSet.has(mod12(c))) return c;
  }
  return m + dir * 2;
}

// ---------------------------------------------------------------- helpers

function note(voice, midi, start, dur, type, chordIndex, extra = {}) {
  return { voice, midi, start, dur, type, chordIndex, ...extra };
}

function plain(voice, midi, chord, k, type = 'chord') {
  return [note(voice, midi, chord.start, chord.beats, type, k)];
}

const isLastPhraseEnd = (chords, k) => k === chords.length - 1;

/** Generic density probability with voice weighting. */
function chance(rng, density, voice, base = 1) {
  const w = [1.0, 0.8, 0.7, 0.6][voice];
  return rng() < Math.min(0.95, density * w * base);
}

// ---------------------------------------------------------------- chorale

/**
 * Chorale texture: chords on the half note, quarter/eighth passing tones,
 * neighbor notes and prepared suspensions (4-3, 7-6, 9-8). Phrase endings
 * are held (fermata feel).
 */
function choraleVoice(chords, voicings, voice, rng, density, opts = {}) {
  const out = [];
  const suspendedInto = new Set();
  for (let k = 0; k < chords.length; k++) {
    const chord = chords[k];
    const m = voicings[k][voice];
    if (m === null) continue;
    const next = k + 1 < chords.length ? voicings[k + 1][voice] : null;
    const nextChord = chords[k + 1];
    if (suspendedInto.has(k)) continue; // this span was already written (resolution)

    // --- prepared suspension into next chord (tie over the downbeat)
    if (voice !== 3 && next !== null && nextChord && chord.beats === 2 && nextChord.beats >= 2 &&
      nextChord.start % 2 === 0 && !opts.noSuspensions &&
      (m - next === 1 || m - next === 2) && !nextChord.pcs.includes(mod12(m)) &&
      !voicings[k + 1].some((x, v) => v !== voice && v !== 3 && x !== null && mod12(x) === mod12(next)) &&
      chance(rng, density, voice, 0.45)) {
      out.push(note(voice, m, chord.start, chord.beats + 1, 'suspension', k));
      out.push(note(voice, next, nextChord.start + 1, nextChord.beats - 1, 'resolution', k + 1));
      suspendedInto.add(k + 1);
      continue;
    }

    const hold = chord.beats !== 2 || next === null || chord.role === 'goal' || opts.sustainOnly;
    if (hold) { out.push(...plain(voice, m, chord, k)); continue; }

    const dir = Math.sign(next - m);
    const path = scalePath(m, next, localScale(chord, dir));
    const t = chord.start;

    if (path.length === 1 && chance(rng, density, voice, 1.4)) {
      out.push(note(voice, m, t, 1, 'chord', k));
      out.push(note(voice, path[0], t + 1, 1, 'passing', k));
    } else if (path.length === 2 && chance(rng, density, voice, 1.1)) {
      out.push(note(voice, m, t, 1, 'chord', k));
      out.push(note(voice, path[0], t + 1, 0.5, 'passing', k));
      out.push(note(voice, path[1], t + 1.5, 0.5, 'passing', k));
    } else if (path.length === 0 && Math.abs(next - m) <= 2 && next !== m && chance(rng, density, voice, 0.25)) {
      // anticipation-like escape: chord tone then step toward next
      out.push(note(voice, m, t, 1.5, 'chord', k));
      out.push(note(voice, next, t + 1.5, 0.5, 'anticipation', k));
    } else if (next === m && voice !== 3 && chance(rng, density, voice, 0.2)) {
      const nb = stepFrom(m, rng() < 0.5 ? 1 : -1, localScale(chord, 0));
      out.push(note(voice, m, t, 1, 'chord', k));
      out.push(note(voice, nb, t + 1, 0.5, 'neighbor', k));
      out.push(note(voice, m, t + 1.5, 0.5, 'neighbor-return', k));
    } else if (voice === 3 && Math.abs(next - m) >= 5 && chance(rng, density, voice, 0.35)) {
      // bass octave leap
      const oct = m - 12 >= HARD_RANGES[3][0] ? m - 12 : m + 12;
      if (oct <= HARD_RANGES[3][1] && (voicings[k][2] === null || oct < voicings[k][2])) {
        out.push(note(voice, m, t, 1, 'chord', k));
        out.push(note(voice, oct, t + 1, 1, 'octave', k));
      } else out.push(...plain(voice, m, chord, k));
    } else {
      out.push(...plain(voice, m, chord, k));
    }
  }
  return out;
}

// ---------------------------------------------------------------- arpeggio (prelude)

const ARP_CELLS = [
  [2, 1, 0, 1],   // T A S A
  [0, 1, 2, 1],   // S A T A
  [2, 0, 1, 0],   // T S A S
  [1, 0, 2, 0]    // A S T S
];

function arpeggioTexture(chords, voicings, rng) {
  const out = [];
  let cell = ARP_CELLS[0];
  let phrase = -1;
  chords.forEach((chord, k) => {
    if (chord.phrase !== phrase) {
      phrase = chord.phrase;
      cell = ARP_CELLS[Math.floor(rng() * ARP_CELLS.length)];
    }
    const v = voicings[k];
    const last = isLastPhraseEnd(chords, k);
    if (last) {
      [0, 1, 2, 3].forEach(i => out.push(note(i, v[i], chord.start, chord.beats, 'chord', k)));
      return;
    }
    out.push(note(3, v[3], chord.start, chord.beats, 'chord', k));
    // Notes of each upper voice ring until that voice's next onset in the cell
    const onsets = cell.map((voice, i) => ({ voice, i }));
    for (let beat = 0; beat < chord.beats; beat++) {
      onsets.forEach(({ voice, i }) => {
        let gap = 4;
        for (let d = 1; d <= 4; d++) { if (cell[(i + d) % 4] === voice) { gap = d; break; } }
        const onset = chord.start + beat + i * 0.25;
        const dur = Math.min(gap * 0.25, chord.start + chord.beats - onset);
        out.push(note(voice, v[voice], onset, dur, 'arpeggio', k));
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------- melodic diminution

/**
 * Soprano diminution of one chord span: fills the span with the rhythmic cell,
 * starting on the structural note and leading to the next structural note.
 * Beam search over candidate pitches; accented positions must be chord tones,
 * non-chord tones must be approached and left by step.
 */
function diminish(start, target, chord, cell, rng, motifDirs, voice = 0, bounds = null) {
  const onsets = [];
  let acc = 0;
  cell.forEach(d => { onsets.push(acc); acc += d; });
  const n = cell.length;
  if (n === 1) return [start];

  const up = localScale(chord, 1), down = localScale(chord, -1);
  let [lo, hi] = HARD_RANGES[voice];
  if (bounds) { lo = Math.max(lo, bounds.min); hi = Math.min(hi, bounds.max); }
  const isChordTone = (m) => chord.pcs.includes(mod12(m));

  let beam = [{ seq: [start], cost: 0 }];
  for (let i = 1; i < n; i++) {
    const accented = onsets[i] % 1 === 0;
    const nextBeam = [];
    beam.forEach(state => {
      const prev = state.seq[state.seq.length - 1];
      for (let m = prev - 7; m <= prev + 7; m++) {
        if (m < lo || m > hi) continue;
        const d = m - prev;
        const ct = isChordTone(m);
        const scaleSet = d >= 0 ? up : down;
        if (!ct && !scaleSet.has(mod12(m))) continue;
        let cost = 0;
        if (!ct) {
          if (Math.abs(d) > 2) continue;      // NCT approached by step
          if (accented) cost += 6;            // accented passing tone (rare)
        } else if (Math.abs(d) > 2 && Math.abs(d) !== 12) {
          cost += Math.abs(d) * 0.45;         // arpeggiation leap
        }
        if (d === 0) cost += 3;
        if (Math.abs(d) === 6) cost += 10;
        // Previous NCT must be left by step
        const prevPrev = state.seq.length >= 2 ? state.seq[state.seq.length - 2] : null;
        if (state.lastNCT && Math.abs(d) > 2) continue;
        if (state.lastNCT && prevPrev !== null && Math.sign(d) !== Math.sign(prev - prevPrev) && d !== 0) cost += 0.6; // neighbor
        // Follow the phrase motif contour
        if (motifDirs && motifDirs[i - 1] !== undefined && Math.sign(d) !== motifDirs[i - 1]) cost += 0.9;
        // last note should lead smoothly into the target
        if (i === n - 1 && target !== null) {
          const toT = Math.abs(target - m);
          if (toT === 0) cost += 3;
          else if (toT <= 2) cost -= 0.5;
          else if (toT > 4) cost += toT * 0.6;
          if (!ct && toT > 2) continue;
        }
        cost += rng() * 0.8;
        nextBeam.push({ seq: [...state.seq, m], cost: state.cost + cost, lastNCT: !ct });
      }
    });
    nextBeam.sort((a, b) => a.cost - b.cost);
    beam = nextBeam.slice(0, 14);
    if (beam.length === 0) return null;
  }
  return beam[0].seq;
}

function melodyVoice(chords, voicings, rng, density, cells, voice = 0) {
  const out = [];
  let phrase = -1, cell = cells[0], motifDirs = null;
  for (let k = 0; k < chords.length; k++) {
    const chord = chords[k];
    const m = voicings[k][voice];
    const target = k + 1 < chords.length ? voicings[k + 1][voice] : null;
    if (chord.phrase !== phrase) {
      phrase = chord.phrase;
      cell = cells[Math.floor(rng() * cells.length)];
      motifDirs = null;
    }
    if (chord.beats !== 2 || target === null || rng() > 0.35 + density * 0.65) {
      out.push(...plain(voice, m, chord, k));
      continue;
    }
    const below = voicings[k][voice + 1];
    const seq = diminish(m, target, chord, cell, rng, motifDirs, voice,
      below !== null && below !== undefined ? { min: below + 1, max: 127 } : null);
    if (!seq) { out.push(...plain(voice, m, chord, k)); continue; }
    if (!motifDirs) motifDirs = seq.slice(1).map((x, i) => Math.sign(x - seq[i]));
    let t = chord.start;
    seq.forEach((p, i) => {
      out.push(note(voice, p, t, cell[i], i === 0 ? 'chord' : (chord.pcs.includes(mod12(p)) ? 'arpeggiation' : 'passing'), k));
      t += cell[i];
    });
  }
  return out;
}

// ---------------------------------------------------------------- bass styles

function bassVoice(chords, voicings, rng, density, style) {
  if (style === 'sustain') return choraleVoice(chords, voicings, 3, rng, density * 0.5, { noSuspensions: true });
  const out = [];
  for (let k = 0; k < chords.length; k++) {
    const chord = chords[k];
    const m = voicings[k][3];
    const next = k + 1 < chords.length ? voicings[k + 1][3] : null;
    const t = chord.start;
    if (next === null || chord.beats !== 2) { out.push(...plain(3, m, chord, k)); continue; }

    const scale = localScale(chord, Math.sign(next - m));
    const approach = (() => {
      // a step above or below the next bass note, preferring scale tones
      const opts = [next + 1, next - 1, next + 2, next - 2].filter(x => scale.has(mod12(x)) || chord.pcs.includes(mod12(x)));
      return opts.sort((a, b) => Math.abs(a - m) - Math.abs(b - m))[0];
    })();
    const above = voicings[k][2];
    const inRange = (x) => x >= HARD_RANGES[3][0] && x <= HARD_RANGES[3][1] && (above === null || x < above);

    if (style === 'drum') {
      const last = Math.abs(next - m) <= 2 || !inRange(approach) ? m : approach;
      [m, m, m, last].forEach((p, i) => out.push(note(3, p, t + i * 0.5, 0.5, i === 3 && p !== m ? 'passing' : 'chord', k)));
      continue;
    }

    if (style === 'walking8') {
      const path = scalePath(m, next, scale);
      let seq, rhythm;
      if (path.length >= 3) { seq = [m, ...path.slice(0, 3)]; rhythm = [0.5, 0.5, 0.5, 0.5]; }
      else if (path.length === 2) { seq = [m, ...path]; rhythm = [1, 0.5, 0.5]; }
      else {
        const third = nearestPC(m, chord.pcs[1], 1);
        const fifth = nearestPC(m, chord.pcs[2], 1);
        const a = inRange(approach) ? approach : m;
        seq = Math.abs(a - fifth) <= 4 ? [m, third, fifth, a] : [m, inRange(m + 12) ? m + 12 : fifth, fifth, a];
        rhythm = [0.5, 0.5, 0.5, 0.5];
        if (path.length === 1 && rng() < 0.5) { seq = [m, path[0]]; rhythm = [1, 1]; }
      }
      seq = seq.map(p => (inRange(p) ? p : m));
      let tt = t;
      seq.forEach((p, i) => {
        out.push(note(3, p, tt, rhythm[i], i === 0 ? 'chord' : (chord.pcs.includes(mod12(p)) ? 'arpeggiation' : 'passing'), k));
        tt += rhythm[i];
      });
      continue;
    }

    // walking4 (quarters)
    const path = scalePath(m, next, scale);
    let second;
    if (path.length === 1) second = path[0];
    else if (inRange(approach) && rng() < 0.6) second = approach;
    else second = inRange(m + 12) && rng() < 0.5 ? m + 12 : (inRange(m - 12) ? m - 12 : m);
    out.push(note(3, m, t, 1, 'chord', k));
    out.push(note(3, second, t + 1, 1, chord.pcs.includes(mod12(second)) ? 'octave' : 'passing', k));
  }
  return out;
}

function nearestPC(m, pc, dir) {
  for (let d = 1; d <= 12; d++) {
    const c = m + dir * d;
    if (mod12(c) === pc) return c;
  }
  return m;
}

// ---------------------------------------------------------------- repair

/** Pitch sounding in a sorted line at time t. */
function soundingAt(line, t) {
  let found = null;
  for (const n of line) {
    if (n.start > t + 1e-9) break;
    if (n.start + n.dur > t + 1e-9) found = n;
  }
  return found;
}

const PROTECTED = new Set(['subject', 'answer', 'countersubject', 'episode']);
const isFigure = (n) => n.type !== 'chord' && !PROTECTED.has(n.type);

/**
 * Finds counterpoint violations in the rendered lines:
 *  - parallel 5ths/8ves between consecutive onsets AND between consecutive
 *    beats (accented parallels across intervening notes),
 *  - voice crossing,
 *  - two embellishments clashing (2nd/7th) at the same onset,
 *  - an accented embellishment clashing with the bass on a strong beat.
 * Returns a list of violations, each with the notes involved.
 * `win` = { voice, t0, t1 } restricts the search (used for local re-checks).
 */
function findViolations(lines, win = null) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (win && i !== win.voice && j !== win.voice) continue;
      const A = lines[i], B = lines[j];
      if (!A.length || !B.length) continue;
      const inWin = (t) => !win || (t >= win.t0 - 1e-9 && t <= win.t1 + 1e-9);
      const onsets = [...new Set([...A, ...B].map(n => n.start))].filter(inWin).sort((x, y) => x - y);
      const checkPair = (t0, t1, kind) => {
        const pa = soundingAt(A, t0), pb = soundingAt(B, t0);
        const a = soundingAt(A, t1), b = soundingAt(B, t1);
        if (!pa || !pb || !a || !b) return;
        const da = a.midi - pa.midi, db = b.midi - pb.midi;
        if (da === 0 || db === 0 || Math.sign(da) !== Math.sign(db)) return;
        const ip = mod12(pa.midi - pb.midi), ic = mod12(a.midi - b.midi);
        if (ip === ic && (ic === 0 || ic === 7)) out.push({ kind, notes: [a, b, pa, pb] });
      };
      for (let k = 1; k < onsets.length; k++) checkPair(onsets[k - 1], onsets[k], 'parallel');
      const tEnd = Math.max(A[A.length - 1].start, B[B.length - 1].start);
      for (let t = 1; t <= tEnd; t++) if (inWin(t)) checkPair(t - 1, t, 'beat-parallel');

      onsets.forEach(t => {
        const a = soundingAt(A, t), b = soundingAt(B, t);
        if (!a || !b) return;
        if (a.midi < b.midi) out.push({ kind: 'crossing', notes: [a, b] });
        if (a.start === t && b.start === t && isFigure(a) && isFigure(b) && [1, 2, 10, 11].includes(mod12(a.midi - b.midi))) {
          out.push({ kind: 'clash', notes: [a, b] });
        }
        if (t % 2 === 0 && j === 3 && a.start === t && isFigure(a) && a.type !== 'suspension' &&
          [1, 2, 6, 10, 11].includes(mod12(a.midi - b.midi))) {
          out.push({ kind: 'accent', notes: [a] });
        }
      });
    }
  }
  return out;
}

function plainSpan(lines, v, k, chords, voicings) {
  const chord = chords[k];
  lines[v] = lines[v].filter(n => n.chordIndex !== k || PROTECTED.has(n.type));
  const prevTie = lines[v].find(n => n.chordIndex === k - 1 && n.type === 'suspension');
  if (prevTie) { prevTie.dur = chords[k - 1].beats; prevTie.type = 'chord'; }
  const res = lines[v].find(n => n.chordIndex === k + 1 && n.type === 'resolution');
  if (res && !lines[v].some(x => x.type === 'suspension' && x.chordIndex === k)) {
    res.start = chords[k + 1].start; res.dur = chords[k + 1].beats; res.type = 'chord';
  }
  const n = note(v, voicings[k][v], chord.start, chord.beats, 'chord', k);
  lines[v].push(n);
  lines[v].sort((a, b) => a.start - b.start);
  return n;
}

/** Tries another chord tone for a plain (skeleton) note of a free voice. */
function repitch(lines, n, chords) {
  const chord = chords[n.chordIndex];
  if (!chord) return false;
  const [lo, hi] = HARD_RANGES[n.voice];
  const win = { voice: n.voice, t0: n.start - 2, t1: n.start + n.dur + 2 };
  const before = findViolations(lines, win).length;
  const original = n.midi;
  let best = null, bestCount = before;
  for (let m = original - 7; m <= original + 7; m++) {
    if (m === original || m < lo || m > hi) continue;
    if (!chord.pcs.includes(mod12(m))) continue;
    if (n.voice === 3 && mod12(m) !== chord.bassPC && !(chord.quality !== 'dim' && [chord.pcs[0], chord.pcs[1]].includes(mod12(m)))) continue;
    n.midi = m;
    const count = findViolations(lines, win).length;
    if (count < bestCount || (count === bestCount && best !== null && Math.abs(m - original) < Math.abs(best - original))) {
      if (count < bestCount) { bestCount = count; best = m; }
    }
  }
  n.midi = best !== null ? best : original;
  return best !== null;
}

/**
 * Removes violations: embellishments are reverted to the plain chord tone;
 * if only skeleton notes are involved (fugue free voices), another chord
 * tone is tried. Fixed thematic lines are never altered.
 */
function repair(lines, chords, voicings, { allowRepitch = false } = {}) {
  for (let iter = 0; iter < 10; iter++) {
    const violations = findViolations(lines);
    if (violations.length === 0) break;
    let changed = false;
    const touched = new Set();
    violations.forEach(({ notes }) => {
      const figures = notes.filter(isFigure);
      if (figures.length) {
        figures.forEach(n => {
          const key = `${n.voice}|${n.chordIndex}`;
          if (touched.has(key) || voicings[n.chordIndex] === undefined) return;
          touched.add(key);
          plainSpan(lines, n.voice, n.chordIndex, chords, voicings);
          changed = true;
        });
      } else if (allowRepitch) {
        const free = notes.filter(n => n.type === 'chord').sort((a, b) => [1, 2, 0, 3].indexOf(a.voice) - [1, 2, 0, 3].indexOf(b.voice));
        for (const n of free) {
          const key = `${n.voice}|${n.chordIndex}|r`;
          if (touched.has(key)) continue;
          touched.add(key);
          if (repitch(lines, n, chords)) { changed = true; break; }
        }
      }
    });
    if (!changed) break;
  }
  return lines;
}

// ---------------------------------------------------------------- textures

const FORM_STYLES = {
  chorale: { texture: 'chorale' },
  prelude: { texture: 'arpeggio' },
  suite: { soprano: [[0.25, 0.25, 0.25, 0.25, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [0.5, 0.25, 0.25, 0.5, 0.5], [1, 0.5, 0.5]], bass: 'walking8' },
  allemande: { soprano: [[0.25, 0.25, 0.25, 0.25, 0.5, 0.5], [0.5, 0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]], bass: 'walking8' },
  courante: { soprano: [[1.5, 0.5], [0.5, 0.5, 1], [1, 0.5, 0.5]], bass: 'walking4' },
  gigue: { soprano: [[0.75, 0.25, 0.75, 0.25], [1.5, 0.5], [0.5, 0.5, 0.5, 0.5]], bass: 'walking4' },
  minuet: { soprano: [[1, 0.5, 0.5], [0.5, 0.5, 1], [1, 1]], bass: 'walking4' },
  sarabande: { soprano: [[1.5, 0.5], [2], [1, 1]], bass: 'sustain' },
  ritornello: { soprano: [[0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25], [0.5, 0.25, 0.25, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]], bass: 'drum' },
  passacaglia: { soprano: [[1, 1], [0.5, 0.5, 0.5, 0.5]], bass: 'sustain' }
};

/**
 * Renders a voiced progression with a texture.
 * @returns {object[]} notes {voice, midi, start, dur, type, chordIndex}
 */
function render(chords, voicings, { style, rng, density = 0.5 }) {
  const st = typeof style === 'string' ? (FORM_STYLES[style] || FORM_STYLES.suite) : style;
  let lines;
  if (st.texture === 'arpeggio') {
    const notes = arpeggioTexture(chords, voicings, rng);
    return notes;
  }
  if (st.texture === 'chorale') {
    lines = [0, 1, 2, 3].map(v => choraleVoice(chords, voicings, v, rng, density));
  } else {
    lines = [
      melodyVoice(chords, voicings, rng, density, st.soprano),
      choraleVoice(chords, voicings, 1, rng, density * 0.6),
      choraleVoice(chords, voicings, 2, rng, density * 0.6),
      bassVoice(chords, voicings, rng, density, st.bass || 'walking4')
    ];
  }
  lines.forEach(l => l.sort((a, b) => a.start - b.start));
  repair(lines, chords, voicings);
  return lines.flat();
}

module.exports = { render, repair, localScale, scalePath, stepFrom, diminish, FORM_STYLES, findViolations, soundingAt, PROTECTED };
