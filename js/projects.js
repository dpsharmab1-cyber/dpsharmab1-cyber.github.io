// Nine works as the Figma "stacked cards": ten black panels standing in
// perspective, a name under each. The panels rise into place as the section
// arrives and float a little; hovering one lifts it, lights its name and shows
// the work beside the pointer; a click opens its project page.
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/></svg>';
const NS = 'http://www.w3.org/2000/svg';
// label centres in the frame (artboard px)
const LAB_X = [-8, 154, 316, 478, 660, 856, 1052, 1248, 1444];

export class Cards {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.box = this.sec.querySelector('.cards');
    this.labWrap = this.sec.querySelector('.labels');
    this.peek = document.querySelector('.peek');
    this.page = new ProjectPage(app, this);
    this.labs = PROJECTS.map((p, i) => this.label(p, i));
    this.ready = this.build();
  }

  label(p, i) {
    const li = document.createElement('li');
    li.className = 'lab';
    li.style.setProperty('--x', LAB_X[i]);
    li.innerHTML = `<b>${p.title}</b><span>${p.kind}</span><button type="button" aria-label="Open ${p.title}">SEE MORE <i>${ARROW}</i></button>`;
    this.labWrap.append(li);
    li.querySelector('button').addEventListener('click', () => this.page.open(i, this.cardOf[i]?.el || null));
    li.addEventListener('pointerenter', () => this.hot(i, true));
    li.addEventListener('pointerleave', () => this.hot(i, false));
    return li;
  }

  async build() {
    try { this.box.innerHTML = await (await fetch('assets/cards.svg')).text(); } catch (e) { return; }
    const groups = [...this.box.querySelectorAll('.card')];
    this.cards = groups.map((el) => {
      // outer: entrance; hov: hover lift; flo: idle float
      const hov = document.createElementNS(NS, 'g'), flo = document.createElementNS(NS, 'g');
      while (el.firstChild) flo.append(el.firstChild);
      hov.append(flo); el.append(hov);
      const b = el.getBBox();
      const cx = b.x + b.width / 2;
      let i = 0, best = 1e9;
      LAB_X.forEach((x, k) => { if (Math.abs(x - cx) < best) { best = Math.abs(x - cx); i = k; } });
      return { el, hov, flo, cx, i };
    });
    this.cardOf = {};
    for (const c of this.cards) if (!this.cardOf[c.i] || Math.abs(LAB_X[c.i] - c.cx) < Math.abs(LAB_X[c.i] - this.cardOf[c.i].cx)) this.cardOf[c.i] = c;
    for (const c of this.cards) {
      c.el.setAttribute('role', 'button');
      c.el.setAttribute('tabindex', '0');
      c.el.setAttribute('aria-label', `Open ${PROJECTS[c.i].title}`);
      c.el.addEventListener('pointerenter', () => this.hot(c.i, true, c));
      c.el.addEventListener('pointerleave', () => this.hot(c.i, false, c));
      c.el.addEventListener('click', () => this.page.open(c.i, c.el));
      c.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.page.open(c.i, c.el); } });
      gsap.to(c.flo, { y: -6 - Math.random() * 6, duration: 2.6 + Math.random() * 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: Math.random() * 2 });
    }
    // rise in from the floor, the middle first; sink back on the way out
    const order = [...this.cards].sort((a, b) => Math.abs(a.cx - 756) - Math.abs(b.cx - 756)).map((c) => c.el);
    gsap.set(order, { y: 260, opacity: 0 });
    const labs = this.labs;
    gsap.set(labs, { y: 24, opacity: 0 });
    const show = () => { gsap.to(order, { y: 0, opacity: 1, duration: 1.5, ease: 'expo.out', stagger: 0.07, overwrite: true }); gsap.to(labs, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.04, delay: 0.4, overwrite: true }); };
    const hide = (dir) => { gsap.to(order, { y: 200 * dir, opacity: 0, duration: 0.7, ease: 'expo.in', stagger: 0.03, overwrite: true }); gsap.to(labs, { y: 20 * dir, opacity: 0, duration: 0.5, ease: 'expo.in', overwrite: true }); };
    ScrollTrigger.create({ trigger: this.sec, start: 'top 65%', end: 'bottom 20%', onEnter: show, onEnterBack: show, onLeave: () => hide(-1), onLeaveBack: () => hide(1) });
    // the work follows the pointer over the cards
    addEventListener('pointermove', (e) => { this.px = e.clientX; this.py = e.clientY; });
    gsap.ticker.add(() => {
      if (!this.peekOn) return;
      this.qx = (this.qx ?? this.px) + (this.px - (this.qx ?? this.px)) * 0.16;
      this.qy = (this.qy ?? this.py) + (this.py - (this.qy ?? this.py)) * 0.16;
      this.peek.style.transform = `translate3d(${(this.qx + 28).toFixed(1)}px, ${(this.qy - 190).toFixed(1)}px, 0)`;
    });
  }

  hot(i, on, card) {
    this.labs.forEach((l, k) => l.classList.toggle('is-hot', on && k === i));
    const c = card || this.cardOf?.[i];
    if (c) { c.el.classList.toggle('is-hot', on); gsap.to(c.hov, { y: on ? -22 : 0, duration: on ? 0.7 : 0.9, ease: on ? 'expo.out' : 'elastic.out(1, .6)', overwrite: true }); }
    if (!matchMedia('(pointer: fine)').matches) return;
    if (card) {
      this.app.cursor?.state(on ? 'big' : null, on ? 'OPEN' : '');
      if (on) { const p = PROJECTS[i]; this.peek.querySelector('img').src = p.cover.thumb || p.cover.src; this.qx = this.px; this.qy = this.py; }
      this.peekOn = on;
      this.peek.classList.toggle('is-on', on);
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
    const imgs = p.images;
    const figs = imgs.slice(1).map((im, k) => {
      const tall = im.h > im.w * 1.15;
      const cls = imgs.length > 3 && k % 5 === 0 && !tall ? 'wide' : tall ? 'third' : '';
      return `<figure class="${cls}"><img src="${im.src}" width="${im.w}" height="${im.h}" alt="${p.title}, image ${k + 2}" loading="lazy" decoding="async"></figure>`;
    }).join('');
    this.inner.innerHTML = `
      <header class="pj-hero">
        <img class="pj-hero-img" src="${p.cover.src}" alt="">
        <div class="pj-head">
          <p class="pj-no">${p.no} / ${String(PROJECTS.length).padStart(2, '0')}</p>
          <h2 class="t-anton pj-title" id="pj-title">${p.title}</h2>
          <p class="pj-sub">${p.kind}</p>
        </div>
      </header>
      <section class="pj-body">
        <ul class="pj-meta">${p.meta.map((m) => `<li>${m}</li>`).join('')}</ul>
        <div><p class="pj-desc">${p.desc}</p>
          ${p.live ? `<a class="pill-btn dark-pill pj-live" href="${p.live}" target="_blank" rel="noopener"><span>${p.liveLabel.toUpperCase()}</span><i class="pill-arrow"><svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></i></a>` : ''}
        </div>
      </section>
      <section class="pj-gallery">${figs || `<figure class="wide"><img src="${p.cover.src}" alt="${p.title}"></figure>`}</section>
      <a class="pj-next" href="#work/${next.id}" data-next="${(i + 1) % PROJECTS.length}"><small>NEXT PROJECT</small><b>${next.title}</b></a>`;
    this.inner.querySelector('.pj-next').addEventListener('click', (e) => { e.preventDefault(); this.swap((i + 1) % PROJECTS.length); });
    this.inner.querySelectorAll('.pj-gallery figure').forEach((f) => f.addEventListener('click', () => {
      this.zoom.querySelector('img').src = f.querySelector('img').src;
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
      gsap.fromTo(e.target, { clipPath: 'inset(18% 6% 18% 6% round 6px)' }, { clipPath: 'inset(0% 0% 0% 0% round 6px)', duration: 1.3, ease: 'expo.out' });
      gsap.fromTo(e.target.querySelector('img'), { scale: 1.25 }, { scale: 1, duration: 1.6, ease: 'expo.out' });
    }), { root: this.scroller, threshold: 0.08 });
    this.inner.querySelectorAll('.pj-gallery figure').forEach((f) => { f.style.clipPath = 'inset(18% 6% 18% 6% round 6px)'; this.io.observe(f); });
  }

  intro() {
    const title = this.inner.querySelector('.pj-title');
    const split = SplitText.create(title, { type: 'chars,lines', mask: 'lines' });
    const tl = gsap.timeline();
    tl.from(split.chars, { yPercent: 115, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: 0.025 })
      .from('.pj-no, .pj-sub', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.15)
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
