/**
 * Page controller (the barroco estocástico experience on top of bach's player).
 *
 * public/player.js composes and plays; it tells the page what happens through window
 * events, and this module presents it for every piece, manual or kiosk:
 *   bach:composed {data, seed, style}  -> author + invented title, score rendered (while
 *                                         the samples load, never as playback starts)
 *   bach:playing  {data, timing, ...}  -> hero "now playing", slideshow, score follower,
 *                                         progress bar / bar counter / section line
 *   bach:stopped                       -> follower and progress stop
 *   bach:kiosk    {active}             -> the start button, the slideshow between pieces
 * Nothing here schedules or touches audio: the follower and the progress only read the
 * clock the player scheduled the notes on (ui/score.js).
 * It also reports those events to Umami (track() below).
 */
import Slideshow from './slideshow.js';
import Score from './score.js';
import { nextAuthor, inventTitle, ENSEMBLE_ES, FORM_ES, tempoMarking } from './authors.js';

const $ = (id) => document.getElementById(id);

const el = {
  hero: $('heroSlideshow'),
  piece: $('nowPlaying'),
  title: $('pieceTitle'),
  author: $('pieceAuthor'),
  subtitle: $('pieceSubtitle'),
  section: $('pieceSection'),
  kioskBtn: $('kioskBtn'),
  kioskLabel: $('kioskBtnLabel'),
  stopBtn: $('stopBtn'),
  fullscreenBtn: $('fullscreenBtn'),
  fill: $('progressBar'),
  bar: $('currentBar'),
  bars: $('totalBars'),
  elapsed: $('elapsedTime'),
  total: $('totalTime'),
  staffHeader: $('staffHeader'),
  viewport: $('staffViewport'),
  notation: $('staffNotation'),
};

const slideshow = new Slideshow(el.hero);
const score = new Score({ viewport: el.viewport, notation: el.notation });

let kioskActive = false;
let composed = null;   // {token, seed, data, author, title} of the last composed piece
let current = null;    // the piece playing: {result, piece, totalBeats}
let progressTimer = null;

const fmt = (secs) => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function ensembleName(style) {
  if (ENSEMBLE_ES[style]) return ENSEMBLE_ES[style];
  const preset = typeof STYLE_PRESETS !== 'undefined' && STYLE_PRESETS[style];
  return (preset && preset.displayName) || style || '';
}

function endBeats(data) {
  return (data.notes || []).reduce((m, n) => Math.max(m, n.startTime + (n.beats || 1)), 0);
}

// ---- Analytics (self-hosted Umami at stats.jape.com.ar, script tag in index.html) ----
// Same event names and properties as barroco estocástico had, plus the ensemble:
//   iniciar  the first piece of a concert (the Iniciar button or the ?kiosk overlay)
//   pieza    every following concert piece, with its number n (2, 3, ...)
//   componer a manual "Componer y tocar" (composed, before the samples load)
//   play     every piece that starts sounding (modo: concierto | manual)
// The tag only tracks on barroco.jape.com.ar (data-domains), so local runs send
// nothing; if it is blocked, window.umami is undefined and this does nothing.
let concertPieces = 0;
function track(name, data, extra = {}) {
  try {
    const meta = (data && data.meta) || {};
    window.umami?.track(name, {
      forma: String(meta.form || '').toLowerCase(),
      tonalidad: `${meta.key || ''} ${meta.mode || ''}`.trim(),
      compases: Math.round(meta.bars || 0),
      ...extra,
    });
  } catch (err) { /* analytics never breaks the page */ }
}

// ---- Composed: author, title, score -----------------------------------------
window.addEventListener('bach:composed', (e) => {
  const { data, seed, style, token } = e.detail;
  if (kioskActive) {
    concertPieces++;
    if (concertPieces === 1) track('iniciar', data, { conjunto: style });
    else track('pieza', data, { conjunto: style, n: concertPieces });
  } else {
    track('componer', data, { conjunto: style });
  }
  const piece = { token, seed, style, data, author: nextAuthor(), title: inventTitle(data.meta, seed) };
  composed = piece;
  const bpm = Number(($('tempoSlider') || {}).value) || 0;
  renderStaffHeader(piece, bpm);
  // After the current task: the player goes on to load the samples meanwhile
  setTimeout(() => {
    if (composed !== piece) return;  // superseded before it could render
    score.render(data);
    piece.rendered = true;
  }, 0);
});

function renderStaffHeader(piece, bpm) {
  const meta = piece.data.meta || {};
  const secs = endBeats(piece.data) * 60 / (bpm || 100);
  el.staffHeader.hidden = false;
  el.staffHeader.innerHTML = '';
  const add = (cls, text) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    el.staffHeader.appendChild(d);
  };
  add('staff-title', piece.title);
  add('staff-byline', [piece.author, ensembleName(piece.style)].filter(Boolean).join(' · '));
  add('staff-meta', [`${Math.round(meta.bars || 0)} compases`, bpm ? `♩ = ${bpm}` : null, fmt(secs)].filter(Boolean).join(' · '));
}

