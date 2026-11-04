/**
 * Minimal SFZ reader for sample libraries served from the soundfont folder
 * (e.g. Versilian Studios "VCSL Keys"). It turns an .sfz instrument into the
 * shape the browser's LayeredSampler plays (same as /api/vsco/articulation):
 *
 *   { baseUrl, samples: { note: {path, root, gain, alts?, stack?} },
 *     velocity: { note: [layers] }, releases: { note: {...} }, envelope, info }
 *
 * Supported: <control> (default_path, #define), <global>, <master>, <group>,
 * <region> inheritance; // and block comments; key / lokey / hikey /
 * pitch_keycenter; volume, global_volume, master_volume, group_volume; tune,
 * transpose; offset (frames -> seconds from the FLAC header); lovel / hivel;
 * trigger=attack|release; seq_length / seq_position (round robins);
 * ampeg_attack / ampeg_release / ampeg_sustain=0 + ampeg_decay (a sample that
 * fades out by itself). Key-switched regions (sw_*) are skipped.
 */
const fs = require('fs');
const path = require('path');

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToNote = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const NOTE_INDEX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** SFZ key value: a MIDI number or a note name (c4 = 60, SFZ convention). */
function parseKey(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  const m = /^([a-gA-G])(#|b)?(-?\d+)$/.exec(s);
  if (!m) return null;
  return (parseInt(m[3], 10) + 1) * 12 + NOTE_INDEX[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const num = (v, d) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

/** Strip comments, apply #define, return [{header, opcodes}] in file order. */
function tokenize(text) {
  const defines = {};
  const out = [];
  let current = null;
  text = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (let line of text.split(/\r?\n/)) {
    const c = line.indexOf('//');
    if (c >= 0) line = line.slice(0, c);
    const def = /^\s*#define\s+(\$\w+)\s+(.*?)\s*$/.exec(line);
    if (def) { defines[def[1]] = def[2]; continue; }
    if (/^\s*#/.test(line)) continue;  // #include and other directives: not used here
    line = line.replace(/\$\w+/g, v => (v in defines ? defines[v] : v));
    // Split the line on headers; opcodes follow the header they come after
    const parts = line.split(/(<\w+>)/);
    for (const part of parts) {
      const h = /^<(\w+)>$/.exec(part);
      if (h) {
        current = { header: h[1].toLowerCase(), opcodes: {} };
        out.push(current);
        continue;
      }
      if (!current || !part.trim()) continue;
      // A value runs to the next "name=" (sample paths contain spaces and commas)
      const re = /(\w+)=(.*?)(?=\s+\w+=|$)/g;
      let m;
      while ((m = re.exec(part.trim())) !== null) current.opcodes[m[1]] = m[2].trim();
    }
  }
  return out;
}

/** Each region with the opcodes it inherits from <control>/<global>/<master>/<group>. */
function flattenRegions(sections) {
  let control = {}, global = {}, master = {}, group = {};
  const regions = [];
  for (const s of sections) {
    switch (s.header) {
      case 'control': control = { ...s.opcodes }; global = {}; master = {}; group = {}; break;
      case 'global': global = { ...s.opcodes }; master = {}; group = {}; break;
      case 'master': master = { ...s.opcodes }; group = {}; break;
      case 'group': group = { ...s.opcodes }; break;
      case 'region': regions.push({ control, global, master, group, region: s.opcodes }); break;
      default: break;  // <curve>, <effect>, <midi>...: ignored
    }
  }
  return regions;
}

/** Sample rate and length of a FLAC / WAV file, from its header (null if unknown). */
function audioInfo(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(64);
    fs.readSync(fd, b, 0, 64, 0);
    if (b.toString('ascii', 0, 4) === 'fLaC') {
      // STREAMINFO is the first metadata block: rate (20 bits), channels, bits, total samples (36 bits)
      const si = 8;
      const rate = (b[si + 10] << 12) | (b[si + 11] << 4) | (b[si + 12] >> 4);
      const channels = ((b[si + 12] >> 1) & 7) + 1;
      const total = (b[si + 13] & 0x0f) * 2 ** 32 + b.readUInt32BE(si + 14);
      return rate > 0 ? { rate, channels, seconds: total / rate } : null;
    }
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') {
      return { rate: b.readUInt32LE(24), channels: b.readUInt16LE(22), seconds: null };
    }
    return null;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Parse an .sfz file into the player's shape. `libDir` is the folder of the
 * library (the .sfz paths are relative to the .sfz file itself).
 */
function parseSfz(sfzFile, libDir, baseUrl) {
  const sfzDir = path.dirname(sfzFile);
  const regions = flattenRegions(tokenize(fs.readFileSync(sfzFile, 'utf8')));
  const attackRegions = [];
  const releaseRegions = [];
  let skipped = 0;
  let missing = 0;
  const infoCache = new Map();

  for (const r of regions) {
    const op = { ...r.global, ...r.master, ...r.group, ...r.region };
    const trigger = (op.trigger || 'attack').toLowerCase();
    if (Object.keys(op).some(k => k.startsWith('sw_')) || (trigger !== 'attack' && trigger !== 'release')) { skipped++; continue; }
    if (!op.sample) { skipped++; continue; }
    const rel = ((r.control.default_path || '') + op.sample).replace(/\\/g, '/');
    const abs = path.resolve(sfzDir, rel);
    const relToLib = path.relative(libDir, abs).split(path.sep).join('/');
    if (relToLib.startsWith('..') || path.isAbsolute(relToLib)) { skipped++; continue; }
    if (!infoCache.has(abs)) infoCache.set(abs, fs.existsSync(abs) ? audioInfo(abs) || {} : null);
    const info = infoCache.get(abs);
    if (!info) { missing++; continue; }

    let lokey = parseKey(op.lokey), hikey = parseKey(op.hikey);
    const key = parseKey(op.key);
    if (key !== null) { if (lokey === null) lokey = key; if (hikey === null) hikey = key; }
    if (lokey === null) lokey = 0;
    if (hikey === null) hikey = 127;
    let center = parseKey(op.pitch_keycenter);
    if (center === null) center = key !== null ? key : 60;
    // Tuning: the sample is played `tune` cents / `transpose` semitones higher, so its
    // nominal root is that much lower
    const root = center - num(op.tune, 0) / 100 - num(op.transpose, 0);
    const gain = num(op.volume, 0) + num(op.global_volume, 0) + num(op.master_volume, 0) + num(op.group_volume, 0);
    const offsetFrames = num(op.offset, 0);
    const entry = {
      path: relToLib,
      root: Math.round(root * 1000) / 1000,
      gain: Math.round(gain * 1000) / 1000,
    };
    if (offsetFrames > 0 && info.rate) entry.offset = Math.round(offsetFrames / info.rate * 1e5) / 1e5;
    if (info.seconds) entry.secs = Math.round(info.seconds * 1000) / 1000;
    const attack = num(op.ampeg_attack, null), release = num(op.ampeg_release, null);
    if (attack !== null) entry.attack = attack;
    if (release !== null) entry.release = release;
    // A sample faded out by its envelope (sustain 0): it lasts attack + hold + decay
    if (op.ampeg_sustain !== undefined && num(op.ampeg_sustain, 100) <= 0) {
      entry.maxSecs = num(op.ampeg_delay, 0) + num(op.ampeg_attack, 0) + num(op.ampeg_hold, 0) + num(op.ampeg_decay, 0);
    }
    const target = {
      entry, lokey, hikey,
      lovel: num(op.lovel, 1), hivel: num(op.hivel, 127),
      seqLength: num(op.seq_length, 1), seqPosition: num(op.seq_position, 1),
      group: r.group,
    };
    (trigger === 'release' ? releaseRegions : attackRegions).push(target);
  }

  // Other takes of a sample that exist on disk but that the .sfz does not list
  // ("_rr1" -> "_rr2", "_1" -> "_2"), as for VSCO
  const RR_SUFFIX = /(_rr|_RR|_)(\d)((?:_\w+)?\.\w+)$/;
  const altsCache = new Map();
  function diskAlts(relPath) {
    if (altsCache.has(relPath)) return altsCache.get(relPath);
    const alts = [];
    if (RR_SUFFIX.test(relPath)) {
      for (let d = 1; d <= 4; d++) {
        const alt = relPath.replace(RR_SUFFIX, (m, pre, n, rest) => `${pre}${d}${rest}`);
        if (alt !== relPath && fs.existsSync(path.join(libDir, alt))) alts.push(alt);
      }
    }
    altsCache.set(relPath, alts);
    return alts;
  }

  /**
   * Per key: the regions that sound together (stacked registers, e.g. 8' + 4'), each
   * with its round-robin takes (seq_position) as `alts`, and velocity layers.
   */
  function mapKeys(list) {
    const samples = {};
    const velocity = {};
    for (let midi = 0; midi < 128; midi++) {
      const hits = list.filter(t => midi >= t.lokey && midi <= t.hikey);
      if (!hits.length) continue;
      // Velocity layers: distinct [lovel, hivel] ranges; a harpsichord has one (amp_veltrack=0)
      const ranges = [...new Map(hits.map(t => [`${t.lovel}-${t.hivel}`, [t.lovel, t.hivel]])).values()]
        .sort((a, b) => a[0] - b[0]);
      const build = (subset) => {
        // Stacked sources: one per <group> (the registers); round robins inside each
        const byGroup = new Map();
        subset.forEach(t => {
          if (!byGroup.has(t.group)) byGroup.set(t.group, []);
          byGroup.get(t.group).push(t);
        });
        const voices = [];
        byGroup.forEach(ts => {
          // seq_position takes of a group alternate (one voice); other regions sound together
          const seq = ts.filter(t => t.seqLength > 1).sort((a, b) => a.seqPosition - b.seqPosition);
          if (seq.length) {
            const main = { ...seq[0].entry };
            if (seq.length > 1) main.alts = seq.slice(1).map(t => t.entry.path);
            voices.push(main);
          }
          ts.filter(t => !(t.seqLength > 1)).forEach(t => {
            const main = { ...t.entry };
            const alts = diskAlts(main.path);
            if (alts.length) main.alts = alts;
            voices.push(main);
          });
        });
        const main = voices[0];
        if (voices.length > 1) main.stack = voices.slice(1);
        return main;
      };
      const note = midiToNote(midi);
      if (ranges.length > 1) {
        velocity[note] = ranges.map(([lo, hi]) => ({
          ...build(hits.filter(t => t.lovel === lo && t.hivel === hi)), lovel: lo, hivel: hi,
        }));
        samples[note] = velocity[note][velocity[note].length - 1];
      } else {
        samples[note] = build(hits);
      }
    }
    return { samples, velocity };
  }

  const att = mapKeys(attackRegions);
  const rel = mapKeys(releaseRegions);
  const firstGroup = attackRegions[0] ? attackRegions[0].group : {};
  return {
    baseUrl,
    samples: att.samples,
    velocity: att.velocity,
    releases: rel.samples,
    envelope: {
      attack: num(firstGroup.ampeg_attack, 0.004),
      release: num(firstGroup.ampeg_release, 0.4),
    },
    info: {
      regions: regions.length,
      attackRegions: attackRegions.length,
      releaseRegions: releaseRegions.length,
      skipped,
      missing,
      notes: Object.keys(att.samples).length,
      releaseNotes: Object.keys(rel.samples).length,
    },
  };
}

module.exports = { parseSfz, tokenize, flattenRegions, parseKey, audioInfo, midiToNote };
