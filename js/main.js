// Portfolio 2026: one scaled artboard, smooth scroll and the motion of every
// section. GSAP (ScrollTrigger, SplitText) drives the timelines; Lenis (MIT,
// darkroom.engineering) eases the scroll; js/lens.js bends type under glass.
import Lenis from '../vendor/lenis.mjs';
import { Lens } from './lens.js';
import { Stars } from './stars.js';
import { Projects } from './projects.js';

const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = (window.__v6 = {});
const root = document.documentElement;
const BOARD_W = 1512, BOARD_H = 7632, FRAME_H = 982;
const BH = { x: 1145, y: 300 };                 // black hole centre, artboard px
const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- scale
// the artboard is scaled so one Figma frame (1512 x 982) fills the screen
function fit() {
  const w = innerWidth, h = innerHeight;
  // portrait phones: the landing gets a tall 430 x 932 board, framed sections
  // show the centre 1000 px of their frames, About and Contact flow
  const portrait = w / h < 0.8;
  root.classList.toggle('portrait', portrait);
  if (portrait) {
    const zl = Math.min(w / 430, h / 932), left = (w - 430 * zl) / 2;
    root.style.setProperty('--zl', zl);
    root.style.setProperty('--z', w / 1000);
    root.style.setProperty('--u', (w / BOARD_W) + 'px');
    app.scale = w / 1000;
    app.bhDoc = { x: left + 302 * zl, y: 19 * zl };
    app.boardMap = (x, y) => ({ x: left + (x / BOARD_W) * 430 * zl, y: (y / FRAME_H) * 932 * zl });
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
function inOut(targets, trigger, { from = 115, stagger = 0.022, duration = 1, start = 'top 82%', end = 'bottom 12%', rotate = 4 } = {}) {
  gsap.set(targets, { yPercent: from, rotate });
  const show = () => gsap.to(targets, { yPercent: 0, rotate: 0, duration, ease: 'expo.out', stagger, overwrite: true });
  const hide = (dir) => gsap.to(targets, { yPercent: dir * from, rotate: dir * rotate, duration: duration * 0.7, ease: 'expo.in', stagger: stagger * 0.6, overwrite: true });
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

// ---------------------------------------------------------------- nav
const nav = $('#nav');
const links = $$('[data-nav]', nav);
const secs = $$('.sec');
const navMap = { landing: 'landing', about: 'about', works: 'works', projects: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
gsap.ticker.add(() => {
  // the section under the menu decides its colours and the active link
  const probe = 60;
  let cur = secs[0];
  for (const sec of secs) { const r = sec.getBoundingClientRect(); if (r.top <= probe && r.bottom > probe) cur = sec; }
  if (cur === app.navSec) return;
  app.navSec = cur;
  links.forEach((a) => a.classList.toggle('is-on', a.dataset.nav === navMap[cur.id]));
  nav.classList.toggle('on-light', cur.dataset.theme === 'light');
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
    document.addEventListener('pointerover', (e) => { if (!this.forced && e.target.closest('a, button, .chips li, input, textarea')) this.el.classList.add('is-link'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest('a, button, .chips li, input, textarea')) this.el.classList.remove('is-link'); });
    gsap.ticker.add(() => {
      this.rx += (this.x - this.rx) * 0.18; this.ry += (this.y - this.ry) * 0.18;
      this.dot.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.ring.style.transform = `translate3d(${this.rx}px,${this.ry}px,0)`;
    });
  }
  state(kind, label = '') { this.forced = !!kind; this.el.classList.toggle('is-big', kind === 'big'); this.el.classList.remove('is-link'); this.lab.textContent = label; }
}
app.cursor = new Cursor();

// glass buttons swell under the pointer and stay in place; the icon leans in
function swell(el) {
  if (!fine || reduced) return;
  const icon = el.querySelector('.pill-arrow');
  el.addEventListener('pointerenter', () => gsap.to(el, { scale: 1.07, duration: 0.6, ease: 'power3.out', overwrite: 'auto' }));
  el.addEventListener('pointermove', (e) => {
    if (!icon) return;
    const r = el.getBoundingClientRect();
    gsap.to(icon, { x: (e.clientX - (r.left + r.width / 2)) * 0.06, y: (e.clientY - (r.top + r.height / 2)) * 0.12, duration: 0.5, ease: 'power3.out' });
  });
  el.addEventListener('pointerleave', () => {
    gsap.to(el, { scale: 1, duration: 0.9, ease: 'elastic.out(1, .55)', overwrite: 'auto' });
    if (icon) gsap.to(icon, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .5)' });
  });
}

// ---------------------------------------------------------------- glass over type
const lenses = [];
function barLens(title, bar, { rel = 0.5, drift = 0.1, chroma = 0.07 } = {}) {
  const lens = new Lens(title, { axis: 'h', chroma, depth: 0.55, soft: 0.7 });
  const st = { off: 0, mouse: 0, m: 0 };
  const place = () => {
    const th = title.offsetHeight, h = bar.offsetHeight;
    const y = th * rel - h / 2 + (st.off + st.m) * th;
    bar.style.top = (title.offsetTop + y).toFixed(1) + 'px';
    lens.set(y, h);
  };
  const item = { place, st, on: true };
  new IntersectionObserver(([e]) => { item.on = e.isIntersecting; }, { rootMargin: '20% 0px' }).observe(title);
  lenses.push(item);
  gsap.fromTo(st, { off: -drift }, { off: drift, ease: 'none', scrollTrigger: { trigger: title, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  if (fine) {
    const sec = title.closest('.sec');
    sec.addEventListener('pointermove', (e) => { const r = title.getBoundingClientRect(); st.mouse = gsap.utils.clamp(-0.25, 0.25, ((e.clientY - r.top) / r.height - 0.5) * 0.3); });
    sec.addEventListener('pointerleave', () => { st.mouse = 0; });
  }
}
gsap.ticker.add(() => lenses.forEach((l) => { if (!l.on) return; l.st.m += (l.st.mouse - l.st.m) * 0.06; l.place(); }));

// ---------------------------------------------------------------- build
async function boot() {
  try { await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 20px Montserrat'), document.fonts.ready]); } catch (e) {}
  const svg = async (url) => { try { return await (await fetch(url)).text(); } catch (e) { return ''; } };

  // phone tears between the flowing sections (hidden on the artboard layout)
  const tear = (parent, src, css = {}) => { const i = new Image(); i.src = src; i.alt = ''; i.className = 'tear-ph'; Object.assign(i.style, css); parent.prepend(i); };
  tear($('#about .skills'), 'assets/tear-bottom.svg');
  tear($('#works'), 'assets/tear-top.svg', { top: '-150px', height: '200px' });
  tear($('#projects'), 'assets/tear-bottom.svg', { top: '-60px', height: '260px' });
  tear($('#connect'), 'assets/tear-top.svg', { top: '-150px', height: '200px' });
  tear($('#contact'), 'assets/tear-bottom.svg', { top: '-30px', height: '120px' });
  tear($('#footer'), 'assets/tear-top.svg', { top: '-150px', height: '200px' });

  // ---------------- the black hole, live from the frame
  const bh = $('.bh');
  bh.innerHTML = await svg('assets/blackhole.svg');
  const fall = [];
  const inner = bh.querySelector('.bh-stars-g g[mask]');
  if (inner) {
    // the stars inside the sphere fall slowly inward, as if being swallowed
    inner.replaceChildren();
    for (let i = 0; i < 70; i++) {
      const el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', (0.7 + Math.random() * 1.5).toFixed(2));
      el.setAttribute('fill', '#fff');
      inner.append(el);
      fall.push({ el, a: Math.random() * 6.283, r: 20 + Math.random() * 330, sp: 5 + Math.random() * 9, o: 0.3 + Math.random() * 0.6 });
    }
  }
  const glowRect = bh.querySelector('.bh-glow rect');
  if (glowRect) {
    // the light inside the sphere keeps flowing, held by its mask
    const wave = document.createElementNS(NS, 'g');
    glowRect.parentNode.insertBefore(wave, glowRect); wave.append(glowRect);
    gsap.to(wave, { x: 30, y: -22, rotation: 6, svgOrigin: `${BH.x} ${BH.y}`, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to(glowRect, { scale: 1.05, svgOrigin: `${BH.x} ${BH.y}`, duration: 13, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
  let landOn = true;
  new IntersectionObserver(([e]) => { landOn = e.isIntersecting; }).observe($('#landing'));
  gsap.ticker.add((t, dt) => {
    if (!landOn) return;
    const d = Math.min(0.05, dt / 1000);
    for (const p of fall) {
      p.r -= (p.sp + p.r * 0.05) * d;
      p.a += d * 0.06;
      if (p.r < 6) { p.r = 300 + Math.random() * 60; p.a = Math.random() * 6.283; }
      p.el.setAttribute('cx', (BH.x + Math.cos(p.a) * p.r).toFixed(1));
      p.el.setAttribute('cy', (BH.y + Math.sin(p.a) * p.r * 0.86).toFixed(1));
      p.el.setAttribute('opacity', (p.o * Math.min(1, (p.r - 6) / 90)).toFixed(3));
    }
  });
  try { stars.seed(await (await fetch('assets/stars.json')).json(), app.boardMap); } catch (e) {}

  // ---------------- Saturn, live from the frame: its rings sway on their own
  $('.saturn').innerHTML = await svg('assets/saturn.svg');
  gsap.fromTo('.saturn .sat-back, .saturn .sat-front', { rotation: -1.6 }, { rotation: 1.6, svgOrigin: '756 2672', duration: 10, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // ---------------- landing: wordmark + glass slab
  $$('.pf-l').forEach((l) => { l.innerHTML = `<span>${l.textContent}</span>`; });
  const slabLens = new Lens($('.pf'), { axis: 'v', chroma: 0.06, depth: 0.2, soft: 0.9 });
  const slab = { w: 0, mx: 0, m: 0 };
  gsap.ticker.add(() => {
    if (!landOn) return;
    slab.m += (slab.mx - slab.m) * 0.05;
    const el = $('.slab');
    el.style.transform = `translate3d(${slab.m.toFixed(1)}px,0,0) scaleX(${slab.w.toFixed(4)})`;
    slabLens.set(slab.m - $('.pf').offsetLeft, Math.max(4, el.offsetWidth * slab.w));
  });
  if (fine) $('#landing').addEventListener('pointermove', (e) => { slab.mx = (e.clientX / innerWidth - 0.3) * 40; });

  // ---------------- splits
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
    .to('.pf-l > span', { yPercent: 0, duration: 1.3, stagger: 0.09 }, 0.25)
    .to(slab, { w: 1, duration: 1.4, ease: 'expo.inOut' }, 0.45)
    .to('#landing .pop', { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.9)
    .add(() => { root.classList.remove('is-loading'); lenis.start(); app.afterIntro?.(); }, 0.6);
  const landOut = gsap.timeline({ paused: true })
    .to('.pf-l > span', { yPercent: -105, duration: 0.8, ease: 'expo.in', stagger: 0.05 }, 0)
    .to('#landing .pop', { y: -26, opacity: 0, duration: 0.6, ease: 'expo.in', stagger: 0.05 }, 0)
    .to(slab, { w: 0, duration: 0.9, ease: 'expo.inOut' }, 0);
  // the menu stays away on the landing and arrives once you move on
  ScrollTrigger.create({ trigger: '#landing', start: 'top top', end: 'bottom 45%',
    onLeave: () => { landOut.play(); nav.classList.add('is-shown'); },
    onEnterBack: () => { landOut.reverse(); nav.classList.remove('is-shown'); } });

  // ---------------- type in and out, section by section
  barLens($('.about-title'), $('#about .bar'), { rel: 0.78, drift: 0.08 });
  barLens($('.content-title'), $('#works .bar'), { rel: 0.56, drift: 0.1 });
  barLens($('.connect-title'), $('#connect .bar'), { rel: 0.62, drift: 0.12, chroma: 0.1 });
  inOut(aboutC, '.about-title', { stagger: 0.03 });
  inOut(contentC, '.content-title', { stagger: 0.05, duration: 1.2, start: 'top 75%' });
  inOut(thinkC, '.think', { stagger: 0.03, start: 'top 88%' });
  inOut(projC, '.proj-title', { stagger: 0.05, start: 'top 85%', end: 'bottom -60%' });
  inOut(connectC, '.connect-title', { stagger: 0.035, start: 'top 80%' });
  inOut(contactC, '.contact-title', { stagger: 0.025, start: 'top 85%' });
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
  pops($$('#about .skill-head, #about .chips li'), '#about .skills', root.classList.contains('portrait') ? { start: 'top 80%', end: 'bottom 5%' } : { start: 'top 20%', end: 'bottom -10%' });

  // works, projects, connect, contact, footer: their pills and blocks
  pops($$('#works .pop'), '#works .see-more', { start: 'top 96%', end: 'bottom 4%' });
  pops($$('#projects .pop'), '#projects', { start: 'top 60%', end: 'bottom 30%' });
  pops($$('#connect .pop'), '#connect .cn-btn', { start: 'top 96%', end: 'bottom 4%' });
  pops($$('#contact .pop'), '#contact', { start: 'top 55%', end: 'bottom 10%' });
  pops($$('#footer .pop'), '#footer', { start: 'top 30%', end: 'bottom top' });
  gsap.fromTo('#works .saturn', { scale: 0.9 }, { scale: 1.04, ease: 'none', transformOrigin: '50% 50%', scrollTrigger: { trigger: '#works', start: 'top bottom', end: 'bottom top', scrub: 0.9 } });
  gsap.from('.sheets i', { y: 80, duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#contact', start: 'top 70%', toggleActions: 'play none none reverse' } });

  // projects: the panels walk past the centre as the section scrolls by
  app.projects = new Projects(app);
  gsap.ticker.add((t, dt) => app.projects.update(Math.min(0.05, dt / 1000)));

  // footer: the wheel turns and rises out of the glass
  gsap.to('.w-ring', { rotate: 360, duration: 120, ease: 'none', repeat: -1 });
  gsap.to('.w-inner', { rotate: -360, duration: 90, ease: 'none', repeat: -1 });
  gsap.to('.w-petals', { rotate: 360, duration: 200, ease: 'none', repeat: -1 });
  gsap.timeline({ scrollTrigger: { trigger: '#footer', start: 'top bottom', end: 'top 10%', scrub: 0.9 } })
    .fromTo('#footer > .wheel', { yPercent: 40, scale: 0.85, rotate: -30 }, { yPercent: 0, scale: 1, rotate: 0, ease: 'none' }, 0)
    .fromTo('.wheel-lens', { yPercent: 40, scale: 0.85, rotate: -30 }, { yPercent: 0, scale: 1, rotate: 0, ease: 'none' }, 0);

  $$('.pill-btn, .nav-pill, .nav-contact, .pj-close').forEach(swell);
  ScrollTrigger.refresh();
}

// ---------------------------------------------------------------- footer sheet lens
$('svg.defs defs').insertAdjacentHTML('beforeend', `<filter id="sheet-lens" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feOffset in="d" dx="5" result="rs"/><feColorMatrix in="rs" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
  <feOffset in="d" dx="-5" result="bs"/><feColorMatrix in="bs" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>
  <feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
  <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1"/></filter>`);

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
