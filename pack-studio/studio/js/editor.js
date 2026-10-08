// Artwork editor: text and image layers placed directly on the dieline.
// A layer is pinned to a panel (u, v inside the panel's bounds), so it stays on
// that panel when the pack is resized. The same layers paint the 3D texture.

import { bounds } from './geom.js';

export const FONTS = {
  Display: 'Jakarta, Inter, system-ui, sans-serif',
  Sans: 'Inter, system-ui, sans-serif',
  Serif: 'Georgia, "Times New Roman", serif',
  Mono: '"Courier New", ui-monospace, monospace',
};

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
const measureCtx = document.createElement('canvas').getContext('2d');

export function newLayer(type, props) {
  return { id: 'L' + ++uid, type, rot: 0, opacity: 1, ...props };
}

export function layerCenter(model, L) {
  const q = model.byId[L.panel];
  if (!q) return [model.art.minX + model.art.w / 2, model.art.minY + model.art.h / 2];
  const b = bounds([q.pts]);
  return [b.minX + L.u * b.w, b.minY + L.v * b.h];
}

export function layerSize(L) {
  if (L.type === 'image') return [L.w, L.w * (L.img.naturalHeight / L.img.naturalWidth || 1)];
  measureCtx.font = `${L.weight} 100px ${FONTS[L.font] || FONTS.Sans}`;
  const w = (measureCtx.measureText(L.text || ' ').width / 100) * L.size;
  return [Math.max(w, L.size * 0.5), L.size * 1.25];
}

export function pinToPanel(model, L, x, y) {
  const hit = model.panels.find((q) => inside([x, y], q.pts)) || model.byId[L.panel] || nearest(model, x, y);
  const b = bounds([hit.pts]);
  L.panel = hit.id;
  L.u = (x - b.minX) / b.w;
  L.v = (y - b.minY) / b.h;
}

// Paint layers onto the artwork canvas (s = px per mm, b = artboard bounds).
export function drawLayers(g, model, layers, s) {
  const b = model.art;
  for (const L of layers) {
    const [x, y] = layerCenter(model, L);
    g.save();
    g.globalAlpha = L.opacity ?? 1;
    g.translate((x - b.minX) * s, (b.maxY - y) * s);
    g.rotate((-L.rot * Math.PI) / 180);
    if (L.type === 'image' && L.img?.naturalWidth) {
      const [w, h] = layerSize(L);
      g.drawImage(L.img, (-w / 2) * s, (-h / 2) * s, w * s, h * s);
    } else if (L.type === 'text') {
      g.fillStyle = L.color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `${L.weight} ${L.size * s}px ${FONTS[L.font] || FONTS.Sans}`;
      g.fillText(L.text, 0, 0);
    }
    g.restore();
  }
}

