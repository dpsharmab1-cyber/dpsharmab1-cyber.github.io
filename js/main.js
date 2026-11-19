// Portfolio 2026 · Red Planet (v11). A fluid page built from the asset pack
// (assets/theme). GSAP drives the motion, Lenis the scroll. Every reveal
// plays once, so nothing disappears while you read it.
import Lenis from '../vendor/lenis.mjs';
import { Cards, Grid } from './projects.js?v=110';

const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = (window.__v8 = {});
const root = document.documentElement;
const V = root.dataset.v || '1';
app.small = () => innerWidth < 960;

// ---------------------------------------------------------------- scroll
const lenis = (app.lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, anchors: false }));
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
const docY = (el) => el.getBoundingClientRect().top + (lenis.animatedScroll || scrollY);
app.docY = docY;

// ---------------------------------------------------------------- the sky
// sparse stars that breathe and drift with the scroll; now and then a slow
// shooting star. One small canvas behind everything; paper covers it.
class Sky {
  constructor(c) {
    this.c = c; this.g = c.getContext('2d'); this.alpha = 0; this.shoot = null; this.next = 4;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.c.width = this.w * dpr; this.c.height = this.h * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((this.w * this.h) / 9000);
    this.s = Array.from({ length: n }, () => ({ x: Math.random() * this.w, y: Math.random() * this.h, r: Math.random() * 0.9 + 0.3, z: Math.random(), p: Math.random() * 6.3, sp: 0.4 + Math.random() * 1.2, warm: Math.random() < 0.18 }));
  }
  frame(t, dt, scroll) {
    const g = this.g, W = this.w, H = this.h;
    const ds = this.last == null ? 0 : scroll - this.last; this.last = scroll;
    g.clearRect(0, 0, W, H);
    if (this.alpha < 0.01) return;
    for (const s of this.s) {
      s.y -= ds * (0.04 + s.z * 0.12); s.x += dt * (1 + s.z * 3);
      if (s.y < -4) s.y += H + 8; else if (s.y > H + 4) s.y -= H + 8;
      if (s.x > W + 4) s.x -= W + 8;
      const tw = 0.45 + 0.55 * Math.sin(t * s.sp + s.p) ** 2;
      g.globalAlpha = this.alpha * tw * (0.35 + s.z * 0.65);
      g.fillStyle = s.warm ? '#ffe0b5' : '#fff';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill();
    }
    this.next -= dt;
    if (!this.shoot && this.next <= 0 && !reduced) this.shoot = { x: Math.random() * W * 0.6, y: H * 0.25 + Math.random() * H * 0.4, life: 0, len: 120 + Math.random() * 120 };
    if (this.shoot) {
      const sh = this.shoot; sh.life += dt;
      const k = sh.life / 1.3, x = sh.x + k * 380, y = sh.y - k * 160;
      const tx = x - sh.len, ty = y + sh.len * 0.42;
      const grad = g.createLinearGradient(x, y, tx, ty);
      grad.addColorStop(0, 'rgba(255,224,181,.95)'); grad.addColorStop(1, 'rgba(255,224,181,0)');
      g.globalAlpha = this.alpha * Math.sin(Math.min(1, k) * Math.PI);
      g.strokeStyle = grad; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fill();
      if (k >= 1) { this.shoot = null; this.next = 6 + Math.random() * 8; }
    }
    g.globalAlpha = 1;
  }
}
const sky = new Sky($('#sky'));
gsap.ticker.add((t, dt) => sky.frame(t, Math.min(0.05, dt / 1000), lenis.animatedScroll || scrollY));

