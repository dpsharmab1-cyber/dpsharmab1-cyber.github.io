// The nine works on the Figma "stacked cards": the same ten perspective
// panels, edges and order, each now showing a project's cover, mapped into
// its panel exactly (a CSS homography). Drag with the mouse or swipe on touch
// and the works slide from panel to panel, looping both ways. Hover lifts a
// panel and lights its name; a click opens the project page.
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js?v=77';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg>';
const NS = 'http://www.w3.org/2000/svg';
const fine = matchMedia('(pointer: fine)').matches;
const Y0 = 1400;                       // the section starts at y 1400 of the Figma frame
const FW = 300, FH = 600;              // the cover's own box before it is mapped

// a homography taking the FW x FH box onto the quad (tl, tr, br, bl)
function quadMatrix(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return `matrix3d(${a / FW},${d / FW},0,${g / FW},${b / FH},${e / FH},0,${h / FH},0,0,1,0,${c},${f},0,1)`;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);

export class Cards {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.box = this.sec.querySelector('.cards');
    this.page = new ProjectPage(app, this);
    this.n = PROJECTS.length;
    this.off = 0; this.goal = 0; this.vel = 0;
    this.rise = { v: 0 };
    this.ready = this.build();
  }

  async build() {
    let raw;
    try { raw = await (await fetch(`assets/cards.json?v=${document.documentElement.dataset.v || 1}`)).json(); } catch (e) { return; }
    // every slot as face + left strip + right strip + top strip, section px
    const toS = (P) => P.map(([x, y]) => [x, y - Y0]);
    const slots = raw.map((s) => {
      const F = toS(s.face);
      const edge = (side) => (s[side] ? toS(s[side].p) : (side === 'L' ? [F[0], F[0], F[3], F[3]] : [F[1], F[1], F[2], F[2]]));
      const top = s.top ? toS(s.top.p) : [F[0], F[1], F[1], F[0]];
      return { F, L: edge('L'), R: edge('R'), T: top.slice(0, 4), side: (s.L || s.R || {}).fill || '#404040', topFill: (s.top || {}).fill || '#777' };
    });
    // a slot beyond each end, so works can slide in and out of view
    const shift = (s, dx) => ({ ...s, F: s.F.map(([x, y]) => [x + dx, y]), L: s.L.map(([x, y]) => [x + dx, y]), R: s.R.map(([x, y]) => [x + dx, y]), T: s.T.map(([x, y]) => [x + dx, y]) });
    const k = slots.length;
    this.slots = [shift(slots[0], -(slots[1].F[0][0] - slots[0].F[0][0]) * 1.4), ...slots, shift(slots[k - 1], (slots[k - 1].F[0][0] - slots[k - 2].F[0][0]) * 1.4)];
    this.span = k;                                   // positions run 0 .. k (looping)
    this.step = k / this.n;
    this.items = PROJECTS.map((p, i) => this.item(p, i));
    const fade = document.createElement('div');
    fade.className = 'cards-floor';
    this.box.append(fade);
    this.bind();
    new IntersectionObserver(([e]) => { this.away = !e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(this.sec);
    ScrollTrigger.create({ trigger: this.sec, start: 'top 70%', end: 'bottom 15%',
      onEnter: () => gsap.to(this.rise, { v: 1, duration: 1.6, ease: 'expo.out', overwrite: true }),
      onEnterBack: () => gsap.to(this.rise, { v: 1, duration: 1.3, ease: 'expo.out', overwrite: true }),
      onLeave: () => gsap.to(this.rise, { v: 0, duration: 0.8, ease: 'expo.in', overwrite: true }),
      onLeaveBack: () => gsap.to(this.rise, { v: 0, duration: 0.8, ease: 'expo.in', overwrite: true }) });
    this.dirty = true;
    gsap.ticker.add((t, dt) => this.update(Math.min(0.05, dt / 1000)));
  }

  item(p, i) {
    const w = document.createElement('div');
    w.className = 'pn';
    const cover = p.groups
      ? `<div class="pn-cover collage">${p.groups.slice(0, 5).map((g) => `<img src="${g.images[0].thumb || g.images[0].src}" alt="" loading="lazy" decoding="async">`).join('')}</div>`
      : `<div class="pn-cover"><img src="${p.cover.thumb || p.cover.src}" alt="" loading="lazy" decoding="async"></div>`;
    w.innerHTML = `<svg class="pn-edges" viewBox="0 0 1512 1055" aria-hidden="true"><polygon class="e-l"/><polygon class="e-r"/><polygon class="e-t"/></svg>
      <div class="pn-face" role="button" tabindex="0" aria-label="${p.title}, ${p.kind}. Open project">${cover}<i class="pn-shade"></i></div>`;
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.innerHTML = `<b>${p.title}</b><span>${p.kind}</span><button type="button" class="pn-more" tabindex="-1">SEE MORE <i>${ARROW.replace('M5 12h13M12.5 6.5 18 12l-5.5 5.5', 'M12 5v13M6.5 12.5 12 18l5.5-5.5')}</i></button>`;
    this.box.append(w);
    this.box.append(lab);
    const it = { p, i, w, lab, face: w.querySelector('.pn-face'), el: { l: w.querySelector('.e-l'), r: w.querySelector('.e-r'), t: w.querySelector('.e-t') } };
    const open = () => { if (!this.dragged) this.page.open(i, it.face); };
    it.face.addEventListener('click', open);
    it.face.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    lab.querySelector('button').addEventListener('click', open);
    const hot = (on) => { w.classList.toggle('is-hot', on); lab.classList.toggle('is-hot', on); if (fine) this.app.cursor?.state(on ? 'big' : null, on ? 'OPEN' : ''); };
    it.face.addEventListener('pointerenter', () => hot(true));
    it.face.addEventListener('pointerleave', () => hot(false));
    return it;
  }

  bind() {
    let sx = 0, so = 0, down = false, lx = 0, lt = 0;
    const px = () => (this.app.scale || 1) * 170;            // screen px per panel
    this.box.addEventListener('pointerdown', (e) => { down = true; this.dragged = false; sx = lx = e.clientX; lt = performance.now(); so = this.off; this.vel = 0; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) this.dragged = true;
      if (!this.dragged) return;
      const now = performance.now();
      this.vel = ((e.clientX - lx) / px()) / Math.max(0.008, (now - lt) / 1000);
      lx = e.clientX; lt = now;
      this.goal = this.off = so + dx / px();
      this.dirty = true;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (this.dragged) this.goal = Math.round((this.off + gsap.utils.clamp(-4, 4, this.vel * 0.2)) / this.step) * this.step;
      setTimeout(() => { this.dragged = false; }, 0);
    });
    this.sec.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.goal -= this.step;
      if (e.key === 'ArrowLeft') this.goal += this.step;
    });
  }

  // where a position (0 .. span) sits: between two neighbouring slots
  at(u) {
    const S = this.slots, k = Math.floor(u), f = u - k;
    const A = S[k + 1] || S[S.length - 1], B = S[k + 2] || S[S.length - 1];
    return { F: lerpPts(A.F, B.F, f), L: lerpPts(A.L, B.L, f), R: lerpPts(A.R, B.R, f), T: lerpPts(A.T, B.T, f), side: f < 0.5 ? A.side : B.side, topFill: f < 0.5 ? A.topFill : B.topFill };
  }

  update(dt) {
    if (this.away || !this.items) return;
    const prev = this.off;
    this.off += (this.goal - this.off) * (1 - Math.exp(-dt * 7));
    if (Math.abs(this.off - prev) > 1e-4) this.dirty = true;
    const r = this.rise.v;
    if (!this.dirty && r === this.lastRise) return;
    this.dirty = false; this.lastRise = r;
    const span = this.span + 1;                      // the loop includes one hidden step
    for (const it of this.items) {
      const u = ((((it.i * this.step + this.off) % span) + span) % span) - 0.5;   // -0.5 .. span - 0.5
      const g = this.at(Math.max(-1, Math.min(this.span, u)));
      const edgeFade = Math.min(1, (u + 0.5) * 3, (this.span - 0.5 - u) * 3);
      // the panels rise out of the floor, the middle ones first
      const mid = Math.abs(u - (this.span - 1) / 2) / this.span;
      const rr = Math.min(1, Math.max(0, r * 1.5 - mid * 0.6));
      const lift = (1 - rr) * (1 - rr) * 260;
      const pt = (P) => P.map(([x, y]) => `${x.toFixed(1)},${(y + lift).toFixed(1)}`).join(' ');
      it.el.l.setAttribute('points', pt(g.L)); it.el.l.setAttribute('fill', g.side);
      it.el.r.setAttribute('points', pt(g.R)); it.el.r.setAttribute('fill', g.side);
      it.el.t.setAttribute('points', pt(g.T)); it.el.t.setAttribute('fill', g.topFill);
      it.face.style.transform = quadMatrix(g.F.map(([x, y]) => [x, y + lift]));
      const o = Math.max(0, edgeFade) * rr;
      it.w.style.opacity = o.toFixed(3);
      it.w.style.zIndex = String(Math.round(Math.abs(u - (this.span - 1) / 2) * 10));
      const cx = (g.F[0][0] + g.F[1][0]) / 2;
      it.lab.style.transform = `translate3d(${cx.toFixed(1)}px,${(lift * 0.3).toFixed(1)}px,0)`;
      it.lab.style.opacity = o.toFixed(3);
    }
  }
}

