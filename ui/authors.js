/**
 * Imaginary Baroque composers and invented piece titles (from barroco estocástico).
 * Every piece gets an author from a shuffled deck: no name repeats until all 100 have
 * come up (the remaining deck lives in localStorage and is reshuffled when empty).
 * The title is built from the generator's meta (form, key, mode, sections) and a
 * period-style nickname picked from the seed, so a seed always gets the same title.
 */

const AUTHORS = [
  // Italianos
  'Zaccaria Rossi (1666–1721)',
  'Francesco di Capua (1588–1653)',
  'Jacopo Marini (1616–1678)',
  'Fabio Santoro (1602–1656)',
  'Baldassare Moretti (1671–1753)',
  'Torquato di Capua (1596–1671)',
  'Orazio Galli (1589–1638)',
  'Silvio Fabbri (1596–1657)',
  'Pietro Bianchi (1614–1694)',
  'Carlo Gentile (1662–1711)',
  'Fabio Quaranta (1656–1716)',
  'Tiberio Bianchi (1676–1755)',
  'Quintilio Fontana (1638–1700)',
  'Ercole del Bosco (1642–1707)',
  'Vittorio Sorrentino (1688–1736)',
  'Bernardo Lombardi (1682–1740)',
  'Eugenio Zito (1674–1749)',
  'Jacopo Alberti (1628–1693)',
  'Camillo Zanetti (1604–1665)',
  'Vittorio Fabbri (1682–1751)',
  'Ottavio Orlando (1598–1651)',
  'Marco Antonio Gentile (1633–1687)',
  'Camillo Tedesco (1630–1700)',
  'Domenico Galli (1662–1726)',
  'Tommaso Moretti (1688–1738)',
  'Raffaele Valenti (1678–1755)',
  'Tiberio Neri (1653–1708)',
  'Pietro della Torre (1633–1686)',
  'Federico Sorrentino (1655–1721)',
  'Paolo Bruno (1691–1755)',
  'Carlo Uccello (1658–1718)',
  'Lorenzo da Siena (1675–1727)',
  'Valerio Amato (1590–1652)',
  'Romano Fontana (1683–1749)',
  'Ercole Ferrari (1595–1657)',
  'Pietro della Rocca (1695–1749)',
  'Fabio del Vecchio (1633–1698)',
  'Lorenzo Galli (1643–1714)',
  'Fabio Moretti (1605–1676)',
  'Tommaso Orlando (1630–1691)',
  'Federico da Siena (1670–1735)',
  'Salvatore Zanetti (1674–1726)',
  'Salvatore Valenti (1662–1720)',
  'Emilio della Rocca (1653–1716)',
  'Jacopo da Verona (1605–1682)',
  'Torquato del Bosco (1633–1698)',
  'Giovanni Battista della Valle (1666–1728)',
  'Zaccaria Zanetti (1672–1740)',
  'Orazio della Torre (1692–1743)',
  'Gabriele Zanetti (1614–1664)',
  // Alemanes
  'Theodor Meier (1688–1755)',
  'Dietrich Roth (1636–1701)',
  'Oswald Seidel (1593–1654)',
  'August Jäger (1657–1725)',
  'Hans von Kleist (1612–1691)',
  'Viktor Hahn (1635–1712)',
  'Christian Schwarz (1603–1667)',
  'Christophorus Schneider (1602–1665)',
  'Gottlob Lange (1680–1755)',
  'Nikolaus Zimmermann (1618–1693)',
  'Andreas Wolf (1659–1732)',
  'Eberhard von Hardenberg (1631–1693)',
  'Reinhard Lange (1602–1682)',
  'Philipp Weiss (1648–1701)',
  'Valentin Lehmann (1681–1732)',
  'Lorenz Fuchs (1695–1750)',
  'Karl Neumann (1604–1662)',
  'Wilhelm Krüger (1686–1755)',
  'Stephan Seidel (1661–1713)',
  'Bruno Neumann (1634–1706)',
  'Stephan Lorenz (1661–1738)',
  'Rudolf von Logau (1652–1716)',
  'Ferdinand Lehmann (1655–1703)',
  'Leonhard Schwarz (1672–1727)',
  'Wilhelm Lang (1672–1754)',
  'Valentin Meyer (1681–1746)',
  'Thomas Fischer (1683–1752)',
  'Heinrich Schulz (1599–1665)',
  'Joachim Bauer (1640–1698)',
  'Wenzel Jäger (1643–1691)',
  'Rudolf Böhm (1677–1741)',
  'Andreas Meier (1649–1708)',
  'Matthias Böhm (1649–1703)',
  'Theodor Scholz (1665–1732)',
  'Christoph Seidel (1692–1755)',
  'Johann Jäger (1662–1722)',
  'Siegfried Becker (1604–1675)',
  'Norbert von Hardenberg (1682–1740)',
  'Bruno Jung (1654–1735)',
  'Dietrich Hahn (1585–1653)',
  'Lorenz Schmitt (1647–1696)',
  'Heinrich Braun (1599–1670)',
  'Rudolf Bauer (1691–1755)',
  'Theodor Müller (1615–1666)',
  'Siegfried von Hardenberg (1615–1668)',
  'Siegfried Neumann (1595–1674)',
  'Wolfgang Jung (1689–1741)',
  'Otto Lang (1682–1755)',
  'Martin von Eichendorff (1683–1739)',
  'Joachim Hartmann (1601–1679)'
];

