// Document model: plain JSON nodes in a tree, plus helpers to find, move,
// clone and measure them. Everything the editor and the exporters share.

export const uid = () => 'n' + Math.random().toString(36).slice(2, 9);

export const FONTS = [
  'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Open Sans', 'Lato', 'DM Sans', 'Manrope',
  'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Sora', 'Figtree', 'Work Sans', 'Rubik',
  'Nunito', 'Raleway', 'Karla', 'Archivo', 'Syne', 'IBM Plex Sans', 'Playfair Display',
  'DM Serif Display', 'Fraunces', 'Lora', 'Merriweather', 'Bebas Neue', 'Oswald',
  'JetBrains Mono', 'IBM Plex Mono',
];

const BASE = {
  x: 0, y: 0, w: 100, h: 100, rot: 0,
  visible: true, locked: false, opacity: 1, blend: 'normal',
  fill: { type: 'solid', color: '#D9D9D9', color2: '#7C5CFF', angle: 180, opacity: 1 },
  stroke: { enabled: false, color: '#111111', width: 1, align: 'inside', style: 'solid', opacity: 1 },
  radius: 0,
  shadow: { enabled: false, inset: false, x: 0, y: 8, blur: 24, spread: 0, color: '#000000', opacity: 0.18 },
  blur: 0, bgBlur: 0,
  cH: 'left', cV: 'top',       // constraints inside a non auto layout parent
  sizeW: 'fixed', sizeH: 'fixed', // fixed | hug | fill
  link: '', tag: 'auto',
};

export const defLayout = () => ({ mode: 'none', gap: 12, pt: 16, pr: 16, pb: 16, pl: 16, align: 'start', justify: 'start', wrap: false });
export const defFont = () => ({ family: 'Inter', size: 16, weight: 400, lh: 1.4, ls: 0, align: 'left', italic: false, deco: 'none', case: 'none' });

const NESTED = ['fill', 'stroke', 'shadow', 'font', 'layout'];

export function makeNode(type, props = {}) {
  const n = structuredClone(BASE);
  n.id = uid();
  n.type = type;
  if (type === 'frame') {
    n.name = 'Frame'; n.fill.color = '#FFFFFF'; n.clip = true; n.layout = defLayout(); n.children = [];
  } else if (type === 'rect') {
    n.name = 'Rectangle';
  } else if (type === 'ellipse') {
    n.name = 'Ellipse';
  } else if (type === 'text') {
    n.name = 'Text'; n.text = 'Text'; n.fill.color = '#111111'; n.font = defFont(); n.textSize = 'autoW';
    n.w = 40; n.h = 22;
  } else if (type === 'image') {
    n.name = 'Image'; n.src = ''; n.fit = 'cover'; n.fill.color = '#E6E6EA';
  } else if (type === 'path') {
    n.name = 'Vector'; n.d = ''; n.vw = 100; n.vh = 100; n.fill.type = 'none';
    n.stroke.enabled = true; n.stroke.width = 2; n.stroke.align = 'center';
  }
  for (const k of Object.keys(props)) {
    if (NESTED.includes(k) && props[k] && typeof props[k] === 'object' && n[k]) Object.assign(n[k], props[k]);
    else n[k] = props[k];
  }
  return n;
}

// Build a tree from a compact spec: ['frame', {props}, [children...]]
export function build(spec) {
  const [type, props = {}, kids] = spec;
  const n = makeNode(type, props);
  if (kids && n.children) n.children = kids.map(build);
  return n;
}

export function emptyDoc() {
  return { v: 1, name: 'Untitled', bg: '#EEEEF1', children: [], assets: {} };
}

/* ---------- tree helpers (all take the doc) ---------- */

export function walk(list, fn, parent = null) {
  for (const n of list) {
    if (fn(n, parent) === false) continue;
    if (n.children) walk(n.children, fn, n);
  }
}

export function makeIndex(doc) {
  const map = new Map();
  walk(doc.children, (n, p) => { map.set(n.id, { node: n, parent: p }); });
  return map;
}

