// Artwork editor: text, image, shape and pack-element layers placed on the dieline.
// A layer is pinned to a panel (u, v inside the panel's bounds), so it stays on
// that panel when the pack is resized. The same layers paint the 3D texture, and
// the 3D view can pick and drag them through the model's UVs.

import { bounds } from './geom.js';
import { ELEMENTS, elementView, elementImage, elementFontUnits, normaliseEAN, SAMPLE_EAN } from './elements.js';

export const FONTS = {
  Display: 'Jakarta, Inter, system-ui, sans-serif',
  Sans: 'Inter, system-ui, sans-serif',
  Elegant: 'Playfair, Georgia, serif',
  Serif: 'Georgia, "Times New Roman", serif',
  Hindi: '"Noto Devanagari", Inter, system-ui, sans-serif',
  Mono: '"Courier New", ui-monospace, monospace',
};

export const SHAPES = { rect: 'Rectangle', ellipse: 'Circle / ellipse', line: 'Line', burst: 'Starburst badge', ribbon: 'Ribbon banner' };

const NS = 'http://www.w3.org/2000/svg';
const measureCtx = document.createElement('canvas').getContext('2d');
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s) => (segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : Array.from(s));

export function newLayer(type, props) {
  return { id: 'L' + crypto.randomUUID().slice(0, 8), type, rot: 0, opacity: 1, ...props };
}

export function layerName(L) {
  if (L.name) return L.name;
  if (L.type === 'text') return (L.text || 'Text').split('\n')[0];
  if (L.type === 'shape') return SHAPES[L.shape] || 'Shape';
  if (L.type === 'element') return ELEMENTS[L.el]?.name || 'Element';
  return 'Image';
}

export function layerCenter(model, L) {
  const q = model.byId[L.panel];
  if (!q) return [model.art.minX + model.art.w / 2, model.art.minY + model.art.h / 2];
  const b = bounds([q.pts]);
  return [b.minX + L.u * b.w, b.minY + L.v * b.h];
}

// ---------- text layout ----------

export function fontCSS(L, px) {
  return `${L.italic ? 'italic ' : ''}${L.weight || 400} ${px}px ${FONTS[L.font] || FONTS.Sans}`;
}

let layoutCache = new WeakMap();
export function resetTextLayout() { layoutCache = new WeakMap(); }

// Lays text out in layer space (mm, y down, centred on 0,0). Straight text with no
// letter spacing keeps whole lines (best kerning and shaping); spaced or curved
// text is placed glyph by glyph, curved text on concentric arcs.
export function textLayout(L) {
  const key = [L.text, L.font, L.weight, L.italic, L.size, L.ls, L.lh, L.curve, L.align].join('|');
  const hit = layoutCache.get(L);
  if (hit?.key === key) return hit.res;

  measureCtx.font = fontCSS(L, 100);
  const size = L.size, k = size / 100, ls = (L.ls || 0) * size, lh = (L.lh || 1.2) * size;
  const lines = String(L.text ?? '').split('\n').map((s) => s || ' ');
  const curve = Math.max(-100, Math.min(100, L.curve || 0));
  const glyphMode = ls !== 0 || curve !== 0;
  const rows = lines.map((line) => {
    if (!glyphMode) return { line, w: measureCtx.measureText(line).width * k };
    const gl = graphemes(line).map((ch) => ({ ch, w: measureCtx.measureText(ch).width * k }));
    return { gl, w: gl.reduce((a, g) => a + g.w + ls, 0) - ls };
  });
  const maxW = Math.max(size * 0.5, ...rows.map((r) => r.w));
  const H = rows.length * lh, align = L.align || 'center';
  const x0 = (r) => (align === 'left' ? -maxW / 2 : align === 'right' ? maxW / 2 - r.w : -r.w / 2);

  let res;
  if (!glyphMode) {
    const ax = align === 'left' ? -maxW / 2 : align === 'right' ? maxW / 2 : 0;
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    res = { mode: 'line', items: rows.map((r, i) => ({ text: r.line, x: ax, y: -H / 2 + lh * (i + 0.5) })), anchor, w: maxW, h: H };
  } else {
    const items = [];
    const A = (curve / 100) * Math.PI * 1.5, R0 = A ? maxW / Math.abs(A) : 0;
    rows.forEach((r, i) => {
      let s = x0(r);
      for (const g of r.gl) {
        const c = s + g.w / 2;
        if (!A) items.push({ text: g.ch, x: c, y: lh * i, rot: 0, w: g.w });
        else if (A > 0) {
          const R = Math.max(lh, R0 - i * lh), th = c / R;
          items.push({ text: g.ch, x: R * Math.sin(th), y: lh * i + R * (1 - Math.cos(th)), rot: th, w: g.w, R });
        } else {
          const R = R0 + i * lh, th = c / R;
          items.push({ text: g.ch, x: R * Math.sin(th), y: lh * i - R * (1 - Math.cos(th)), rot: -th, w: g.w });
        }
        s += g.w + ls;
      }
    });
    // centre the glyph cloud on the layer origin
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of items) {
      const c = Math.cos(it.rot), sn = Math.sin(it.rot), hw = it.w / 2 + size * 0.04, hh = size * 0.62;
      for (const [px, py] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
        const X = it.x + px * c - py * sn, Y = it.y + px * sn + py * c;
        minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
      }
    }
    if (!items.length) { minX = -size / 2; maxX = size / 2; minY = -size / 2; maxY = size / 2; }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    for (const it of items) { it.x -= cx; it.y -= cy; }
    res = { mode: 'glyph', items, w: maxX - minX, h: maxY - minY };
  }
  layoutCache.set(L, { key, res });
  return res;
}

