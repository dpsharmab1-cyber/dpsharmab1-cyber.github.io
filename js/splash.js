// After the intro (Figma "Cover Intro Splash screen _Loading 2"): DEEPAK SHARMA
// and a big black -> red PORTFOLIO up top, See more under it, the wheel turning
// below while the red + blue comet sweeps down behind both. Nothing scrolls. See more plays a calm three-step hand-over:
//   1. the comet fades up and out while the wheel and the wordmark sink away
//   2. a short, completely white beat
//   3. About rises from the bottom, the wheel in its place and PORTFOLIO
//      settling into the nav.
import { Spring } from './core.js';

const LOGO_X = 640.5, LOGO_Y = 527.5;   // frame: wheel centre (1280 x 832)
const LOGO_D = 485;                     // frame: wheel diameter
const OUT = 2.0, BEAT = 0.6, RISE = 2.2; // seconds
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);

export class Splash {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.blob = new Spring(0, 1.1);   // entry: the comet fades in where it rests, slowly
    this.boost = new Spring(0, 1.0);  // the wheel turns a touch faster meanwhile
    this.phase = 0;                   // 0 rest, 1 out, 2 white beat, 3 About rising
    this.t = 0;
    this.mark = document.getElementById('splash-mark');
  }
  // See more is offered only while the splash rests
  get showing() { return this.active && this.phase === 0; }

  // called as the intro hands over; returns false when the splash is skipped
  begin({ skip = false } = {}) {
    if (skip) return false;
    this.active = true;
    this.boost.set(1);
    setTimeout(() => this.blob.set(1), 300);
    document.documentElement.classList.add('splash-on');
    this.app.queueMeasure?.();                   // See more moves under the wordmark
    this.app.scroll.lock(true);
    this.app.scroll.to(0, { immediate: true });
    return true;
  }

  exit() {
    if (!this.active || this.phase) return;
    this.phase = 1;
    this.t = 0;
    this.boost.set(0);
    this.mark?.classList.add('is-leaving');
  }

  step(dt) {
    if (!this.phase) return;
    this.t += dt;
    const root = document.documentElement;
    if (this.phase === 1 && this.t >= OUT) {
      // everything has left: hold a clean white screen, About waits a screen below
      this.phase = 2; this.t = 0;
      this.app.scroll.shift = innerHeight;
    } else if (this.phase === 2 && this.t >= BEAT) {
      this.phase = 3; this.t = 0;
      this.active = false;                       // nav + page glass fade in
      root.classList.remove('splash-on');
      root.classList.add('splash-rise');
      this.app.queueMeasure?.();
    } else if (this.phase === 3) {
      const e = outCubic(Math.min(1, this.t / RISE));
      this.app.scroll.shift = innerHeight * (1 - e);
      if (this.t >= RISE) {
        this.phase = 0;
        this.app.scroll.shift = 0;
        root.classList.remove('splash-rise');
        this.app.scroll.lock(!!this.app.chOpen);
      }
    }
  }

  // the comet, pushed after the section blobs so the wheel refracts it
  update(dt, W, H, blobs) {
    this.step(dt);
    const b = this.blob.step(dt);
    this.boost.step(dt);
    const m = this.app.blobs.meta?.splash;
    if (!m || !this.app.stage?.textures[m.tex || 'splash']) return;
    let show = b;
    if (this.phase === 1) show = b * (1 - inOut(Math.min(1, this.t / (OUT * 0.85))));
    else if (this.phase >= 2 || (!this.active && this.phase === 0)) show = 0;
    if (show < 0.002) return;
    const k = this.size(W, H) / LOGO_D;
    const bb = m.bbox;
    const w = (bb[2] - bb[0]) * k, h = (bb[3] - bb[1]) * k;
    const x = W / 2 + (bb[0] - LOGO_X) * k;
    const y1 = this.restY(H) + (bb[1] - LOGO_Y) * k;      // resting place
    // it appears where it rests: a slow fade, a slight grow and a short rise;
    // on See more it fades the same way while drifting up
    const e = show * show * (3 - 2 * show);
    const g = 0.9 + 0.1 * e;
    const cx = x + w / 2, cy = y1 + h / 2 + (1 - e) * H * (this.phase === 1 ? -0.08 : 0.05);
    blobs.push({ tex: m.tex || 'splash', x: cx - w * g / 2, y: cy - h * g / 2, w: w * g, h: h * g, alpha: e, seed: 0.31 });
  }

  size(W, H) { return this.app.logo.aboutSize() || LOGO_D * Math.min(W / 1280, H / 832); }
  restY(H) { return H * (LOGO_Y / 832); }

  // wheel placement while the splash runs (null = its normal About slot)
  wheelY(slotY, H, size) {
    if (this.active && this.phase === 0) return this.restY(H);
    if (this.phase === 1) return this.restY(H) + (H + size * 0.6 - this.restY(H)) * inOut(Math.min(1, this.t / OUT));
    if (this.phase === 2) return H + size;
    return slotY;
  }
  get steering() { return this.active || this.phase === 1 || this.phase === 2; }
}