// ---------------------------------------------------------------- reveals (once)
function rise(targets, trigger, { stagger = 0.03, duration = 1.25, start = 'top 85%', from = 110 } = {}) {
  if (!targets?.length) return;
  if (reduced) return;
  gsap.set(targets, { yPercent: from, opacity: 0 });
  ScrollTrigger.create({ trigger, start, once: true, onEnter: () => gsap.to(targets, { yPercent: 0, opacity: 1, duration, ease: 'expo.out', stagger }) });
}
function pops(targets, trigger, { start = 'top 88%', stagger = 0.06 } = {}) {
  if (!targets?.length || reduced) return;
  gsap.set(targets, { y: 34, opacity: 0 });
  ScrollTrigger.create({ trigger, start, once: true, onEnter: () => gsap.to(targets, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger }) });
}
const split = (el, type) => {
  const s = SplitText.create(el, type === 'chars' ? { type: 'chars,lines', mask: 'lines', linesClass: 'split-line', charsClass: 'split-char' }
    : type === 'lines' ? { type: 'lines', mask: 'lines', linesClass: 'split-line' } : { type: 'words', mask: 'words', wordsClass: 'split-word' });
  return type === 'chars' ? s.chars : type === 'lines' ? s.lines : s.words;
};

// ---------------------------------------------------------------- nav
const nav = $('#nav'), mark = $('.nav-mark'), links = $$('[data-nav]', nav);
const secs = ['landing', 'about', 'services', 'work', 'projects', 'connect', 'contact', 'footer'].map((id) => document.getElementById(id));
const navMap = { landing: 'landing', about: 'about', services: 'services', work: 'work', projects: 'work', connect: 'contact', contact: 'contact', footer: 'contact' };
let secTops = [], paper = [];
const measure = () => {
  secTops = secs.map((el) => ({ el, top: docY(el) }));
  paper = $$('[data-surface="paper"]').map((el) => { const y = docY(el); return [y - 30, y + el.offsetHeight + 20]; });
};
const moveMark = (a) => {
  if (!a || !a.closest('.nav-pill')) { mark.style.opacity = 0; return; }
  mark.style.opacity = 1; mark.style.left = a.offsetLeft + 'px'; mark.style.width = a.offsetWidth + 'px';
};
gsap.ticker.add(() => {
  if (!secTops.length) return;
  const sy = lenis.animatedScroll || scrollY;
  const y = sy + innerHeight * 0.4;
  let cur = secTops[0].el;
  for (const s of secTops) if (y >= s.top) cur = s.el;
  if (cur !== app.navSec) {
    app.navSec = cur;
    const key = navMap[cur.id];
    links.forEach((a) => { const on = a.dataset.nav === key; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    moveMark(links.find((a) => a.dataset.nav === key));
  }
  const ny = sy + 40;
  const on = paper.some(([a, b]) => ny >= a && ny <= b);
  if (on !== app.onPaper) { app.onPaper = on; nav.classList.toggle('on-paper', on); }
});
let lastY = 0;
lenis.on('scroll', (l) => {
  const y = l.animatedScroll, d = y - lastY;
  if (Math.abs(d) > 8) { nav.classList.toggle('is-tucked', d > 0 && y > innerHeight * 0.8); lastY = y; }
});
const burger = $('.nav-burger'), menu = $('#menu');
const closeMenu = () => { root.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-hidden', 'true'); lenis.start(); };
burger.addEventListener('click', () => {
  const open = !root.classList.contains('menu-open');
  root.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  if (open) { lenis.stop(); gsap.fromTo('.menu a', { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.15 }); } else lenis.start();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) closeMenu(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.matches('.pj-next')) return;
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  if (root.classList.contains('menu-open')) closeMenu();
  lenis.scrollTo(t.id === 'landing' ? 0 : docY(t) - 20, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
});

// ---------------------------------------------------------------- cursor
class Cursor {
  constructor() {
    this.el = $('.cursor'); this.dot = $('.cursor-dot'); this.ring = $('.cursor-ring'); this.lab = $('.cursor-label');
    this.x = this.y = this.rx = this.ry = -100;
    if (!fine || reduced) return;
    root.classList.add('has-cursor');
    addEventListener('pointermove', (e) => { this.x = e.clientX; this.y = e.clientY; }, { passive: true });
    const hot = 'a, button, .chips li, input, textarea';
    document.addEventListener('pointerover', (e) => { if (!this.forced && e.target.closest(hot)) this.el.classList.add('is-link'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest(hot)) this.el.classList.remove('is-link'); });
    gsap.ticker.add(() => {
      this.rx += (this.x - this.rx) * 0.16; this.ry += (this.y - this.ry) * 0.16;
      this.dot.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.ring.style.transform = `translate3d(${this.rx}px,${this.ry}px,0)`;
    });
  }
  state(kind, label = '') { this.forced = !!kind; this.el.classList.toggle('is-big', kind === 'big'); this.el.classList.remove('is-link'); this.lab.textContent = label; }
}
app.cursor = new Cursor();
function magnet(el) {
  if (!fine || reduced) return;
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.16, y: (e.clientY - r.top - r.height / 2) * 0.28, duration: 0.6, ease: 'power3.out' }); });
  el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .45)' }));
}