export function layerSize(L) {
  if (L.type === 'image') return [L.w, L.w * (L.img?.naturalHeight / L.img?.naturalWidth || 1)];
  if (L.type === 'shape') return [L.w, L.shape === 'line' ? Math.max(L.sw || 1, 0.3) : L.h];
  if (L.type === 'element') { const { vb } = elementView(L); return [L.w, (L.w * vb[1]) / vb[0]]; }
  const t = textLayout(L);
  return [t.w, t.h];
}

// four corners in flat (dieline) coordinates
export function layerCorners(model, L) {
  const [cx, cy] = layerCenter(model, L), [w, h] = layerSize(L), r = (L.rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([lx, ly]) => {
    const sx = c * lx + s * ly, sy = -s * lx + c * ly;
    return [cx + sx, cy - sy];
  });
}

export function pinToPanel(model, L, x, y) {
  const hit = model.panels.find((q) => inside([x, y], q.pts)) || model.byId[L.panel] || nearest(model, x, y);
  const b = bounds([hit.pts]);
  L.panel = hit.id;
  L.u = (x - b.minX) / b.w;
  L.v = (y - b.minY) / b.h;
}

// topmost visible, unlocked layer under a flat point
export function layerAt(model, layers, x, y, tolMM = 0) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    if (L.hidden || L.locked) continue;
    const [cx, cy] = layerCenter(model, L), [w, h] = layerSize(L), r = (L.rot * Math.PI) / 180;
    const sx = x - cx, sy = -(y - cy);
    const lx = Math.cos(r) * sx - Math.sin(r) * sy, ly = Math.sin(r) * sx + Math.cos(r) * sy;
    if (Math.abs(lx) <= w / 2 + tolMM && Math.abs(ly) <= h / 2 + tolMM) return L;
  }
  return null;
}

// ---------- canvas painting (3D texture, PNG proof) ----------

// s = px per mm. opts.selected draws a selection frame (live 3D view only).
export function drawLayers(g, model, layers, s, { selected = null, onAsset = null } = {}) {
  const b = model.art;
  for (const L of layers) {
    if (L.hidden) continue;
    const [x, y] = layerCenter(model, L);
    g.save();
    g.translate((x - b.minX) * s, (b.maxY - y) * s);
    g.rotate((-L.rot * Math.PI) / 180);
    g.save();
    g.globalAlpha = L.opacity ?? 1;
    paintLayer(g, L, s, onAsset);
    g.restore();
    if (L.id === selected) {
      const [w, h] = layerSize(L), pad = 1.2 * s;
      g.lineWidth = Math.max(2, 0.5 * s);
      g.setLineDash([3 * g.lineWidth, 2 * g.lineWidth]);
      g.strokeStyle = '#ffffff';
      g.strokeRect((-w / 2) * s - pad, (-h / 2) * s - pad, w * s + 2 * pad, h * s + 2 * pad);
      g.lineDashOffset = 2.5 * g.lineWidth;
      g.strokeStyle = '#2547d0';
      g.strokeRect((-w / 2) * s - pad, (-h / 2) * s - pad, w * s + 2 * pad, h * s + 2 * pad);
    }
    g.restore();
  }
}

