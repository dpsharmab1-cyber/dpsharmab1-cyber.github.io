// The template registry. Every packaging style is one parametric definition:
//   params  -> what the user can type (all millimetres unless unit says otherwise)
//   build() -> a flat net of panels. Each non-root panel names its parent, the hinge
//              (crease) it folds on, the fold angle and a stacking layer.
// The engine turns that single description into the dieline (SVG/PDF/DXF), the
// folding 3D model (GLB) and the artwork template, so adding a category is just
// adding one entry here.

import { rect, arc, ngonOnEdge, ccw } from './geom.js';

export const MATERIALS = {
  sbs:    { name: 'White SBS board',     t: 0.45, inside: '#f2efe8', edge: '#d9d4c8' },
  kraft:  { name: 'Kraft board',         t: 0.5,  inside: '#b98b5d', edge: '#9c7149' },
  eflute: { name: 'E-flute corrugated',  t: 1.6,  inside: '#c79f70', edge: '#a9845a' },
  bflute: { name: 'B-flute corrugated',  t: 3.0,  inside: '#c79f70', edge: '#a9845a' },
  paper:  { name: 'Label paper',         t: 0.1,  inside: '#f7f7f4', edge: '#dddddd' },
  film:   { name: 'Metallised film (PET/PE)', t: 0.12, inside: '#c9cdd2', edge: '#b4b8bd' },
  kraftfilm: { name: 'Kraft paper laminate', t: 0.15, inside: '#c9a27e', edge: '#a8835e' },
};

export const CATEGORIES = [
  { id: 'cartons',  name: 'Folding cartons' },
  { id: 'mailers',  name: 'Mailers & shipping' },
  { id: 'trays',    name: 'Trays & sleeves' },
  { id: 'pouches',  name: 'Pouches & bags' },
  { id: 'bottles',  name: 'Bottles & jars' },
  { id: 'labels',   name: 'Labels & wraps' },
  { id: 'soon',     name: 'Coming next', soon: ['Tubes', 'Paper bags', 'Displays & POS', 'Cups & food'] },
];

const P = (k, label, def, min, max, extra = {}) => ({ k, label, def, min, max, step: 1, unit: 'mm', adv: false, ...extra });

// ---------- shared panel builders ----------

function tuckFlap(x0, x1, y, depth, dir) {
  // rounded-corner tuck on edge y, growing up (dir=1) or down (dir=-1)
  const r = Math.min(depth * 0.7, (x1 - x0) * 0.25);
  const top = y + depth * dir;
  const pts = [[x0, y], [x1, y]];
  if (dir > 0) {
    pts.push(...arc(x1 - r, top - r, r, 0, Math.PI / 2), ...arc(x0 + r, top - r, r, Math.PI / 2, Math.PI));
  } else {
    pts.push(...arc(x1 - r, top + r, r, 0, -Math.PI / 2), ...arc(x0 + r, top + r, r, -Math.PI / 2, -Math.PI));
  }
  return ccw(dedupe(pts));
}

function dustFlap(x0, x1, y, h, dir, chamferRight = true) {
  const c = Math.min(h * 0.45, (x1 - x0) * 0.4);
  const yy = (v) => y + v * dir;
  const pts = chamferRight
    ? [[x0, y], [x1, y], [x1, yy(h * 0.3)], [x1 - c, yy(h)], [x0 + 1.5, yy(h)], [x0, yy(h * 0.55)]]
    : [[x0, y], [x1, y], [x1, yy(h * 0.55)], [x1 - 1.5, yy(h)], [x0 + c, yy(h)], [x0, yy(h * 0.3)]];
  return ccw(pts);
}

function glueFlap(x, y0, y1, g, side = -1) {
  // tapered glue tab on a vertical edge, extending left (side=-1) or right (+1)
  const inset = Math.min(g * 0.8, (y1 - y0) * 0.2);
  return ccw([[x, y0], [x, y1], [x + g * side, y1 - inset], [x + g * side, y0 + inset]]);
}