// ---------------------------------------------------------------- splash
function splash(imgs) {
  const el = $('#splash'), pc = $('.sp-pc', el);
  const shown = { v: 0 }; let done = 0;
  const total = imgs.length || 1;
  const step = () => { done++; };
  imgs.forEach((im) => { if (im.complete) step(); else { im.addEventListener('load', step, { once: true }); im.addEventListener('error', step, { once: true }); } });
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      const goal = Math.min(100, (done / total) * 100);
      shown.v += (goal - shown.v) * 0.12;
      if (goal >= 100 && shown.v > 99.4) shown.v = 100;
      pc.textContent = Math.round(shown.v);
      el.style.setProperty('--p', shown.v.toFixed(1));
      if ((shown.v >= 100 && performance.now() - t0 > 1100) || performance.now() - t0 > 7000) {
        gsap.ticker.remove(tick);
        gsap.timeline({ onComplete: () => el.remove() })
          .to('.sp-name, .sp-sub', { y: -16, opacity: 0, filter: 'blur(8px)', duration: 0.6, ease: 'power3.in', stagger: 0.05 }, 0)
          .to('.sp-orb', { scale: 1.6, opacity: 0, filter: 'blur(10px)', duration: 0.9, ease: 'power3.in' }, 0.1)
          .add(res, 0.55)
          .to(el, { clipPath: 'circle(0% at 50% 50%)', duration: 1.3, ease: 'expo.inOut' }, 0.45);
      }
    };
    gsap.ticker.add(tick);
  });
}

