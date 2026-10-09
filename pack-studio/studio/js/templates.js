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
  kraftpaper: { name: 'Kraft paper 120 gsm', t: 0.2, inside: '#b98b5d', edge: '#8f6a45' },
  artpaper: { name: 'White art paper 170 gsm', t: 0.2, inside: '#f4f2ee', edge: '#cfcac0' },
  laminate: { name: 'Laminate tube (ABL/PBL)', t: 0.3, inside: '#efefed', edge: '#d6d6d4' },
  milkfilm: { name: 'Milk film (LDPE, white)', t: 0.06, inside: '#f4f4f2', edge: '#dcdcd8' },
  duplex: { name: 'Duplex board (grey back)', t: 0.45, inside: '#cfd0cc', edge: '#b7b8b3' },
};

export const CATEGORIES = [
  { id: 'cartons',  name: 'Folding cartons' },
  { id: 'mailers',  name: 'Mailers & shipping' },
  { id: 'food',     name: 'Food & takeaway' },
  { id: 'trays',    name: 'Trays & sleeves' },
  { id: 'pouches',  name: 'Pouches' },
  { id: 'bags',     name: 'Paper bags' },
  { id: 'tubes',    name: 'Tubes' },
  { id: 'bottles',  name: 'Bottles & jars' },
  { id: 'dairy',    name: 'Dairy & milk' },
  { id: 'snacks',   name: 'Snacks' },
  { id: 'sweets',   name: 'Sweets & mithai' },
  { id: 'labels',   name: 'Labels & stickers' },
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
  const maxTop = body === 'bottle' ? H * 0.62 : body === 'sauce' ? H * 0.72 : body === 'pill' ? H * 0.74 : body === 'jar' ? H - 14 : body === 'papertube' ? H - p.lidH - 2 : H - 2;
  const labelH = Math.max(10, Math.min(p.labelH, maxTop - 2));
  const labelY = Math.max(1, Math.min(p.labelY, maxTop - labelH));
  const labelW = full ? circ : circ * (p.cover / 100);
  const overlap = full ? p.overlap : 0;
  const xc = full ? circ / 2 : labelW / 2;
  const fw = Math.min(labelW, p.D * 0.84);
  return {
    kind: 'wrap', body, r, H, labelH, labelY, labelW, circ, overlap, xc, lidH: p.lidH,
    panels: [
      { id: 'label', name: 'Label', pts: rect(0, 0, labelW, labelH) },
      ...(overlap > 0 ? [{ id: 'overlap', name: 'Glue', glue: true, pts: rect(labelW, 0, overlap, labelH), parent: 'label', hinge: [[labelW, 0], [labelW, labelH]], angle: 0 }] : []),
    ],
    front: { rect: [xc - fw / 2, 0, fw, labelH], up: [0, 1] }, // the part facing the viewer
  };
}

// Tapered scoop carton (fries): base plus four walls leaning out by the same angle,
// so the corner edges meet exactly. In a wall's own plane a corner rises h and
// steps out h*sin(lean). Front is low with a scooped top, back is tall and round.
function friesNet(p) {
  const { L, W, Hf, Hb, glue } = p, sn = Math.sin((p.lean * Math.PI) / 180), ang = 90 - p.lean;
  const scoop = Math.min(p.scoop, Hf * 0.6), up = Math.min(Hb - Hf, L * 0.5);
  const curve = (x0, x1, y, depth, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n; return [x0 + (x1 - x0) * k, y + depth * Math.sin(Math.PI * k)];
  });
  const fx = Hf * sn, bx = Hb * sn;
  const front = ccw(dedupe([[0, 0], [L, 0], [L + fx, -Hf], ...curve(L + fx, -fx, -Hf, scoop).slice(1, -1), [-fx, -Hf]]));
  const back = ccw(dedupe([[0, W], [L, W], [L + bx, W + Hb], ...curve(L + bx, -bx, W + Hb, up * 0.35).slice(1, -1), [-bx, W + Hb]]));
  const side = (x, dir) => ccw([[x, 0], [x, W], [x - dir * Hb, W + bx], [x - dir * Hf, -fx]]);
  const flap = (a, b, dir) => {
    // glue flap along a slanted wall edge a→b, on the outer side (dir = ±1)
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = (-dy / l) * dir * glue, ny = (dx / l) * dir * glue;
    const t = Math.min(0.25, glue / l);
    return ccw([a, b, [b[0] + nx - dx * t, b[1] + ny - dy * t], [a[0] + nx + dx * t, a[1] + ny + dy * t]]);
  };
  return [
    { id: 'base', name: 'Base', pts: rect(0, 0, L, W) },
    { id: 'front', name: 'Front', pts: front, parent: 'base', hinge: [[0, 0], [L, 0]], angle: ang, seq: 0 },
    { id: 'back', name: 'Back', pts: back, parent: 'base', hinge: [[0, W], [L, W]], angle: ang, seq: 0 },
    { id: 'left', name: 'Side', pts: side(0, 1), parent: 'base', hinge: [[0, 0], [0, W]], angle: ang, seq: 1 },
    { id: 'right', name: 'Side', pts: side(L, -1), parent: 'base', hinge: [[L, 0], [L, W]], angle: ang, seq: 1 },
    { id: 'gFL', name: '', glue: true, pts: flap([0, 0], [-fx, -Hf], -1), parent: 'front', hinge: [[0, 0], [-fx, -Hf]], angle: 90, layer: 1, seq: 2 },
    { id: 'gFR', name: '', glue: true, pts: flap([L, 0], [L + fx, -Hf], 1), parent: 'front', hinge: [[L, 0], [L + fx, -Hf]], angle: 90, layer: 1, seq: 2 },
    { id: 'gBL', name: '', glue: true, pts: flap([0, W], [-bx, W + Hb], 1), parent: 'back', hinge: [[0, W], [-bx, W + Hb]], angle: 90, layer: 1, seq: 2 },
    { id: 'gBR', name: '', glue: true, pts: flap([L, W], [L + bx, W + Hb], -1), parent: 'back', hinge: [[L, W], [L + bx, W + Hb]], angle: 90, layer: 1, seq: 2 },
  ];
}

