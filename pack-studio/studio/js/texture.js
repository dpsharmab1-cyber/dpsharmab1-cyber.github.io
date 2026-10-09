// Procedural board textures: paper fibres, speckles and soft blotches, drawn once
// into a seamless tile with a fixed seed (so redraws never shimmer).
//   fibreOverlay() -> transparent tile laid over a print colour ("Kraft" finish)
//   boardMap()     -> light grey tile for the 3D board surface and its bump

export const TILE_MM = 50; // one tile covers 50 x 50 mm of board
const SIZE = 512;
let overlay = null, board = null;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// draws f(x, y) at every wrapped copy that touches the tile, so edges meet seamlessly
function wrapped(x, y, reach, f) {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
    const X = x + dx, Y = y + dy;
    if (X > -reach && X < SIZE + reach && Y > -reach && Y < SIZE + reach) f(X, Y);
  }
}

function paintFibres(g, { dark, light, strength = 1 }) {
  const r = rng(20261008);
  // soft blotches: uneven pulp density
  for (let i = 0; i < 26; i++) {
    const x = r() * SIZE, y = r() * SIZE, rad = 40 + r() * 90, a = (0.012 + r() * 0.02) * strength, col = r() < 0.5 ? dark : light;
    wrapped(x, y, rad, (X, Y) => {
      const grd = g.createRadialGradient(X, Y, 0, X, Y, rad);
      grd.addColorStop(0, `rgba(${col},${a})`);
      grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd;
      g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
    });
  }
  // fibres: short, slightly curved strokes, mostly along one direction (machine grain)
  g.lineCap = 'round';
  for (let i = 0; i < 4600; i++) {
    const x = r() * SIZE, y = r() * SIZE, len = 3 + r() * 16, ang = (r() - 0.5) * 1.6 + (r() < 0.25 ? Math.PI / 2 : 0);
    const bend = (r() - 0.5) * len * 0.6, col = r() < 0.62 ? dark : light, a = (0.07 + r() * 0.17) * strength;
    const w = 0.5 + r() * 1.1, dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    g.strokeStyle = `rgba(${col},${a})`;
    g.lineWidth = w;
    wrapped(x, y, len, (X, Y) => {
      g.beginPath();
      g.moveTo(X - dx, Y - dy);
      g.quadraticCurveTo(X - Math.sin(ang) * bend, Y + Math.cos(ang) * bend, X + dx, Y + dy);
      g.stroke();
    });
  }
  // speckles: recycled-fibre flecks
  for (let i = 0; i < 1100; i++) {
    const x = r() * SIZE, y = r() * SIZE, rad = 0.4 + r() * 1.3, a = (0.12 + r() * 0.3) * strength;
    g.fillStyle = `rgba(${r() < 0.8 ? dark : light},${a})`;
    wrapped(x, y, 3, (X, Y) => { g.beginPath(); g.arc(X, Y, rad, 0, Math.PI * 2); g.fill(); });
  }
}

export function fibreOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('canvas');
  overlay.width = overlay.height = SIZE;
  paintFibres(overlay.getContext('2d'), { dark: '74,48,22', light: '255,243,220' });
  return overlay;
}

export function boardMap() {
  if (board) return board;
  board = document.createElement('canvas');
  board.width = board.height = SIZE;
  const g = board.getContext('2d');
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, SIZE, SIZE);
  paintFibres(g, { dark: '60,60,60', light: '255,255,255', strength: 1.3 });
  return board;
}

// Fill a canvas area with the Kraft finish: base colour plus fibres at real scale.
export function fillKraft(g, w, h, s, base) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const pat = g.createPattern(fibreOverlay(), 'repeat');
  pat.setTransform(new DOMMatrix().scale((s * TILE_MM) / SIZE));
  g.fillStyle = pat;
  g.fillRect(0, 0, w, h);
}
