// The nine works as the frame's fan of cards: each card wears one of the
// frame's space posters and carries a project's name below; the middle one
// stands tallest. Drag with the mouse or swipe and the
// projects slide from place to place around the fan, looping both ways; a
// card off to the side comes to the middle when clicked, the middle one opens
// its project page. Wide screens use the frame's exact card places; tablets
// and phones a closer fan sized to the screen.
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js?v=80';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/></svg>';
const fine = matchMedia('(pointer: fine)').matches;
// the frame's cards (frame 2 px): left, top, width, height, tilt; each turns about its bottom middle
const SLOTS = [[-99, 1881, 182, 273, -8.8], [53, 1893, 202, 303, -6.6], [205, 1893, 222, 333, -4.4], [357, 1881, 242, 363, -2.2], [529, 1857, 262, 393, 0],
  [735, 1881, 242, 363, 2.2], [941, 1893, 222, 333, 4.4], [1147, 1893, 202, 303, 6.6], [1353, 1881, 182, 273, 8.8]]
  .map(([x, y, w, h, r]) => ({ px: x + w / 2, py: y + h, s: w / 262, r }));
const lerp = (a, b, t) => a + (b - a) * t;
// which poster each card wears, left to right as in the frame
const POSTER = [3, 5, 1, 0, 2, 4, 1, 3, 5];

