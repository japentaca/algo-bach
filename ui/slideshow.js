/**
 * Hero slideshow (from barroco estocástico): portraits of Baroque musicians from
 * public/autores/ (listed at build time by the virtual:autores-images plugin) that
 * crossfade behind the hero while music plays. The first one is shown still; each
 * next one is fetched only when it is due (7 MB in all: never preloaded at once, so
 * it does not compete with the samples), then faded in over TRANSITION_MS.
 */
import autoresImages from 'virtual:autores-images';

const TRANSITION_MS = 8000;  // keep in sync with .hero-slide's transition
const INTERVAL_MS = 13000;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default class Slideshow {
  constructor(container) {
    this.container = container;
    this.images = shuffle([...autoresImages]);
    this.index = -1;
    this.layers = [];
    this.timer = null;
    this.fades = 0;  // crossfades started (checks)
    if (!container || !this.images.length) {
      if (!this.images.length) console.warn('[Slideshow] no images in autores/');
      return;
    }
    this._show(0, true);
  }

  get running() { return this.timer !== null; }

  _layer(src, active) {
    const layer = document.createElement('div');
    layer.className = 'hero-slide' + (active ? ' active' : '');
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.decoding = 'async';
    // A slow drift of the framing while the slide fades in
    const x = 20 + Math.random() * 60;
    const endY = Math.random() < 0.5 ? 85 + Math.random() * 15 : Math.random() * 15;
    img.style.setProperty('--start-x', `${x}%`);
    img.style.setProperty('--end-y', `${endY}%`);
    img.style.objectPosition = `${x}% 50%`;
    layer.appendChild(img);
    if (window.innerWidth / window.innerHeight > 2.2) layer.classList.add('contain-wide');
    return { layer, img };
  }

  _show(i, still = false) {
    this.index = i;
    const { layer, img } = this._layer(this.images[i], still);
    if (still) {
      this.container.prepend(layer);
      this.layers.push(layer);
      return;
    }
    const fadeIn = () => {
      if (!layer.isConnected) return;
      void layer.offsetHeight;  // commit opacity 0 first, or it jumps instead of fading
      requestAnimationFrame(() => layer.classList.add('active'));
      this.fades++;
      setTimeout(() => {
        this.layers.forEach(l => { if (l !== layer) l.remove(); });
        this.layers = [layer];
      }, TRANSITION_MS + 100);
    };
    // Behind the hero content (the content is the last child)
    this.container.insertBefore(layer, this.container.querySelector('.hero-content'));
    this.layers.push(layer);
    (img.decode ? img.decode() : Promise.resolve()).then(fadeIn, fadeIn);
  }

  _next() {
    if (this.images.length < 2) return;
    let i;
    do { i = Math.floor(Math.random() * this.images.length); } while (i === this.index);
    this._show(i);
  }

  start() {
    if (!this.images.length || this.timer) return;
    this._next();
    this.timer = setInterval(() => this._next(), INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
