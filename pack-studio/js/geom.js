// Pure 2D helpers. All units are millimetres, y points up.

export const EPS = 1e-6;

export function rect(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function ccw(pts) {
  return area(pts) < 0 ? pts.slice().reverse() : pts;
}

export function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

export function bounds(polys, pad = 0) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of polys) for (const [x, y] of pts) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad,
    w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

// Quarter-circle-ish arc points from a to b bulging around a centre, for rounded tuck corners.
export function arc(cx, cy, r, a0, a1, steps = 6) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Regular polygon standing on edge (x0,y0)-(x0+s,y0); dir=+1 builds above, -1 below.
export function ngonOnEdge(x0, y0, s, n, dir = 1) {
  const pts = [[x0, y0]];
  let x = x0, y = y0, a = 0;
  for (let i = 0; i < n - 1; i++) {
    x += s * Math.cos(a); y += s * Math.sin(a) * dir;
    pts.push([x, y]);
    a += (2 * Math.PI) / n;
  }
  return pts;
}

// Outward miter offset of a convex CCW polygon.
export function offset(pts, d) {
  const n = pts.length, lines = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (y2 - y1) / len, ny = -(x2 - x1) / len; // right-hand normal = outward for CCW
    lines.push([x1 + nx * d, y1 + ny * d, x2 + nx * d, y2 + ny * d]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i];
    const p = intersect(a, b);
    const v = pts[i];
    if (!p || Math.hypot(p[0] - v[0], p[1] - v[1]) > d * 3) out.push([b[0], b[1]]);
    else out.push(p);
  }
  return out;
}

function intersect([x1, y1, x2, y2], [x3, y3, x4, y4]) {
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < EPS) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

// Remove every collinear overlap of `cuts` from segment s; returns the leftover pieces.
export function subtractSegments(s, cuts) {
  const [[ax, ay], [bx, by]] = s;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  if (L < EPS) return [];
  const ux = dx / L, uy = dy / L, tol = 0.01;
  let keep = [[0, L]];
  for (const [[cx, cy], [ex, ey]] of cuts) {
    // both endpoints must lie on the line through s
    const d1 = Math.abs((cx - ax) * uy - (cy - ay) * ux);
    const d2 = Math.abs((ex - ax) * uy - (ey - ay) * ux);
    if (d1 > tol || d2 > tol) continue;
    let t0 = (cx - ax) * ux + (cy - ay) * uy, t1 = (ex - ax) * ux + (ey - ay) * uy;
    if (t0 > t1) [t0, t1] = [t1, t0];
    const next = [];
    for (const [k0, k1] of keep) {
      if (t1 <= k0 + tol || t0 >= k1 - tol) { next.push([k0, k1]); continue; }
      if (t0 > k0 + tol) next.push([k0, t0]);
      if (t1 < k1 - tol) next.push([t1, k1]);
    }
    keep = next;
  }
  return keep.filter(([a, b]) => b - a > tol)
    .map(([a, b]) => [[ax + ux * a, ay + uy * a], [ax + ux * b, ay + uy * b]]);
}

export function edges(pts) {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
}

// Drop duplicate segments (shared edges between panels that are not hinges).
export function dedupeSegments(segs) {
  const seen = new Set(), out = [];
  const k = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
  for (const s of segs) {
    const a = k(s[0]), b = k(s[1]);
    const key = a < b ? a + '|' + b : b + '|' + a;
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  return out;
}