// ---- Playing ------------------------------------------------------------------
window.addEventListener('bach:playing', (e) => {
  const result = e.detail;
  const piece = composed && composed.data === result.data ? composed : {
    seed: result.seed, style: result.style, data: result.data,
    author: nextAuthor(), title: inventTitle(result.data.meta, result.seed),
  };
  if (!piece.rendered) { score.render(result.data); piece.rendered = true; }
  const totalBeats = endBeats(result.data);
  current = { result, piece, totalBeats };
  track('play', result.data, { conjunto: result.style, modo: kioskActive ? 'concierto' : 'manual', bpm: result.bpm });
  renderStaffHeader(piece, result.bpm);
  showPiece(piece, result);
  score.follow(result.timing);
  startProgress();
  slideshow.start();
  el.stopBtn.disabled = false;

  const mine = current;
  result.finished.then((natural) => {
    if (current !== mine) return;
    stopProgress(natural);
    score.stop();
    current = null;
    if (!kioskActive) slideshow.stop();
    if (!kioskActive) el.stopBtn.disabled = true;
  });
});

function showPiece(piece, result) {
  const meta = piece.data.meta || {};
  el.title.textContent = piece.title;
  el.author.textContent = piece.author;
  el.subtitle.textContent = [
    ensembleName(result.style) + (result.continuo ? ' · órgano continuo' : ''),
    `${tempoMarking(result.bpm)} ♩ = ${result.bpm}`,
  ].join(' · ');
  el.section.textContent = '';
  el.section.hidden = true;
  el.piece.hidden = false;
  document.body.classList.add('has-piece');
  // the bars of the score (the last note's onset jitter may poke past the final bar line)
  el.bars.textContent = String(score.bars || Math.max(1, Math.round((meta.bars || 0))));
  document.title = `${piece.title} — Barroco Estocástico`;
  el.piece.dataset.form = FORM_ES[meta.form] || meta.form || '';
}

// Section line ("Variazione III · pizzicato", "Solo", ...) from the articulation plan
function sectionAt(beat) {
  const art = current && current.result.articulation;
  const secs = (art && art.sections) || [];
  let s = null;
  for (const x of secs) if (beat >= x.startBeat - 0.05) s = x;
  return s ? s.text : '';
}

function startProgress() {
  stopProgress();
  const { result, totalBeats } = current;
  const spb = result.timing.secsPerBeat;
  el.total.textContent = fmt(totalBeats * spb);
  const tick = () => {
    const beat = Math.max(0, Math.min(totalBeats, score.beatNow() ?? 0));
    el.fill.style.width = `${(beat / totalBeats * 100).toFixed(2)}%`;
    el.bar.textContent = String(Math.min(Math.floor(beat / 4) + 1, score.bars || Infinity));
    el.elapsed.textContent = fmt(beat * spb);
    const text = sectionAt(beat);
    if (text !== el.section.textContent) {
      el.section.textContent = text;
      el.section.hidden = !text;
    }
  };
  tick();
  progressTimer = setInterval(tick, 250);
}

function stopProgress(full = false) {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (full) el.fill.style.width = '100%';
}

window.addEventListener('bach:stopped', () => {
  score.stop();
  stopProgress();
  current = null;
  el.fill.style.width = '0%';
  el.bar.textContent = '0';
  el.elapsed.textContent = '0:00';
  if (!kioskActive) {
    slideshow.stop();
    el.stopBtn.disabled = true;
  }
});

// ---- Kiosk / start button ---------------------------------------------------------
window.addEventListener('bach:kiosk', (e) => {
  kioskActive = !!e.detail.active;
  if (kioskActive) concertPieces = 0;
  el.kioskLabel.textContent = kioskActive ? 'Detener' : 'Iniciar';
  el.kioskBtn.classList.toggle('playing', kioskActive);
  el.stopBtn.disabled = !kioskActive && !current;
  if (kioskActive) slideshow.start();
  else if (!current) slideshow.stop();
});

el.stopBtn.addEventListener('click', () => {
  if (kioskActive && window.BachKiosk) window.BachKiosk.exit();
  else if (window.BachPlayer) window.BachPlayer.stopPlayback();
});

// ---- Fullscreen ---------------------------------------------------------------------
if (el.fullscreenBtn) {
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) {
    el.fullscreenBtn.hidden = true;
  }
  el.fullscreenBtn.addEventListener('click', () => {
    const root = document.documentElement;
    try {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch (e) { /* refused */ }
  });
  const sync = () => el.fullscreenBtn.setAttribute('aria-pressed', fsEl() ? 'true' : 'false');
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

// ---- Range fill (cosmetic): the kiosk's input events update it too ------------------
function paintRange(r) {
  const min = +r.min || 0, max = +r.max || 100;
  r.style.setProperty('--val', `${((+r.value - min) / (max - min)) * 100}%`);
}
document.querySelectorAll('input[type="range"]').forEach(paintRange);
document.addEventListener('input', (e) => {
  if (e.target && e.target.type === 'range') paintRange(e.target);
});

// For checks from the console
window.BachUI = { score, slideshow, current: () => current, composed: () => composed };