// ---------------------------------------------------------------------------
// The project page: the clicked panel's image flies out to fill the screen,
// the page wipes up under it, then the title rises letter by letter.
class ProjectPage {
  constructor(app, list) {
    this.app = app;
    this.list = list;
    this.el = document.getElementById('project');
    this.scroller = this.el.querySelector('.pj-scroll');
    this.inner = this.el.querySelector('.pj-inner');
    this.lenis = new Lenis({ wrapper: this.scroller, content: this.inner, lerp: 0.085, autoRaf: false });
    gsap.ticker.add((t) => { if (this.open_) this.lenis.raf(t * 1000); });
    this.el.querySelector('.pj-close').addEventListener('click', () => this.close());
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.open_) { if (this.zoom?.classList.contains('is-open')) this.zoom.classList.remove('is-open'); else this.close(); } });
    addEventListener('popstate', () => { if (this.open_ && !location.hash.startsWith('#work/')) this.close(true); });
    this.zoom = document.createElement('div');
    this.zoom.className = 'zoom';
    this.zoom.innerHTML = '<img alt="">';
    this.zoom.addEventListener('click', () => this.zoom.classList.remove('is-open'));
    document.body.append(this.zoom);
    const m = /^#work\/([\w-]+)$/.exec(location.hash);
    if (m) {
      const i = PROJECTS.findIndex((p) => p.id === m[1]);
      if (i >= 0) app.afterIntro = () => this.open(i, null);
    }
  }

  render(i) {
    const p = PROJECTS[i];
    const next = PROJECTS[(i + 1) % PROJECTS.length];
    const fig = (im, k, cls = '') => `<figure class="${cls}"><img src="${im.thumb || im.src}" data-full="${im.src}" width="${im.w}" height="${im.h}" alt="${p.title}, image ${k + 1}" loading="lazy" decoding="async"></figure>`;
    // UI work: the live prototype first, then the screens
    const live = p.liveKind === 'proto'
      ? `<section class="pj-live-frame"><div class="pj-device"><iframe src="${p.live}" title="${p.title}, live prototype" loading="lazy"></iframe></div>
         <a class="pill pill-light btn" href="${p.live}" target="_blank" rel="noopener"><span>OPEN FULL SCREEN</span><i class="dot">${ARROW}</i></a></section>`
      : p.liveKind === 'site'
        ? `<section class="pj-live-frame"><a class="pj-device pj-site" href="${p.live}" target="_blank" rel="noopener"><img src="${p.cover.src}" alt="${p.title} website"><span class="pill pill-light btn"><span>VISIT THE LIVE SITE</span><i class="dot">${ARROW}</i></span></a></section>`
        : '';
    let gallery;
    if (p.groups) {
      // social: first a mix of every client (the intro settles into it), then
      // the rest of each client's posts as their own collage
      const pick = [], left = p.groups.map((g) => [...g.images]);
      for (let k = 0; pick.length < 30 && left.some((l) => l.length); k++) { const l = left[k % left.length]; if (l.length) pick.push(l.shift()); }
      const tile = (im, k) => fig(im, k, (k % 7 === 0 ? 'big' : k % 5 === 3 ? 'tall' : ''));
      gallery = `<section class="pj-group pj-hl"><h3 class="eyebrow">HIGHLIGHTS <small>${p.groups.length} brands</small></h3><div class="pj-collage pj-hl-grid">${pick.map(tile).join('')}</div></section>`
        + p.groups.map((g, gi) => left[gi].length ? `<section class="pj-group"><h3 class="eyebrow">${g.title} <small>${g.images.length}</small></h3>
        <div class="pj-collage">${left[gi].map(tile).join('')}</div></section>` : '').join('');
    } else {
      const imgs = p.liveKind ? p.images : p.images.slice(1);
      gallery = `<div class="pj-grid">${(imgs.length ? imgs : [p.cover]).map((im, k) => fig(im, k)).join('')}</div>`;
    }
    this.inner.innerHTML = `
      <header class="pj-hero">
        <img class="pj-hero-img" src="${p.cover.src}" alt="">
        <div class="pj-head">
          <p class="eyebrow pj-no">${p.no} / ${String(PROJECTS.length).padStart(2, '0')} · ${p.kind}</p>
          <h2 class="t-anton h-xl pj-title" id="pj-title">${p.title}</h2>
        </div>
      </header>
      <section class="pj-body">
        <div><p class="eyebrow">ABOUT THE PROJECT</p><p class="pj-desc">${p.desc}</p></div>
        <ul class="pj-meta">${p.meta.map((m) => `<li>${m}</li>`).join('')}</ul>
      </section>
      ${live}
      <section class="pj-gallery"><p class="eyebrow">${p.groups ? 'SELECTED POSTS' : 'SCREENS & DETAILS'}</p>${gallery}</section>
      <a class="pj-next" href="#work/${next.id}"><small class="eyebrow">NEXT PROJECT</small><b class="t-anton">${next.title}</b></a>`;
    this.inner.querySelector('.pj-next').addEventListener('click', (e) => { e.preventDefault(); this.swap((i + 1) % PROJECTS.length); });
    this.inner.querySelectorAll('.pj-gallery figure').forEach((f) => f.addEventListener('click', () => {
      this.zoom.querySelector('img').src = f.querySelector('img').dataset.full;
      this.zoom.classList.add('is-open');
    }));
    this.reveals(false);
    if (p.groups) this.socialIntro();
  }

  // gallery images unfold as they scroll into view
  reveals(skipFigures) {
    this.io?.disconnect();
    this.io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      this.io.unobserve(e.target);
      gsap.fromTo(e.target, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' });
    }), { root: this.scroller, threshold: 0.08 });
    this.inner.querySelectorAll(skipFigures ? '.pj-live-frame' : '.pj-collage:not(.pj-hl-grid) figure, .pj-grid figure, .pj-live-frame').forEach((f) => { f.style.opacity = 0; this.io.observe(f); });
  }

  // Social media: the posts first spin in a ring, scatter, gather into one
  // stack, fan out into thin strips, then each flies to its place in the grid
  socialIntro() {
    const box = this.inner.querySelector('.pj-hl-grid');
    if (!box) return;
    const figs = [...box.querySelectorAll('figure')];
    if (!figs.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    figs.forEach((f) => { f.style.opacity = 0; });
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      this.playSocial(box, figs);
    }, { root: this.scroller, rootMargin: '0px 0px -35% 0px' });
    io.observe(box);
  }

  // inside the highlights grid only (clipped there, under the headings): the
  // posts spin in a ring, scatter, gather into one stack, fan out into thin
  // strips, then each flies to its own place in the grid
  playSocial(box, figs) {
    const N = figs.length;
    const stage = document.createElement('div');
    stage.className = 'sx-stage';
    box.append(stage);
    const W = box.clientWidth, H = box.clientHeight;
    const vr = this.scroller.getBoundingClientRect(), br = box.getBoundingClientRect();
    // the middle of what is on screen of the grid
    const vis0 = Math.max(0, vr.top - br.top), vis1 = Math.min(H, vr.bottom - br.top);
    const cx = W / 2, cy = Math.max(180, Math.min(H - 180, (vis0 + vis1) / 2));
    const room = Math.min(H, vis1 - vis0, 620);
    const tw = Math.max(64, Math.min(96, W / 14)), th = tw * 1.3;
    const tiles = figs.map((f) => {
      const t = document.createElement('div');
      t.className = 'sx-tile';
      t.innerHTML = `<img src="${f.querySelector('img').src}" alt="">`;
      stage.append(t);
      return t;
    });
    const R = Math.min(W, room) * 0.3, spin = { a: 0 };
    const ring = () => tiles.forEach((t, i) => {
      const a = (i / N) * Math.PI * 2 + spin.a;
      gsap.set(t, { x: cx + Math.cos(a) * R - tw / 2, y: cy + Math.sin(a) * R - th / 2, rotation: (a * 180) / Math.PI + 90 });
    });
    gsap.set(tiles, { width: tw, height: th, scale: 0, transformOrigin: '50% 50%' });
    ring();
    const total = Math.min(W * 0.78, N * 28), sw = total / N, sh = Math.min(380, room * 0.6);
    const tl = gsap.timeline({ onComplete: () => stage.remove() });
    tl.to(tiles, { scale: 1, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.015 }, 0)
      .to(spin, { a: Math.PI * 1.6, duration: 1.9, ease: 'power2.inOut', onUpdate: ring }, 0)
      .to(tiles, { x: () => W * (0.06 + Math.random() * 0.88) - tw / 2, y: () => cy + (Math.random() - 0.5) * room * 0.8 - th / 2, rotation: () => (Math.random() - 0.5) * 50, scale: 0.75, duration: 1, ease: 'expo.out', stagger: { each: 0.008, from: 'random' } }, 1.9)
      .to(tiles, { x: cx - tw * 0.8, y: cy - th * 0.8, width: tw * 1.6, height: th * 1.6, scale: 1, rotation: () => (Math.random() - 0.5) * 10, duration: 0.8, ease: 'expo.inOut', stagger: 0.006 }, 3.0)
      .to(tiles, { rotation: 0, duration: 0.3, ease: 'power2.out' }, 3.8)
      .to(tiles, { x: (i) => cx - total / 2 + i * sw, y: cy - sh / 2, width: sw + 0.5, height: sh, duration: 0.9, ease: 'expo.inOut', stagger: 0.012 }, 4.15)
      .add(() => {
        const base = box.getBoundingClientRect();
        tiles.forEach((t, i) => {
          const r = figs[i].getBoundingClientRect();
          gsap.to(t, { x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height, borderRadius: 12, duration: 1.1, ease: 'expo.inOut', delay: i * 0.014,
            onComplete: () => { figs[i].style.opacity = 1; t.style.visibility = 'hidden'; } });
        });
      }, 5.3)
      .to({}, { duration: 1.8 });
  }

  intro() {
    const title = this.inner.querySelector('.pj-title');
    const split = SplitText.create(title, { type: 'chars,lines', mask: 'lines' });
    const tl = gsap.timeline();
    tl.from(split.chars, { yPercent: 115, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: 0.025 })
      .from('.pj-no', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.15)
      .from('.pj-hero-img', { scale: 1.15, duration: 1.8, ease: 'expo.out' }, 0)
      .from('.pj-body > *', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.35);
    return tl;
  }

  open(i, face) {
    if (this.open_) return this.swap(i);
    this.i = i;
    this.open_ = true;
    this.render(i);
    this.lenis.scrollTo(0, { immediate: true });
    this.app.lenis.stop();
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    try { history.pushState({ work: PROJECTS[i].id }, '', '#work/' + PROJECTS[i].id); } catch (e) {}
    const tl = gsap.timeline();
    if (face) {
      // the panel image flies flat and fills the screen
      const r = face.getBoundingClientRect();
      const fly = document.createElement('img');
      fly.className = 'fly';
      fly.src = PROJECTS[i].cover.src;
      Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      document.body.append(fly);
      tl.to(fly, { left: 0, top: 0, width: innerWidth, height: innerHeight, duration: 1.05, ease: 'expo.inOut' }, 0)
        .to(fly, { opacity: 0.55, duration: 0.5, ease: 'power2.out' }, 0.75)
        .add(() => fly.remove(), 1.35);
    }
    tl.fromTo(this.el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.inOut' }, face ? 0.25 : 0)
      .add(this.intro(), face ? 0.85 : 0.5);
    setTimeout(() => this.el.querySelector('.pj-close').focus({ preventScroll: true }), 900);
  }

  swap(i) {
    const tl = gsap.timeline();
    tl.to(this.inner, { opacity: 0, y: -40, duration: 0.5, ease: 'power2.in' })
      .add(() => {
        this.i = i;
        this.render(i);
        this.lenis.scrollTo(0, { immediate: true });
        try { history.replaceState({ work: PROJECTS[i].id }, '', '#work/' + PROJECTS[i].id); } catch (e) {}
      })
      .set(this.inner, { opacity: 1, y: 0 })
      .add(() => this.intro());
  }

  close(fromPop) {
    if (!this.open_) return;
    this.open_ = false;
    gsap.to(this.el, {
      clipPath: 'inset(0% 0% 100% 0%)', duration: 0.95, ease: 'expo.inOut',
      onComplete: () => { this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden', 'true'); this.inner.innerHTML = ''; },
    });
    this.app.lenis.start();
    if (!fromPop && location.hash.startsWith('#work/')) { try { history.pushState(null, '', location.pathname + location.search); } catch (e) {} }
  }
}
