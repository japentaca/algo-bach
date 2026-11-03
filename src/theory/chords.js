const { Note, Interval, Scale } = require('tonal');

/**
 * Chord / key theory built from scale degrees.
 *
 * Why this exists: tonal's Progression.fromRomanNumerals() ignores numeral
 * case, so "ii", "vi", "i" or "iv" come back as MAJOR triads. Every minor
 * chord of the piece was wrong. Here chords are built from the scale of the
 * key, with Baroque minor-mode practice (raised 7th only in dominant chords).
 */

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const NUMERAL_RE = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|ø|\+)?(7)?(?:\/(.+))?$/;

const chroma = (n) => Note.chroma(n);
const mod = (n, m) => ((n % m) + m) % m;

/** Natural scale of a key (major, or natural minor). */
function keyScale(tonic, mode) {
  return Scale.get(`${tonic} ${mode === 'minor' ? 'minor' : 'major'}`).notes;
}

/**
 * Pitch classes (chroma) that are "in the key". For minor all three forms are
 * allowed (natural, harmonic, melodic) since Baroque minor is mutable.
 */
function keyPitchClassSet(tonic, mode) {
  const set = new Set(keyScale(tonic, mode).map(chroma));
  if (mode === 'minor') {
    const s = keyScale(tonic, 'minor');
    set.add(mod(chroma(s[5]) + 1, 12)); // raised 6th
    set.add(mod(chroma(s[6]) + 1, 12)); // raised 7th (leading tone)
  }
  return set;
}

/** Spelled names for every chroma of a key (used to print MIDI notes). */
function keySpelling(tonic, mode) {
  const names = {};
  const s = keyScale(tonic, mode);
  s.forEach(n => { names[chroma(n)] = Note.pitchClass(n); });
  if (mode === 'minor') {
    names[mod(chroma(s[5]) + 1, 12)] = Note.pitchClass(Note.transpose(s[5], '1A'));
    names[mod(chroma(s[6]) + 1, 12)] = Note.pitchClass(Note.transpose(s[6], '1A'));
  }
  return names;
}

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
const FLAT_MINOR_KEYS = new Set(['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab']);

/**
 * Converts a MIDI number to a pitch name, using the key's spelling when the
 * note is diatonic, and the key-signature direction (sharps/flats) otherwise.
 * Output is restricted to names the player/MIDI module understand
 * (no E#, B#, Cb, Fb or double accidentals).
 */
function spellMidi(midi, tonic = 'C', mode = 'major') {
  const names = keySpelling(tonic, mode);
  const c = mod(midi, 12);
  let pc = names[c];
  const useFlats = mode === 'minor' ? FLAT_MINOR_KEYS.has(tonic) : FLAT_KEYS.has(tonic);
  if (!pc || /##|bb|E#|B#|Cb|Fb/.test(pc)) {
    const generic = useFlats ? Note.fromMidi(midi) : Note.fromMidiSharps(midi);
    return generic;
  }
  // Octave from MIDI (careful: pitch-class octave numbering follows letter C)
  const octave = Math.floor(midi / 12) - 1;
  return pc + octave;
}

/**
 * Builds a chord from a Roman numeral in a key.
 *   Upper case = major, lower case = minor, ° = diminished, ø = half-dim 7th,
 *   + = augmented, 7 = seventh, "/X" = applied (secondary) chord of X.
 * Minor mode: "V", "V7", "vii°", "vii°7" use the raised leading tone;
 *   "VII" (upper case) is the natural subtonic.
 */
