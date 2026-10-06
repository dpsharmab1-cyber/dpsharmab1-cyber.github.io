// Services: a carousel of glass folders (Figma "folders section"). Opening one
// shows its chapter as a page (js/chpage.js). DOM labels and the GL folder
// share one matrix3d per card so they stay locked together.
import { Spring, clamp } from './core.js';

const smoothstep01 = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
import { ICONS } from './icons.js';

export const CATEGORIES = [
  { id: 'ui', no: '01', title: 'UI/UX<br>DESIGN', tags: ['Figma', 'Prototypes', 'Responsive'] },
  { id: 'brand', no: '02', title: 'BRAND<br>DESIGN', tags: ['Identity', 'Packaging', 'Moodboards'] },
  { id: 'art', no: '03', title: '2D ART<br>&amp; PRINT', tags: ['Logos', 'Print', 'Templates'] },
  { id: 'social', no: '04', title: 'SOCIAL<br>MEDIA<br>DESIGN', tags: ['Photoshop', 'Campaigns', 'AI Tools'] },
  { id: 'game', no: '05', title: 'GAME<br>DESIGN', tags: ['Characters', 'Game UI', 'Assets'] },
  { id: '3d', no: '06', title: '3D<br>DESIGN', tags: ['Blender', 'Models', 'Renders'] },
];

// Figma "folders section update": a card is 360 x 316 (frame px)
const CW = 360, CH = 316;

