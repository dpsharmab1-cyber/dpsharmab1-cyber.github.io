// Portfolio 2026 · Red Planet (v10). The three mockup frames as one page: art
// layers (assets/v10, cut by tools/v10/build_theme.py; the torn edges are
// vectors from assets/theme/elements),
// live type and UI on top. Wide screens show the frames scaled to the width;
// tablets and phones reflow. GSAP drives every motion, Lenis the scroll.
import Lenis from '../vendor/lenis.mjs';
import { Cards } from './projects.js?v=100';

const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = (window.__v8 = {});
const root = document.documentElement;
const V = root.dataset.v || '1';
const W0 = 1512, H0 = 7856;

// ---------------------------------------------------------------- layout
// wide screens: the frames, scaled to the width; tablets and phones: reflow
function fit() {
  const w = innerWidth, h = innerHeight;
  const flow = w < 1024 || w / h < 0.9;
  root.classList.toggle('flow', flow);
  root.classList.toggle('tab', flow && w >= 640);
  root.classList.toggle('phone', flow && w < 640);
  app.flow = flow;
  if (flow) { app.scale = 1; root.style.setProperty('--u', '1px'); return; }
  const s = Math.min(1.5, Math.max(0.62, w / W0));
  app.scale = s;
  root.style.setProperty('--s', s);
  root.style.setProperty('--u', s + 'px');
  root.style.setProperty('--page-h', H0 * s + 'px');
}
fit();
let lastFlow = app.flow;
addEventListener('resize', () => { fit(); if (app.flow !== lastFlow) location.reload(); ScrollTrigger.refresh(); });

// ---------------------------------------------------------------- scroll
const lenis = (app.lenis = new Lenis({ lerp: 0.075, smoothWheel: true, syncTouch: false, anchors: false }));
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

// ---------------------------------------------------------------- the sky
// sparse stars that breathe, drift a little with the scroll, and now and
// then a slow shooting star; drawn once per frame on one small canvas
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
    // a shooting star every so often
    this.next -= dt;
    if (!this.shoot && this.next <= 0 && !reduced) { this.shoot = { x: Math.random() * W * 0.6, y: H * 0.25 + Math.random() * H * 0.4, life: 0, len: 120 + Math.random() * 120 }; }
    if (this.shoot) {
      const sh = this.shoot; sh.life += dt;
      // the head flies up and to the right, its tail trailing down-left
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

// ---------------------------------------------------------------- reveals
// mystical, unhurried: type rises out of a soft blur once a block is well in view
const later = (st) => st.replace(/top (\d+)%/, (m, n) => `top ${Math.max(45, +n - 12)}%`);
function inOut(targets, trigger, { from = 110, stagger = 0.03, duration = 1.25, start = 'top 82%', end = 'bottom 10%', blur = 10 } = {}) {
  gsap.set(targets, { yPercent: from, opacity: 0, filter: `blur(${blur}px)` });
  const show = () => gsap.to(targets, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration, ease: 'expo.out', stagger, overwrite: true, delay: 0.12 });
  const hide = (d) => gsap.to(targets, { yPercent: d * from * 0.6, opacity: 0, filter: `blur(${blur}px)`, duration: duration * 0.6, ease: 'power3.in', stagger: stagger * 0.5, overwrite: true });
  ScrollTrigger.create({ trigger, start: later(start), end, onEnter: show, onEnterBack: show, onLeave: () => hide(-1), onLeaveBack: () => hide(1) });
}
function pops(targets, trigger, opts = {}) {
  if (!targets.length) return;
  gsap.set(targets, { y: 30, opacity: 0, filter: 'blur(6px)' });
  const show = () => gsap.to(targets, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: 0.05, overwrite: true, delay: 0.1 });
  const hide = (d) => gsap.to(targets, { y: -24 * d, opacity: 0, filter: 'blur(6px)', duration: 0.55, ease: 'power3.in', stagger: 0.02, overwrite: true });
  ScrollTrigger.create({ trigger, end: 'bottom 15%', ...opts, start: later(opts.start || 'top 75%'), onEnter: show, onEnterBack: show, onLeave: () => hide(1), onLeaveBack: () => hide(-1) });
}
const split = (el, type) => {
  const s = SplitText.create(el, type === 'chars' ? { type: 'chars,lines', mask: 'lines', linesClass: 'split-line', charsClass: 'split-char' }
    : type === 'lines' ? { type: 'lines', mask: 'lines', linesClass: 'split-line' } : { type: 'words', mask: 'words', wordsClass: 'split-word' });
  return type === 'chars' ? s.chars : type === 'lines' ? s.lines : s.words;
};

