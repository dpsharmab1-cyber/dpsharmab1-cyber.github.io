// The ten works as the "Content and cards" mockup draws them: tall slabs in a
// corridor, each turned on its vertical axis. The nearer the middle, the more
// edge-on; the red spine sits on each slab's near edge. Drag, swipe or use
// the arrow keys to walk the corridor; click a slab and it glides to the
// middle and turns to face you, showing the real work; click it again (or
// its SEE MORE) to open the project page. Wide screens use the mockup's
// spacing; tablets and phones a closer corridor sized to the screen.
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js?v=110';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/></svg>';
const fine = matchMedia('(pointer: fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// each project's poster (assets/theme/posters, tools/v10/build_posters.py)
const POSTER = ['01-oaks-dashboard', '02-gaurav', '03-elixir', '04-coldtrace', '05-p7', '06-momma', '07-social', '08-ergonxlu', '09-fibril', '10-teacher-app'];
// how far a slab turns for an offset a from the middle: square-on at the very
// middle, 72° just beside it, opening to 22° at the ends (fitted to the mockup)
const turn = (a) => (a < 0.5 ? 144 * a : Math.max(22, 78 - 11.5 * a));

export class Cards {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.box = this.sec.querySelector('.cards');
    this.page = new ProjectPage(app, this);
    this.n = PROJECTS.length;
    // wide: the mockup's resting view, the middle between two slabs; small
    // screens: one slab faces you so its name shows
    this.c = this.goal = this.box.clientWidth < 900 ? 4 : 4.5;
    this.vel = 0; this.rise = { v: 0 }; this.hover = -1;
    this.items = PROJECTS.map((p, i) => this.build(p, i));
    this.size();
    addEventListener('resize', () => this.size());
    this.bind();
    new IntersectionObserver(([e]) => { this.away = !e.isIntersecting; }, { rootMargin: '15% 0px' }).observe(this.box);
    ScrollTrigger.create({ trigger: this.box, start: 'top 85%', end: 'bottom 5%',
      onEnter: () => gsap.to(this.rise, { v: 1, duration: 2.2, ease: 'expo.out', overwrite: true }),
      onEnterBack: () => gsap.to(this.rise, { v: 1, duration: 1.6, ease: 'expo.out', overwrite: true }),
      onLeave: () => gsap.to(this.rise, { v: 0, duration: 0.9, ease: 'power3.in', overwrite: true }),
      onLeaveBack: () => gsap.to(this.rise, { v: 0, duration: 0.9, ease: 'power3.in', overwrite: true }) });
    if (reduced) this.rise.v = 1;
    gsap.ticker.add((t, dt) => this.update(Math.min(0.05, dt / 1000), t));
  }

  build(p, i) {
    const el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('role', 'listitem');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `${p.title}, ${p.kind}. Press Enter to open the project`);
    const shot = p.cover ? `<img class="shot" src="${p.cover.thumb || p.cover.src}" alt="" loading="lazy" decoding="async">` : '';
    el.innerHTML = `<div class="card-in"><img class="poster" src="assets/theme/posters/${POSTER[i]}.svg?v=100" alt="" loading="lazy" decoding="async">${shot}<i class="card-spine"></i><b class="card-no">${p.no}</b></div>`;
    this.box.append(el);
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.innerHTML = `<b>${p.title}</b><span>${p.kind}</span><button type="button" tabindex="-1">SEE MORE <i>${ARROW}</i></button>`;
    this.box.append(lab);
    const it = { p, i, el, lab, last: {} };
    const open = () => { if (!this.dragged) this.page.open(i, null); };
    el.addEventListener('click', () => {
      if (this.dragged) return;
      const d = this.rel(i);
      if (Math.abs(d) > 0.25) { this.goal = this.c + d; return; }
      open();
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    el.addEventListener('focus', () => { if (Math.abs(this.rel(i)) > 0.25) this.goal = this.c + this.rel(i); });
    lab.querySelector('button').addEventListener('click', open);
    el.addEventListener('pointerenter', () => { this.hover = i; if (fine) this.app.cursor?.state('big', Math.abs(this.rel(i)) < 0.25 ? 'OPEN' : 'TURN'); });
    el.addEventListener('pointerleave', () => { this.hover = -1; this.app.cursor?.state(); });
    return it;
  }

  rel(i) { const n = this.n; return ((((i - this.c + n / 2) % n) + n) % n) - n / 2; }

  // the corridor sized to its box: wide screens show the whole corridor with a
  // label under every slab; narrow ones a closer corridor, one label at a time
  size() {
    const W = this.box.clientWidth;
    this.W = W;
    this.flow = W < 900;
    if (this.flow) { this.bw = Math.min(W * 0.4, 230); this.bh = this.bw * 2.3; this.step = Math.min(W * 0.26, 190); this.top = 24; }
    else { this.bw = Math.min(240, W * 0.16); this.bh = this.bw * 2.42; this.step = W * 0.1; this.top = 30; }
    this.box.style.setProperty('--box-h', `${Math.round(this.top + this.bh + (this.flow ? 130 : 120))}px`);
    this.box.style.setProperty('--cw', this.bw + 'px'); this.box.style.setProperty('--ch', this.bh + 'px');
    this.box.style.perspectiveOrigin = `${W / 2}px ${this.top + this.bh * 0.55}px`;
    for (const it of this.items || []) it.last = {};
  }

  // where a slab sits for an offset o from the middle (continuous)
  place(o) {
    const a = Math.abs(o), sg = Math.sign(o) || 0;
    const x = this.W / 2 + o * this.step + sg * a * a * this.step * (this.flow ? 0.04 : 0.009);
    return { x, ry: -sg * turn(a) };
  }

  bind() {
    let sx = 0, sc = 0, down = false, lx = 0, lt = 0;
    const px = () => this.step;
    this.box.addEventListener('pointerdown', (e) => { down = true; this.dragged = false; sx = lx = e.clientX; lt = performance.now(); sc = this.c; this.vel = 0; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) this.dragged = true;
      if (!this.dragged) return;
      const now = performance.now();
      this.vel = (-(e.clientX - lx) / px()) / Math.max(0.008, (now - lt) / 1000);
      lx = e.clientX; lt = now;
      this.goal = this.c = sc - dx / px();
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (this.dragged) this.goal = Math.round(this.c + gsap.utils.clamp(-4, 4, this.vel * 0.2));
      setTimeout(() => { this.dragged = false; }, 0);
    });
    this.sec.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.goal = Math.round(this.goal) + 1; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.goal = Math.round(this.goal) - 1; }
    });
  }

  update(dt, t) {
    if (this.away) return;
    this.c += (this.goal - this.c) * (1 - Math.exp(-dt * 5.5));
    const rise = this.rise.v;
    for (const it of this.items) {
      const o = this.rel(it.i), a = Math.abs(o);
      const g = this.place(o);
      const r = Math.min(1, Math.max(0, rise * 1.5 - a * 0.08));
      const drop = (1 - r) * (1 - r) * 380;
      // a slab you point at opens a little toward you
      const open = it.i === this.hover && a > 0.25 ? 0.72 : 1;
      const ry = g.ry * open + (1 - r) * 30 * (Math.sign(o) || 1);
      const fade = this.flow ? Math.max(0, Math.min(1, (3.2 - a) * 1.4)) : Math.max(0, Math.min(1, (5.2 - a) * 2.5));
      const L = it.last;
      it.el.style.transform = `translate3d(${(g.x - this.bw / 2).toFixed(1)}px,${(this.top + drop).toFixed(1)}px,0) rotateY(${ry.toFixed(2)}deg)`;
      it.el.style.opacity = (r * fade).toFixed(3);
      const z = String(a < 0.5 ? 200 : 100 + Math.round(a * 10));
      if (L.z !== z) { it.el.style.zIndex = z; L.z = z; }
      const right = o > 0;
      if (L.r !== right) { it.el.classList.toggle('is-right', right); L.r = right; }
      const centre = a < 0.25;
      if (L.c !== centre) { it.el.classList.toggle('is-centre', centre); it.lab.classList.toggle('is-centre', centre); L.c = centre; }
      if (this.flow) {
        it.lab.style.transform = `translate3d(${(this.W / 2).toFixed(1)}px,${(this.top + this.bh + 34).toFixed(1)}px,0)`;
        it.lab.style.opacity = (r * Math.max(0, 1 - a * 2.6)).toFixed(3);
        it.lab.style.pointerEvents = a < 0.3 ? 'auto' : 'none';
      } else {
        it.lab.style.transform = `translate3d(${g.x.toFixed(1)}px,${(this.top + this.bh + 30 + drop * 0.3).toFixed(1)}px,0)`;
        it.lab.style.opacity = (r * fade).toFixed(3);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// All ten projects as a grid of cards, with filters by discipline. Each card
// opens the same project page as the corridor.
const TAGS = { 'oaks-dashboard': ['ui'], gaurav: ['brand', 'packaging'], elixir: ['game'], coldtrace: ['ui'], p7: ['brand', 'print'],
  momma: ['packaging', 'brand'], social: ['social'], ergonxlu: ['ui', 'brand'], fibril: ['packaging', 'print'], 'teacher-app': ['ui'] };
const FILTERS = [['all', 'All'], ['ui', 'UI / UX'], ['brand', 'Branding'], ['packaging', 'Packaging'], ['print', 'Print'], ['game', 'Game art'], ['social', 'Social']];
const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg>';

export class Grid {
  constructor(app, page) {
    const box = document.getElementById('pgrid'), fbox = document.querySelector('.filters');
    if (!box) return;
    box.classList.add('is-all');
    box.innerHTML = PROJECTS.map((p, i) => `<article class="pcard${i === 0 || i === 6 ? ' feat' : ''}" data-tags="${(TAGS[p.id] || []).join(' ')}">
        <div class="pcard-media"><img class="shot" src="${p.cover.thumb || p.cover.src}" alt="${p.title}, cover image" loading="lazy" decoding="async"><b class="pcard-no">${p.no}</b></div>
        <div class="pcard-body"><p class="pcard-kind">${p.kind}</p><h4 class="pcard-title">${p.title}</h4><p class="pcard-desc">${p.desc}</p>
        <ul class="pcard-tags">${p.meta.slice(0, 3).map((m) => `<li>${m}</li>`).join('')}</ul>
        <button class="pcard-open" type="button" data-i="${i}">View project <i>${ARROW_R}</i></button></div></article>`).join('');
    box.querySelectorAll('.pcard-open').forEach((b) => b.addEventListener('click', () => page.open(+b.dataset.i, null)));
    box.querySelectorAll('.pcard').forEach((c) => {
      c.addEventListener('click', (e) => { if (!e.target.closest('.pcard-open')) c.querySelector('.pcard-open').click(); });
      c.addEventListener('pointerenter', () => { if (fine) app.cursor?.state('big', 'OPEN'); });
      c.addEventListener('pointerleave', () => app.cursor?.state());
    });
    const count = (k) => PROJECTS.filter((p) => k === 'all' || (TAGS[p.id] || []).includes(k)).length;
    fbox.innerHTML = FILTERS.map(([k, n], i) => `<button class="filter${i ? '' : ' is-on'}" type="button" data-k="${k}" aria-pressed="${!i}">${n} <small>${count(k)}</small></button>`).join('');
    fbox.addEventListener('click', (e) => {
      const b = e.target.closest('.filter'); if (!b) return;
      fbox.querySelectorAll('.filter').forEach((f) => { const on = f === b; f.classList.toggle('is-on', on); f.setAttribute('aria-pressed', on); });
      const k = b.dataset.k, shown = [];
      box.classList.toggle('is-all', k === 'all');
      box.querySelectorAll('.pcard').forEach((c) => { const on = k === 'all' || c.dataset.tags.split(' ').includes(k); c.classList.toggle('is-hidden', !on); if (on) shown.push(c); });
      if (!reduced) gsap.fromTo(shown, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
      ScrollTrigger.refresh();
    });
    if (!reduced) {
      const cards = [...box.children];
      gsap.set(cards, { y: 40, opacity: 0 });
      ScrollTrigger.batch(cards, { start: 'top 90%', once: true, onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08 }) });
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
         <a class="btn pj-live" href="${p.live}" target="_blank" rel="noopener"><span>OPEN FULL SCREEN</span><i class="go"><svg viewBox="0 0 24 24"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg></i></a></section>`
      : p.liveKind === 'site'
        ? `<section class="pj-live-frame"><a class="pj-device pj-site" href="${p.live}" target="_blank" rel="noopener"><img src="${p.cover.src}" alt="${p.title} website"><span class="btn btn-solid pj-live"><span>VISIT THE LIVE SITE</span><i class="go"><svg viewBox="0 0 24 24"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg></i></span></a></section>`
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
        <div class="pj-glow"></div>
        <div class="pj-head">
          <p class="eyebrow pj-no"><i class="bar"></i>${p.no} / ${String(PROJECTS.length).padStart(2, '0')} · ${p.kind}</p>
          <h2 class="t-anton pj-title" id="pj-title">${p.title}</h2>
          <ul class="pj-meta">${p.meta.map((m) => `<li>${m}</li>`).join('')}</ul>
        </div>
        <figure class="pj-cover"><img src="${p.cover.thumb || p.cover.src}" alt="${p.title}, cover"></figure>
        <img class="pj-planet" src="assets/theme/elements/red-planet.svg?v=100" alt="">
      </header>
      <section class="pj-body">
        <p class="eyebrow"><i class="bar"></i>ABOUT THE PROJECT</p><p class="pj-desc">${p.desc}</p>
      </section>
      ${live}
      <section class="pj-gallery"><p class="eyebrow"><i class="bar"></i>${p.groups ? 'SELECTED POSTS' : 'SCREENS & DETAILS'}</p>${gallery}</section>
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
      .from('.pj-cover', { y: 80, rotate: 4, opacity: 0, filter: 'blur(12px)', duration: 1.8, ease: 'expo.out' }, 0.1)
      .from('.pj-planet', { x: 120, opacity: 0, duration: 2.4, ease: 'expo.out' }, 0.2)
      .from('.pj-meta li', { y: 20, opacity: 0, filter: 'blur(6px)', duration: 1, ease: 'expo.out', stagger: 0.06 }, 0.5)
      .from('.pj-body > *', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.35);
    gsap.to(this.inner.querySelector('.pj-cover'), { y: -14, rotate: 1, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.8 });
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
