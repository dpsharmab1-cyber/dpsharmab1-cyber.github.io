// Portfolio 2026 (v7): one scaled artboard, smooth scroll and the motion of
// every section. GSAP (ScrollTrigger, SplitText) drives the timelines; Lenis
// (MIT, darkroom.engineering) eases the scroll.
import Lenis from '../vendor/lenis.mjs';
import { Stars } from './stars.js';
import { Cards } from './projects.js';

const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = (window.__v7 = {});
const root = document.documentElement;
const BOARD_W = 1512, BOARD_H = 7856, FRAME_H = 982;
const BH = { x: 1198.5, y: 379 };                // black hole centre, artboard px
const NS = 'http://www.w3.org/2000/svg';
// board rows where the page is dark (the menu turns light-on-dark there)
const DARK = [[0, 1890], [2353, 3690], [5100, 5650], [6647, BOARD_H]];

// ---------------------------------------------------------------- scale
function fit() {
  const w = innerWidth, h = innerHeight;
  const portrait = w / h < 0.8;
  root.classList.toggle('portrait', portrait);
  if (portrait) {
    const zl = w / 560;
    root.style.setProperty('--zl', zl);
    root.style.setProperty('--z', w / 1000);
    root.style.setProperty('--zt', w / 721);
    root.style.setProperty('--u', (w / BOARD_W) + 'px');
    app.scale = w / 1000;
    app.toBoard = null;
    app.bhDoc = { x: (BH.x - 940) * zl, y: (BH.y - 330 + 50) * zl * 0.786 };
    app.boardMap = (x, y) => ({ x: x * zl * 0.37, y: y * zl });
    return;
  }
  const s = Math.min(w / BOARD_W, h / FRAME_H);
  app.scale = s;
  root.style.setProperty('--s', s);
  root.style.setProperty('--u', s + 'px');
  root.style.setProperty('--page-h', BOARD_H * s + 'px');
  const left = (w - BOARD_W * s) / 2;
  app.bhDoc = { x: left + BH.x * s, y: BH.y * s };
  app.boardMap = (x, y) => ({ x: left + x * s, y: y * s });
  app.toBoard = (docY) => docY / s;
}
fit();

// ---------------------------------------------------------------- scroll
const lenis = (app.lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, anchors: false }));
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
addEventListener('resize', () => { fit(); ScrollTrigger.refresh(); });

// ---------------------------------------------------------------- stars
const stars = new Stars($('#stars'));
gsap.ticker.add((t, dt) => stars.frame(t, Math.min(0.05, dt / 1000), lenis.animatedScroll || scrollY, app.bhDoc));

// ---------------------------------------------------------------- helpers
// letters rise in as a block arrives and lift out as it leaves (both ways)
function inOut(targets, trigger, { from = 115, stagger = 0.022, duration = 1, start = 'top 82%', end = 'bottom 12%', rotate = 4, onShow, onHide } = {}) {
  gsap.set(targets, { yPercent: from, rotate });
  const show = () => { gsap.to(targets, { yPercent: 0, rotate: 0, duration, ease: 'expo.out', stagger, overwrite: true }); onShow?.(); };
  const hide = (dir) => { gsap.to(targets, { yPercent: dir * from, rotate: dir * rotate, duration: duration * 0.7, ease: 'expo.in', stagger: stagger * 0.6, overwrite: true, delay: onHide ? 0.35 : 0 }); onHide?.(); };
  ScrollTrigger.create({ trigger, start, end, onEnter: show, onEnterBack: show, onLeave: () => hide(-1), onLeaveBack: () => hide(1) });
}
// pills, buttons and small blocks fade up in and lift out the same way
function pops(targets, trigger, opts = {}) {
  if (!targets.length) return;
  gsap.set(targets, { y: 26, opacity: 0 });
  const show = () => gsap.to(targets, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.035, overwrite: true });
  const hide = (dir) => gsap.to(targets, { y: -26 * dir, opacity: 0, duration: 0.5, ease: 'expo.in', stagger: 0.015, overwrite: true });
  ScrollTrigger.create({ trigger, start: 'top 72%', end: 'bottom 22%', ...opts, onEnter: show, onEnterBack: show, onLeave: () => hide(1), onLeaveBack: () => hide(-1) });
}
const split = (el, type) => {
  const s = SplitText.create(el, type === 'chars' ? { type: 'chars,lines', mask: 'lines', linesClass: 'split-line', charsClass: 'split-char' }
    : type === 'lines' ? { type: 'lines', mask: 'lines', linesClass: 'split-line' } : { type: 'words', mask: 'words' });
  return type === 'chars' ? s.chars : type === 'lines' ? s.lines : s.words;
};