function inside([x, y], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function nearest(model, x, y) {
  let best = model.panels[0], d = Infinity;
  for (const q of model.panels) {
    const b = bounds([q.pts]);
    const dd = Math.hypot(b.minX + b.w / 2 - x, b.minY + b.h / 2 - y);
    if (dd < d) { d = dd; best = q; }
  }
  return best;
}

export function panelAt(model, x, y) {
  return model.panels.find((q) => inside([x, y], q.pts)) || null;
}

// ---------- on-dieline editing ----------

export class Editor {
  constructor({ getModel, getLayers, onChange, onSelect, pxToMm }) {
    Object.assign(this, { getModel, getLayers, onChange, onSelect, pxToMm });
    this.selected = null;
  }

  get model() { return this.getModel(); }

  mount(svg) {
    this.svg = svg;
    this.layersG = document.createElementNS(NS, 'g');
    this.layersG.id = 'Layers';
    svg.insertBefore(this.layersG, svg.querySelector('#Bleed'));
    this.ui = document.createElementNS(NS, 'g');
    this.ui.id = 'EditUI';
    svg.appendChild(this.ui);
    this.ui.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.up(e));
    this.render();
  }

  toFlat(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(this.svg.getScreenCTM().inverse()), b = this.model.art;
    return [q.x + b.minX, b.maxY - q.y];
  }

  render() {
    if (!this.svg) return;
    const model = this.model, b = model.art, layers = this.getLayers();
    const X = (x) => x - b.minX, Y = (y) => b.maxY - y;
    this.layersG.textContent = '';
    this.ui.textContent = '';
    const k = this.pxToMm();
    for (const L of layers) {
      const [x, y] = layerCenter(model, L), [w, h] = layerSize(L);
      const tf = `translate(${X(x)} ${Y(y)}) rotate(${-L.rot})`;
      const g = el('g', { transform: tf, opacity: L.opacity ?? 1 });
      if (L.type === 'image') {
        g.appendChild(el('image', { href: L.src, x: -w / 2, y: -h / 2, width: w, height: h, preserveAspectRatio: 'none' }));
      } else {
        const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': L.size, 'font-family': FONTS[L.font] || FONTS.Sans, 'font-weight': L.weight, fill: L.color });
        t.textContent = L.text;
        g.appendChild(t);
      }
      this.layersG.appendChild(g);

      const hit = el('g', { transform: tf, 'data-ed': 'move', 'data-id': L.id, class: 'ed-layer' });
      hit.appendChild(el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }));
      if (L.id === this.selected) {
        const pad = 1.5 * k;
        hit.appendChild(el('rect', { x: -w / 2 - pad, y: -h / 2 - pad, width: w + 2 * pad, height: h + 2 * pad, class: 'ed-box' }));
        const top = -h / 2 - pad;
        hit.appendChild(el('line', { x1: 0, y1: top, x2: 0, y2: top - 18 * k, class: 'ed-stem' }));
        hit.appendChild(el('circle', { cx: 0, cy: top - 18 * k, r: 6 * k, class: 'ed-handle rot', 'data-ed': 'rotate', 'data-id': L.id }));
        hit.appendChild(el('rect', { x: w / 2 + pad - 6 * k, y: h / 2 + pad - 6 * k, width: 12 * k, height: 12 * k, rx: 2 * k, class: 'ed-handle', 'data-ed': 'scale', 'data-id': L.id }));
      }
      this.ui.appendChild(hit);
    }
  }

  select(id) {
    this.selected = id;
    this.render();
    this.onSelect(this.getLayers().find((L) => L.id === id) || null);
  }

  down(e) {
    const t = e.target.closest('[data-ed]');
    if (!t) return;
    e.stopPropagation();
    e.preventDefault();
    const L = this.getLayers().find((x) => x.id === t.dataset.id);
    if (!L) return;
    if (this.selected !== L.id) this.select(L.id);
    const p = this.toFlat(e), c = layerCenter(this.model, L);
    this.drag = { mode: t.dataset.ed, L, start: p, c, off: [c[0] - p[0], c[1] - p[1]], d0: Math.hypot(p[0] - c[0], p[1] - c[1]) || 1, w0: L.w, s0: L.size };
    this.svg.setPointerCapture(e.pointerId);
  }

  move(e) {
    const d = this.drag;
    if (!d) return;
    e.stopPropagation();
    const [px, py] = this.toFlat(e), L = d.L;
    if (d.mode === 'move') pinToPanel(this.model, L, px + d.off[0], py + d.off[1]);
    else if (d.mode === 'scale') {
      const f = Math.max(0.05, Math.hypot(px - d.c[0], py - d.c[1]) / d.d0);
      if (L.type === 'image') L.w = Math.max(3, d.w0 * f);
      else L.size = Math.max(1.5, Math.min(300, d.s0 * f));
    } else if (d.mode === 'rotate') {
      let a = (Math.atan2(py - d.c[1], px - d.c[0]) * 180) / Math.PI - 90;
      a = ((a % 360) + 540) % 360 - 180;
      const snap = Math.round(a / 45) * 45;
      L.rot = e.shiftKey ? Math.round(a / 15) * 15 : Math.abs(a - snap) < 4 ? snap : Math.round(a);
    }
    this.render();
    this.onChange('live');
  }

  up(e) {
    if (!this.drag) return;
    this.drag = null;
    try { this.svg.releasePointerCapture(e.pointerId); } catch {}
    this.onSelect(this.getLayers().find((L) => L.id === this.selected) || null);
    this.onChange('commit');
  }
}

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, typeof v === 'number' ? +v.toFixed(3) : v);
  return n;
}