// ---------------------------------------------------------------- nav
const nav = $('#nav'), mark = $('.nav-mark'), links = $$('[data-nav]', nav);
const secs = ['landing', 'about', 'skills', 'works', 'projects', 'connect', 'contact', 'footer'].map((id) => document.getElementById(id));
const navMap = { landing: 'landing', about: 'about', skills: 'skills', works: 'projects', projects: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
let secTops = [];
// where a section starts on the page: on wide screens the blocks share their
// frame's box, so its place in the frame (data-at) decides
const docY = (el) => {
  const y = lenis.animatedScroll || scrollY;
  if (!app.flow && el.dataset.at != null) return el.closest('.frame').getBoundingClientRect().top + y + (+el.dataset.at) * app.scale;
  return el.getBoundingClientRect().top + y;
};
app.docY = docY;
const measure = () => { secTops = secs.map((el) => ({ el, top: docY(el) })); measurePaper(); };
const moveMark = (a) => {
  if (!a || !a.closest('.nav-pill')) { mark.style.opacity = 0; return; }
  mark.style.opacity = 1; mark.style.left = a.offsetLeft + 'px'; mark.style.width = a.offsetWidth + 'px';
};
gsap.ticker.add(() => {
  if (!secTops.length) return;
  const y = (lenis.animatedScroll || scrollY) + innerHeight * 0.4;
  let cur = secTops[0].el;
  for (const s of secTops) if (y >= s.top) cur = s.el;
  if (cur === app.navSec) return;
  app.navSec = cur;
  const key = navMap[cur.id];
  links.forEach((a) => a.classList.toggle('is-on', a.dataset.nav === key));
  moveMark(links.find((a) => a.dataset.nav === key));
});
// where the paper is (doc y ranges): the nav turns light over it
let paper = [];
const measurePaper = () => {
  const y = lenis.animatedScroll || scrollY, s = app.scale || 1;
  if (app.flow) { paper = ['#skills', '#projects', '#contact'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.top + y - 40, r.bottom + y + 20]; }); return; }
  const top = (id) => document.getElementById(id).getBoundingClientRect().top + y;
  const f1 = top('f1'), f2 = top('f2'), f3 = top('f3');
  paper = [[f1 + 1900 * s, f1 + 2353 * s], [f2 + 1260 * s, f3 + 215 * s], [f3 + 740 * s, f3 + 1737 * s]];
};
gsap.ticker.add(() => {
  if (!paper.length) return;
  const y = (lenis.animatedScroll || scrollY) + nav.offsetTop + 20;
  const on = paper.some(([a, b]) => y >= a && y <= b);
  if (on !== app.onPaper) { app.onPaper = on; nav.classList.toggle('on-paper', on); }
});
let lastY = 0;
lenis.on('scroll', (l) => {
  const y = l.animatedScroll, d = y - lastY;
  if (Math.abs(d) > 6) { nav.classList.toggle('is-tucked', d > 0 && y > innerHeight * 0.6); lastY = y; }
});
const closeMenu = () => { root.classList.remove('menu-open'); $('.nav-burger').setAttribute('aria-expanded', 'false'); lenis.start(); };
$('.nav-burger').addEventListener('click', () => {
  const open = !root.classList.contains('menu-open');
  root.classList.toggle('menu-open', open);
  $('.nav-burger').setAttribute('aria-expanded', String(open));
  if (open) { lenis.stop(); gsap.fromTo('.menu a', { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.15 }); } else lenis.start();
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.matches('.pj-next')) return;
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  if (root.classList.contains('menu-open')) closeMenu();
  lenis.scrollTo(t.id === 'landing' ? 0 : docY(t) - (app.flow ? 20 : 0), { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
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
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.6, ease: 'power3.out' }); });
  el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .45)' }));
}

// ---------------------------------------------------------------- art layers
// which layers drift with the scroll, and how much (depth)
const DEPTH = { planet: 0.16, saturn: 0.18 };
// shown on tablets and phones too
const KEEP = { s1: ['planet'], s2: ['saturn'], s3: [] };
// the emblem's glow is drawn by .mantra itself (both layouts)
const SKIP = new Set(['glow']);