function paintLayer(g, L, s, onAsset) {
  const [w, h] = layerSize(L);
  if (L.type === 'image') {
    if (L.img?.naturalWidth) g.drawImage(L.img, (-w / 2) * s, (-h / 2) * s, w * s, h * s);
  } else if (L.type === 'element') {
    const img = elementImage(L, onAsset);
    if (img) g.drawImage(img, (-w / 2) * s, (-h / 2) * s, w * s, h * s);
  } else if (L.type === 'shape') {
    g.beginPath();
    shapePath(L, w, h, s, g);
    if (L.shape !== 'line' && L.fill) { g.fillStyle = L.fill; g.fill(); }
    if (L.stroke && L.sw > 0) {
      g.lineWidth = L.sw * s; g.strokeStyle = L.stroke; g.lineJoin = 'round';
      if (L.shape === 'line') g.lineCap = 'round';
      g.stroke();
    }
  } else if (L.type === 'text') {
    const t = textLayout(L);
    g.font = fontCSS(L, L.size * s);
    g.textBaseline = 'middle';
    const outline = L.outline && L.ow > 0;
    if (outline) { g.lineJoin = 'round'; g.strokeStyle = L.outline; g.lineWidth = 2 * L.ow * s; }
    g.fillStyle = L.color;
    if (t.mode === 'line') {
      g.textAlign = t.anchor === 'start' ? 'left' : t.anchor === 'end' ? 'right' : 'center';
      for (const it of t.items) {
        if (outline) g.strokeText(it.text, it.x * s, it.y * s);
        g.fillText(it.text, it.x * s, it.y * s);
      }
    } else {
      g.textAlign = 'center';
      for (const it of t.items) {
        g.save();
        g.translate(it.x * s, it.y * s);
        g.rotate(it.rot);
        if (outline) g.strokeText(it.text, 0, 0);
        g.fillText(it.text, 0, 0);
        g.restore();
      }
    }
  }
}

// One path description for canvas (ctx given) and SVG (returns a path string).
function shapePath(L, w, h, s = 1, ctx = null) {
  const P = [];
  const M = (x, y) => (ctx ? ctx.moveTo(x * s, y * s) : P.push(`M${f(x)} ${f(y)}`));
  const Ln = (x, y) => (ctx ? ctx.lineTo(x * s, y * s) : P.push(`L${f(x)} ${f(y)}`));
  const Z = () => (ctx ? ctx.closePath() : P.push('Z'));
  if (L.shape === 'line') { M(-w / 2, 0); Ln(w / 2, 0); }
  else if (L.shape === 'ellipse') {
    if (ctx) ctx.ellipse(0, 0, (w / 2) * s, (h / 2) * s, 0, 0, Math.PI * 2);
    else P.push(`M${f(-w / 2)} 0A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w / 2)} 0A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(-w / 2)} 0Z`);
  } else if (L.shape === 'burst') {
    const n = Math.max(5, Math.min(40, L.points || 16)), depth = 0.84;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? depth : 1;
      (i ? Ln : M)((Math.cos(a) * r * w) / 2, (Math.sin(a) * r * h) / 2);
    }
    Z();
  } else if (L.shape === 'ribbon') {
    const notch = Math.min(w * 0.12, h * 0.5);
    M(-w / 2, -h / 2); Ln(w / 2, -h / 2); Ln(w / 2 - notch, 0); Ln(w / 2, h / 2); Ln(-w / 2, h / 2); Ln(-w / 2 + notch, 0); Z();
  } else {
    const r = Math.max(0, Math.min(L.radius || 0, w / 2, h / 2));
    if (ctx && ctx.roundRect) ctx.roundRect((-w / 2) * s, (-h / 2) * s, w * s, h * s, r * s);
    else if (ctx) ctx.rect((-w / 2) * s, (-h / 2) * s, w * s, h * s);
    else if (r) P.push(`M${f(-w / 2 + r)} ${f(-h / 2)}H${f(w / 2 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w / 2)} ${f(-h / 2 + r)}V${f(h / 2 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w / 2 - r)} ${f(h / 2)}H${f(-w / 2 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(-w / 2)} ${f(h / 2 - r)}V${f(-h / 2 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(-w / 2 + r)} ${f(-h / 2)}Z`);
    else P.push(`M${f(-w / 2)} ${f(-h / 2)}H${f(w / 2)}V${f(h / 2)}H${f(-w / 2)}Z`);
  }
  return P.join('');
}
const f = (v) => +v.toFixed(3);

// ---------- SVG (on-dieline view) ----------