export class Cards {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.box = this.sec.querySelector('.cards');
    this.page = new ProjectPage(app, this);
    this.n = PROJECTS.length;
    this.c = 0; this.goal = 0; this.vel = 0; this.rise = { v: 0 };
    this.items = PROJECTS.map((p, i) => this.build(p, i));
    this.size();
    addEventListener('resize', () => this.size());
    this.bind();
    new IntersectionObserver(([e]) => { this.away = !e.isIntersecting; }, { rootMargin: '15% 0px' }).observe(this.box);
    ScrollTrigger.create({ trigger: this.box, start: 'top 85%', end: 'bottom 5%',
      onEnter: () => gsap.to(this.rise, { v: 1, duration: 2, ease: 'expo.out', overwrite: true }),
      onEnterBack: () => gsap.to(this.rise, { v: 1, duration: 1.6, ease: 'expo.out', overwrite: true }),
      onLeave: () => gsap.to(this.rise, { v: 0, duration: 0.9, ease: 'power3.in', overwrite: true }),
      onLeaveBack: () => gsap.to(this.rise, { v: 0, duration: 0.9, ease: 'power3.in', overwrite: true }) });
    gsap.ticker.add((t, dt) => this.update(Math.min(0.05, dt / 1000), t));
  }

  build(p, i) {
    const el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('role', 'listitem');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `${p.title}, ${p.kind}. Open project`);
    // the card faces are the frame's space posters (in the frame's order)
    const inner = `<div class="card-in"><img src="assets/v8/poster-${POSTER[(i + 4) % POSTER.length]}.webp?v=80" alt="" loading="lazy" decoding="async"></div>`;
    el.innerHTML = `${inner}<i class="card-edge"></i><b class="card-no">${p.no}</b>`;
    this.box.append(el);
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.innerHTML = `<b>${p.title}</b><span>${p.kind}</span><button type="button" tabindex="-1">SEE MORE <i>${ARROW}</i></button>`;
    this.box.append(lab);
    const it = { p, i, el, lab, last: {} };
    const open = () => { if (!this.dragged) this.page.open(i, null); };
    el.addEventListener('click', () => {
      const d = this.rel(i);
      if (Math.abs(d) > 0.5 && !this.dragged) { this.goal = this.c + d; return; }
      open();
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    lab.querySelector('button').addEventListener('click', open);
    el.addEventListener('pointerenter', () => { if (fine) this.app.cursor?.state('big', Math.abs(this.rel(i)) < 0.5 ? 'OPEN' : 'VIEW'); });
    el.addEventListener('pointerleave', () => this.app.cursor?.state());
    return it;
  }

  rel(i) { const n = this.n; return ((((i - this.c + n / 2) % n) + n) % n) - n / 2; }

  // the base card box: the frame's middle card, or one sized to the screen
  size() {
    this.flow = this.app.flow;
    if (this.flow) {
      const W = this.box.clientWidth;
      this.W = W;
      this.bw = Math.min(W * 0.56, 360); this.bh = this.bw * 1.5;
    } else { this.bw = 262; this.bh = 393; }
    for (const it of this.items) { it.el.style.width = this.bw + 'px'; it.el.style.height = this.bh + 'px'; it.last = {}; }
  }

  // where a card sits for an offset o from the middle (continuous)
  place(o) {
    if (!this.flow) {
      const k = o + 4, i = Math.floor(k), f = k - i;
      const get = (j) => {
        if (j < 0) { const a = SLOTS[0], b = SLOTS[1]; return { px: a.px - (b.px - a.px) * -j, py: a.py - 10 * -j, s: a.s * 0.9 ** -j, r: a.r - 2.2 * -j }; }
        if (j > 8) { const a = SLOTS[8], b = SLOTS[7]; return { px: a.px + (a.px - b.px) * (j - 8), py: a.py - 10 * (j - 8), s: a.s * 0.9 ** (j - 8), r: a.r + 2.2 * (j - 8) }; }
        return SLOTS[j];
      };
      const A = get(i), B = get(i + 1);
      return { px: lerp(A.px, B.px, f), py: lerp(A.py, B.py, f), s: lerp(A.s, B.s, f), r: lerp(A.r, B.r, f) };
    }
    const W = this.W, a = Math.abs(o), sg = Math.sign(o) || 1;
    const dx = 0.38 * W * Math.min(a, 1) + 0.24 * W * Math.max(0, Math.min(a, 2) - 1) + 0.3 * W * Math.max(0, a - 2);
    const s = 1 - 0.22 * Math.min(a, 2) - 0.08 * Math.max(0, a - 2);
    return { px: W / 2 + sg * dx, py: 40 + this.bh, s, r: o * 6 };
  }

  bind() {
    let sx = 0, sc = 0, down = false, lx = 0, lt = 0;
    const px = () => (this.flow ? this.W * 0.38 : 162 * (this.app.scale || 1));
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
      if (e.key === 'ArrowRight') this.goal = Math.round(this.goal) + 1;
      if (e.key === 'ArrowLeft') this.goal = Math.round(this.goal) - 1;
    });
  }

  update(dt, t) {
    if (this.away) return;
    this.c += (this.goal - this.c) * (1 - Math.exp(-dt * 5.5));
    const rise = this.rise.v;
    for (const it of this.items) {
      const o = this.rel(it.i), a = Math.abs(o);
      const g = this.place(o);
      const r = Math.min(1, Math.max(0, rise * 1.6 - a * 0.1));
      const drop = (1 - r) * (1 - r) * 340;
      const bob = Math.sin(t * 0.9 + it.i) * 3;
      const fade = this.flow ? Math.max(0, Math.min(1, (2.6 - a) * 1.5)) : Math.max(0, Math.min(1, (4.45 - a) * 3));
      const L = it.last;
      it.el.style.transform = `translate3d(${(g.px - this.bw / 2).toFixed(1)}px,${(g.py - this.bh + drop + bob).toFixed(1)}px,0) rotate(${(g.r + (1 - r) * 8 * Math.sign(o || 1)).toFixed(2)}deg) scale(${g.s.toFixed(4)})`;
      it.el.style.opacity = (r * fade).toFixed(3);
      const z = String(100 - Math.round(a * 10));
      if (L.z !== z) { it.el.style.zIndex = z; L.z = z; }
      const centre = a < 0.5;
      if (L.c !== centre) { it.el.classList.toggle('is-centre', centre); it.lab.classList.toggle('is-centre', centre); L.c = centre; }
      if (this.flow) {
        it.lab.style.transform = `translate3d(${(this.W / 2).toFixed(1)}px,${(this.bh + 70).toFixed(1)}px,0)`;
        it.lab.style.opacity = (r * Math.max(0, 1 - a * 2.2)).toFixed(3);
      } else {
        it.lab.style.transform = `translate3d(${g.px.toFixed(1)}px,${(drop * 0.3).toFixed(1)}px,0)`;
        it.lab.style.opacity = (r * fade).toFixed(3);
      }
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