// ---------------------------------------------------------------- glass
// Each panel is Figma's own render of its glass. It slides over the type once
// the letters land (and off before they leave), bends a few px with slow
// noise, carries a travelling glint and catches the light under the pointer.
const glasses = [];
function glass(el, { axis = 'h', period = 7 } = {}) {
  const g = { el, axis, wipe: 0, on: false, t: Math.random() * period, period };
  new IntersectionObserver(([e]) => { g.on = e.isIntersecting; el.classList.toggle('is-live', g.on && !reduced); }, { rootMargin: '10% 0px' }).observe(el);
  if (fine) {
    const zone = el.closest('.sec');
    zone.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1));
      el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1));
      const near = axis === 'h' ? Math.abs(e.clientY - (r.top + r.height / 2)) < r.height * 2.5 : e.clientX < r.right + 120;
      el.style.setProperty('--mo', near ? 1 : 0);
    });
    zone.addEventListener('pointerleave', () => el.style.setProperty('--mo', 0));
  }
  g.show = (d = 1.3) => gsap.to(g, { wipe: 1, duration: d, ease: 'expo.inOut', overwrite: true });
  g.hide = (d = 0.6) => gsap.to(g, { wipe: 0, duration: d, ease: 'expo.in', overwrite: true });
  glasses.push(g);
  return g;
}
const turb = document.querySelector('#glass-live feTurbulence');
gsap.ticker.add((t, dt) => {
  // the noise drifts, so the bend of the light never sits still
  if (turb && !reduced) turb.setAttribute('baseFrequency', `${(0.006 + Math.sin(t * 0.35) * 0.0015).toFixed(5)} ${(0.018 + Math.cos(t * 0.27) * 0.004).toFixed(5)}`);
  for (const g of glasses) {
    g.el.style.setProperty('--wipe', g.wipe.toFixed(4));
    if (g.axis === 'v') g.el.parentElement.style.setProperty('--gw', g.wipe.toFixed(4));
    if (g.ext) g.ext.forEach((x) => { x.style.opacity = g.wipe.toFixed(3); });
    if (!g.on) continue;
    g.t += dt / 1000;
    const k = (g.t % g.period) / g.period;              // glint: a quick pass, then rest
    const pos = -30 + Math.min(1, k / 0.45) * 160;
    g.el.style.setProperty(g.axis === 'h' ? '--gx' : '--gy', pos.toFixed(2));
  }
});

// ---------------------------------------------------------------- nav
const nav = $('#nav');
const links = $$('[data-nav]', nav);
const secs = $$('section.sec, footer.sec');
const navMap = { landing: 'landing', about: 'about', works: 'works', projects: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
gsap.ticker.add(() => {
  const probe = 60;
  let cur = secs[0];
  for (const sec of secs) { const r = sec.getBoundingClientRect(); if (r.top <= probe && r.bottom > probe) cur = sec; }
  let light;
  if (app.toBoard) { const y = app.toBoard((lenis.animatedScroll || scrollY) + probe); light = !DARK.some(([a, b]) => y >= a && y < b); }
  else light = cur.dataset.theme === 'light';
  nav.classList.toggle('on-light', light);
  if (cur === app.navSec) return;
  app.navSec = cur;
  links.forEach((a) => a.classList.toggle('is-on', a.dataset.nav === navMap[cur.id]));
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.matches('.pj-next')) return;
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  lenis.scrollTo(t.id === 'landing' ? 0 : t, { duration: 1.6, easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) });
});