function layerNode(L) {
  const [w, h] = layerSize(L);
  const g = el('g', {});
  if (L.type === 'image') {
    g.appendChild(el('image', { href: L.src, x: -w / 2, y: -h / 2, width: w, height: h, preserveAspectRatio: 'none' }));
  } else if (L.type === 'element') {
    const { vb, body } = elementView(L);
    // a scaled group, not a nested <svg>: page CSS sizes every svg to its box
    const n = el('g', { transform: `translate(${f(-w / 2)} ${f(-h / 2)}) scale(${w / vb[0]} ${h / vb[1]})` });
    n.innerHTML = body;
    g.appendChild(n);
  } else if (L.type === 'shape') {
    const attrs = { d: shapePath(L, w, h), fill: L.shape !== 'line' && L.fill ? L.fill : 'none' };
    if (L.stroke && L.sw > 0) Object.assign(attrs, { stroke: L.stroke, 'stroke-width': L.sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    g.appendChild(el('path', attrs));
  } else {
    const t = textLayout(L);
    const base = { 'dominant-baseline': 'central', 'font-size': L.size, 'font-family': FONTS[L.font] || FONTS.Sans, 'font-weight': L.weight || 400, fill: L.color };
    if (L.italic) base['font-style'] = 'italic';
    if (L.outline && L.ow > 0) Object.assign(base, { stroke: L.outline, 'stroke-width': 2 * L.ow, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
    for (const it of t.items) {
      const n = t.mode === 'line'
        ? el('text', { ...base, x: it.x, y: it.y, 'text-anchor': t.anchor })
        : el('text', { ...base, 'text-anchor': 'middle', transform: `translate(${f(it.x)} ${f(it.y)}) rotate(${f((it.rot * 180) / Math.PI)})` });
      n.textContent = it.text;
      g.appendChild(n);
    }
  }
  return g;
}

// ---------- print check ----------

const DIET = new Set(['veg', 'nonveg']);

export function printCheck(model, layers) {
  const out = [];
  const add = (L, level, msg) => out.push({ id: L.id, level, msg, name: layerName(L) });
  const visible = layers.filter((L) => !L.hidden);
  for (const L of visible) {
    const q = model.byId[L.panel], corners = layerCorners(model, L);
    if (q) {
      if (!corners.every((p) => inside(p, q.pts))) add(L, 'warn', `Crosses a fold or the cut line of the ${q.name.toLowerCase()} panel`);
      else {
        const d = Math.min(...corners.map((p) => edgeDistance(p, q.pts)));
        if (d < 2) add(L, 'info', `Only ${d.toFixed(1)} mm from a fold or cut. Keep 2–3 mm clear`);
      }
    }
    if (model.zones.some((z) => convexOverlap(corners, z))) add(L, 'warn', 'Sits on a heat-seal area, where print gets crushed or hidden');
    if (L.type === 'text' && L.size < 2.1) add(L, 'info', 'Text smaller than 6 pt can be hard to read');
    if (L.type === 'image' && L.img?.naturalWidth) {
      const dpi = L.img.naturalWidth / (L.w / 25.4);
      if (dpi < 200) add(L, dpi < 120 ? 'warn' : 'info', `Low resolution: about ${Math.round(dpi)} dpi at this size (aim for 300)`);
    }
    if (L.type === 'element') {
      if (L.el === 'barcode') {
        if (L.w < 37.29 * 0.8) add(L, 'warn', 'Barcode is under 80% of standard size and may not scan');
        if (normaliseEAN(L.data?.code).startsWith(SAMPLE_EAN)) add(L, 'warn', 'Sample barcode number. Use your own number from GS1 India');
      }
      if (L.el === 'qr' && L.w < 15) add(L, 'info', 'QR codes under 15 mm can be hard to scan');
      const fu = elementFontUnits(L);
      if (fu) {
        const mm = (fu * L.w) / elementView(L).vb[0];
        if (mm < 1.6) add(L, 'warn', `Text in this block is about ${mm.toFixed(1)} mm. Check the minimum size for your pack under FSSAI and Legal Metrology rules`);
      }
      if (DIET.has(L.el) && L.w < 3) add(L, 'warn', 'Veg / non-veg mark should be at least 3 mm');
    }
  }
  if (visible.some((L) => L.el === 'veg') && visible.some((L) => L.el === 'nonveg')) {
    const L = visible.find((x) => x.el === 'nonveg');
    add(L, 'warn', 'Both veg and non-veg marks are on this pack');
  }
  return out;
}

// separating-axis test for two convex polygons
function convexOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], nx = y1 - y2, ny = x2 - x1;
      const proj = (P) => P.map(([x, y]) => x * nx + y * ny);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

function edgeDistance([x, y], pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    d = Math.min(d, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return d;
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

// Snap a layer centre to its panel's centre lines. Returns guide lines to draw.
export function snapToPanel(model, L, x, y, tol) {
  const q = panelAt(model, x, y) || model.byId[L.panel];
  if (!q) return { x, y, guides: [] };
  const b = bounds([q.pts]), cx = b.minX + b.w / 2, cy = b.minY + b.h / 2, guides = [];
  if (Math.abs(x - cx) < tol) { x = cx; guides.push([[cx, b.minY], [cx, b.maxY]]); }
  if (Math.abs(y - cy) < tol) { y = cy; guides.push([[b.minX, cy], [b.maxX, cy]]); }
  return { x, y, guides };
}

// ---------- on-dieline editing ----------

export class Editor {
  constructor({ getModel, getLayers, onChange, onSelect, pxToMm }) {
    Object.assign(this, { getModel, getLayers, onChange, onSelect, pxToMm });
    this.selected = null;
    this.guides = [];
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
    if (!this.svg?.isConnected) return;
    const model = this.model, b = model.art, layers = this.getLayers();
    const X = (x) => x - b.minX, Y = (y) => b.maxY - y;
    this.layersG.textContent = '';
    this.ui.textContent = '';
    const k = this.pxToMm();
    for (const L of layers) {
      if (L.hidden) continue;
      const [x, y] = layerCenter(model, L), [w, h] = layerSize(L);
      const tf = `translate(${f(X(x))} ${f(Y(y))}) rotate(${-L.rot})`;
      const g = layerNode(L);
      g.setAttribute('transform', tf);
      g.setAttribute('opacity', L.opacity ?? 1);
      this.layersG.appendChild(g);

      const hit = el('g', { transform: tf, 'data-id': L.id, class: 'ed-layer' + (L.locked ? ' locked' : '') });
      if (!L.locked) hit.setAttribute('data-ed', 'move');
      hit.appendChild(el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }));
      if (L.id === this.selected) {
        const pad = 1.5 * k;
        hit.appendChild(el('rect', { x: -w / 2 - pad, y: -h / 2 - pad, width: w + 2 * pad, height: h + 2 * pad, class: 'ed-box' }));
        if (!L.locked) {
          const top = -h / 2 - pad;
          hit.appendChild(el('line', { x1: 0, y1: top, x2: 0, y2: top - 18 * k, class: 'ed-stem' }));
          hit.appendChild(el('circle', { cx: 0, cy: top - 18 * k, r: 6 * k, class: 'ed-handle rot', 'data-ed': 'rotate', 'data-id': L.id }));
          hit.appendChild(el('rect', { x: w / 2 + pad - 6 * k, y: h / 2 + pad - 6 * k, width: 12 * k, height: 12 * k, rx: 2 * k, class: 'ed-handle', 'data-ed': 'scale', 'data-id': L.id }));
        }
      }
      this.ui.appendChild(hit);
    }
    for (const [[x1, y1], [x2, y2]] of this.guides) {
      this.ui.appendChild(el('line', { x1: X(x1), y1: Y(y1), x2: X(x2), y2: Y(y2), class: 'ed-guide' }));
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
    this.drag = { mode: t.dataset.ed, L, c, off: [c[0] - p[0], c[1] - p[1]], d0: Math.hypot(p[0] - c[0], p[1] - c[1]) || 1, w0: L.w, h0: L.h, s0: L.size, moved: false };
    this.svg.setPointerCapture(e.pointerId);
  }

  move(e) {
    const d = this.drag;
    if (!d) return;
    e.stopPropagation();
    d.moved = true;
    const [px, py] = this.toFlat(e), L = d.L;
    if (d.mode === 'move') {
      const sn = e.altKey ? { x: px + d.off[0], y: py + d.off[1], guides: [] } : snapToPanel(this.model, L, px + d.off[0], py + d.off[1], 6 * this.pxToMm());
      pinToPanel(this.model, L, sn.x, sn.y);
      this.guides = sn.guides;
    } else if (d.mode === 'scale') scaleLayer(L, Math.max(0.05, Math.hypot(px - d.c[0], py - d.c[1]) / d.d0), d);
    else if (d.mode === 'rotate') {
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
    const moved = this.drag.moved;
    this.drag = null;
    this.guides = [];
    try { this.svg.releasePointerCapture(e.pointerId); } catch {}
    this.render();
    this.onSelect(this.getLayers().find((L) => L.id === this.selected) || null);
    if (moved) this.onChange('commit');
  }
}

// uniform scale from a drag; f = new distance / start distance
export function scaleLayer(L, k, d) {
  if (L.type === 'text') L.size = Math.max(1, Math.min(300, d.s0 * k));
  else {
    L.w = Math.max(2, Math.min(2000, d.w0 * k));
    if (L.type === 'shape' && d.h0 != null) L.h = Math.max(0.5, Math.min(2000, d.h0 * k));
  }
}

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, typeof v === 'number' ? +v.toFixed(3) : v);
  return n;
}