async function buildArt() {
  let man;
  try { man = await (await fetch(`assets/v10/layers.json?v=${V}`)).json(); } catch (e) { return {}; }
  const byId = {};
  for (const fr of $$('.frame')) {
    const key = fr.dataset.frame, art = $('.art', fr);
    for (const l of man[key] || []) {
      if (SKIP.has(l.id)) continue;
      const im = new Image();
      im.alt = ''; im.decoding = 'async'; if (key !== 's1') im.loading = 'lazy';
      im.src = `assets/v10/${l.src}?v=${V}`;
      im.className = `ly ly-${key}-${l.id}` + (l.id.startsWith('tear') ? ' ly-tear' : '') + ((KEEP[key] || []).includes(l.id) ? ' keep' : '');
      im.style.cssText = `--x:${l.x};--y:${l.y};--w:${l.w};--h:${l.h}`;
      art.append(im);
      byId[`${key}-${l.id}`] = im;
    }
  }
  return byId;
}

function animateArt(L) {
  if (reduced) return;
  // the black world floats; its red ring tilts slowly about the world's centre
  const planet = L['s1-planet'];
  if (planet) {
    gsap.to(planet, { y: '+=12', duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo(planet, { rotation: -1.6 }, { rotation: 1.6, transformOrigin: '62% 42%', duration: 12, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
  // Saturn floats and its rings sway a touch
  const sat = L['s2-saturn'];
  if (sat) {
    gsap.to(sat, { y: '+=12', duration: 8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo(sat, { rotation: -1.2 }, { rotation: 1.2, transformOrigin: '50% 48%', duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
  // depth: the worlds drift at their own pace as the page scrolls (wide screens)
  if (!app.flow) for (const [k, el] of Object.entries(L)) {
    const d = DEPTH[k.slice(3)]; if (!d) continue;
    ScrollTrigger.create({ trigger: el.closest('.frame'), start: 'top bottom', end: 'bottom top', scrub: true, onUpdate: (st) => { el.style.translate = `0 ${(-(st.progress - 0.5) * d * 320).toFixed(1)}px`; } });
  }
}

// ---------------------------------------------------------------- splash
// the emblem's star turns in a red ring that fills as the first frame's art
// loads; then an iris opens onto the landing
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
      if (shown.v >= 100 && performance.now() - t0 > 1400 || performance.now() - t0 > 9000) {
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
  const L = await buildArt();
  animateArt(L);
  await splash(Object.values(L).filter((im) => !im.loading || im.loading !== 'lazy'));

  // the footer emblem, live: two mantra rings turning against each other
  try {
    $('.mantra').innerHTML = await (await fetch(`assets/v10/mantra.svg?v=${V}`)).text();
    // the eight-point star sits inside the rings and turns the other way
    const st = new Image(); st.src = `assets/theme/elements/mantra-star.svg?v=${V}`; st.alt = ''; st.className = 'mantra-star'; $('.mantra').append(st);
    if (!reduced) {
      gsap.to(st, { rotation: -360, duration: 160, ease: 'none', repeat: -1 });
      gsap.to('.mantra .ring-outer', { rotation: 360, svgOrigin: '756 2236', duration: 120, ease: 'none', repeat: -1 });
      gsap.to('.mantra .ring-inner', { rotation: -360, svgOrigin: '756 2236', duration: 90, ease: 'none', repeat: -1 });
    }
  } catch (e) {}

  // splits
  $$('.pf-l').forEach((l) => l.classList.add('ready'));
  const chars = (sel) => split($(sel), 'chars');
  const aboutC = chars('.about-title'), contentC = chars('.content-title'), thinkC = chars('.think'), projC = chars('.proj-title');
  const connectC = chars('.connect-title'), contactC = chars('.contact-title');
  // small screens: the frame's hand-set line breaks would leave ragged lines
  if (app.flow) $$('[data-reveal="lines"] br').forEach((br) => br.replaceWith(' '));
  const words = $$('[data-reveal="words"]').map((el) => [el, split(el, 'words')]);
  const lines = $$('[data-reveal="lines"]').map((el) => [el, split(el, 'lines')]);

  // the landing: stars, then the red-ringed world swings in, then the title rises
  const hero = ['s1-planet'].map((k) => L[k]).filter(Boolean);
  gsap.set('.pf-l > span', { yPercent: 105, filter: 'blur(12px)' });
  gsap.set('#landing .pop', { y: 24, opacity: 0, filter: 'blur(6px)' });
  gsap.set(hero, { opacity: 0, scale: 0.94, rotation: -6, transformOrigin: '62% 42%' });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(sky, { alpha: 1, duration: 2.4, ease: 'power1.out' }, 0)
    .to(hero, { opacity: 1, scale: 1, rotation: 0, duration: 2.6, ease: 'power3.out', clearProps: 'scale' }, 0.2)
    .to('.pf-l > span', { yPercent: 0, filter: 'blur(0px)', duration: 1.6, stagger: 0.1 }, 0.5)
    .to('#landing .pop', { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.08 }, 1.2)
    .add(() => { root.classList.remove('is-loading'); lenis.start(); measure(); app.afterIntro?.(); }, 0.8);
  const landOut = gsap.timeline({ paused: true })
    .to('.pf-l > span', { yPercent: -80, opacity: 0, filter: 'blur(10px)', duration: 0.9, ease: 'power3.in', stagger: 0.05 }, 0)
    .to('#landing .pop', { y: -20, opacity: 0, filter: 'blur(6px)', duration: 0.6, ease: 'power3.in', stagger: 0.04 }, 0);
  ScrollTrigger.create({ trigger: '#works', start: 'top 40%', onEnter: () => { nav.classList.add('is-shown'); measure(); moveMark(links.find((a) => a.classList.contains('is-on'))); }, onLeaveBack: () => nav.classList.remove('is-shown') });
  ScrollTrigger.create({ trigger: '#landing', start: 'top top', end: app.flow ? 'bottom 40%' : 'top -55%',
    onLeave: () => landOut.play(), onEnterBack: () => landOut.reverse() });

  // type, section by section
  inOut(aboutC, '.about-title', { stagger: 0.035 });
  inOut(contentC, '.content-title', { stagger: 0.06, duration: 1.5, start: 'top 85%' });
  inOut(thinkC, '.think', { stagger: 0.03, start: 'top 90%' });
  inOut(projC, '.proj-title', { stagger: 0.05, start: 'top 90%' });
  inOut(connectC, '.connect-title', { stagger: 0.045, start: 'top 88%' });
  inOut(contactC, '.contact-title', { stagger: 0.025, start: 'top 90%' });
  const foot = (el) => el.closest('#footer') ? { start: 'top 95%', end: 'bottom top' } : {};
  words.forEach(([el, w]) => inOut(w, el, { stagger: 0.05, from: 100, blur: 6, ...foot(el) }));
  lines.forEach(([el, l]) => inOut(l, el, { stagger: 0.09, from: 100, blur: 6, ...foot(el) }));

  $$('.xp-list li').forEach((li, i) => gsap.from(li, { x: 50, opacity: 0, filter: 'blur(6px)', duration: 1.2, ease: 'expo.out', delay: i * 0.06, scrollTrigger: { trigger: li, start: 'top 88%', end: 'bottom 8%', toggleActions: 'play reverse play reverse' } }));
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.8, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
  });
  pops($$('.stats > div'), '.stats', { start: 'top 90%' });
  $$('.skill-col').forEach((col) => pops($$('.skill-head, .chips li', col), col, { start: 'top 88%' }));
  pops($$('#works .pop'), '#works .see-more', { start: 'top 95%', end: 'bottom 5%' });
  pops($$('#connect .pop'), '#connect .cn-btn', { start: 'top 95%', end: 'bottom 5%' });
  pops($$('#contact .pop'), app.flow ? '#contact' : '.form-title', { start: 'top 92%', end: app.flow ? 'bottom 10%' : 'bottom -75%' });
  pops($$('#footer .pop'), '.foot-copy', { start: 'top 98%', end: 'bottom top' });
  gsap.from('.mantra', { scale: 0.8, opacity: 0, filter: 'blur(14px)', rotation: -20, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: '.mantra', start: 'top 85%', toggleActions: 'play none none reverse' } });

  // marquee: an endless, unhurried run that leans on the scroll speed
  const track = $('.mq-track');
  const unit = track.innerHTML, unitW = track.scrollWidth;
  while (track.scrollWidth < track.parentElement.offsetWidth + unitW * 2) track.insertAdjacentHTML('beforeend', unit);
  let mx = -unitW * 0.4, boost = 0;
  lenis.on('scroll', (l) => { boost = Math.min(5, Math.abs(l.velocity) * 0.2); });
  gsap.ticker.add((t, dt) => { if (reduced) return; boost *= 0.94; mx -= (0.7 + boost) * (dt / 16.7); if (mx < -unitW) mx += unitW; track.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`; });

  // projects: the fan of cards
  app.cards = new Cards(app);

  $$('.btn, .nav-contact, .topic').forEach(magnet);
  measure();
  addEventListener('resize', () => setTimeout(measure, 80));
  ScrollTrigger.refresh();
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
