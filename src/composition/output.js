const Chords = require('../theory/chords');

/**
 * Converts internal notes {voice, midi, start, dur, type, chordIndex} into the
 * public format {pitch, duration, startTime, voice, velocity, type, beats}.
 */

const DUR_NAMES = [
  [4, '1n'], [3, '2n.'], [2, '2n'], [1.5, '4n.'], [1, '4n'],
  [0.75, '8n.'], [0.5, '8n'], [0.25, '16n'], [0.125, '32n']
];

function durationName(beats) {
  let best = DUR_NAMES[0];
  DUR_NAMES.forEach(d => { if (Math.abs(d[0] - beats) < Math.abs(best[0] - beats)) best = d; });
  return best[1];
}

const BASE_VELOCITY = [92, 72, 70, 84];

/**
 * @param {object[]} notes - internal notes
 * @param {object[]} chords - chords (for key context / phrase position)
 * @param {object} opts - { rng, humanize, keyOf: (note) => {key, mode} }
 */
function toOutput(notes, chords, { rng, humanize = 0.15, keyOf = null } = {}) {
  const phraseSpan = {};
  chords.forEach(c => {
    const s = phraseSpan[c.phrase] || { start: Infinity, end: -Infinity };
    s.start = Math.min(s.start, c.start);
    s.end = Math.max(s.end, c.start + c.beats);
    phraseSpan[c.phrase] = s;
  });
  const lastBeat = Math.max(...notes.map(n => n.start + n.dur));

  return notes
    .filter(n => n.midi !== null && n.midi !== undefined && n.dur > 0)
    .map(n => {
      const chord = chords[n.chordIndex] || chords[0];
      const ctx = keyOf ? keyOf(n) : { key: chord.key, mode: chord.mode };
      // Dynamics: phrase arch (louder toward the cadence), softer embellishments
      let velocity = n.velocity || BASE_VELOCITY[n.voice];
      const span = phraseSpan[chord.phrase];
      if (span && span.end > span.start) {
        const x = (n.start - span.start) / (span.end - span.start);
        velocity += Math.round(8 * Math.sin(Math.PI * Math.min(1, x * 1.15)));
      }
      if (n.type && !['chord', 'subject', 'answer'].includes(n.type)) velocity -= 6;
      if (n.start + n.dur >= lastBeat - 1e-6) velocity += 4;
      if (rng && humanize) velocity += Math.round((rng() * 2 - 1) * humanize * 20);
      const offset = rng && humanize ? (rng() * 2 - 1) * humanize * 0.05 : 0;

      return {
        pitch: Chords.spellMidi(n.midi, ctx.key, ctx.mode),
        duration: durationName(n.dur),
        beats: n.dur,
        startTime: Math.max(0, Math.round((n.start + (n.start > 0 ? offset : 0)) * 1000) / 1000),
        voice: n.voice,
        velocity: Math.max(30, Math.min(127, velocity)),
        type: n.type === 'chord' ? undefined : n.type
      };
    })
    .sort((a, b) => a.startTime - b.startTime || a.voice - b.voice);
}

module.exports = { toOutput, durationName };