// ---------------------------------------------------------------- cursor + glass buttons
class Cursor {
  constructor() {
    this.el = $('.cursor'); this.dot = $('.cursor-dot'); this.ring = $('.cursor-ring'); this.lab = $('.cursor-label');
    this.x = this.y = this.rx = this.ry = -100;
    if (!fine || reduced) return;
    root.classList.add('has-cursor');
    addEventListener('pointermove', (e) => { this.x = e.clientX; this.y = e.clientY; });
    const hot = 'a, button, .chips li, input, textarea';
    document.addEventListener('pointerover', (e) => { if (!this.forced && e.target.closest(hot)) this.el.classList.add('is-link'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest(hot)) this.el.classList.remove('is-link'); });
    gsap.ticker.add(() => {
      this.rx += (this.x - this.rx) * 0.18; this.ry += (this.y - this.ry) * 0.18;
      this.dot.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.ring.style.transform = `translate3d(${this.rx}px,${this.ry}px,0)`;
    });
  }
  state(kind, label = '') { this.forced = !!kind; this.el.classList.toggle('is-big', kind === 'big'); this.el.classList.remove('is-link'); this.lab.textContent = label; }
}
app.cursor = new Cursor();

// glass buttons swell under the pointer and stay in place; the dot leans in
function swell(el) {
  if (!fine || reduced) return;
  const icon = el.querySelector('.dot');
  el.addEventListener('pointerenter', () => gsap.to(el, { scale: 1.07, duration: 0.6, ease: 'power3.out', overwrite: 'auto' }));
  el.addEventListener('pointermove', (e) => {
    if (!icon) return;
    const r = el.getBoundingClientRect();
    gsap.to(icon, { x: (e.clientX - (r.left + r.width / 2)) * 0.05, y: (e.clientY - (r.top + r.height / 2)) * 0.12, duration: 0.5, ease: 'power3.out' });
  });
  el.addEventListener('pointerleave', () => {
    gsap.to(el, { scale: 1, duration: 0.9, ease: 'elastic.out(1, .55)', overwrite: 'auto' });
    if (icon) gsap.to(icon, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .5)' });
  });
}

