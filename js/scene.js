// Blobs + wheel logo placement. Both live in "Figma frame space" (1280×832)
// and are mapped onto each section, so the page reads exactly like the frames.
import { Spring, clamp } from './core.js';

export class Blobs {
  constructor(meta) {
    this.meta = meta;
    this.secs = [];
    this.vis = new Map();   // per section + blob: fade spring, kept across re-measures
  }
  measure(scrollY) {
    // a section can carry several blobs (data-blob="aboutL aboutR")
    this.secs = [...document.querySelectorAll('[data-blob]')].flatMap((el, i) => {
      const r = el.getBoundingClientRect();
      // phones: some sections pin their blob behind a headline instead
      const an = el.dataset.blobAnchor && el.querySelector(el.dataset.blobAnchor);
      const q = an?.getBoundingClientRect();
      const names = el.dataset.blob.split(/\s+/);
      return names.map((name, k) => {
        const key = (el.id || i) + ':' + name;
        if (!this.vis.has(key)) this.vis.set(key, new Spring(0, 1.8));
        return { el, name, key, top: r.top + scrollY, h: r.height, seed: ((i + k * 0.5) * 0.37) % 1,
          anchor: q ? q.top - r.top + q.height * (el.dataset.blobAt != null ? +el.dataset.blobAt : 0.5) : null, pinAll: el.dataset.blobPin === 'all' };
      });
    });
  }
  place(name, top, W, H, t, seed, anchor, pinAll) {
    const m = this.meta[name];
    if (!m) return null;
    const b = m.bbox, tex = m.tex || name;
    const bw = b[2] - b[0];
    // phones: every blob is centred on the screen and kept large (about one and
    // a half screens wide for the comet), so the colour still carries the page
    const narrow = W < 720;
    // tall tablets: never wider than the frame ratio allows, or it swamps the copy
    const s = narrow ? W / 1280 * (bw < 1000 ? 1.9 : 1.45) : Math.min(Math.sqrt((W / 1280) * (H / 832)), W / 1280 * 1.15);
    let fx = ((b[0] + b[2]) / 2) / 1280, fy = ((b[1] + b[3]) / 2) / 832;
    if (narrow) { fx = 0.5; fy = 0.5; }
    let cx = fx * W + Math.sin(t * 0.17 + seed * 9) * 7 * s;
    let cy = fy * H + Math.cos(t * 0.13 + seed * 7) * 6 * s;
    if ((narrow || pinAll) && anchor != null) {
      // centred behind the headline and locked to it (no parallax, no drift)
      const k = narrow ? s : s * 0.9;
      const w = bw * k, h = (b[3] - b[1]) * k;
      return { tex, x: W / 2 - w / 2, y: top + anchor - h / 2, w, h, seed };
    }
    const br = 1 + 0.016 * Math.sin(t * 0.33 + seed * 6.28);
    const w = bw * s * br, h = (b[3] - b[1]) * s * br;
    return { tex, x: cx - w / 2, y: top + cy - h / 2, w, h, seed };
  }
  update(t, scrollY, W, H, out, pageAlpha, dt = 0.016) {
    for (const s of this.secs) {
      const top = s.top - scrollY;
      // each background eases in as its section arrives and melts away as it
      // leaves: a slow fade, a slight grow and a short rise
      // the target follows how much of the section is on screen, so the colour
      // builds and drains with the scroll; the spring then smooths every change
      const seen = clamp((Math.min(top + s.h, H) - Math.max(top, 0)) / Math.min(s.h, H));
      const v = this.vis.get(s.key);
      const k = clamp((seen - 0.08) / 0.5);
      v.set(k * k * (3 - 2 * k));
      const f = v.step(dt);
      if (f < 0.004 || top > H * 1.4 || top + Math.min(s.h, H) < -H * 1.4) continue;
      const e = f * f * (3 - 2 * f);
      const pinned = s.anchor != null && (W < 720 || s.pinAll);
      const b = this.place(s.name, pinned ? top : top + -top * 0.12, W, H, t, s.seed, s.anchor, s.pinAll);
      if (!b) continue;
      const g = 0.9 + 0.1 * e, cx = b.x + b.w / 2, cy = b.y + b.h / 2 + (1 - e) * H * 0.06;
      b.w *= g; b.h *= g; b.x = cx - b.w / 2; b.y = cy - b.h / 2;
      b.alpha = pageAlpha * e;
      out.push(b);
    }
  }
}

