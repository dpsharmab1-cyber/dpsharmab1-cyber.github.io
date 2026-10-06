// Shared motion utilities: springs, smooth scroll, split text, reveal states.
import Lenis from './vendor/lenis.mjs';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = matchMedia('(pointer: fine)').matches;
export const coarse = !finePointer;

// critically-damped spring toward a target, frame-rate independent
export class Spring {
  constructor(v = 0, k = 9) { this.v = v; this.t = v; this.k = k; this.vel = 0; }
  set(t) { this.t = t; return this; }
  jump(v) { this.v = this.t = v; this.vel = 0; return this; }
  step(dt) {
    const k = this.k, x = this.v - this.t;
    // analytic critically-damped step
    const e = Math.exp(-k * dt);
    const v0 = this.vel + k * x;
    this.v = this.t + (x + v0 * dt) * e;
    this.vel = (this.vel - k * v0 * dt) * e;
    if (Math.abs(this.v - this.t) < 1e-4 && Math.abs(this.vel) < 1e-4) { this.v = this.t; this.vel = 0; }
    return this.v;
  }
}

// ---------------------------------------------------------------------------
// smooth scroll: native scroll position is the target, content follows with a
// frame-rate independent lerp. Touch devices follow the native position 1:1 (the
// finger stays in charge), but text and glass still move in the same frame, so
// the WebGL glass never trails the page while flinging.
export class SmoothScroll {
  // Lenis (MIT, darkroom.engineering, js/vendor/lenis.mjs) eases the window
  // scroll; the page itself is a fixed layer moved to Lenis' value every frame,
  // so the DOM, the WebGL glass and the wheel always read the same number.
  // Touch keeps its native momentum; Lenis just follows it.
  constructor(content) {
    this.content = content;
    this.enabled = !reduced;
    this.y = window.scrollY;
    this.vel = 0;
    this.locked = false;
    this.shift = 0;        // px the page sits below its scroll position (splash hand-over)
    this.clock = 0;
    if (this.enabled) {
      document.documentElement.classList.add('smooth');
      this.lenis = new Lenis({
        autoRaf: false, autoResize: false, lerp: 0.085, smoothWheel: true, syncTouch: false,
        // the folder pages and the lightbox scroll on their own
        prevent: (n) => n.classList?.contains('chpage') || n.id === 'lightbox',
      });
    }
    this.resize();
  }
  resize() {
    if (this.enabled) document.body.style.height = this.content.offsetHeight + 'px';
    this.max = Math.max(0, (this.enabled ? this.content.offsetHeight : document.documentElement.scrollHeight) - window.innerHeight);
    this.lenis?.resize();
  }
  get target() { return this.lenis ? this.lenis.targetScroll : window.scrollY; }
  to(y, { immediate = false, duration } = {}) {
    y = clamp(y, 0, this.max);
    if (!this.lenis) { window.scrollTo(0, y); this.y = y; return; }
    if (immediate) { this.lenis.scrollTo(y, { immediate: true, force: true }); this.y = y; return; }
    const d = duration ?? clamp(0.6 + Math.abs(y - this.lenis.animatedScroll) / 2600, 0.7, 1.6);
    this.lenis.scrollTo(y, { duration: d, easing: easeInOutCubic, force: true });
  }
  lock(on) {
    this.locked = on;
    if (this.lenis) on ? this.lenis.stop() : this.lenis.start();
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }
  update(dt) {
    const prev = this.y;
    if (this.lenis) {
      this.clock += dt * 1000;
      this.lenis.raf(this.clock);
      // a shift moves page, glass and wheel together: they all read scroll.y
      this.y = this.lenis.animatedScroll - this.shift;
      this.content.style.transform = `translate3d(0,${-this.y.toFixed(2)}px,0)`;
    } else {
      this.y = window.scrollY;
    }
    this.vel = (this.y - prev) / Math.max(dt, 1e-3);
  }
}

