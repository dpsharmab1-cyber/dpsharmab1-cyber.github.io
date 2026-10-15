// A quiet starfield behind the dark sections: three depths drift at different
// speeds with the scroll, and every star breathes on its own clock.
export class Stars {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.alpha = 0;
    this.scroll = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((this.w * this.h) / 4200);
    this.s = Array.from({ length: n }, () => ({
      x: Math.random() * this.w, y: Math.random() * this.h,
      z: [0.15, 0.35, 0.7][(Math.random() * 3) | 0],        // depth: parallax + size
      r: Math.random() * 0.9 + 0.35,
      p: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 1.6,
      b: 0.25 + Math.random() * 0.75,
    }));
  }
  draw(t) {
    const g = this.g, H = this.h;
    g.clearRect(0, 0, this.w, H);
    if (this.alpha <= 0.01) return;
    for (const s of this.s) {
      const y = (((s.y - this.scroll * s.z * 0.25 - t * 4 * s.z) % H) + H) % H;
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.p);
      g.globalAlpha = this.alpha * s.b * tw;
      g.fillStyle = s.z > 0.5 && s.b > 0.85 ? '#ffe0b5' : '#ffffff';
      g.beginPath();
      g.arc(s.x, y, s.r * (0.6 + s.z), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