// The wheel is a full-size wheel that belongs to its section and scrolls with it:
// the top of About (half above its glass sheet, half turning behind it), the
// footer (rising into place from below) and the 3D folder. It never travels
// between sections and is never scaled down.
export class LogoCtl {
  constructor() {
    this.ang = [0, 0, 0];
    this.list = [];
    this.introGate = 1;
  }
  aboutSize() { return this.list.find((a) => a.mode === 'about')?.size || 0; }
  measure(scrollY) {
    const prev = this.list;
    this.list = [...document.querySelectorAll('[data-logo]')].filter((el) => !el.closest('.chpage')).map((el, i) => {
      const r = el.getBoundingClientRect();
      const mode = el.dataset.logo;
      const it = { mode, level: +(el.dataset.level || 1), top: r.top + scrollY, h: r.height,
        bloom: prev[i]?.bloom || new Spring(0, 1.2), vis: prev[i]?.vis || new Spring(0, mode === 'about' ? 0.9 : 2),
        rise: prev[i]?.rise || new Spring(0, 3.2) };
      const slot = mode === 'about' ? el.querySelector('.about-logo') : mode === 'three' ? el : null;
      const edge = mode === 'footer' && el.querySelector('.foot-sheet-1');
      if (edge) it.cy = r.top + scrollY + edge.offsetTop;   // half above the glass, half behind
      if (slot) {
        const q = slot.getBoundingClientRect();
        it.cy = q.top + scrollY + q.height / 2;
        it.size = q.width;
      }
      return it;
    });
  }
  update(dt, scrollY, W, H, out, pageAlpha) {
    const s = Math.min(W / 1280, H / 832);
    const sy = H / 832;
    // very slow, steady spin: ring ~2 min per turn, inner text the other way
    // ~2.7 min, petals ~4 min
    // the splash turns it a little faster, easing back once it settles
    const bo = 1 + 1.2 * (this.splash?.boost.v || 0);
    this.ang[0] += dt * (Math.PI * 2 / 120) * bo;
    this.ang[1] -= dt * (Math.PI * 2 / 160) * bo;
    this.ang[2] += dt * (Math.PI * 2 / 240) * bo;
    for (const a of this.list) {
      const top = a.top - scrollY, bottom = top + a.h;
      const size = a.size || 485 * Math.max(s, 0.62);
      let y = a.cy != null ? a.cy - scrollY : top + 416 * sy;
      // the splash steers the wheel (rest, sinking away, held off-screen)
      const centred = a.mode === 'about' && this.splash?.steering;
      if (centred) y = this.splash.wheelY(y, H, size);
      const held = a.mode === 'about' && this.splash && (this.splash.steering || this.splash.phase === 3);
      // footer: after Contact, the wheel rises from below the screen into its
      // place, turning a little faster on the way up (tied to the scroll)
      let spin = 0;
      if (a.mode === 'footer') {
        a.rise.set(clamp((H * 1.02 - top) / (H * 0.92)));
        const r = a.rise.step(dt);
        const e = 1 - Math.pow(1 - r, 3);
        y += (1 - e) * H * 0.85;
        spin = (1 - e) * Math.PI * 0.9;
      }
      const gate = a.mode === 'about' ? this.introGate : 1;
      const seen = clamp((Math.min(bottom, H) - Math.max(top, 0)) / Math.min(a.h, H));
      const on = gate > 0.5 && (seen > 0.12 || held);
      a.bloom.set(on ? 1 : 0);
      a.vis.set(on ? 1 : 0);
      const bloom = a.bloom.step(dt);
      // fades in slowly after the intro / as its section arrives
      const fade = a.vis.step(dt);
      if (y + size / 2 < 0 || y - size / 2 > H) continue;
      const vis = pageAlpha * fade * fade * (3 - 2 * fade);
      if (vis < 0.003) continue;
      out.push({ x: W / 2, y, scale: size / 485, aRing: this.ang[0] + spin, aInner: this.ang[1] - spin * 0.7, aPetal: this.ang[2] + spin * 0.5,
        bloom: 0.15 + 0.85 * bloom, opacity: vis, level: a.level, // About's wheel is centred on the section's top edge: never cut it there,
        // so it rises in whole with the page instead of as a half disc
        clip: centred ? [-1e5, -1e5, 1e5, 1e5] : [0, a.mode === 'about' ? -1e5 : Math.max(top, -1e5), W, Math.min(bottom, 1e5)] });
    }
  }
}