function realizeNumeral(numeral, tonic, mode = 'major') {
  const m = NUMERAL_RE.exec(numeral);
  if (!m) throw new Error(`Unknown numeral: ${numeral}`);
  const [, accidental, roman, symbol, seventh, target] = m;

  if (target) {
    // Applied chord: build the primary part in the (major) key of the target root
    const t = realizeNumeral(target, tonic, mode);
    const applied = realizeNumeral(`${roman}${symbol || ''}${seventh || ''}`, Note.pitchClass(t.names[0]), 'major');
    return { ...applied, numeral, key: tonic, mode, secondary: true, targetRootPC: t.pcs[0] };
  }

  const degree = ROMANS.indexOf(roman.toUpperCase());
  const upper = roman === roman.toUpperCase();
  const scale = keyScale(tonic, mode);
  let root = scale[degree];
  if (mode === 'minor' && degree === 6 && !upper) root = Note.transpose(root, '1A'); // leading tone
  if (accidental === 'b') root = Note.transpose(root, '-1A');
  if (accidental === '#') root = Note.transpose(root, '1A');

  let quality;
  if (symbol === '°') quality = 'dim';
  else if (symbol === 'ø') quality = 'halfdim';
  else if (symbol === '+') quality = 'aug';
  else quality = upper ? 'major' : 'minor';

  const triad = {
    major: ['1P', '3M', '5P'],
    minor: ['1P', '3m', '5P'],
    dim: ['1P', '3m', '5d'],
    halfdim: ['1P', '3m', '5d'],
    aug: ['1P', '3M', '5A']
  }[quality];

  const intervals = [...triad];
  let seventhType = null;
  if (seventh || quality === 'halfdim') {
    if (quality === 'major') seventhType = degree === 4 || roman === 'V' ? '7m' : '7M';
    else if (quality === 'dim') seventhType = '7d';
    else seventhType = '7m';
    intervals.push(seventhType);
  }

  const names = intervals.map(i => Note.pitchClass(Note.transpose(root, i)));
  const pcs = names.map(chroma);

  // Dominant-type chords carry a leading tone that wants to rise a semitone
  const isDominant = (upper && degree === 4 && quality === 'major') ||
    (degree === 6 && (quality === 'dim' || quality === 'halfdim') && !upper);
  let leadingTonePC = null;
  if (isDominant) leadingTonePC = degree === 4 ? pcs[1] : pcs[0];

  const suffix = { major: '', minor: 'm', dim: 'dim', halfdim: 'm7b5', aug: 'aug' }[quality];
  let name = names[0] + suffix;
  if (seventhType && quality !== 'halfdim') name += seventhType === '7M' ? 'maj7' : '7';

  return {
    numeral,
    key: tonic,
    mode,
    degree,
    quality,
    names,
    pcs,
    name,
    seventh: !!seventhType,
    seventhPC: seventhType ? pcs[3] : null,
    leadingTonePC,
    isDominant
  };
}

/**
 * Converts a diatonic degree (0 = tonic, 7 = tonic an octave up, negative
 * allowed) plus chromatic alteration to MIDI, relative to tonic in octave 4.
 */
function degreeToMidi(degree, tonic, mode, alt = 0, baseOctave = 4) {
  const scale = keyScale(tonic, mode);
  const idx = mod(degree, 7);
  const oct = Math.floor(degree / 7);
  const tonicMidi = Note.midi(tonic + baseOctave);
  const semis = mod(chroma(scale[idx]) - chroma(tonic), 12);
  return tonicMidi + semis + 12 * oct + alt;
}

/** Diatonic degree (approximate) of a midi note in a key; returns {degree, alt}. */
function midiToDegree(midi, tonic, mode, baseOctave = 4) {
  const scale = keyScale(tonic, mode);
  const tonicMidi = Note.midi(tonic + baseOctave);
  const rel = midi - tonicMidi;
  const oct = Math.floor(rel / 12);
  const pc = mod(rel, 12);
  const steps = scale.map(n => mod(chroma(n) - chroma(tonic), 12));
  let best = 0, bestAlt = 99;
  steps.forEach((s, i) => {
    const alt = pc - s;
    if (Math.abs(alt) < Math.abs(bestAlt)) { best = i; bestAlt = alt; }
  });
  return { degree: best + 7 * oct, alt: bestAlt };
}

/** Is a chord (set of pcs) fully diatonic in a key? */
function chordFitsKey(chord, tonic, mode) {
  const set = keyPitchClassSet(tonic, mode);
  return chord.pcs.every(pc => set.has(pc));
}

module.exports = {
  ROMANS,
  keyScale,
  keyPitchClassSet,
  keySpelling,
  spellMidi,
  realizeNumeral,
  degreeToMidi,
  midiToDegree,
  chordFitsKey,
  mod
};