const STORAGE_KEY = 'baroque-author-deck';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadDeck() {
  try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const deck = JSON.parse(raw);
    // Checked against the current list (it may change between versions)
    if (Array.isArray(deck) && deck.length > 0 && deck.every(n => AUTHORS.includes(n))) return deck;
  }
  } catch (e) { /* no localStorage or corrupt: reshuffle */ }
  return shuffle([...AUTHORS]);
}

function saveDeck(deck) {
  try {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  } catch (e) { /* no persistence: the deck still works in memory */ }
}

let deck = null;

/** The next author of the deck; reshuffles when it runs out. */
export function nextAuthor() {
  if (!deck || deck.length === 0) deck = loadDeck();
  const author = deck.pop();
  saveDeck(deck);
  return author;
}

// ---- Invented titles ---------------------------------------------------------

export const FORM_ES = {
  Chorale: 'Coral', Prelude: 'Preludio', Fugue: 'Fuga', Ritornello: 'Concerto',
  Variations: 'Variaciones', Suite: 'Suite', Passacaglia: 'Passacaglia',
};

// Nicknames after the manner of the period («La Follia», «Il Gardellino»…)
const NICKNAMES = [
  'La Tempestosa', 'La Capricciosa', 'La Malinconica', 'La Notturna',
  'La Peregrina', 'La Serenissima', 'La Fortuna', 'La Clemenza',
  'La Solitudine', 'La Speranza', 'La Vendetta', 'La Gelosia',
  'La Fenice', 'La Sirena', 'La Aurora', 'La Lontananza',
  'La Battaglia', 'La Caccia', 'La Pastorella', 'La Zingara',
  'Il Labirinto', 'Il Gardellino', 'Il Tramonto', 'Il Sospiro',
  'Il Capriccio', 'Il Fantasma', 'Il Pellegrino', 'Il Naufragio',
  'Il Giardino Segreto', 'Il Rossignolo', 'Il Crepuscolo', 'Il Vulcano',
  'L’Inquietudine', 'L’Incognita', 'L’Eco', 'L’Ombra',
  'Der Wanderer', 'Die Nachtigall', 'Das Gewitter', 'Der Irrgarten',
  'Die Morgenröte', 'Das Echo', 'Der Schwermut', 'Die Einsamkeit',
];

const TONIC_ES = { C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };

/** "Eb", "minor" → "mi bemol menor". */
export function keyToSpanish(key, mode) {
  const m = /^([A-G])(#|b)?$/.exec(key || '');
  if (!m) return '';
  let tonic = TONIC_ES[m[1]];
  if (m[2] === '#') tonic += ' sostenido';
  if (m[2] === 'b') tonic += ' bemol';
  return `${tonic} ${mode === 'minor' ? 'menor' : 'mayor'}`;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * «Fuga a 4 voces "La Tempestosa" en mi menor», «Aria con 5 variaciones "Il Sospiro"
 * en re mayor»… from the generator's meta; the nickname comes from the seed.
 */
export function inventTitle(meta = {}, seed = '') {
  const form = meta.form || '';
  const sections = Array.isArray(meta.sections) ? meta.sections : [];
  let label = FORM_ES[form] || form || 'Pieza';
  if (form === 'Fugue') label = 'Fuga a 4 voces';
  if (form === 'Variations') {
  const n = sections.filter(s => s.kind === 'variation').length;
  label = n ? `Aria con ${n} ${n === 1 ? 'variación' : 'variaciones'}` : 'Aria variada';
  }
  const nick = NICKNAMES[hash(`${seed}|${form}|${meta.key}|${meta.mode}`) % NICKNAMES.length];
  const key = keyToSpanish(meta.key, meta.mode);
  return `${label} «${nick}»${key ? ' en ' + key : ''}`;
}

// Ensembles in Spanish (styleSelect values); unknown ones fall back to the preset name
export const ENSEMBLE_ES = {
  Strings: 'Cuarteto de cuerdas', Woodwinds: 'Cuarteto de maderas', Brass: 'Cuarteto de metales',
  Harp: 'Arpa', Mixed: 'Orquesta',
  HarpsichordFull: 'Clave flamenco (8′ y 4′)', Harpsichord8: 'Clave flamenco (8′)',
  VscoWoodwinds: 'Flauta, oboe, clarinete y fagot',
  VscoBrass: 'Trompeta, trompa, trombón y trombón bajo',
  VscoStrings: 'Dos violines, viola y violonchelo',
  VscoOboeStrings: 'Oboe y cuerdas', VscoFluteStrings: 'Flauta traversa y cuerdas',
  VscoTrumpetStrings: 'Trompeta y cuerdas', VscoOboeBassoon: 'Oboe, cuerdas y fagot',
};

export function tempoMarking(bpm) {
  if (bpm < 60) return 'Largo';
  if (bpm < 72) return 'Adagio';
  if (bpm < 88) return 'Andante';
  if (bpm < 108) return 'Moderato';
  if (bpm < 132) return 'Allegro';
  if (bpm < 160) return 'Vivace';
  return 'Presto';
}

export { AUTHORS };
