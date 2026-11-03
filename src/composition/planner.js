const seedrandom = require('seedrandom');
const PhrasePlan = require('../harmony/phrasePlan');
const { voiceChords } = require('../voices/voicing');
const Figuration = require('../voices/figuration');
const { addOrnaments } = require('../voices/ornaments');
const { toOutput } = require('./output');
const Fugue = require('./fugue');

/**
 * Composition planner.
 *
 * Pipeline (all steps share one seeded RNG, so a seed always reproduces the
 * same piece):
 *   1. tonal & phrase plan  – phrases with metrically placed cadences and
 *                              modulations to related keys (phrasePlan.js)
 *   2. SATB voice leading    – dynamic-programming search (voicing.js)
 *   3. texture / figuration  – form-specific diminutions (figuration.js)
 *   4. ornaments             – cadential trills, mordents (ornaments.js)
 *   5. output                – spelling, dynamics, light humanization
 *
 * Fugues use their own engine (fugue.js) built on the same components.
 */

const VARIATION_STYLES = [
  { texture: 'chorale' },
  { soprano: [[1, 0.5, 0.5], [0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5]], bass: 'walking4' },
  { soprano: [[0.25, 0.25, 0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]], bass: 'walking4' },
  { soprano: [[1, 1], [2]], bass: 'walking8' },
  { texture: 'arpeggio' },
  { soprano: [[0.75, 0.25, 0.75, 0.25], [0.5, 0.25, 0.25, 0.5, 0.5]], bass: 'drum' }
];
// Name of each VARIATION_STYLES texture (meta.sections, used by the player's articulation plan)
const VARIATION_TEXTURES = ['chorale', 'eighths', 'sixteenths', 'long', 'arpeggio', 'dotted'];

/**
 * Concerto layout over the phrase plan: the opening and closing phrases are tutti
 * ritornelli; in between, solo episodes of two phrases alternate with a one-phrase
 * tutti return (S S T S S T ...). Metadata only: it does not change the notes.
 */
function ritornelloSections(phrases) {
  const n = phrases.length;
  const openTutti = n >= 8 ? 2 : 1;
  return phrases.map((p, i) => {
    let kind;
    if (i < openTutti || i === n - 1 || n < 3) kind = 'tutti';
    else kind = (i - openTutti) % 3 === 2 ? 'tutti' : 'solo';
    return { kind, index: i, startBeat: p.startBeat, endBeat: p.endBeat, key: p.key, mode: p.mode };
  }).reduce((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.kind === s.kind) last.endBeat = s.endBeat;
    else acc.push({ ...s, index: acc.length });
    return acc;
  }, []);
}

class Planner {
  generate(options = {}) {
    const form = options.form || 'Chorale';
    const formKey = form.toLowerCase();
    const bars = Math.max(1, parseInt(options.duration) || 2);
    const mode = options.mode === 'minor' ? 'minor' : 'major';
    const key = options.key || 'C';
    const seed = options.seed || 'default';
    const density = (options.ornamentDensity !== undefined ? parseInt(options.ornamentDensity) : 50) / 100;
    const rng = seedrandom(`${seed}|${form}|${key}|${mode}|${bars}`);

    if (formKey === 'fugue') {
      return Fugue.generate({ key, mode, bars, rng, density });
    }
    if (formKey === 'variations' || formKey === 'passacaglia') {
      return this.generateVariations({ key, mode, bars, rng, density, form });
    }

    // 1. Harmonic plan
    const plan = PhrasePlan.planPiece({ tonic: key, mode, bars, rng, modulate: bars >= 12 });
    // 2. Voice leading
    const voicings = voiceChords(plan.chords, { rng, jitter: 2.5 });
    // 3. Texture
    let notes = Figuration.render(plan.chords, voicings, { style: formKey, rng, density });
    // 4. Ornaments
    notes = addOrnaments(notes, plan.chords, { rng, density });
    // 5. Output
    const out = toOutput(notes, plan.chords, { rng });

    return {
      notes: out,
      meta: {
        key,
        mode,
        form,
        style: `Baroque ${form}`,
        bars: plan.chords.reduce((s, c) => s + c.beats, 0) / 4,
        progression: PhrasePlan.describe(plan.chords),
        phraseMarkers: plan.phrases,
        ...(formKey === 'ritornello' ? { sections: ritornelloSections(plan.phrases) } : {})
      }
    };
  }

  /**
   * Variations: a binary theme (antecedent HC + consequent PAC) whose
   * harmony is kept while the texture grows progressively busier.
   */
  generateVariations({ key, mode, bars, rng, density, form }) {
    const themeBars = Math.min(8, Math.max(4, bars));
    const theme = PhrasePlan.planPiece({ tonic: key, mode, bars: themeBars, rng, modulate: false });
    const nVar = Math.max(1, Math.round(bars / themeBars));
    const themeBeats = theme.chords.reduce((s, c) => s + c.beats, 0);

    const allNotes = [];
    const allChords = [];
    const sections = [];
    for (let v = 0; v < nVar; v++) {
      const offset = v * themeBeats;
      sections.push({
        kind: v === 0 ? 'theme' : 'variation', index: v,
        startBeat: offset, endBeat: offset + themeBeats,
        texture: VARIATION_TEXTURES[v % VARIATION_TEXTURES.length]
      });
      const chords = theme.chords.map(c => ({ ...c, start: c.start + offset, phrase: c.phrase + v * 10 }));
      const voicings = voiceChords(chords, { rng, jitter: 3 });
      const style = VARIATION_STYLES[v % VARIATION_STYLES.length];
      const base = allChords.length;
      let notes = Figuration.render(chords, voicings, { style, rng, density: Math.min(1, density + 0.1 * v) });
      notes = addOrnaments(notes, chords, { rng, density });
      notes.forEach(n => { n.chordIndex += base; });
      allChords.push(...chords);
      allNotes.push(...notes);
    }
    return {
      notes: toOutput(allNotes, allChords, { rng }),
      meta: {
        key,
        mode,
        form,
        style: `Baroque ${form}`,
        bars: (themeBeats * nVar) / 4,
        progression: `Theme (${PhrasePlan.describe(theme.chords)}) + ${nVar - 1} variations`,
        phraseMarkers: theme.phrases,
        sections
      }
    };
  }
}

module.exports = Planner;