// ---------------------------------------------------------------- build
async function boot() {
  try { await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 20px Montserrat'), document.fonts.load('500 20px Montserrat'), document.fonts.ready]); } catch (e) {}
  const svg = async (url) => { try { return await (await fetch(url)).text(); } catch (e) { return ''; } };
  const [bhSvg, satSvg, wheelSvg] = await Promise.all([svg('assets/blackhole.svg'), svg('assets/saturn.svg'), svg('assets/wheel.svg')]);

  // ---------------- the black hole, live from the frame
  const bh = $('.bh');
  bh.innerHTML = bhSvg;
  const fall = [];
  const inner = bh.querySelector('.bh-in');
  if (inner) {
    // the stars inside the sphere fall slowly inward, as if being swallowed
    for (let i = 0; i < 80; i++) {
      const el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', (0.7 + Math.random() * 1.6).toFixed(2));
      el.setAttribute('fill', '#fff');
      inner.append(el);
      fall.push({ el, a: Math.random() * 6.283, r: 20 + Math.random() * 330, sp: 5 + Math.random() * 9, o: 0.3 + Math.random() * 0.6 });
    }
    gsap.to(inner.children, { opacity: 0.35, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.08, from: 'random' } });
  }
  let landOn = true;
  new IntersectionObserver(([e]) => { landOn = e.isIntersecting; }).observe($('#landing'));
  gsap.ticker.add((t, dt) => {
    if (!landOn) return;
    const d = Math.min(0.05, dt / 1000);
    for (const p of fall) {
      p.r -= (p.sp + p.r * 0.05) * d;
      p.a += d * 0.08;
      if (p.r < 6) { p.r = 310 + Math.random() * 40; p.a = Math.random() * 6.283; }
      p.el.setAttribute('cx', (BH.x + Math.cos(p.a) * p.r).toFixed(1));
      p.el.setAttribute('cy', (BH.y + Math.sin(p.a) * p.r).toFixed(1));
      p.el.setAttribute('opacity', (p.o * Math.min(1, (p.r - 6) / 90)).toFixed(3));
    }
  });
  try {
    const all = await (await fetch('assets/stars.json')).json();
    stars.seed(all.filter((s) => s[1] < FRAME_H), app.boardMap);
  } catch (e) {}

  // ---------------- Saturn: its rings sway on their own
  $('.saturn').innerHTML = satSvg;
  gsap.fromTo('.saturn .sat-back, .saturn .sat-front', { rotation: -1.2 }, { rotation: 1.2, svgOrigin: '756 475', duration: 10, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // ---------------- footer wheel
  $('.wheel').innerHTML = wheelSvg + '<img class="dome" src="assets/glass-dome.webp" alt="">';

  // ---------------- glass panels
  const gSlab = glass($('.glass-slab'), { axis: 'v', period: 8 });
  const gAbout = glass($('.glass-about'), { period: 6.5 });
  const gContent = glass($('.glass-content'), { period: 9 });
  const gConnect = glass($('.glass-connect'), { period: 8 });
  // wide screens: the full-width bars run on past the artboard as plain glass
  for (const g of [gContent, gConnect]) {
    g.ext = [-1, 1].map((side) => {
      const x = document.createElement('i');
      x.className = 'bar-x';
      Object.assign(x.style, { top: getComputedStyle(g.el).top, height: g.el.offsetHeight + 'px', left: side < 0 ? '-2000px' : '1512px' });
      g.el.parentElement.append(x);
      return x;
    });
  }
  const gSheets = glass($('.glass-sheets'), { period: 10 });
  gSheets.wipe = 1;

  // ---------------- splits
  $$('.pf-l').forEach((l) => l.classList.add('pf-ready'));
  const chars = (sel) => split($(sel), 'chars');
  const aboutC = chars('.about-title'), contentC = chars('.content-title'), thinkC = chars('.think'), projC = chars('.proj-title');
  const connectC = chars('.connect-title'), contactC = chars('.contact-title');
  const words = $$('[data-reveal="words"]').map((el) => [el, split(el, 'words')]);
  const lines = $$('[data-reveal="lines"]').map((el) => [el, split(el, 'lines')]);

  // ---------------- landing in and out
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  gsap.set('.pf-l > span', { yPercent: 105 });
  gsap.set('#landing .pop', { y: 26, opacity: 0 });
  tl.to(stars, { alpha: 1, duration: 1.8, ease: 'power1.out' }, 0)
    .fromTo('.bh', { opacity: 0 }, { opacity: 1, duration: 2.2, ease: 'power2.out' }, 0)
    .to('.pf-l > span', { yPercent: 0, duration: 1.3, stagger: 0.08 }, 0.25)
    .add(() => gSlab.show(1.4), 1.05)
    .to('#landing .pop', { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 1.2)
    .add(() => { root.classList.remove('is-loading'); lenis.start(); app.afterIntro?.(); }, 0.6);
  const landOut = gsap.timeline({ paused: true })
    .add(() => gSlab.hide(0.7), 0)
    .to('.pf-l > span', { yPercent: -105, duration: 0.8, ease: 'expo.in', stagger: 0.05 }, 0.3)
    .to('#landing .pop', { y: -26, opacity: 0, duration: 0.6, ease: 'expo.in', stagger: 0.05 }, 0);
  const landBack = () => { gsap.to('.pf-l > span', { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06, overwrite: true }); gsap.to('#landing .pop', { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, overwrite: true }); gSlab.show(1.3); };
  // the menu stays away on the landing and arrives once you move on
  ScrollTrigger.create({ trigger: '#landing', start: 'top top', end: 'bottom 45%',
    onLeave: () => { landOut.restart(); nav.classList.add('is-shown'); },
    onEnterBack: () => { landOut.pause(); landBack(); nav.classList.remove('is-shown'); } });

  // ---------------- type in and out; each glass bar slides over its title once it lands
  const withGlass = (g) => ({ onShow: () => gsap.delayedCall(0.55, () => g.show()), onHide: () => g.hide() });
  inOut(aboutC, '.about-title', { stagger: 0.03, ...withGlass(gAbout) });
  inOut(contentC, '.content-title', { stagger: 0.05, duration: 1.2, start: 'top 80%', ...withGlass(gContent) });
  inOut(thinkC, '.think', { stagger: 0.03, start: 'top 90%' });
  inOut(projC, '.proj-title', { stagger: 0.05, start: 'top 88%', end: 'bottom -60%' });
  inOut(connectC, '.connect-title', { stagger: 0.035, start: 'top 85%', ...withGlass(gConnect) });
  inOut(contactC, '.contact-title', { stagger: 0.025, start: 'top 88%' });
  const last = (el) => el.closest('#footer') ? { start: 'top 30%', end: 'bottom top' } : {};
  words.forEach(([el, w]) => inOut(w, el.closest('#footer') ? '#footer' : el, { stagger: 0.04, from: 110, rotate: 0, ...last(el) }));
  lines.forEach(([el, l]) => inOut(l, el.closest('#footer') ? '#footer' : el, { stagger: 0.08, from: 105, rotate: 0, duration: 1.1, ...last(el) }));

  // about: experience rows, stats, skills
  $$('.xp-list li').forEach((li, i) => gsap.from(li, { x: 60, opacity: 0, duration: 1.1, ease: 'expo.out', delay: i * 0.05, scrollTrigger: { trigger: li, start: 'top 94%', end: 'bottom 6%', toggleActions: 'play reverse play reverse' } }));
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 92%', onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.6, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
  });
  pops($$('.stats > div'), '.stats', { start: 'top 92%', end: 'bottom 8%' });
  pops($$('#about .skill-head, #about .chips li'), '#about .chips li', { start: 'top 92%', end: 'bottom -10%' });

  // works, connect, contact, footer: their pills and blocks
  pops($$('#works .pop'), '#works .see-more', { start: 'top 96%', end: 'bottom 4%' });
  pops($$('#connect .pop'), '#connect .cn-btn', { start: 'top 96%', end: 'bottom 4%' });
  pops($$('#contact .pop'), '#contact', { start: 'top 55%', end: 'bottom 10%' });
  pops($$('#footer .pop'), '#footer', { start: 'top 30%', end: 'bottom top' });
  gsap.fromTo('#works .saturn', { scale: 0.92, yPercent: 6 }, { scale: 1.03, yPercent: -4, ease: 'none', transformOrigin: '50% 50%', scrollTrigger: { trigger: '#works', start: 'top bottom', end: 'bottom top', scrub: 0.9 } });
  gsap.from('.sheets i', { y: 70, duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#contact', start: 'top 75%', toggleActions: 'play none none reverse' } });

  // marquee: an endless, steady run that leans on the scroll speed
  const track = $('.mq-track');
  const unit = track.innerHTML, unitW = track.scrollWidth, pair = unitW / 4;
  while (track.scrollWidth < track.parentElement.offsetWidth + unitW * 2) track.insertAdjacentHTML('beforeend', unit);
  // start where the frame has it: a "Welcome" at x -194
  let mx = ((2000 - 194) % pair) - pair * 2, boost = 0;
  lenis.on('scroll', (l) => { boost = Math.min(6, Math.abs(l.velocity) * 0.25); });
  gsap.ticker.add((t, dt) => { boost *= 0.94; mx -= (0.9 + boost) * (dt / 16.7); if (mx < -unitW) mx += unitW; track.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`; });

  // projects: the stacked cards
  app.cards = new Cards(app);

  // footer: the wheel and its glass rise into place, the glow breathes
  gsap.timeline({ scrollTrigger: { trigger: '#footer', start: 'top bottom', end: 'top 15%', scrub: 0.9 } })
    .fromTo('.wheel', { yPercent: 18, scale: 0.9, opacity: 0.2 }, { yPercent: 0, scale: 1, opacity: 1, ease: 'none' }, 0)
    .fromTo('.glass-sheets', { y: 160 }, { y: 0, ease: 'none' }, 0);

  $$('.pill, .nav-pill, .nav-contact, .pj-close').forEach(swell);
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
