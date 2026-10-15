// The starfield behind every dark section, at one steady pace for the whole
// site. Three depths slide with the scroll at different speeds (parallax), and
// every star drifts very slowly toward the black hole, wherever it now sits
// (above the screen once the landing has scrolled away). Stars that reach it
// fade out and are born again elsewhere, so the flow never stops or jumps.
// The first screen is seeded with the stars from the Figma landing frame.
export class Stars {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.alpha = 0;
    this.scroll = null;
    this.s = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  // figma: [[x, y, size, opacity]] in landing-board px; map(x, y) -> screen
  seed(figma, map) {
    for (const [x, y, d, o] of figma) {
      const p = map(x, y);
      this.s.push(this.make(p.x, p.y, Math.max(0.5, d * 0.55), o));
    }
  }
  make(x, y, r, b) {
    return { x, y, r: r ?? Math.random() * 0.9 + 0.35, b: b ?? 0.25 + Math.random() * 0.75,
      z: [0.15, 0.35, 0.7][(Math.random() * 3) | 0], p: Math.random() * 6.283, sp: 0.4 + Math.random() * 1.4, age: 9 };
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((this.w * this.h) / 4600);
    while (this.s.length < n) this.s.push(this.make(Math.random() * this.w, Math.random() * this.h));
  }
  reborn(s, sx, sy) {
    // somewhere away from the sink, faded in from nothing
    let x, y, k = 0;
    do { x = Math.random() * this.w; y = Math.random() * this.h; k++; } while (Math.hypot(x - sx, y - sy) < 260 && k < 8);
    s.x = x; s.y = y; s.age = 0;
  }
  frame(t, dt, scroll, sink) {
    const g = this.g, W = this.w, H = this.h;
    const ds = this.scroll == null ? 0 : scroll - this.scroll;
    this.scroll = scroll;
    g.clearRect(0, 0, W, H);
    const sx = sink ? sink.x : W / 2, sy = sink ? sink.y - scroll : -H;
    for (const s of this.s) {
      s.age += dt;
      s.y -= ds * s.z * 0.3;                                   // parallax layers
      if (s.y < -4) s.y += H + 8; else if (s.y > H + 4) s.y -= H + 8;
      const dx = sx - s.x, dy = sy - s.y, d = Math.hypot(dx, dy) || 1;
      const v = (5 + s.z * 9) * dt;                            // a few px per second
      s.x += (dx / d) * v; s.y += (dy / d) * v;
      if (d < 22 || s.x < -6 || s.x > W + 6) { this.reborn(s, sx, sy); continue; }
      if (this.alpha <= 0.01) continue;
      const near = Math.min(1, d / 160), born = Math.min(1, s.age / 1.6);
      const tw = 0.6 + 0.4 * Math.sin(t * s.sp + s.p);
      g.globalAlpha = this.alpha * s.b * tw * near * born;
      g.fillStyle = s.z > 0.5 && s.b > 0.85 ? '#ffe0b5' : '#fff';
      g.beginPath();
      g.arc(s.x, s.y, s.r * (0.6 + s.z), 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
