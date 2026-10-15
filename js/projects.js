// The nine works as books standing on a shelf: the project's image is the
// cover, a red spine carries its title, cream page edges show on the other
// side. On wide screens the shelf runs the full width; drag with the mouse or
// swipe (it loops both ways, with a little inertia), or use the arrow keys.
// The books nearest the centre turn to face you and stay sharp; the rest turn
// their spines out, step back and blur. On phones the books stand one under
// another and turn to face you as each one reaches the middle of the screen.
// A click opens the project page.
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg>';
const fine = matchMedia('(pointer: fine)').matches;
const portrait = () => document.documentElement.classList.contains('portrait');

export class Cards {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.box = this.sec.querySelector('.cards');
    this.page = new ProjectPage(app, this);
    this.n = PROJECTS.length;
    this.c = 0; this.goal = 0; this.vel = 0;
    this.rise = { v: 0 };
    this.items = PROJECTS.map((p, i) => this.build(p, i));
    this.bindDrag();
    new IntersectionObserver(([e]) => { this.away = !e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(this.sec);
    ScrollTrigger.create({ trigger: this.sec, start: 'top 70%', end: 'bottom 15%',
      onEnter: () => gsap.to(this.rise, { v: 1, duration: 1.8, ease: 'expo.out', overwrite: true }),
      onEnterBack: () => gsap.to(this.rise, { v: 1, duration: 1.4, ease: 'expo.out', overwrite: true }),
      onLeave: () => { if (!portrait()) gsap.to(this.rise, { v: 0, duration: 0.8, ease: 'expo.in', overwrite: true }); },
      onLeaveBack: () => { if (!portrait()) gsap.to(this.rise, { v: 0, duration: 0.8, ease: 'expo.in', overwrite: true }); } });
    this.measure();
    addEventListener('resize', () => setTimeout(() => this.measure(), 60));
    gsap.ticker.add((t, dt) => this.update(Math.min(0.05, dt / 1000)));
  }

  build(p, i) {
    const bk = document.createElement('div');
    bk.className = 'bk';
    const cover = p.groups
      // social: one book, its cover a collage of several clients' posts
      ? `<div class="bk-cover collage">${p.groups.slice(0, 5).map((g) => `<img src="${g.images[0].thumb || g.images[0].src}" alt="" loading="lazy" decoding="async">`).join('')}</div>`
      : `<div class="bk-cover"><img src="${p.cover.thumb || p.cover.src}" alt="" loading="lazy" decoding="async"></div>`;
    bk.innerHTML = `<div class="book" tabindex="0" role="button" aria-label="${p.title}, ${p.kind}. Open project">
        <div class="bk-face bk-front">${cover}<b class="bk-no">${p.no}</b></div>
        <div class="bk-face bk-back"></div>
        <div class="bk-face bk-spine"><span>${p.title}</span><i>${p.no}</i></div>
        <div class="bk-face bk-pages"></div>
        <div class="bk-face bk-top"></div>
      </div>
      <div class="lab"><b>${p.title}</b><span>${p.kind}</span><button type="button" class="pill pill-light btn" tabindex="-1"><span>SEE MORE</span><i class="dot">${ARROW}</i></button></div>`;
    this.box.append(bk);
    const book = bk.querySelector('.book'), lab = bk.querySelector('.lab');
    const it = { p, i, bk, book, lab, last: {} };
    const open = () => { if (!this.dragged) this.page.open(i, bk.querySelector('.bk-cover')); };
    book.addEventListener('click', () => {
      // a book off to the side comes to the centre first
      const d = this.rel(i);
      if (!portrait() && Math.abs(d) > 0.6 && !this.dragged) { this.goal = this.c + d; return; }
      open();
    });
    book.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    lab.querySelector('button').addEventListener('click', open);
    book.addEventListener('pointerenter', () => { if (fine && (portrait() || Math.abs(this.rel(i)) < 0.6)) this.app.cursor?.state('big', 'OPEN'); });
    book.addEventListener('pointerleave', () => this.app.cursor?.state());
    return it;
  }

  rel(i) { const n = this.n; return ((((i - this.c + n / 2) % n) + n) % n) - n / 2; }

  // phones: where each book sits in the page, so the scroll alone places them
  measure() {
    const y = this.app.lenis?.animatedScroll || scrollY;
    for (const it of this.items) { it.bk.style.transform = ''; const r = it.bk.getBoundingClientRect(); it.top = r.top + y; it.h = r.height; it.last = {}; }
  }

  bindDrag() {
    let sx = 0, sc = 0, down = false, lx = 0, lt = 0;
    const px = () => (this.app.scale || 1) * 230;            // screen px per book
    this.box.addEventListener('pointerdown', (e) => { if (portrait()) return; down = true; this.dragged = false; sx = lx = e.clientX; lt = performance.now(); sc = this.c; this.vel = 0; });
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
      if (this.dragged) this.goal = Math.round(this.c + gsap.utils.clamp(-4, 4, this.vel * 0.18));
      setTimeout(() => { this.dragged = false; }, 0);
    });
    this.sec.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.goal = Math.round(this.goal) + 1;
      if (e.key === 'ArrowLeft') this.goal = Math.round(this.goal) - 1;
    });
  }

  update(dt) {
    if (this.away) return;
    if (portrait()) return this.updatePhone();
    this.c += (this.goal - this.c) * (1 - Math.exp(-dt * 6));
    const rise = this.rise.v;
    // the shelf reaches the screen edges: outer books spread to fill it
    const half = 756 - (this.app.x0 || 0);
    const side = Math.max(150, (half - 360 - 90) / 3.4);
    for (const it of this.items) {
      const p = this.rel(it.i), ap = Math.abs(p), sg = Math.sign(p) || 1;
      const x = ap <= 1 ? p * 360 : sg * (360 + (ap - 1) * side);
      const ang = ap <= 1 ? -p * 24 : -sg * (24 + Math.min(1, ap - 1) * 46);
      const z = -Math.pow(ap, 1.2) * 120;
      const r = Math.min(1, Math.max(0, rise * 1.6 - ap * 0.12));
      const y = (1 - r) * (1 - r) * 420;
      const blur = Math.round(Math.max(0, ap - 1.15) * 5) / 2;
      const vis = ap < 4.7 && r > 0.001;
      const L = it.last;
      if (L.vis !== vis) { it.bk.style.visibility = vis ? '' : 'hidden'; L.vis = vis; }
      if (!vis) continue;
      it.bk.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`;
      it.book.style.transform = `rotateY(${ang.toFixed(2)}deg)`;
      it.bk.style.opacity = (r * (1 - Math.max(0, ap - 3.6))).toFixed(3);
      if (L.blur !== blur) { it.book.style.filter = blur ? `blur(${blur}px)` : 'none'; L.blur = blur; }
      const zi = String(100 - Math.round(ap * 10));
      if (L.z !== zi) { it.bk.style.zIndex = zi; L.z = zi; }
      it.lab.style.opacity = Math.max(0, 1 - Math.max(0, ap - 0.55) * 1.6).toFixed(3);
    }
  }

  // phones: each book turns to face you as it reaches the middle of the screen
  updatePhone() {
    const y = this.app.lenis?.animatedScroll || scrollY, vh = innerHeight;
    for (const it of this.items) {
      const e = gsap.utils.clamp(-1, 1, (it.top + it.h * 0.45 - y - vh / 2) / vh);
      const ang = e * 38, tilt = -e * 6;
      const key = ang.toFixed(1);
      if (it.last.k === key) continue;
      it.last.k = key;
      it.book.style.transform = `rotateY(${key}deg) rotateX(${tilt.toFixed(2)}deg)`;
      it.bk.style.opacity = (1 - Math.max(0, Math.abs(e) - 0.55) * 1.2).toFixed(3);
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
      // social: one collage per client, tiles of mixed sizes
      gallery = p.groups.map((g) => `<section class="pj-group"><h3 class="eyebrow">${g.title} <small>${g.images.length}</small></h3>
        <div class="pj-collage">${g.images.map((im, k) => fig(im, k, (k % 7 === 0 ? 'big' : k % 5 === 3 ? 'tall' : ''))).join('')}</div></section>`).join('');
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
    this.reveals();
  }

  // gallery images unfold as they scroll into view
  reveals() {
    this.io?.disconnect();
    this.io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      this.io.unobserve(e.target);
      gsap.fromTo(e.target, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' });
    }), { root: this.scroller, threshold: 0.08 });
    this.inner.querySelectorAll('.pj-gallery figure, .pj-live-frame').forEach((f) => { f.style.opacity = 0; this.io.observe(f); });
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