function trapezoidOnEdge([ax, ay], [bx, by], depth, insetFrac = 0.15) {
  // trapezoid standing on edge a->b, on its right-hand side (outward for a CCW polygon)
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  const nx = uy, ny = -ux, i = L * insetFrac;
  return ccw([[ax, ay], [bx, by],
    [bx - ux * i + nx * depth, by - uy * i + ny * depth],
    [ax + ux * i + nx * depth, ay + uy * i + ny * depth]]);
}

function dedupe(pts) {
  return pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
}

// Wrap-around label on a turned container (can, bottle, jar). The 3D body is a lathe profile.
function wrap(p, body, H) {
  const r = p.D / 2, circ = Math.PI * p.D;
  const full = p.cover >= 100;
  // keep the label on the straight part of the body
  const maxTop = body === 'bottle' ? H * 0.62 : body === 'jar' ? H - 14 : H - 2;
  const labelH = Math.max(10, Math.min(p.labelH, maxTop - 2));
  const labelY = Math.max(1, Math.min(p.labelY, maxTop - labelH));
  const labelW = full ? circ : circ * (p.cover / 100);
  const overlap = full ? p.overlap : 0;
  const xc = full ? circ / 2 : labelW / 2;
  const fw = Math.min(labelW, p.D * 0.84);
  return {
    kind: 'wrap', body, r, H, labelH, labelY, labelW, circ, overlap, xc,
    panels: [
      { id: 'label', name: 'Label', pts: rect(0, 0, labelW, labelH) },
      ...(overlap > 0 ? [{ id: 'overlap', name: 'Glue', glue: true, pts: rect(labelW, 0, overlap, labelH), parent: 'label', hinge: [[labelW, 0], [labelW, labelH]], angle: 0 }] : []),
    ],
    front: { rect: [xc - fw / 2, 0, fw, labelH], up: [0, 1] }, // the part facing the viewer
  };
}

// Flexible pouch printed as one web: front, (gusset), back. The back sits upside
// down on the print, exactly as it does on a real pouch film layout.
function pouch(p, gusset) {
  const { W, H, seal, topSeal } = p, G = gusset ? p.G : 0;
  const fy = H + G; // front panel bottom
  const panels = [
    { id: 'front', name: 'Front', pts: rect(0, fy, W, H) },
    ...(G ? [{ id: 'gusset', name: 'Bottom gusset', pts: rect(0, H, W, G), parent: 'front', hinge: [[0, fy], [W, fy]], angle: 180 }] : []),
    { id: 'back', name: 'Back', pts: rect(0, 0, W, H), parent: G ? 'gusset' : 'front', hinge: [[0, H], [W, H]], angle: 180 },
  ];
  const zones = [
    rect(0, fy, seal, H), rect(W - seal, fy, seal, H), rect(0, fy + H - topSeal, W, topSeal),
    rect(0, 0, seal, H), rect(W - seal, 0, seal, H), rect(0, 0, W, topSeal),
    ...(G ? [rect(0, H, seal, G), rect(W - seal, H, seal, G)] : []),
  ];
  const guides = [];
  if (p.zip) {
    guides.push({ seg: [[seal, fy + H - p.zip], [W - seal, fy + H - p.zip]], label: 'Zipper' });
    guides.push({ seg: [[seal, p.zip], [W - seal, p.zip]], label: 'Zipper' });
  }
  const notch = Math.max(topSeal + 4, (p.zip || topSeal * 3) * 0.55);
  for (const y of [fy + H - notch, notch]) {
    guides.push({ seg: [[0, y], [seal, y]], label: 'Tear notch' }, { seg: [[W - seal, y], [W, y]], label: '' });
  }
  return {
    kind: 'pouch', W, H, G, seal, topSeal, panels, zones, guides,
    creases: G ? [[[0, H + G / 2], [W, H + G / 2]]] : [],
    front: { rect: [0, fy, W, H - topSeal], up: [0, 1] },
  };
}

// ---------- templates ----------