export class Folders {
  constructor(root, { onOpen }) {
    this.root = root;
    this.stage = root.querySelector('.folder-stage');
    this.onOpen = onOpen;
    this.n = CATEGORIES.length;
    this.pos = new Spring(1, 7);   // brand design centred, like the frame
    this.cards = CATEGORIES.map((c, i) => {
      const el = document.createElement('div');
      el.className = 'fcard';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${c.title.replace(/<br>/g, ' ')} — open`);
      el.innerHTML = `<span class="fcard-arrow">${ICONS.arrowUpRight}</span>
        <span class="fcard-tags">${c.tags.map((t) => `<span>${t}</span>`).join('')}</span>
        <span class="fcard-no">${c.no}</span><span class="fcard-title">${c.title}</span>`;
      this.stage.appendChild(el);
      const card = { c, i, el, hover: new Spring(0, 12), open: new Spring(0, 9), m: null, o: 0 };
      el.addEventListener('pointerenter', () => card.hover.set(1));
      el.addEventListener('pointerleave', () => card.hover.set(0));
      el.addEventListener('click', () => { if (!this.dragged) this.activate(card); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.activate(card); } });
      return card;
    });
    root.querySelector('.arrow-prev').addEventListener('click', () => this.go(-1));
    root.querySelector('.arrow-next').addEventListener('click', () => this.go(1));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    });
    this.bindDrag();
    this.visible = 1;
  }

  go(d) { this.pos.set(Math.round(this.pos.t) + d); }
  centerIndex() { return ((Math.round(this.pos.t) % this.n) + this.n) % this.n; }

  // a tap on any folder opens it (a side folder also turns to the centre)
  activate(card) {
    if (card.i !== this.centerIndex()) this.openById(card.c.id);
    this.onOpen(card.c.id, card);
  }

  openById(id) {
    const card = this.cards.find((c) => c.c.id === id);
    if (!card) return;
    let d = card.i - this.centerIndex();
    if (d > this.n / 2) d -= this.n;
    if (d < -this.n / 2) d += this.n;
    this.pos.set(Math.round(this.pos.t) + d);
    return card;
  }

  bindDrag() {
    let sx = 0, sp = 0, down = false;
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.arrow')) return;
      down = true; this.dragged = false; sx = e.clientX; sp = this.pos.t;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) this.dragged = true;
      if (this.dragged) this.pos.set(sp - dx / 230);
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      this.pos.set(Math.round(this.pos.t));
      setTimeout(() => { this.dragged = false; }, 0);
    });
  }

  measure(scrollY) {
    const r = this.stage.getBoundingClientRect();
    this.base = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
    // folders stay inside the glass sheet they sit on: DOM labels by clip-path,
    // GL folders by the same rounded rect in the shader
    const sheet = document.querySelector('.work-sheet');
    if (sheet) {
      const q = sheet.getBoundingClientRect();
      const rad = parseFloat(getComputedStyle(sheet).borderTopLeftRadius) || 0;
      this.sheet = { x0: q.left, y0: q.top + scrollY, x1: q.right, y1: q.bottom + scrollY, r: rad };
      this.stage.style.clipPath = `inset(${(q.top - r.top).toFixed(1)}px ${(r.right - q.right).toFixed(1)}px ${(r.bottom - q.bottom).toFixed(1)}px ${(q.left - r.left).toFixed(1)}px round ${rad}px)`;
    }
    // Figma "folders section update": centre card 360 x 316 at k = 1, sitting
    // on the stage bottom; red arrows level with its top edge
    const W = document.documentElement.clientWidth, H = innerHeight;
    // phones and tablets size by width (centre card ~62 % / ~42 % of it)
    const fit = W < 720 ? (W * 0.62) / CW : W < 1100 ? (W * 0.42) / CW : clamp(Math.min(W / 1280, H / 832), 0.55, 1.3);
    this.k = Math.min(fit, (r.height * 0.96) / CH);
    // a tall stage (tablet portrait) centres the cards instead of parking them at the bottom
    this.baseY = Math.min(r.height - 4, r.height * 0.5 + CH * this.k * 0.62);
    const ay = this.baseY - (CH + 6) * this.k + (r.top - this.root.getBoundingClientRect().top);
    this.root.style.setProperty('--arrow-y', ay.toFixed(1) + 'px');
  }

  update(dt, scrollY, out, pageAlpha, W) {
    const pos = this.pos.step(dt);
    const b = this.base;
    if (!b) return;
    const sx = b.x, sy = b.y - scrollY;
    const k = this.k;
    const ox = b.w / 2, base = this.baseY ?? b.h - 4;
    const cy0 = base - (CH / 2) * k;          // centre card's middle
    const persp = new DOMMatrix();
    persp.m34 = -1 / 1400;
    // dissolve under the nav, like the page text does
    const vis = this.visible * pageAlpha * clamp((sy + base - 96) / 160);
    const sorted = [];
    for (const card of this.cards) {
      let o = card.i - pos;
      o = ((o % this.n) + this.n * 1.5) % this.n - this.n / 2;  // wrap to [-n/2, n/2)
      card.o = o;
      const ao = Math.abs(o);
      const h = card.hover.step(dt) * (ao < 0.5 ? 1 : 0);
      const op = card.open.step(dt);
      // frame: neighbours 62.4 % at ±265 px and 34 px higher, the next pair
      // 54.3 % at ±469 px and 73 px higher, both blurred (7.5 px)
      const a1 = Math.min(ao, 1), a2 = clamp(ao - 1, 0, 1), a3 = Math.max(ao - 2, 0);
      const rel = 1 - 0.376 * a1 - 0.081 * a2 - 0.05 * a3;
      const scale = rel * k * (1 + 0.03 * h);
      const x = ox + Math.sign(o) * (265 * a1 + 204 * a2 + 190 * a3) * k;
      const y = cy0 - (34 * a1 + 39 * a2 + 30 * a3) * k - 10 * h * k;
      const z = 0, ry = 0;   // the frame keeps every card flat
      const m = new DOMMatrix()
        .translate(ox, base).multiply(persp).translate(-ox, -base)
        .translate(x, y, z).rotate(0, ry, 0).scale(scale, scale, 1).translate(-CW / 2, -CH / 2);
      card.m = m;
      const blurPx = 7.5 * k * smoothstep01((ao - 0.15) / 0.85);   // screen px
      const blur = blurPx / Math.max(scale, 1e-3);                   // local px for the shader
      const alpha = clamp(2.7 - ao, 0, 1) * vis;
      const t = m.toString();
      if (t !== card.lastT) { card.el.style.transform = t; card.lastT = t; }
      const z2 = String(100 - Math.round(ao * 10));
      if (card.el.style.zIndex !== z2) card.el.style.zIndex = z2;
      const f = blurPx > 0.1 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
      if (card.el._f !== f) { card.el.style.filter = f; card.el._f = f; }
      const a = alpha.toFixed(3);
      if (card.el._a !== a) { card.el.style.opacity = a; card.el._a = a; card.el.style.pointerEvents = alpha > 0.2 ? '' : 'none'; }
      card.el.classList.toggle('is-center', ao < 0.5);
      if (alpha < 0.003) continue;
      const mg = new DOMMatrix().translate(sx, sy).multiply(m);
      sorted.push({ ao, f: { m: mg.toFloat32Array(), w: CW, h: CH, scale: scale * 0.95, blur, open: op, hover: h, opacity: alpha, level: 3, seed: card.i * 0.21 } });
    }
    const sh = this.sheet;
    const clip = sh && [sh.x0, sh.y0 - scrollY, sh.x1, sh.y1 - scrollY];
    sorted.sort((a, b) => b.ao - a.ao).forEach((s) => { s.f.clip = clip; s.f.clipR = sh?.r || 0; out.push(s.f); });
  }

  // screen rect of a card (for the folder → panel morph)
  rectOf(card, scrollY) {
    const r = card.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
}