// ---------------------------------------------------------------- build
async function boot() {
  try { await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('600 20px Montserrat'), document.fonts.ready]); } catch (e) {}
  const planet = $('.hero-planet'), saturn = $('.saturn');
  await splash([planet]);

  // the footer emblem: two mantra rings turning against each other round the star
  try {
    $('.mantra').innerHTML = await (await fetch(`assets/v10/mantra.svg?v=${V}`)).text();
    const st = new Image(); st.src = `assets/theme/elements/mantra-star.svg?v=${V}`; st.alt = ''; st.className = 'mantra-star'; $('.mantra').append(st);
    if (!reduced) {
      gsap.to(st, { rotation: -360, duration: 160, ease: 'none', repeat: -1 });
      gsap.to('.mantra .ring-outer', { rotation: 360, svgOrigin: '756 2236', duration: 120, ease: 'none', repeat: -1 });
      gsap.to('.mantra .ring-inner', { rotation: -360, svgOrigin: '756 2236', duration: 90, ease: 'none', repeat: -1 });
    }
  } catch (e) {}

  // projects: the corridor and the grid
  app.cards = new Cards(app);
  app.grid = new Grid(app, app.cards.page);

  // splits (after layout is final)
  const chars = (sel) => $(sel) && split($(sel), 'chars');
  const words = $$('[data-reveal="words"]').map((el) => [el, split(el, 'words')]);
  const lines = $$('[data-reveal="lines"]').map((el) => [el, split(el, 'lines')]);
  const heads = $$('[data-split]').map((el) => [el, split(el, 'chars')]);

  // the landing: the red-ringed world swings in, the title rises, the rest follows
  if (!reduced) {
    gsap.set('.pf-l > span', { yPercent: 105 });
    gsap.set('#landing .pop', { y: 24, opacity: 0 });
    gsap.set(planet, { opacity: 0, scale: 0.92, rotation: -8, transformOrigin: '62% 42%' });
  }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(sky, { alpha: 1, duration: 2.4, ease: 'power1.out' }, 0);
  if (!reduced) {
    tl.to(planet, { opacity: 1, scale: 1, rotation: 0, duration: 2.6, ease: 'power3.out' }, 0.1)
      .to('.pf-l > span', { yPercent: 0, duration: 1.5, stagger: 0.08 }, 0.35)
      .to('#landing .pop', { y: 0, opacity: 1, duration: 1.2, stagger: 0.07 }, 0.9);
    // the worlds float, sway and drift with the scroll
    gsap.to(planet, { y: '+=14', duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.7 });
    gsap.to(planet, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '#landing', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo(saturn, { rotation: -1.2 }, { rotation: 1.2, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo(saturn, { yPercent: 10, scale: 0.94 }, { yPercent: -6, scale: 1, ease: 'none', scrollTrigger: { trigger: '#work', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  tl.add(() => { root.classList.remove('is-loading'); lenis.start(); measure(); app.afterIntro?.(); }, 0.6);

  // type, section by section
  heads.forEach(([el, c]) => rise(c, el, { stagger: el.classList.contains('work-title') ? 0.08 : 0.035, duration: 1.3 }));
  words.forEach(([el, w]) => rise(w, el, { stagger: 0.05, from: 100 }));
  lines.forEach(([el, l]) => rise(l, el, { stagger: 0.08, from: 100 }));
  pops($$('.facts li'), '.facts');
  pops($$('.xp-list li'), '.xp-list', { stagger: 0.07 });
  pops($$('.svc'), '.svc-grid', { stagger: 0.1 });
  pops($$('.cn-btn'), '.cn-btn', { start: 'top 95%' });
  pops($$('.contact-card, .contact-form'), '.contact-grid', { start: 'top 75%', stagger: 0.12 });
  pops($$('.foot-grid > *'), '.foot-grid', { start: 'top 95%' });
  if (!reduced) gsap.from('.mantra', { scale: 0.85, opacity: 0, rotation: -20, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: '.mantra', start: 'top 85%', once: true } });
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
    if (reduced) return;
    ScrollTrigger.create({ trigger: el, start: 'top 95%', once: true, onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.8, delay: 0.9, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
  });

  // marquee: an endless, unhurried run that leans on the scroll speed
  const track = $('.mq-track');
  const unit = track.innerHTML, unitW = track.scrollWidth;
  while (track.scrollWidth < track.parentElement.offsetWidth + unitW * 2) track.insertAdjacentHTML('beforeend', unit);
  let mx = -unitW * 0.4, boost = 0;
  lenis.on('scroll', (l) => { boost = Math.min(5, Math.abs(l.velocity) * 0.2); });
  gsap.ticker.add((t, dt) => { if (reduced) return; boost *= 0.94; mx -= (0.7 + boost) * (dt / 16.7); if (mx < -unitW) mx += unitW; track.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`; });

  $$('.btn, .nav-contact, .topic').forEach(magnet);
  measure();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { ScrollTrigger.refresh(); measure(); }, 120); });
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { ScrollTrigger.refresh(); measure(); }, 120); }).observe($('main'));
}

// ---------------------------------------------------------------- contact form (GitHub Pages: the mail app opens, filled in)
(() => {
  const form = $('.contact-form');
  const topics = $$('.topic', form);
  topics.forEach((b) => b.addEventListener('click', () => topics.forEach((t) => { t.classList.toggle('is-on', t === b); t.setAttribute('aria-checked', t === b); })));
  const status = $('.form-status', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) { status.textContent = 'Add your email so I can reply.'; form.email.focus(); return; }
    if (!d.message?.trim()) { status.textContent = 'Add a short message so I know how to help.'; form.message.focus(); return; }
    const topic = $('.topic.is-on', form)?.textContent || '';
    const body = [`Topic: ${topic}`, d.name && `Name: ${d.name}`, `Email: ${d.email}`, d.phone && `Phone: ${d.phone}`, d.company && `Company / link: ${d.company}`, '', d.message].filter(Boolean).join('\n');
    location.href = `mailto:dpsharmab1@gmail.com?subject=${encodeURIComponent(`${topic} — ${d.name || 'Portfolio enquiry'}`)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your mail app… thank you!';
  });
  const tick = () => { const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); $$('[data-clock]').forEach((el) => { el.textContent = t; }); };
  tick(); setInterval(tick, 15000);
})();

boot();
