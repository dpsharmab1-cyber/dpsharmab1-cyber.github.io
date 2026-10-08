// Compiles a template + user values into one model that every output reads from:
// the 2D dieline, the folding 3D view, the artwork canvas and the exporters.

import { ccw, edges, subtractSegments, dedupeSegments, offset, bounds, centroid, area } from './geom.js';

export const BLEED = 3; // mm

export function compile(tpl, values, material) {
  const p = { ...values, t: material.t };
  const spec = tpl.build(p);
  const panels = spec.panels.map((q) => ({ layer: 0, seq: 0, angle: 0, ...q, pts: ccw(q.pts) }));
  const byId = Object.fromEntries(panels.map((q) => [q.id, q]));

  for (const q of panels) {
    if (q.parent && !byId[q.parent]) throw new Error(`${tpl.id}: panel ${q.id} has unknown parent ${q.parent}`);
    if (q.hinge) q.fold = foldAxis(q);
  }

  const hinges = panels.filter((q) => q.hinge).map((q) => q.hinge);
  const cut = dedupeSegments(panels.flatMap((q) => edges(q.pts).flatMap((e) => subtractSegments(e, hinges))));
  const crease = [...panels.filter((q) => q.hinge && q.angle !== 0).map((q) => q.hinge), ...(spec.creases || [])];
  const bleed = panels.map((q) => offset(q.pts, BLEED));
  const net = bounds(panels.map((q) => q.pts));
  const art = bounds(bleed);

  let frontRect;
  if (spec.front.rect) {
    const [x, y, w, h] = spec.front.rect;
    frontRect = { x, y, w, h, up: spec.front.up };
  } else {
    const b = bounds([byId[spec.front.panel].pts]);
    frontRect = { x: b.minX, y: b.minY, w: b.w, h: b.h, up: spec.front.up };
  }

  return {
    tpl, values: p, material, spec, panels, byId, cut, crease, bleed, net, art, frontRect,
    zones: (spec.zones || []).map(ccw), guides: spec.guides || [],
    kind: spec.kind || 'net',
    orient: spec.orient || 'tube',
    maxSeq: Math.max(0, ...panels.map((q) => q.seq)),
    boardArea: panels.reduce((s, q) => s + Math.abs(area(q.pts)), 0) / 1e6, // m²
  };
}

// Rotation axis along the hinge, signed so a positive angle folds the panel away
// from the printed (+z) side. That keeps the print on the outside of the pack.
function foldAxis(q) {
  const [[ax, ay], [bx, by]] = q.hinge;
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L, uy = (by - ay) / L;
  const [cx, cy] = centroid(q.pts);
  const vx = cx - ax, vy = cy - ay, d = vx * ux + vy * uy;
  const wx = vx - d * ux, wy = vy - d * uy;
  const cross = ux * wy - uy * wx;
  return { a: [ax, ay], u: [ux, uy], sign: cross > 0 ? -1 : 1 };
}

// Staggered fold progress so panels fold in a believable order.
export function panelProgress(q, t, maxSeq) {
  const dur = Math.min(1, 2.4 / (maxSeq + 1));
  const step = maxSeq > 0 ? (1 - dur) / maxSeq : 0;
  const x = Math.min(1, Math.max(0, (t - q.seq * step) / dur));
  return x * x * (3 - 2 * x);
}

const SHEETS = [
  ['A4', 210, 297], ['A3', 297, 420], ['SRA3', 320, 450], ['A2', 420, 594],
  ['B2', 500, 707], ['A1', 594, 841], ['B1', 707, 1000], ['Corrugated 1200 × 1600', 1200, 1600],
];

export function sheetFit(model) {
  const w = model.art.w, h = model.art.h;
  const fit = SHEETS.find(([, a, b]) => (w <= a && h <= b) || (w <= b && h <= a));
  return fit ? fit[0] : 'Oversize';
}

export function panelLabels(model) {
  return model.panels
    .filter((q) => q.name && Math.min(bounds([q.pts]).w, bounds([q.pts]).h) > 12)
    .map((q) => ({ text: q.name, at: centroid(q.pts), size: Math.min(6, Math.max(2.4, Math.min(bounds([q.pts]).w, bounds([q.pts]).h) / 7)) }));
}