export const listOf = (doc, parent) => (parent ? parent.children : doc.children);

export const isFlex = (p) => !!(p && p.type === 'frame' && p.layout && p.layout.mode !== 'none');

export function isAncestor(idx, a, b) { // is a an ancestor of b
  let e = idx.get(b);
  while (e && e.parent) { if (e.parent.id === a) return true; e = idx.get(e.parent.id); }
  return false;
}

export function chainOf(idx, id) { // [topmost ... node]
  const out = [];
  let e = idx.get(id);
  while (e) { out.unshift(e.node); e = e.parent ? idx.get(e.parent.id) : null; }
  return out;
}

export function worldPos(idx, id) {
  let x = 0, y = 0;
  let e = idx.get(id);
  while (e) { x += e.node.x; y += e.node.y; e = e.parent ? idx.get(e.parent.id) : null; }
  return { x, y };
}

export function worldBox(idx, id) {
  const e = idx.get(id);
  const p = worldPos(idx, id);
  return { x: p.x, y: p.y, w: e.node.w, h: e.node.h };
}

export function unionBox(boxes) {
  if (!boxes.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function remove(doc, idx, id) {
  const e = idx.get(id);
  if (!e) return null;
  const list = listOf(doc, e.parent);
  const i = list.findIndex((n) => n.id === id);
  if (i >= 0) list.splice(i, 1);
  return { node: e.node, parent: e.parent, index: i };
}

export function insert(doc, node, parent, index = -1) {
  const list = listOf(doc, parent);
  if (index < 0 || index > list.length) list.push(node); else list.splice(index, 0, node);
}

export function cloneWithNewIds(node) {
  const c = structuredClone(node);
  walk([c], (n) => { n.id = uid(); });
  return c;
}

/* ---------- constraints: when a frame is resized, move its children ---------- */

export function applyConstraints(frame, oldW, oldH) {
  if (!frame.children || isFlex(frame)) return;
  const nw = frame.w, nh = frame.h;
  if (oldW === nw && oldH === nh) return;
  for (const c of frame.children) {
    const ow = c.w, oh = c.h;
    [c.x, c.w] = axis(c.cH, c.x, c.w, oldW, nw);
    [c.y, c.h] = axis(c.cV, c.y, c.h, oldH, nh);
    if (c.type === 'frame' && (c.w !== ow || c.h !== oh)) applyConstraints(c, ow, oh);
  }
}

function axis(mode, pos, size, oldP, newP) {
  switch (mode) {
    case 'right': case 'bottom': return [pos + (newP - oldP), size];
    case 'center': return [Math.round(pos + (newP - oldP) / 2), size];
    case 'stretch': return [pos, Math.max(1, size + (newP - oldP))];
    case 'scale': { const k = oldP ? newP / oldP : 1; return [Math.round(pos * k), Math.max(1, Math.round(size * k))]; }
    default: return [pos, size];
  }
}

/* ---------- colour helpers ---------- */

export function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a = 1) {
  if (a >= 1) return normHex(hex);
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;
}

export function normHex(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#000000';
  return '#' + h.toUpperCase();
}

/* ---------- shape paths ---------- */

export function polygonPath(sides, w, h) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push([w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)]);
  }
  return fitPoints(pts, w, h, true);
}

export function starPath(points, w, h, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : 1;
    pts.push([w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a)]);
  }
  return fitPoints(pts, w, h, true);
}

// Scale points so their bounding box fills w x h, return an svg path string.
export function fitPoints(pts, w, h, closed) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const bw = Math.max(...xs) - x0 || 1, bh = Math.max(...ys) - y0 || 1;
  const kx = w / bw, ky = h / bh;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${r2((p[0] - x0) * kx)} ${r2((p[1] - y0) * ky)}`).join(' ');
  return d + (closed ? ' Z' : '');
}

export const r2 = (v) => Math.round(v * 100) / 100;
