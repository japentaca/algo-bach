/**
 * Quality analyzer for generated pieces.
 *
 * Measures objective counterpoint/harmony problems in the generator output so
 * algorithm changes can be compared numerically.
 *
 * Usage:  node analyze_quality.js            (summary over many seeds)
 *         node analyze_quality.js --verbose  (per-configuration rows)
 */
const { Note, Scale } = require('tonal');
const { generatePiece } = require('./src/main');

const BEATS = {
  '1n': 4, '2n.': 3, '2n': 2, '4n.': 1.5, '4n': 1,
  '8n.': 0.75, '8n': 0.5, '16n': 0.25, '32n': 0.125
};
const RANGES = [['C4', 'A5'], ['G3', 'D5'], ['C3', 'G4'], ['E2', 'C4']].map(r => r.map(Note.midi));

function keyPitchClasses(key, mode) {
  const scales = mode === 'minor'
    ? ['natural minor', 'harmonic minor', 'melodic minor']
    : ['major'];
  const set = new Set();
  scales.forEach(s => Scale.get(`${key} ${s}`).notes.forEach(n => set.add(Note.chroma(n))));
  return set;
}

function analyze(piece, key, mode) {
  // Trill / mordent notes are measured as their main note (the ornament
  // decorates it; its upper/lower note is not an independent voice motion)
  const src = piece.notes.map((n, i, all) => {
    if (n.type !== 'trill' && n.type !== 'mordent') return n;
    const main = all.find(m => m.voice === n.voice && m.startTime > n.startTime &&
      (m.type === 'trill-resolution' || m.type === 'mordent-resolution'));
    return main ? { ...n, pitch: main.pitch } : n;
  });
  const notes = src.map(n => ({
    midi: Note.midi(n.pitch),
    start: Math.round(n.startTime * 8) / 8,
    end: Math.round((n.startTime + (n.beats || BEATS[n.duration] || 2)) * 8) / 8,
    voice: n.voice
  })).filter(n => n.midi !== null && n.midi !== undefined);

  const end = Math.max(...notes.map(n => n.end));
  // Local key per time (phrases / fugue sections), falling back to the home key
  const markers = Array.isArray(piece.meta.phraseMarkers) ? piece.meta.phraseMarkers : [];
  const keySets = {};
  const inKeyAt = (t, pc) => {
    const m = markers.find(p => t >= p.startBeat - 1e-6 && t < p.endBeat - 1e-6);
    const k = m ? `${m.key} ${m.mode}` : `${key} ${mode}`;
    if (!keySets[k]) keySets[k] = keyPitchClasses(...k.split(' '));
    return keySets[k].has(pc);
  };

  const stats = {
    notes: notes.length,
    beats: end,
    chromatic: 0,        // notes outside the key (all minor forms allowed)
    sameVoiceOverlap: 0, // two notes sounding at once in the same voice
    strongDiss: 0,       // downbeats with a 2nd / 7th / 9th against the bass
    parallels: 0,        // consecutive 5ths / 8ves between any voice pair
    crossings: 0,        // beats where voice order S>A>T>B is violated
    outOfRange: 0,
    bigLeaps: 0,         // melodic leaps larger than an octave
    silentVoiceBeats: 0  // beats where a voice is silent (texture holes)
  };

  notes.forEach(n => {
    if (!inKeyAt(n.start, ((n.midi % 12) + 12) % 12)) stats.chromatic++;
    const [lo, hi] = RANGES[n.voice] || [0, 127];
    if (n.midi < lo || n.midi > hi) stats.outOfRange++;
  });

  const byVoice = [0, 1, 2, 3].map(v => notes.filter(n => n.voice === v).sort((a, b) => a.start - b.start));
  byVoice.forEach(vn => {
    for (let i = 1; i < vn.length; i++) {
      if (vn[i].start < vn[i - 1].end - 1e-6) stats.sameVoiceOverlap++;
      if (Math.abs(vn[i].midi - vn[i - 1].midi) > 12) stats.bigLeaps++;
    }
  });

  // Pitch of each voice sounding at time t (latest onset wins)
  const soundingAt = (v, t) => {
    let best = null;
    for (const n of byVoice[v]) {
      if (n.start > t + 1e-6) break;
      if (n.end > t + 1e-6) best = n;
    }
    return best ? best.midi : null;
  };

  let prev = null;
  for (let t = 0; t < end; t += 1) {
    const cur = [0, 1, 2, 3].map(v => soundingAt(v, t));
    cur.forEach(p => { if (p === null) stats.silentVoiceBeats++; });

    // Crossing
    const present = cur.map((p, v) => ({ p, v })).filter(x => x.p !== null);
    for (let i = 1; i < present.length; i++) {
      if (present[i].p > present[i - 1].p) { stats.crossings++; break; }
    }

    // Unprepared strong-beat dissonance against the lowest voice (2nds, 9ths,
    // major 7ths; a note held over from before is a prepared suspension and the
    // minor 7th of seventh chords is not counted)
    if (t % 2 === 0 && present.length >= 2) {
      const bass = Math.min(...present.map(x => x.p));
      const bad = present.some(x => {
        if (![1, 2, 11].includes((x.p - bass) % 12)) return false;
        const prepared = prev && prev[x.v] === x.p && t > 0;
        return !prepared;
      });
      if (bad) stats.strongDiss++;
    }

    // Parallels
    if (prev) {
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 4; b++) {
          if ([prev[a], prev[b], cur[a], cur[b]].some(p => p === null)) continue;
          const i1 = ((prev[a] - prev[b]) % 12 + 12) % 12;
          const i2 = ((cur[a] - cur[b]) % 12 + 12) % 12;
          const moveA = cur[a] - prev[a];
          const moveB = cur[b] - prev[b];
          if (moveA === 0 || moveB === 0 || Math.sign(moveA) !== Math.sign(moveB)) continue;
          if ((i1 === 7 && i2 === 7) || (i1 === 0 && i2 === 0)) stats.parallels++;
        }
      }
    }
    prev = cur;
  }
  return stats;
}