function tuckEnd(p, reverse) {
  const { L, W, H, tuck, glue } = p;
  const dust = Math.min(p.dust, W * 0.95);
  const x = [0, L, L + W, 2 * L + W, 2 * L + 2 * W];
  const panels = [
    { id: 'front', name: 'Front', pts: rect(0, 0, L, H) },
    { id: 'right', name: 'Side', pts: rect(L, 0, W, H), parent: 'front', hinge: [[L, 0], [L, H]], angle: 90, seq: 1 },
    { id: 'back', name: 'Back', pts: rect(x[2], 0, L, H), parent: 'right', hinge: [[x[2], 0], [x[2], H]], angle: 90, seq: 2 },
    { id: 'left', name: 'Side', pts: rect(x[3], 0, W, H), parent: 'back', hinge: [[x[3], 0], [x[3], H]], angle: 90, seq: 3 },
    { id: 'glue', name: 'Glue', glue: true, pts: glueFlap(0, 0, H, glue), parent: 'front', hinge: [[0, 0], [0, H]], angle: 90, layer: 1, seq: 0 },
  ];
  // top closure always hangs off the back panel
  panels.push(
    { id: 'lidTop', name: 'Top', pts: rect(x[2], H, L, W), parent: 'back', hinge: [[x[2], H], [x[3], H]], angle: 90, seq: 6 },
    { id: 'tuckTop', name: 'Tuck', pts: tuckFlap(x[2], x[3], H + W, tuck, 1), parent: 'lidTop', hinge: [[x[2], H + W], [x[3], H + W]], angle: 90, layer: 1, seq: 7 },
    { id: 'dustTR', name: 'Dust', pts: dustFlap(L, L + W, H, dust, 1, false), parent: 'right', hinge: [[L, H], [L + W, H]], angle: 90, layer: 1, seq: 5 },
    { id: 'dustTL', name: 'Dust', pts: dustFlap(x[3], x[4], H, dust, 1, true), parent: 'left', hinge: [[x[3], H], [x[4], H]], angle: 90, layer: 1, seq: 5 },
  );
  // bottom closure: on the front for reverse tuck, on the back for straight tuck
  const bx0 = reverse ? 0 : x[2], bx1 = reverse ? L : x[3], bp = reverse ? 'front' : 'back';
  panels.push(
    { id: 'lidBot', name: 'Bottom', pts: rect(bx0, -W, L, W), parent: bp, hinge: [[bx0, 0], [bx1, 0]], angle: 90, seq: 6 },
    { id: 'tuckBot', name: 'Tuck', pts: tuckFlap(bx0, bx1, -W, tuck, -1), parent: 'lidBot', hinge: [[bx0, -W], [bx1, -W]], angle: 90, layer: 1, seq: 7 },
    { id: 'dustBR', name: 'Dust', pts: dustFlap(L, L + W, 0, dust, -1, false), parent: 'right', hinge: [[L, 0], [L + W, 0]], angle: 90, layer: 1, seq: 4 },
    { id: 'dustBL', name: 'Dust', pts: dustFlap(x[3], x[4], 0, dust, -1, true), parent: 'left', hinge: [[x[3], 0], [x[4], 0]], angle: 90, layer: 1, seq: 4 },
  );
  return { panels, orient: 'tube', front: { panel: 'front', up: [0, 1] } };
}

const TUCK_PARAMS = [
  P('L', 'Length', 70, 15, 400), P('W', 'Width', 45, 10, 300), P('H', 'Height', 130, 15, 500),
  P('tuck', 'Tuck flap', 15, 5, 60, { adv: true }), P('dust', 'Dust flap', 28, 5, 150, { adv: true }),
  P('glue', 'Glue flap', 14, 6, 40, { adv: true }),
];

