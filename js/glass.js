// Binds DOM [data-glass] elements to glass surfaces on the GL stage.
// Every frame the DOM transform and the GL rect are computed from the same
// numbers, so text and glass never drift apart while scrolling.
import { Spring } from './core.js';

// liquidGL glass (see shaders.js): no fill, no frost, a soft shadow underneath;
// topic chips and the bar keep a body so their labels stay readable
export const PRESETS = {
  pill:  { bevel: 8, frost: 0, splay: 1, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0.04 },
  lens:  { bevel: 8, frost: 0, splay: 1.4, refr: 1.4, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
  panel: { bevel: 12, frost: 0, splay: 0.5, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
  sheet: { bevel: 14, frost: 0, splay: 0.4, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
  card:  { bevel: 10, frost: 0, splay: 0.6, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
  chip:  { bevel: 7, frost: 0, splay: 1, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0.06 },
  topic: { bevel: 7, frost: 0, splay: 1, fill: [0.8, 0.8, 0.81, 0.9], dfill: [0.16, 0.16, 0.18, 0.85], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0.05 },
  // controls that float over busy imagery keep a readable body
  bar:   { bevel: 8, frost: 0, splay: 1, fill: [1, 1, 1, 0.78], dfill: [0.1, 0.1, 0.12, 0.72], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
  field: { bevel: 6, frost: 0, splay: 0.3, fill: [1, 1, 1, 0], dfill: [1, 1, 1, 0], shadow: [4, 18, 0.1, 0], dshadow: [4, 18, 0.4, 0], hoverScale: 0 },
};

// the selected topic chip: solid ink (white in dark mode)
const INK = [0.04, 0.04, 0.05, 0.94], INK_DARK = [0.96, 0.96, 0.97, 0.94];

export class GlassItem {
  constructor(el) {
    this.el = el;
    let type = el.dataset.glass;
    if (type === 'chip' && el.classList.contains('topic')) type = 'topic';
    this.type = type;
    this.preset = PRESETS[type] || PRESETS.pill;
    this.level = +(el.dataset.level || 2);
    const rad = (el.dataset.radius || '').trim().split(/\s+/).filter(Boolean).map(Number);
    this.radius = rad.length === 1 ? rad[0] : null;
    if (rad.length === 4) this.radius4 = [rad[2], rad[1], rad[3], rad[0]]; // tl tr br bl -> br tr bl tl
    this.fixed = !!el.closest('[data-fixed], #nav, #seemore, #workbar, #tip');
    this.base = { x: 0, y: 0, w: 0, h: 0 };
    this.appear = new Spring(0, 7);
    this.hover = new Spring(0, 14);
    this.tint = new Spring(0, 10);
    this.focus = new Spring(0, 12);
    this.ext = 1;          // external visibility multiplier (modules)
    this.mx = 0; this.my = 0;   // magnetic pull (ui.js Magnet), px
    this.rectFn = null;    // custom rect provider
    this.lastT = '';
    const interactive = el.matches('a, button, input, textarea, .chip');
    if (interactive) {
      el.addEventListener('pointerenter', () => this.hover.set(1));
      el.addEventListener('pointerleave', () => this.hover.set(0));
      el.addEventListener('focus', () => this.focus.set(1));
      el.addEventListener('blur', () => this.focus.set(0));
    }
  }
  measure(scrollY) {
    const r = this.el.getBoundingClientRect();
    this.base = { x: r.left, y: r.top + (this.fixed ? 0 : scrollY), w: r.width, h: r.height };
    // CSS border-radius is the single source for glass corners (per breakpoint)
    const cs = getComputedStyle(this.el);
    const v = [cs.borderBottomRightRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderTopLeftRadius].map((x) => parseFloat(x) || 0);
    if (v.some((x) => x > 0)) { this.radius4 = v; this.radius = null; }
  }
}

export class GlassLayer {
  constructor() {
    this.items = [];
    this.pageAlpha = 1;
    this.dark = false;
  }
  add(el) {
    if (el._glass) return el._glass;
    const it = new GlassItem(el);
    el._glass = it;
    this.items.push(it);
    return it;
  }
  scan(root = document) {
    root.querySelectorAll('[data-glass]').forEach((el) => this.add(el));
  }
  remove(root) {
    this.items = this.items.filter((it) => {
      if (root.contains(it.el)) { it.el._glass = null; return false; }
      return true;
    });
  }
  measure(scrollY) {
    const its = this.items.filter((i) => !i.rectFn);
    its.forEach((i) => { i.el.style.transform = 'none'; });
    its.forEach((i) => i.measure(scrollY));
    its.forEach((i) => { i.el.style.transform = i.lastT; });
  }
  update(dt, scrollY, out) {
    const dark = this.dark;
    for (const it of this.items) {
      const st = it.el.dataset.state;
      if (!it.fixed) it.appear.set(st === 'in' ? 1 : 0);
      else if (it.appear.t === 0 && !it.manual) it.appear.set(1);
      const a = it.appear.step(dt);
      const h = it.hover.step(dt);
      const f = it.focus.step(dt);
      const tn = it.tint.step(dt);
      const dir = st === 'above' ? -1 : 1;
      const dy = (1 - a) * 22 * dir;
      const big = Math.max(it.base.w, it.base.h) > 520;
      const s = (big ? 1 : 0.965 + 0.035 * a) * (1 + it.preset.hoverScale * h);
      const t = `translate3d(${it.mx.toFixed(2)}px,${(dy + it.my).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      if (!it.rectFn && t !== it.lastT) { it.el.style.transform = t; it.lastT = t; }
      const op = a * it.ext * (it.fixed ? 1 : this.pageAlpha);
      const opS = op.toFixed(3);
      if (it.el._op !== opS && !it.rectFn) { it.el.style.opacity = opS; it.el._op = opS; }
      if (op < 0.003) continue;

      let x, y, w, hh;
      if (it.rectFn) {
        const r = it.rectFn();
        if (!r) continue;
        ({ x, y, w } = r); hh = r.h;
      } else {
        const b = it.base;
        w = b.w * s; hh = b.h * s;
        x = b.x + (b.w - w) / 2 + it.mx;
        y = b.y - (it.fixed ? 0 : scrollY) + dy + it.my + (b.h - hh) / 2;
      }
      const p = it.preset;
      let fill = (dark ? p.dfill : p.fill).slice();
      if (it.type === 'field') fill[3] += f * (dark ? 0.05 : 0.25);
      if (it.type === 'chip' || it.type === 'pill') fill[3] += h * (dark ? 0.05 : 0.12);
      out.push({
        level: it.level,
        x, y, w, h: hh,
        r: it.radiusArr || (it.radius4 ? it.radius4.map((v) => v * s) : it.radius != null ? it.radius * s : Math.min(w, hh) / 2),
        bevel: p.bevel, refr: p.refr ?? 1, disp: 1, frost: p.frost, splay: p.splay,
        fill,
        tint: tn > 0.001 ? ((c) => [c[0], c[1], c[2], c[3] * tn])(dark ? INK_DARK : INK) : null,
        shadow: dark ? p.dshadow : p.shadow,
        opacity: op,
      });
    }
  }
}