// Flat die-cut sticker or label: one panel, any outline.
function stickerNet(outline) {
  return { panels: [{ id: 'label', name: 'Label', pts: ccw(outline) }], front: { panel: 'label', up: [0, 1] } };
}
const ellipse = (rx, ry, n = 96) => Array.from({ length: n }, (_, i) => [rx + rx * Math.cos((i / n) * Math.PI * 2), ry + ry * Math.sin((i / n) * Math.PI * 2)]);
function roundedRect(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  if (!r) return rect(0, 0, w, h);
  return [...arc(w - r, r, r, -Math.PI / 2, 0), ...arc(w - r, h - r, r, 0, Math.PI / 2), ...arc(r, h - r, r, Math.PI / 2, Math.PI), ...arc(r, r, r, Math.PI, Math.PI * 1.5)];
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

// Gusseted paper bag: front, gusset, back, gusset + glue, a folded bottom and
// (for shopping bags) a turned-over top band with rope handles.
function paperBag(p, shopping) {
  const { L, W, H, glue } = p, T = shopping ? p.turn : 0;
  const x = [0, L, L + W, 2 * L + W, 2 * L + 2 * W], widths = [L, W, L, W];
  const names = ['Front', 'Gusset', 'Back', 'Gusset'], panels = [], creases = [], zones = [], guides = [];
  const f1 = W / 2 + 12;
  widths.forEach((w, i) => {
    const x0 = x[i], major = i % 2 === 0;
    panels.push({ id: 'p' + i, name: names[i], pts: rect(x0, 0, w, H),
      ...(i ? { parent: 'p' + (i - 1), hinge: [[x0, 0], [x0, H]], angle: 90, seq: i } : {}) });
    const fh = major ? f1 : W / 2;
    panels.push({ id: 'b' + i, name: 'Bottom', pts: rect(x0, -fh, w, fh), parent: 'p' + i, hinge: [[x0, 0], [x0 + w, 0]],
      angle: 90, layer: i === 0 ? 0 : i === 2 ? 1 : 2, seq: i === 0 ? 7 : i === 2 ? 6 : 5 });
    if (T) panels.push({ id: 't' + i, name: 'Turn-over', pts: rect(x0, H, w, T), parent: 'p' + i, hinge: [[x0, H], [x0 + w, H]], angle: 180, layer: 1, seq: 0 });
    if (!major) {
      const c = x0 + w / 2;
      creases.push([[c, 0], [c, H]], [[x0, 0], [c, W / 2]], [[x0 + w, 0], [c, W / 2]]);
    }
  });
  panels.push({ id: 'glue', name: 'Glue', glue: true, pts: glueFlap(0, 0, H, glue), parent: 'p0', hinge: [[0, 0], [0, H]], angle: 90, layer: 1, seq: 0 });
  const extras = [];
  if (shopping) {
    const hw = Math.min(L * 0.38, 110), hh = Math.min(hw * 0.75, 90), y = H - Math.min(T * 0.6, 28);
    for (const [panel, cx] of [['p0', L / 2], ['p2', x[2] + L / 2]]) {
      extras.push({ type: 'handle', panel, cx, y, w: hw, h: hh });
      zones.push(rect(cx - hw / 2 - 6, H - T, 12, T), rect(cx + hw / 2 - 6, H - T, 12, T)); // handle patches
    }
    guides.push({ seg: [[0, H - T], [L, H - T]], label: 'Handle patch' });
  }
  return { panels, creases, zones, guides, extras, orient: 'tube', front: { panel: 'p0', up: [0, 1] } };
}

// Pillow pack (vertical form-fill-seal): one web printed as
//   fin | back (left half) | front | back (right half) | fin
// The fins seal together down the back; top and bottom are sealed across.
// Used for milk pouches and chips bags.
function pillow(p, puff) {
  const { W, H, fin, es } = p, total = 2 * fin + 2 * W;
  const fx = fin + W / 2;
  const panels = [
    { id: 'front', name: 'Front', pts: rect(fx, 0, W, H) },
    { id: 'backL', name: 'Back', pts: rect(fin, 0, W / 2, H), parent: 'front', hinge: [[fx, 0], [fx, H]], angle: 180 },
    { id: 'backR', name: 'Back', pts: rect(fx + W, 0, W / 2, H), parent: 'front', hinge: [[fx + W, 0], [fx + W, H]], angle: 180 },
    { id: 'finL', name: '', pts: rect(0, 0, fin, H), parent: 'backL', hinge: [[fin, 0], [fin, H]], angle: 90 },
    { id: 'finR', name: '', pts: rect(total - fin, 0, fin, H), parent: 'backR', hinge: [[total - fin, 0], [total - fin, H]], angle: 90 },
  ];
  const zones = [rect(0, 0, total, es), rect(0, H - es, total, es), rect(0, es, fin, H - 2 * es), rect(total - fin, es, fin, H - 2 * es)];
  const notchY = H - es - Math.min(12, H * 0.05);
  const guides = [
    { seg: [[fx - 4, notchY], [fx, notchY]], label: 'Tear notch' },
    { seg: [[fin + 4, H - es - 18], [fin + 4 + Math.min(14, W / 4), H - es - 18]], label: 'Eye mark' },
  ];
  return { kind: 'pillow', W, H, fin, es, puff, panels, zones, guides, front: { rect: [fx, es, W, H - 2 * es], up: [0, 1] } };
}

// Tapered cup sleeve: a conical label unrolls into a ring sector. Built from thin
// convex strips so the usual bleed and texture machinery applies.
function cupSleeve(p) {
  const R1 = p.D1 / 2, R2 = Math.min(p.D2 / 2, R1 - 2), H = p.Hc;
  const s = Math.hypot(H, R1 - R2);                 // slant height of the wall
  const Ro = (R1 * s) / (R1 - R2);                  // apex to rim, along the slant
  const Ri = Ro - s;                                // apex to base
  const k = s / H;                                  // vertical mm -> slant mm
  const rOut = Ro - p.gapTop * k, rIn = Ri + p.gapBottom * k;
  const theta = (2 * Math.PI * R1) / Ro;            // opening angle of the unrolled wall
  const olap = p.overlap / rOut;
  const N = 28, P = (r, a) => [r * Math.sin(a), r * Math.cos(a)];
  const panels = [];
  for (let i = 0; i < N; i++) {
    const a0 = -theta / 2 + (theta * i) / N, a1 = -theta / 2 + (theta * (i + 1)) / N;
    panels.push({ id: 's' + i, name: i === N >> 1 ? 'Sleeve' : '', pts: ccw([P(rIn, a0), P(rIn, a1), P(rOut, a1), P(rOut, a0)]),
      ...(i ? { parent: 's' + (i - 1), hinge: [P(rIn, a0), P(rOut, a0)], angle: 0 } : {}) });
  }
  if (olap > 0) {
    const a0 = theta / 2, a1 = theta / 2 + olap;
    panels.push({ id: 'glue', name: '', glue: true, pts: ccw([P(rIn, a0), P(rIn, a1), P(rOut, a1), P(rOut, a0)]), parent: 's' + (N - 1), hinge: [P(rIn, a0), P(rOut, a0)], angle: 0 });
  }
  const fw = Math.min(R1 * 1.25, rIn * Math.sin(theta / 2) * 2), fh = (rOut - rIn) * 0.8;
  return {
    kind: 'cup', R1, R2, H, s, Ro, rIn, rOut, theta, olap, panels,
    front: { rect: [-fw / 2, (rIn + rOut) / 2 - fh / 2, fw, fh], up: [0, 1] },
  };
}

// Open tray net with glued corners; ox shifts it sideways (for two-piece boxes).
function trayNet(L, W, H, c, prefix = '', ox = 0, rootExtra = {}) {
  const id = (x) => prefix + x, m = Math.min(1.5, H * 0.05);
  const panels = [
    { id: id('base'), name: prefix ? 'Lid top' : 'Base', pts: rect(ox, 0, L, W), ...rootExtra },
    { id: id('front'), name: 'Front', pts: rect(ox, -H, L, H), parent: id('base'), hinge: [[ox, 0], [ox + L, 0]], angle: 90, seq: 0 },
    { id: id('back'), name: 'Back', pts: rect(ox, W, L, H), parent: id('base'), hinge: [[ox, W], [ox + L, W]], angle: 90, seq: 0 },
    { id: id('left'), name: 'Side', pts: rect(ox - H, 0, H, W), parent: id('base'), hinge: [[ox, 0], [ox, W]], angle: 90, seq: 1 },
    { id: id('right'), name: 'Side', pts: rect(ox + L, 0, H, W), parent: id('base'), hinge: [[ox + L, 0], [ox + L, W]], angle: 90, seq: 1 },
  ];
  for (const [wall, y0, y1] of [['front', -H, 0], ['back', W, W + H]]) {
    for (const [x, dir] of [[ox, -1], [ox + L, 1]]) {
      const a = y0 + m, b = y1 - m, taper = Math.min(c * 0.5, (b - a) * 0.3);
      const far = wall === 'front' ? [b - taper * 0.3, a + taper] : [b - taper, a + taper * 0.3];
      panels.push({ id: id(wall + (dir < 0 ? 'L' : 'R')), name: 'Glue', glue: true,
        pts: ccw([[x, a], [x, b], [x + c * dir, far[0]], [x + c * dir, far[1]]]),
        parent: id(wall), hinge: [[x, a], [x, b]], angle: 90, layer: 1, seq: 2 });
    }
  }
  return panels;
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
    params: TUCK_PARAMS, dims: ['L', 'W', 'H'], material: 'kraft',
    build: (p) => tuckEnd(p, true),
  },
  {
    id: 'ste', category: 'cartons', name: 'Straight tuck end box',
    desc: 'Both tucks on the back panel, so the front artwork stays unbroken.',
    keywords: ['straight', 'ste'],
    params: TUCK_PARAMS, dims: ['L', 'W', 'H'], material: 'kraft',
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
    id: 'shopbag', category: 'bags', name: 'Shopping bag with handles',
    desc: 'Gusseted paper carry bag with turn-over top and twisted rope handles.',
    keywords: ['bag', 'shopping bag', 'carry bag', 'paper bag', 'gift bag', 'tote', 'handle', 'boutique', 'retail bag'],
    params: [
      P('L', 'Width', 260, 120, 600), P('W', 'Gusset', 120, 50, 250), P('H', 'Height', 330, 150, 600),
      P('turn', 'Turn-over top', 40, 20, 80, { adv: true }), P('glue', 'Glue flap', 20, 12, 40, { adv: true }),
    ],
    dims: ['L', 'W', 'H'], material: 'kraftpaper',
    build: (p) => paperBag(p, true),
  },
  {
    id: 'sosbag', category: 'bags', name: 'SOS food bag',
    desc: 'Flat-bottom paper bag for bakeries, takeaway and groceries. No handles.',
    keywords: ['sos', 'food bag', 'bakery bag', 'flat bottom bag', 'takeaway', 'grocery bag', 'lunch bag', 'bread bag'],
    params: [
      P('L', 'Width', 150, 80, 400), P('W', 'Gusset', 90, 40, 200), P('H', 'Height', 280, 120, 500),
      P('glue', 'Glue flap', 18, 12, 40, { adv: true }),
    ],
    dims: ['L', 'W', 'H'], material: 'kraftpaper',
    build: (p) => paperBag(p, false),
  },
  {
    id: 'squeeze', category: 'tubes', name: 'Squeeze tube',
    desc: 'Cosmetic or pharma tube with crimp seal and flip-top cap. Creams, gels, toothpaste.',
    keywords: ['tube', 'squeeze', 'cream', 'toothpaste', 'lotion', 'cosmetic tube', 'gel', 'ointment', 'face wash', 'sunscreen'],
    params: [
      P('D', 'Diameter', 35, 13, 60), P('L', 'Tube length', 140, 50, 250),
      P('crimp', 'Crimp seal', 8, 4, 15, { adv: true }),
    ],
    dims: ['D', 'L'], material: 'laminate',
    build: (p) => {
      const r = p.D / 2, C = Math.PI * p.D, { L, crimp } = p;
      return {
        kind: 'tube', r, L, C, crimp,
        panels: [{ id: 'sleeve', name: 'Tube print', pts: rect(0, 0, C, L) }],
        zones: [rect(0, L - crimp, C, crimp)],
        guides: [{ seg: [[C - 12, L - crimp - 6], [C - 4, L - crimp - 6]], label: '' }, { seg: [[0, L - crimp], [C, L - crimp]], label: 'Crimp line' }],
        front: { rect: [C / 2 - p.D * 0.42, 6, p.D * 0.84, L - crimp - 12], up: [0, 1] },
      };
    },
  },
  {
    id: 'papertube', category: 'tubes', name: 'Paper tube',
    desc: 'Kraft cylinder box with lid for tea, candles, apparel and gifts.',
    keywords: ['paper tube', 'cylinder box', 'poster tube', 'kraft tube', 'canister', 'round box', 'cylinder'],
    params: [
      P('D', 'Diameter', 75, 30, 200), P('H', 'Height', 150, 50, 500),
      P('lidH', 'Lid height', 30, 10, 80, { adv: true }), P('overlap', 'Glue overlap', 10, 0, 30, { adv: true }),
    ],
    dims: ['D', 'H'], material: 'kraft',
    build: (p) => wrap({ ...p, cover: 100, labelY: 3, labelH: p.H }, 'papertube', p.H),
  },
  {
    id: 'milkpouch', category: 'dairy', name: 'Milk pouch',
    desc: 'Centre-sealed pillow pouch for milk, buttermilk and curd. 200 ml to 1 litre.',
    keywords: ['milk pouch', 'milk', 'doodh', 'milk packet', 'buttermilk', 'chaas', 'lassi pouch', 'pillow pack', 'liquid pouch'],
    params: [
      P('W', 'Lay-flat width', 150, 70, 300), P('H', 'Length', 220, 100, 400),
      P('fin', 'Fin (back) seal', 10, 6, 20, { adv: true }), P('es', 'End seals', 12, 6, 25, { adv: true }),
    ],
    presets: [
      { label: '200 ml', q: { ml: 200 }, v: { W: 110, H: 170 } },
      { label: '500 ml', q: { ml: 500 }, v: { W: 150, H: 220 } },
      { label: '1 litre', q: { ml: 1000 }, v: { W: 180, H: 300 } },
    ],
    dims: ['W', 'H'], material: 'milkfilm',
    build: (p) => pillow(p, 0.3),
  },
  {
    id: 'curdcup', category: 'dairy', name: 'Curd & ice-cream cup',
    desc: 'Tapered cup with a printed wrap sleeve and foil lid. Dahi, yogurt, ice cream, raita.',
    keywords: ['curd', 'dahi', 'yogurt', 'yoghurt', 'ice cream', 'ice-cream', 'cup', 'tub', 'shrikhand', 'raita', 'paper cup'],
    params: [
      P('D1', 'Top diameter', 95, 40, 200), P('D2', 'Bottom diameter', 75, 30, 190), P('Hc', 'Cup height', 70, 25, 200),
      P('gapTop', 'Gap below rim', 6, 0, 30, { adv: true }), P('gapBottom', 'Gap above base', 4, 0, 30, { adv: true }),
      P('overlap', 'Glue overlap', 8, 0, 20, { adv: true }),
    ],
    presets: [
      { label: '100 g', q: { g: 100 }, v: { D1: 70, D2: 55, Hc: 50 } },
      { label: '200 g', q: { g: 200 }, v: { D1: 85, D2: 65, Hc: 60 } },
      { label: '400 g', q: { g: 400 }, v: { D1: 95, D2: 75, Hc: 80 } },
      { label: '1 kg tub', q: { g: 1000 }, v: { D1: 130, D2: 105, Hc: 110 } },
    ],
    dims: ['D1', 'D2', 'Hc'], material: 'paper',
    build: (p) => cupSleeve(p),
  },
  {
    id: 'dairycarton', category: 'dairy', hidden: true, name: 'Butter & paneer carton',
    desc: 'Low straight-tuck carton for butter, paneer, cheese and ghee blocks.',
    keywords: ['butter', 'paneer', 'cheese', 'ghee', 'butter box', 'paneer box', 'cheese box', 'dairy box'],
    params: [
      P('L', 'Length', 110, 30, 300), P('W', 'Width', 60, 20, 200), P('H', 'Height', 40, 15, 200),
      P('tuck', 'Tuck flap', 14, 5, 60, { adv: true }), P('dust', 'Dust flap', 30, 5, 150, { adv: true }),
      P('glue', 'Glue flap', 12, 6, 40, { adv: true }),
    ],
    presets: [
      { label: '100 g', q: { g: 100 }, v: { L: 75, W: 45, H: 35 } },
      { label: '200 g', q: { g: 200 }, v: { L: 110, W: 60, H: 40 } },
      { label: '500 g', q: { g: 500 }, v: { L: 140, W: 75, H: 55 } },
    ],
    dims: ['L', 'W', 'H'], material: 'sbs',
    build: (p) => tuckEnd(p, false),
  },
  {
    id: 'chips', category: 'snacks', name: 'Chips & snack bag',
    desc: 'Nitrogen-filled pillow bag with crimp seals. Chips, namkeen, puffs and wafers.',
    keywords: ['chips', 'crisps', 'snack bag', 'snacks', 'namkeen', 'wafers', 'puffs', 'bhujia', 'nitrogen', 'pillow bag', 'snack'],
    params: [
      P('W', 'Lay-flat width', 160, 70, 320), P('H', 'Length', 230, 100, 450),
      P('fin', 'Fin (back) seal', 10, 6, 20, { adv: true }), P('es', 'Crimp seals', 15, 8, 30, { adv: true }),
    ],
    presets: [
      { label: 'Small ~20 g', q: { g: 20 }, v: { W: 120, H: 170 } },
      { label: 'Medium ~50 g', q: { g: 50 }, v: { W: 160, H: 230 } },
      { label: 'Large ~100 g', q: { g: 100 }, v: { W: 210, H: 300 } },
      { label: 'Party ~200 g', q: { g: 200 }, v: { W: 250, H: 360 } },
    ],
    dims: ['W', 'H'], material: 'film',
    build: (p) => pillow(p, 0.22),
  },
  {
    id: 'canister', category: 'snacks', name: 'Chips canister',
    desc: 'Tall stackable-chips can with full-wrap label and clear overcap.',
    keywords: ['chips canister', 'chips can', 'chips tube', 'stackable chips', 'snack canister', 'snack can'],
    params: [
      P('D', 'Diameter', 75, 40, 140), P('H', 'Height', 235, 80, 350),
      P('lidH', 'Overcap height', 18, 8, 40, { adv: true }), P('overlap', 'Glue overlap', 10, 0, 30, { adv: true }),
    ],
    presets: [
      { label: 'Mini', q: { g: 40 }, v: { D: 70, H: 110 } },
      { label: 'Regular', q: { g: 110 }, v: { D: 75, H: 235 } },
      { label: 'Large', q: { g: 160 }, v: { D: 80, H: 270 } },
    ],
    dims: ['D', 'H'], material: 'paper',
    build: (p) => wrap({ ...p, cover: 100, labelY: 3, labelH: p.H }, 'canister', p.H),
  },
  {
    id: 'sweetbox', category: 'sweets', name: 'Sweet box (hinged lid)',
    desc: 'Classic mithai box: glued tray with a hinged lid that tucks shut.',
    keywords: ['sweet box', 'mithai', 'mithai box', 'sweets', 'barfi', 'laddu', 'ladoo', 'kaju katli', 'peda', 'sweet', 'halwai'],
    params: [
      P('L', 'Length', 190, 80, 400), P('W', 'Width', 140, 60, 300), P('H', 'Height', 45, 20, 120),
      P('corner', 'Corner flap', 22, 8, 60, { adv: true }),
    ],
    presets: [
      { label: '250 g', q: { g: 250 }, v: { L: 150, W: 110, H: 40 } },
      { label: '500 g', q: { g: 500 }, v: { L: 190, W: 140, H: 45 } },
      { label: '1 kg', q: { g: 1000 }, v: { L: 240, W: 180, H: 50 } },
    ],
    dims: ['L', 'W', 'H'], material: 'duplex',
    build: (p) => {
      const { L, W, H } = p, t = p.t, c = Math.min(p.corner, W * 0.45, H * 0.9);
      const panels = trayNet(L, W, H, c);
      const ly = W + H, lw = W + t, flap = Math.max(10, H * 0.55), ear = Math.max(8, H - 2 * t - 2);
      panels.push(
        { id: 'lid', name: 'Lid', pts: rect(0, ly, L, lw), parent: 'back', hinge: [[0, ly], [L, ly]], angle: 90, seq: 5 },
        { id: 'lidFlap', name: 'Lid tuck', pts: tuckFlap(t, L - t, ly + lw, flap, 1), parent: 'lid', hinge: [[t, ly + lw], [L - t, ly + lw]], angle: 90, layer: 2, seq: 6 },
        { id: 'earL', name: 'Ear', pts: ccw([[0, ly + 3], [0, ly + lw - 3], [-ear, ly + lw - ear * 0.6], [-ear, ly + ear * 0.3]]), parent: 'lid', hinge: [[0, ly + 3], [0, ly + lw - 3]], angle: 90, layer: 2, seq: 6 },
        { id: 'earR', name: 'Ear', pts: ccw([[L, ly + 3], [L, ly + lw - 3], [L + ear, ly + lw - ear * 0.6], [L + ear, ly + ear * 0.3]]), parent: 'lid', hinge: [[L, ly + 3], [L, ly + lw - 3]], angle: 90, layer: 2, seq: 6 },
      );
      return { panels, orient: 'tray', front: { panel: 'lid', up: [0, -1] } };
    },
  },
  {
    id: 'sweet2pc', category: 'sweets', name: 'Two-piece sweet box',
    desc: 'Premium lid-and-base box. The lid slides over the base; ideal for gifting and festivals.',
    keywords: ['two piece', '2 piece', 'two-piece', 'lid and base', 'telescope', 'premium sweet', 'gift sweet', 'diwali box', 'festive box', 'dry fruit box'],
    params: [
      P('L', 'Length', 200, 80, 400), P('W', 'Width', 150, 60, 300), P('H', 'Base height', 50, 20, 120),
      P('lidH', 'Lid depth', 30, 10, 120, { adv: true }), P('corner', 'Corner flap', 22, 8, 60, { adv: true }),
    ],
    presets: [
      { label: '250 g', q: { g: 250 }, v: { L: 150, W: 110, H: 40, lidH: 25 } },
      { label: '500 g', q: { g: 500 }, v: { L: 200, W: 150, H: 50, lidH: 30 } },
      { label: '1 kg', q: { g: 1000 }, v: { L: 250, W: 190, H: 55, lidH: 35 } },
    ],
    dims: ['L', 'W', 'H'], material: 'duplex',
    build: (p) => {
      const { L, W, H } = p, t = p.t, gap = 1 + 2 * t;              // lid clears the base walls
      const Ll = L + 2 * gap, Wl = W + 2 * gap, Hl = Math.min(p.lidH, H);
      const c = Math.min(p.corner, W * 0.45, Hl * 0.9);
      const ox = L + H + 24 + Math.max(Hl, c);
      // the lid net sits beside the base on the sheet; when folded it flips over onto the base
      const place = { from: [ox + Ll / 2, Wl / 2], to: [L / 2, W / 2, -(H + 0.8)] };
      const panels = [...trayNet(L, W, H, Math.min(p.corner, W * 0.45, H * 0.9)), ...trayNet(Ll, Wl, Hl, c, 'lid_', ox, { place })];
      return { panels, orient: 'tray', front: { panel: 'lid_base', up: [0, -1] } };
    },
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
    id: 'fries', category: 'food', name: 'Fries box (scoop)',
    desc: 'Tapered fry carton with a scooped front and tall rounded back. Also popcorn, churros and wedges.',
    keywords: ['fries', 'french fries', 'fry box', 'chips box', 'scoop', 'popcorn', 'churros', 'wedges', 'fast food', 'qsr', 'takeaway'],
    params: [
      P('L', 'Base width', 70, 40, 160), P('W', 'Base depth', 35, 20, 100), P('Hf', 'Front height', 85, 40, 200), P('Hb', 'Back height', 115, 50, 260),
      P('lean', 'Wall lean', 9, 0, 20, { unit: '°', adv: true }), P('scoop', 'Front scoop', 18, 0, 60, { adv: true }), P('glue', 'Glue flap', 12, 8, 25, { adv: true }),
    ],
    presets: [
      { label: 'Small', v: { L: 60, W: 30, Hf: 75, Hb: 100 } },
      { label: 'Medium', v: { L: 70, W: 35, Hf: 85, Hb: 115 } },
      { label: 'Large', v: { L: 82, W: 40, Hf: 95, Hb: 130 } },
    ],
    dims: ['L', 'W', 'Hb'], material: 'sbs',
    build: (p) => ({ panels: friesNet({ ...p, Hb: Math.max(p.Hb, p.Hf + 5) }), orient: 'tray', front: { panel: 'front', up: [0, -1] } }),
  },
  {
    id: 'saucebottle', category: 'bottles', name: 'Sauce bottle label',
    desc: 'Label on a squeeze bottle with a flip-top cap: ketchup, sauces, dressings, honey, syrups.',
    keywords: ['sauce', 'sauce bottle', 'ketchup', 'squeeze bottle', 'mayonnaise', 'mayo', 'mustard', 'chilli sauce', 'hot sauce', 'dressing', 'syrup', 'honey squeeze'],
    params: [
      P('D', 'Bottle diameter', 60, 35, 110), P('bottleH', 'Bottle height', 190, 100, 320),
      P('labelH', 'Label height', 70, 20, 180), P('cover', 'Wrap coverage', 55, 20, 100, { unit: '%' }),
      P('labelY', 'Label from base', 30, 0, 120, { adv: true }), P('overlap', 'Glue overlap', 8, 0, 30, { adv: true }),
    ],
    presets: [
      { label: '200 g', q: { g: 200 }, v: { D: 50, bottleH: 160, labelH: 60, labelY: 26 } },
      { label: '500 g', q: { g: 500 }, v: { D: 62, bottleH: 200, labelH: 75, labelY: 32 } },
      { label: '1 kg', q: { g: 1000 }, v: { D: 78, bottleH: 250, labelH: 95, labelY: 40 } },
    ],
    dims: ['D', 'bottleH'], material: 'paper',
    build: (p) => wrap(p, 'sauce', p.bottleH),
  },
  {
    id: 'pillbottle', category: 'bottles', name: 'Pill bottle label',
    desc: 'Wrap label for supplement, vitamin, protein and medicine bottles with a wide cap.',
    keywords: ['pill bottle', 'supplement', 'vitamin', 'capsule', 'tablet bottle', 'medicine bottle', 'pharma', 'nutraceutical', 'protein', 'gummies', 'hdpe bottle'],
    params: [
      P('D', 'Bottle diameter', 60, 30, 160), P('bottleH', 'Bottle height', 110, 50, 260),
      P('labelH', 'Label height', 60, 20, 200), P('cover', 'Wrap coverage', 90, 20, 100, { unit: '%' }),
      P('labelY', 'Label from base', 10, 0, 100, { adv: true }), P('overlap', 'Glue overlap', 8, 0, 30, { adv: true }),
    ],
    presets: [
      { label: '60 cc', v: { D: 45, bottleH: 85, labelH: 42, labelY: 8 } },
      { label: '150 cc', v: { D: 60, bottleH: 110, labelH: 60, labelY: 10 } },
      { label: '500 cc', v: { D: 85, bottleH: 150, labelH: 85, labelY: 14 } },
      { label: '1 kg tub', q: { g: 1000 }, v: { D: 125, bottleH: 190, labelH: 120, labelY: 18 } },
    ],
    dims: ['D', 'bottleH'], material: 'paper',
    build: (p) => wrap(p, 'pill', p.bottleH),
  },
  {
    id: 'roundsticker', category: 'labels', name: 'Round sticker',
    desc: 'Circular die-cut sticker or label: lids, seals, logos, jar tops, thank-you stickers.',
    keywords: ['round sticker', 'circle sticker', 'circular label', 'round label', 'lid sticker', 'seal sticker', 'logo sticker', 'die cut', 'die-cut', 'sticker'],
    params: [P('D', 'Diameter', 50, 10, 300)],
    presets: [{ label: '25 mm', v: { D: 25 } }, { label: '50 mm', v: { D: 50 } }, { label: '75 mm', v: { D: 75 } }, { label: '100 mm', v: { D: 100 } }],
    dims: ['D'], material: 'paper',
    build: (p) => stickerNet(ellipse(p.D / 2, p.D / 2)),
  },
  {
    id: 'ovalsticker', category: 'labels', name: 'Oval label',
    desc: 'Oval die-cut label for bottles, jars, soaps and candles.',
    keywords: ['oval label', 'oval sticker', 'ellipse label', 'soap label', 'candle label'],
    params: [P('W', 'Width', 80, 15, 300), P('H', 'Height', 55, 10, 300)],
    dims: ['W', 'H'], material: 'paper',
    build: (p) => stickerNet(ellipse(p.W / 2, p.H / 2)),
  },
  {
    id: 'rectsticker', category: 'labels', name: 'Rectangle label',
    desc: 'Square or rectangular label with optional rounded corners: product, shipping, barcode and MRP stickers.',
    keywords: ['rectangle label', 'square sticker', 'product label', 'shipping label', 'mrp sticker', 'barcode sticker', 'price label', 'rounded corner label'],
    params: [P('W', 'Width', 90, 10, 400), P('H', 'Height', 60, 10, 400), P('r', 'Corner radius', 4, 0, 50)],
    presets: [{ label: '50 × 25', v: { W: 50, H: 25, r: 2 } }, { label: '100 × 50', v: { W: 100, H: 50, r: 3 } }, { label: '100 × 150', v: { W: 100, H: 150, r: 3 } }],
    dims: ['W', 'H'], material: 'paper',
    build: (p) => stickerNet(roundedRect(p.W, p.H, p.r)),
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