function strip(piece) {
  return JSON.stringify(piece.notes.map(n => [n.pitch, n.duration, n.voice, Math.round(n.startTime * 8)]));
}

function run() {
  const verbose = process.argv.includes('--verbose');
  const forms = ['Chorale', 'Prelude', 'Suite', 'Fugue'];
  const configs = [['C', 'major'], ['G', 'major'], ['F', 'major'], ['A', 'minor'], ['D', 'minor'], ['Eb', 'major']];
  const seeds = ['s1', 's2', 's3', 's4'];

  const totals = {};
  let deterministic = 0, determinismRuns = 0;

  forms.forEach(form => {
    const agg = {};
    configs.forEach(([key, mode]) => {
      seeds.forEach(seed => {
        const opts = { form, key, mode, duration: 16, seed, ornamentDensity: 50 };
        const piece = generatePiece(opts);
        const s = analyze(piece, key, mode);
        Object.entries(s).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; });
        if (seed === 's1') {
          determinismRuns++;
          if (strip(piece) === strip(generatePiece(opts))) deterministic++;
        }
        if (verbose) console.log(form, key, mode, seed, JSON.stringify(s));
      });
    });
    totals[form] = agg;
  });

  console.log('\nPer-form rates (per 100 beats unless noted):');
  const rows = Object.entries(totals).map(([form, a]) => {
    const per100 = k => (100 * a[k] / a.beats).toFixed(1);
    return {
      form,
      beats: a.beats,
      'chromatic %notes': (100 * a.chromatic / a.notes).toFixed(1),
      parallels: per100('parallels'),
      strongDiss: per100('strongDiss'),
      overlapSameVoice: per100('sameVoiceOverlap'),
      crossings: per100('crossings'),
      outOfRange: per100('outOfRange'),
      bigLeaps: per100('bigLeaps'),
      'silent %voice-beats': (100 * a.silentVoiceBeats / (4 * a.beats)).toFixed(1)
    };
  });
  console.table(rows);
  console.log(`Deterministic with same seed: ${deterministic}/${determinismRuns}`);
}

if (require.main === module) run();
module.exports = { analyze };
