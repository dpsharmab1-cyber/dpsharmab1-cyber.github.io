// Nine works as tall black panels standing like blinds (Figma "Content
// projects"): as the section scrolls by, or when dragged, they slide past the
// centre where they turn edge-on; hover turns one to face you; a click expands
// it into its project page. Positions are artboard px (the board is scaled).
import Lenis from '../vendor/lenis.mjs';
import { PROJECTS } from './data.js';

const { gsap, ScrollTrigger, SplitText } = window;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6"/></svg>';

export class Projects {
  constructor(app) {
    this.app = app;
    this.sec = document.getElementById('projects');
    this.wrap = this.sec.querySelector('.blinds');
    this.labWrap = this.sec.querySelector('.labels');
    this.countEl = this.sec.querySelector('.proj-count');
    this.n = PROJECTS.length;
    this.c = 0.5;          // centre position (float); panels rest either side of it
    this.goal = 0.5;
    this.items = PROJECTS.map((p, i) => this.build(p, i));
    this.page = new ProjectPage(app, this);
    this.bindDrag();
    this.pin();
    // the panels rise out of the floor as the section arrives
    this.rise = { v: 0 };
    new IntersectionObserver(([e]) => { this.away = !e.isIntersecting; }).observe(this.sec);
    ScrollTrigger.create({ trigger: this.sec, start: 'top 75%',
      onEnter: () => gsap.to(this.rise, { v: 1, duration: 1.8, ease: 'expo.out', overwrite: true }),
      onLeaveBack: () => gsap.to(this.rise, { v: 0, duration: 0.8, ease: 'expo.in', overwrite: true }) });
  }

  build(p, i) {
    const el = document.createElement('div');
    el.className = 'blind';
    el.setAttribute('role', 'listitem');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `${p.no}. ${p.title}, ${p.kind}. Open project`);
    el.innerHTML = `<i class="blind-cap"></i><div class="blind-face"><img src="${p.cover.thumb || p.cover.src}" alt="" loading="lazy" decoding="async"><b class="blind-no">${p.no}</b></div><i class="blind-spine"></i><i class="blind-edge"></i>`;
    this.wrap.append(el);
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.innerHTML = `<b>${p.title}</b><span>${p.kind}</span><button type="button" tabindex="-1">SEE MORE <i>${ARROW}</i></button>`;
    this.labWrap.append(lab);
    const it = { p, i, el, lab, hot: 0, hotT: 0, img: el.querySelector('img'), spine: el.querySelector('.blind-spine'), edge: el.querySelector('.blind-edge') };
    el.addEventListener('pointerenter', () => { it.hotT = 1; el.classList.add('is-hot'); this.app.cursor?.state('big', 'VIEW'); });
    el.addEventListener('pointerleave', () => { it.hotT = 0; el.classList.remove('is-hot'); this.app.cursor?.state(); });
    const open = () => { if (!this.dragged) this.page.open(i, el.querySelector('.blind-face')); };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    lab.querySelector('button').addEventListener('click', open);
    return it;
  }

  // the scroll walks the panels past the centre while the section goes by
  pin() {
    const steps = this.n - 2;
    this.st = ScrollTrigger.create({
      trigger: this.wrap, start: 'top 85%', end: 'bottom 15%',
      onUpdate: (s) => { if (!this.dragging) this.goal = 0.5 + s.progress * steps; },
    });
  }

  bindDrag() {
    let sx = 0, sc = 0, down = false;
    const S = () => this.spacing();
    this.wrap.addEventListener('pointerdown', (e) => { down = true; this.dragged = false; sx = e.clientX; sc = this.goal; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) { this.dragged = true; this.dragging = true; }
      if (this.dragging) this.goal = Math.min(0.5 + this.n - 2, Math.max(0.5, sc - dx / (S() * (this.app.scale || 1))));
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (this.dragging) {
        // settle on a resting spot and move the page scroll to match
        this.goal = Math.round(this.goal - 0.5) + 0.5;
        const st = this.st, steps = this.n - 2;
        const y = st.start + ((this.goal - 0.5) / steps) * (st.end - st.start);
        this.app.lenis.scrollTo(y, { duration: 0.8 });
        setTimeout(() => { this.dragging = false; }, 850);
      }
      setTimeout(() => { this.dragged = false; }, 0);
    });
  }

  spacing() { return 190; }                      // artboard px between panels

  update(dt) {
    if (this.away) return;          // off screen: nothing to move
    const k = 1 - Math.exp(-dt * 7);
    this.c += (this.goal - this.c) * k;
    const S = this.spacing(), W = 1512;
    const theta = 71;
    let near = 0, best = 1e9;
    for (const it of this.items) {
      it.hot += (it.hotT - it.hot) * (1 - Math.exp(-dt * 9));
      // the row loops, so panels always stand on both sides of the centre
      const n = this.n;
      const p = ((((it.i - this.c + n / 2) % n) + n) % n) - n / 2;
      if (Math.abs(p) < best) { best = Math.abs(p); near = it.i; }
      const x = p * S;
      const side = Math.max(-1, Math.min(1, p / 0.55));
      const ang = -theta * side * (1 - it.hot * 0.82);
      const z = it.hot * 90 - Math.abs(p) * 6;
      const r = Math.min(1, Math.max(0, this.rise.v * 1.5 - Math.abs(p) * 0.08));
      const vis = Math.abs(x) < W * 0.62 + S && r > 0.001;
      it.el.style.visibility = vis ? '' : 'hidden';
      if (!vis) continue;
      const ry = (1 - r) * (1 - r) * 0.55 * this.wrap.offsetHeight;
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(ry - it.hot * 18).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(ang + (1 - r) * 30 * Math.sign(-p || 1)).toFixed(2)}deg)`;
      it.el.style.opacity = r.toFixed(3);
      it.el.style.zIndex = String(Math.round(Math.abs(p) * 10 + it.hot * 100));
      // the red spine is always on the panel's outer edge
      const outerLeft = p < 0;
      it.spine.style.left = outerLeft ? '0' : 'auto'; it.spine.style.right = outerLeft ? 'auto' : '0';
      it.edge.style.left = outerLeft ? 'auto' : '0'; it.edge.style.right = outerLeft ? '0' : 'auto';
      const ap = Math.abs(p);
      const blur = Math.max(0, ap - 0.6) * 2.2;
      it.lab.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      it.lab.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      const fall = document.documentElement.classList.contains('portrait') ? 1.4 : 0.18;   // phones: only the centre names
      it.lab.style.opacity = String(Math.max(0, 1 - Math.max(0, ap - 0.6) * fall));
    }
    const label = `${String(near + 1).padStart(2, '0')} / ${String(this.n).padStart(2, '0')}`;
    if (this.countEl.textContent !== label) this.countEl.textContent = label;
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