// ---------------------------------------------------------------------------
// split text into masked words / chars. Keeps inline markup (<br>, <em>, <b>).
export function split(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const mode = el.dataset.split || 'words';
  let i = 0;
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const wd = document.createElement('span');
          wd.className = 'wd';
          wd.setAttribute('aria-hidden', 'true');
          if (mode === 'chars') {
            [...part].forEach((c) => {
              const ch = document.createElement('span');
              ch.className = 'ch';
              ch.textContent = c;
              ch.style.setProperty('--i', i++);
              wd.appendChild(ch);
            });
          } else {
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            wi.style.setProperty('--i', i++);
            wd.appendChild(wi);
          }
          frag.appendChild(wd);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        walk(n);
      }
    });
  };
  walk(el);
  if (!el.getAttribute('aria-label') && !/^H[1-6]$/.test(el.tagName)) el.setAttribute('aria-label', label);
  if (/^H[1-6]$/.test(el.tagName)) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    el.appendChild(sr);
  }
}

// ---------------------------------------------------------------------------
// reveal: elements get data-state = below | in | above. CSS does the motion,
// so leaving upward plays it out, and scrolling back plays it in again.
export class Reveal {
  constructor(root = document) {
    this.listeners = new Set();
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const st = e.isIntersecting ? 'in' : (e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 10 ? 'above' : 'below');
        if (e.target.dataset.state !== st) {
          e.target.dataset.state = st;
          this.listeners.forEach((fn) => fn(e.target, st));
        }
      }
    }, { rootMargin: '-6% 0px -7% 0px', threshold: 0 });
    this.scan(root);
  }
  scan(root) {
    root.querySelectorAll('[data-split]').forEach((el) => split(el));
    root.querySelectorAll('[data-split], [data-reveal], [data-glass]').forEach((el) => {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = '1';
      if (!el.dataset.state) el.dataset.state = 'below';
      if (el.hasAttribute('data-fixed') || el.closest('#nav, #workbar, #seemore, #tip, #lightbox')) return;
      this.io.observe(el);
    });
  }
  on(fn) { this.listeners.add(fn); }
  force(root, st) {
    root.querySelectorAll('[data-split], [data-reveal]').forEach((el) => { el.dataset.state = st; });
  }
}

// Figma's black → red headline gradient (#000 → #f00). Split headlines animate
// letter by letter, so each letter carries its own slice of one shared gradient
// (offset by its layout position, which transforms don't touch).
const absOff = (el) => { let x = 0, y = 0; while (el) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; };
export function gradText(root = document) {
  root.querySelectorAll('.grad-v, .grad-h').forEach((el) => {
    const chars = [...el.querySelectorAll('.ch')];
    if (!chars.length) return;               // unsplit: plain CSS background-clip
    const dir = el.classList.contains('grad-h') ? '90deg' : '180deg';
    const box = chars.map((c) => { const [x, y] = absOff(c); return [x, y, c.offsetWidth, c.offsetHeight]; });
    const x0 = Math.min(...box.map((b) => b[0])), y0 = Math.min(...box.map((b) => b[1]));
    const w = Math.max(...box.map((b) => b[0] + b[2])) - x0, h = Math.max(...box.map((b) => b[1] + b[3])) - y0;
    chars.forEach((c, i) => {
      c.classList.add('grad-ch');
      c.style.backgroundImage = `linear-gradient(${dir}, #000, #f00)`;
      c.style.backgroundSize = `${w}px ${h}px`;
      c.style.backgroundPosition = `${x0 - box[i][0]}px ${y0 - box[i][1]}px`;
    });
  });
}

// The same Lenis scroll for an inner scroller (the opened folder pages). Links
// glide with the page's ease; touch keeps its native momentum.
export class InnerSmooth {
  constructor(el, content) {
    this.el = el;
    this.clock = 0;
    this.lenis = reduced ? null : new Lenis({ wrapper: el, content, autoRaf: false, lerp: 0.085, smoothWheel: true, syncTouch: false });
  }
  jump(y) { if (this.lenis) this.lenis.scrollTo(y, { immediate: true, force: true }); else this.el.scrollTop = y; }
  to(y) {
    if (!this.lenis) return this.jump(y);
    this.lenis.scrollTo(y, { duration: clamp(0.6 + Math.abs(y - this.lenis.animatedScroll) / 2600, 0.7, 1.6), easing: easeInOutCubic, force: true });
  }
  update(dt) { this.clock += dt * 1000; this.lenis?.raf(this.clock); }
}
