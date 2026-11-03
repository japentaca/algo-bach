const { localScale, stepFrom } = require('./figuration');

/**
 * Baroque ornaments placed where they belong stylistically, instead of on
 * random long notes:
 *  - cadential trill (starting on the upper note) on the soprano over the
 *    dominant that precedes an authentic cadence,
 *  - occasional mordents on long notes at phrase beginnings.
 * Fully seeded (no Math.random) so the same seed gives the same piece.
 */

function addOrnaments(notes, chords, { rng, density = 0.5 }) {
  const out = [];
  const byVoice = [0, 1, 2, 3].map(v => notes.filter(n => n.voice === v).sort((a, b) => a.start - b.start));

  byVoice.forEach((line, voice) => {
    line.forEach((n, idx) => {
      const chord = chords[n.chordIndex];
      const next = line[idx + 1];
      if (!chord || voice > 1 || n.type !== 'chord') { out.push(n); return; }

      // --- cadential trill
      const nextChord = chords[n.chordIndex + 1];
      const cadential = chord.role === 'dominant' && nextChord && nextChord.role === 'goal' &&
        ['PAC', 'IAC'].includes(nextChord.cadence);
      if (cadential && voice === 0 && n.dur >= 1 && rng() < 0.35 + 0.6 * density) {
        const upper = stepFrom(n.midi, 1, localScale(chord, 1));
        const step = n.dur >= 2 ? 0.25 : 0.125;
        const count = Math.max(2, Math.round((n.dur - 0.5) / step));
        for (let i = 0; i < count; i++) {
          out.push({ ...n, midi: i % 2 === 0 ? upper : n.midi, start: n.start + i * step, dur: step, type: 'trill' });
        }
        out.push({ ...n, start: n.start + count * step, dur: n.dur - count * step, type: 'trill-resolution' });
        return;
      }

      // --- mordent on a long note at the start of a phrase
      const phraseStart = chord.phraseIndex === 0 || chord.phraseIndex === 1;
      // (patterns chosen so every resulting duration has a standard note value)
      const MORDENT = { 1: 0.125, 1.5: 0.25, 2: 0.25 };
      if (phraseStart && MORDENT[n.dur] && n.start % 1 === 0 && rng() < density * 0.25 &&
        (!next || next.start >= n.start + n.dur)) {
        const step = MORDENT[n.dur];
        const lower = stepFrom(n.midi, -1, localScale(chord, -1));
        out.push({ ...n, dur: step, type: 'mordent' });
        out.push({ ...n, midi: lower, start: n.start + step, dur: step, type: 'mordent' });
        out.push({ ...n, start: n.start + 2 * step, dur: n.dur - 2 * step, type: 'mordent-resolution' });
        return;
      }
      out.push(n);
    });
  });
  return out;
}

module.exports = { addOrnaments };
