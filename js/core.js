// Shared motion utilities: springs, smooth scroll, split text, reveal states.

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
  constructor(content) {
    this.content = content;
    this.enabled = !reduced;
    this.y = window.scrollY;
    this.vel = 0;
    this.anim = null;
    this.locked = false;
    this.shift = 0;        // px the page sits below its scroll position (splash hand-over)
    if (this.enabled) document.documentElement.classList.add('smooth');
    this.resize();
  }
  resize() {
    if (this.enabled) document.body.style.height = this.content.offsetHeight + 'px';
    this.max = Math.max(0, (this.enabled ? this.content.offsetHeight : document.documentElement.scrollHeight) - window.innerHeight);
  }
  get target() { return window.scrollY; }
  to(y, { immediate = false, duration } = {}) {
    y = clamp(y, 0, this.max);
    if (immediate || reduced) {
      window.scrollTo(0, y);
      this.y = this.base = y;
      this.anim = null;
      return;
    }
    const from = window.scrollY;
    const d = duration ?? clamp(0.6 + Math.abs(y - from) / 2600, 0.7, 1.6);
    this.anim = { from, to: y, t: 0, d };
  }
  lock(on) {
    this.locked = on;
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }
  update(dt) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.d;
      const y = lerp(a.from, a.to, easeInOutCubic(clamp(a.t)));
      window.scrollTo(0, y);
      if (a.t >= 1) this.anim = null;
    }
    const prev = this.y;
    if (this.enabled) {
      const t = this.target;
      this.y = this.base ?? this.y;
      this.y = coarse && !this.anim ? t : this.y + (t - this.y) * (1 - Math.exp(-dt * (this.anim ? 30 : 10)));
      if (Math.abs(t - this.y) < 0.05) this.y = t;
      this.base = this.y;
      // a shift moves page, glass and wheel together: they all read scroll.y
      this.y -= this.shift;
      this.content.style.transform = `translate3d(0,${-this.y.toFixed(2)}px,0)`;
    } else {
      this.y = this.target;
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

// The same smooth scroll for an inner scroller (the opened folder pages): wheel
// input sets a target and the view eases to it with the page's own constant;
// links glide with the page's ease. Touch keeps its native momentum, and the
// scrollbar or keys simply resync the target.
export class InnerSmooth {
  constructor(el) {
    this.el = el;
    this.y = this.t = el.scrollTop;
    this.set = -1;
    this.anim = null;
    this.on = !reduced;
    const max = () => Math.max(0, el.scrollHeight - el.clientHeight);
    if (this.on && !coarse) el.addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientHeight : 1;
      this.anim = null;
      this.t = clamp(this.t + e.deltaY * k, 0, max());
    }, { passive: false });
    el.addEventListener('scroll', () => {
      if (Math.abs(el.scrollTop - this.set) < 1.5) return;     // our own write
      this.y = this.t = el.scrollTop;
      this.anim = null;
    }, { passive: true });
    this.max = max;
  }
  jump(y) { this.anim = null; this.el.scrollTop = this.y = this.t = this.set = clamp(y, 0, this.max()); }
  to(y) {
    y = clamp(y, 0, this.max());
    if (!this.on) return this.jump(y);
    this.anim = { from: this.el.scrollTop, to: y, t: 0, d: clamp(0.6 + Math.abs(y - this.el.scrollTop) / 2600, 0.7, 1.6) };
  }
  update(dt) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.d;
      this.t = this.y = lerp(a.from, a.to, easeInOutCubic(clamp(a.t)));
      if (a.t >= 1) this.anim = null;
    } else if (Math.abs(this.t - this.y) > 0.3) {
      this.y += (this.t - this.y) * (1 - Math.exp(-dt * 10));
    } else this.y = this.t;
    if (Math.abs(this.el.scrollTop - this.y) >= 0.5) { this.set = this.y; this.el.scrollTop = this.y; this.set = this.el.scrollTop; }
  }
}