export const TEMPLATES = [
  {
    id: 'rte', category: 'cartons', name: 'Reverse tuck end box',
    desc: 'The classic retail carton: cosmetics, serums, supplements, tea.',
    keywords: ['tuck', 'reverse', 'cosmetic', 'serum', 'perfume', 'soap', 'carton', 'retail', 'product box'],
    params: TUCK_PARAMS, dims: ['L', 'W', 'H'], material: 'sbs',
    build: (p) => tuckEnd(p, true),
  },
  {
    id: 'ste', category: 'cartons', name: 'Straight tuck end box',
    desc: 'Both tucks on the back panel, so the front artwork stays unbroken.',
    keywords: ['straight', 'ste'],
    params: TUCK_PARAMS, dims: ['L', 'W', 'H'], material: 'sbs',
    build: (p) => tuckEnd(p, false),
  },
  {
    id: 'hexbox', category: 'cartons', name: 'Polygon gift box',
    desc: 'Any number of sides from 5 to 12, with fitted lids and tucks.',
    keywords: ['hex', 'hexagon', 'octagon', 'pentagon', 'polygon', 'gift', 'candle'],
    params: [
      P('N', 'Sides', 6, 5, 12, { unit: '#' }), P('s', 'Side width', 45, 15, 200), P('H', 'Height', 110, 20, 400),
      P('tuck', 'Tuck flap', 14, 5, 50, { adv: true }), P('glue', 'Glue flap', 12, 6, 30, { adv: true }),
    ],
    dims: ['s', 'H'], material: 'sbs',
    build: (p) => {
      const N = Math.round(p.N), { s, H, glue, tuck } = p, ang = 360 / N;
      const panels = [];
      for (let i = 0; i < N; i++) {
        const x0 = i * s;
        panels.push({ id: 'p' + i, name: i === 0 ? 'Front' : 'Side', pts: rect(x0, 0, s, H),
          ...(i ? { parent: 'p' + (i - 1), hinge: [[x0, 0], [x0, H]], angle: ang, seq: i } : {}) });
      }
      panels.push({ id: 'glue', name: 'Glue', glue: true, pts: glueFlap(0, 0, H, glue), parent: 'p0', hinge: [[0, 0], [0, H]], angle: ang, layer: 1, seq: 0 });
      const k = Math.floor(N / 2);
      for (const [id, y, dir, seq] of [['top', H, 1, N + 1], ['bot', 0, -1, N]]) {
        const lid = ccw(ngonOnEdge(0, y, s, N, dir));
        panels.push({ id, name: dir > 0 ? 'Lid' : 'Base', pts: lid, parent: 'p0', hinge: [[0, y], [s, y]], angle: 90, seq });
        // tuck on the edge opposite the hinge; it folds down inside the matching side
        const h = lid.findIndex((q, i) => Math.abs(q[1] - y) < 1e-6 && Math.abs(lid[(i + 1) % N][1] - y) < 1e-6);
        const a = lid[(h + k) % N], b = lid[(h + k + 1) % N];
        panels.push({ id: id + 'Tuck', name: 'Tuck', pts: trapezoidOnEdge(a, b, tuck, 0.12), parent: id, hinge: [a, b], angle: 90, layer: 1, seq: seq + 1 });
      }
      return { panels, orient: 'tube', front: { panel: 'p0', up: [0, 1] } };
    },
  },
  {
    id: 'mailer', category: 'mailers', name: 'Mailer box',
    desc: 'Roll-end mailer with double side walls and a tuck-in lid. The D2C favourite.',
    keywords: ['mailer', 'subscription', 'ecommerce', 'e-commerce', 'shipping box with lid', 'd2c', 'pr box', 'unboxing'],
    params: [
      P('L', 'Length', 250, 60, 600), P('W', 'Width', 180, 40, 500), P('H', 'Height', 70, 20, 250),
      P('dustW', 'Dust flap', 60, 15, 200, { adv: true }),
    ],
    dims: ['L', 'W', 'H'], material: 'eflute',
    build: (p) => {
      const { L, W, H } = p, t = p.t, dw = Math.min(p.dustW, W * 0.45);
      const ear = H - 2 * t;
      const panels = [
        { id: 'base', name: 'Base', pts: rect(0, 0, L, W) },
        { id: 'front', name: 'Front', pts: rect(0, -H, L, H), parent: 'base', hinge: [[0, 0], [L, 0]], angle: 90, seq: 1 },
        { id: 'frontIn', name: 'Front inner', pts: rect(t, -2 * H + t, L - 2 * t, H - t), parent: 'front', hinge: [[t, -H], [L - t, -H]], angle: 180, layer: 1, seq: 2 },
        { id: 'back', name: 'Back', pts: rect(0, W, L, H), parent: 'base', hinge: [[0, W], [L, W]], angle: 90, seq: 1 },
        { id: 'dustL', name: 'Dust', pts: ccw([[0, W], [0, W + H], [-dw, W + H - 4], [-dw, W + H * 0.35]]), parent: 'back', hinge: [[0, W], [0, W + H]], angle: 90, layer: 1, seq: 2 },
        { id: 'dustR', name: 'Dust', pts: ccw([[L, W], [L, W + H], [L + dw, W + H - 4], [L + dw, W + H * 0.35]]), parent: 'back', hinge: [[L, W], [L, W + H]], angle: 90, layer: 1, seq: 2 },
        { id: 'sideL', name: 'Side', pts: rect(-H, 0, H, W), parent: 'base', hinge: [[0, 0], [0, W]], angle: 90, seq: 3 },
        { id: 'sideLIn', name: 'Side inner', pts: rect(-2 * H + t, t, H - t, W - 2 * t), parent: 'sideL', hinge: [[-H, t], [-H, W - t]], angle: 180, layer: 2, seq: 4 },
        { id: 'sideR', name: 'Side', pts: rect(L, 0, H, W), parent: 'base', hinge: [[L, 0], [L, W]], angle: 90, seq: 3 },
        { id: 'sideRIn', name: 'Side inner', pts: rect(L + H, t, H - t, W - 2 * t), parent: 'sideR', hinge: [[L + H, t], [L + H, W - t]], angle: 180, layer: 2, seq: 4 },
        { id: 'lid', name: 'Lid', pts: rect(0, W + H, L, W + t), parent: 'back', hinge: [[0, W + H], [L, W + H]], angle: 90, seq: 6 },
        { id: 'lidFlap', name: 'Lid tuck', pts: tuckFlap(t, L - t, 2 * W + H + t, H - 2 * t, 1), parent: 'lid', hinge: [[t, 2 * W + H + t], [L - t, 2 * W + H + t]], angle: 90, layer: 3, seq: 7 },
        { id: 'earL', name: 'Ear', pts: ccw([[0, W + H + 2], [0, 2 * W + H - 2], [-ear, 2 * W + H - ear * 0.6], [-ear, W + H + ear * 0.25]]), parent: 'lid', hinge: [[0, W + H + 2], [0, 2 * W + H - 2]], angle: 90, layer: 3, seq: 7 },
        { id: 'earR', name: 'Ear', pts: ccw([[L, W + H + 2], [L, 2 * W + H - 2], [L + ear, 2 * W + H - ear * 0.6], [L + ear, W + H + ear * 0.25]]), parent: 'lid', hinge: [[L, W + H + 2], [L, 2 * W + H - 2]], angle: 90, layer: 3, seq: 7 },
      ];
      return { panels, orient: 'tray', front: { panel: 'lid', up: [0, -1] } };
    },
  },
  {
    id: 'rsc', category: 'mailers', name: 'Shipping carton (RSC)',
    desc: 'Regular slotted container: the standard brown shipping box.',
    keywords: ['shipping', 'rsc', 'corrugated', 'moving', 'courier', 'carton box', 'master carton', '0201'],
    params: [
      P('L', 'Length', 300, 80, 1200), P('W', 'Width', 200, 60, 800), P('H', 'Height', 200, 50, 1000),
      P('glue', 'Glue flap', 35, 20, 60, { adv: true }),
    ],
    dims: ['L', 'W', 'H'], material: 'bflute',
    build: (p) => {
      const { L, W, H, glue } = p, t = p.t, slot = Math.max(4, 2 * t), f = W / 2;
      const widths = [L, W, L, W], panels = [];
      let x = 0;
      widths.forEach((w, i) => {
        panels.push({ id: 'p' + i, name: i % 2 ? 'Side' : (i ? 'Back' : 'Front'), pts: rect(x, 0, w, H),
          ...(i ? { parent: 'p' + (i - 1), hinge: [[x, 0], [x, H]], angle: 90, seq: i } : {}) });
        const a = x + (i > 0 ? slot / 2 : 0), b = x + w - (i < 3 ? slot / 2 : 0);
        const major = i % 2 === 0;
        panels.push(
          { id: 'ft' + i, name: major ? 'Major flap' : 'Minor flap', pts: rect(a, H, b - a, f), parent: 'p' + i, hinge: [[a, H], [b, H]], angle: 90, layer: major ? 0 : 1, seq: major ? 7 : 6 },
          { id: 'fb' + i, name: major ? 'Major flap' : 'Minor flap', pts: rect(a, -f, b - a, f), parent: 'p' + i, hinge: [[a, 0], [b, 0]], angle: 90, layer: major ? 0 : 1, seq: major ? 5 : 4 },
        );
        x += w;
      });
      panels.push({ id: 'glue', name: 'Glue', glue: true, pts: glueFlap(0, 0, H, glue), parent: 'p0', hinge: [[0, 0], [0, H]], angle: 90, layer: 1, seq: 0 });
      return { panels, orient: 'tube', front: { panel: 'p0', up: [0, 1] } };
    },
  },
  {
    id: 'tray', category: 'trays', name: 'Open tray',
    desc: 'Glued-corner tray for bakery, produce, gift sets and inserts.',
    keywords: ['tray', 'bakery', 'produce', 'insert', 'open box'],
    params: [
      P('L', 'Length', 200, 40, 600), P('W', 'Width', 140, 30, 500), P('H', 'Height', 45, 10, 200),
      P('corner', 'Corner flap', 25, 8, 80, { adv: true }),
    ],
    dims: ['L', 'W', 'H'], material: 'kraft',
    build: (p) => {
      const { L, W, H } = p, c = Math.min(p.corner, W * 0.45), m = Math.min(1.5, H * 0.05);
      const panels = [
        { id: 'base', name: 'Base', pts: rect(0, 0, L, W) },
        { id: 'front', name: 'Front', pts: rect(0, -H, L, H), parent: 'base', hinge: [[0, 0], [L, 0]], angle: 90, seq: 0 },
        { id: 'back', name: 'Back', pts: rect(0, W, L, H), parent: 'base', hinge: [[0, W], [L, W]], angle: 90, seq: 0 },
        { id: 'left', name: 'Side', pts: rect(-H, 0, H, W), parent: 'base', hinge: [[0, 0], [0, W]], angle: 90, seq: 1 },
        { id: 'right', name: 'Side', pts: rect(L, 0, H, W), parent: 'base', hinge: [[L, 0], [L, W]], angle: 90, seq: 1 },
      ];
      for (const [wall, y0, y1] of [['front', -H, 0], ['back', W, W + H]]) {
        for (const [side, x, dir] of [['L', 0, -1], ['R', L, 1]]) {
          const a = y0 + m, b = y1 - m, taper = Math.min(c * 0.5, (b - a) * 0.3);
          const far = wall === 'front' ? [b - taper * 0.3, a + taper] : [b - taper, a + taper * 0.3];
          panels.push({ id: wall + side, name: 'Glue', glue: true,
            pts: ccw([[x, a], [x, b], [x + c * dir, far[0]], [x + c * dir, far[1]]]),
            parent: wall, hinge: [[x, a], [x, b]], angle: 90, layer: 1, seq: 2 });
        }
      }
      return { panels, orient: 'tray', front: { panel: 'front', up: [0, -1] } };
    },
  },
  {
    id: 'sleeve', category: 'trays', name: 'Sleeve',
    desc: 'Slide-on wrap for trays, soap bars, chocolate and gift sets.',
    keywords: ['sleeve', 'wrap around', 'belly band', 'chocolate'],
    params: [
      P('W', 'Width', 110, 20, 500), P('H', 'Height', 35, 5, 300), P('L', 'Sleeve length', 70, 10, 500),
      P('glue', 'Glue flap', 14, 6, 40, { adv: true }),
    ],
    dims: ['W', 'H', 'L'], material: 'sbs',
    build: (p) => {
      const { W, H, L, glue } = p, widths = [W, H, W, H], panels = [];
      let x = 0;
      widths.forEach((w, i) => {
        panels.push({ id: 'p' + i, name: i % 2 ? 'Side' : (i ? 'Back' : 'Front'), pts: rect(x, 0, w, L),
          ...(i ? { parent: 'p' + (i - 1), hinge: [[x, 0], [x, L]], angle: 90, seq: i } : {}) });
        x += w;
      });
      panels.push({ id: 'glue', name: 'Glue', glue: true, pts: glueFlap(0, 0, L, glue), parent: 'p0', hinge: [[0, 0], [0, L]], angle: 90, layer: 1, seq: 0 });
      return { panels, orient: 'sleeve', front: { panel: 'p0', up: [0, 1] } };
    },
  },
  {
    id: 'standup', category: 'pouches', name: 'Stand-up pouch',
    desc: 'Doypack with bottom gusset, zipper and tear notch. Coffee, snacks, pet food.',
    keywords: ['pouch', 'stand up', 'stand-up', 'standup', 'doypack', 'zipper bag', 'coffee bag', 'snack', 'pet food', 'granola'],
    params: [
      P('W', 'Width', 140, 60, 400), P('H', 'Height', 220, 80, 500), P('G', 'Bottom gusset', 80, 20, 200),
      P('seal', 'Side seal', 6, 3, 15, { adv: true }), P('topSeal', 'Top seal', 12, 5, 30, { adv: true }),
      P('zip', 'Zipper from top', 32, 15, 80, { adv: true }),
    ],
    dims: ['W', 'H', 'G'], material: 'film',
    build: (p) => pouch(p, true),
  },
  {
    id: 'sachet', category: 'pouches', name: 'Flat pouch (3-side seal)',
    desc: 'Sachets and pillow packs for samples, spices, sheet masks and tea.',
    keywords: ['sachet', 'flat pouch', '3 side', 'three side', 'pillow pack', 'sample', 'spice', 'sheet mask', 'packet'],
    params: [
      P('W', 'Width', 100, 30, 300), P('H', 'Height', 140, 40, 400),
      P('seal', 'Side seal', 6, 3, 15, { adv: true }), P('topSeal', 'Top seal', 8, 4, 25, { adv: true }),
    ],
    dims: ['W', 'H'], material: 'film',
    build: (p) => pouch({ ...p, G: 0, zip: 0 }, false),
  },
  {
    id: 'bottle', category: 'bottles', name: 'Bottle label',
    desc: 'Front or full-wrap label on a beverage, sauce, oil or wine bottle.',
    keywords: ['bottle', 'wine', 'beer', 'sauce', 'oil', 'kombucha', 'juice', 'cold brew'],
    params: [
      P('D', 'Bottle diameter', 72, 30, 140), P('bottleH', 'Bottle height', 240, 120, 400),
      P('labelH', 'Label height', 90, 20, 200), P('cover', 'Wrap coverage', 60, 20, 100, { unit: '%' }),
      P('labelY', 'Label from base', 35, 0, 150, { adv: true }), P('overlap', 'Glue overlap', 8, 0, 30, { adv: true }),
    ],
    dims: ['D', 'bottleH'], material: 'paper',
    build: (p) => wrap(p, 'bottle', p.bottleH),
  },
  {
    id: 'jar', category: 'bottles', name: 'Jar label',
    desc: 'Wrap label for honey, pickle, jam, candle and spread jars with a screw lid.',
    keywords: ['jar', 'honey', 'pickle', 'candle jar', 'spread', 'jam', 'ghee'],
    params: [
      P('D', 'Jar diameter', 85, 30, 200), P('jarH', 'Jar height', 100, 40, 250),
      P('labelH', 'Label height', 55, 15, 200), P('cover', 'Wrap coverage', 100, 20, 100, { unit: '%' }),
      P('labelY', 'Label from base', 16, 0, 120, { adv: true }), P('overlap', 'Glue overlap', 8, 0, 30, { adv: true }),
    ],
    dims: ['D', 'jarH'], material: 'paper',
    build: (p) => wrap(p, 'jar', p.jarH),
  },
  {
    id: 'canlabel', category: 'labels', name: 'Can label',
    desc: 'Full wrap label for beverage and food cans, with glue overlap.',
    keywords: ['label', 'can', 'tin', 'beverage', 'soda', 'sticker'],
    params: [
      P('D', 'Diameter', 66, 20, 300), P('canH', 'Container height', 122, 30, 400),
      P('labelH', 'Label height', 96, 10, 380), P('overlap', 'Glue overlap', 8, 0, 30, { adv: true }),
    ],
    dims: ['D', 'canH'], material: 'paper',
    build: (p) => wrap({ ...p, cover: 100, labelY: (p.canH - Math.min(p.labelH, p.canH - 4)) / 2 }, 'can', p.canH),
  },
];

export const byId = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export function defaults(tpl) {
  return Object.fromEntries(tpl.params.map((p) => [p.k, p.def]));
}
