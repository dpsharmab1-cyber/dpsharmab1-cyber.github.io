// Portfolio 2026: boot, smooth scroll and the motion of every section.
// GSAP (ScrollTrigger, SplitText) drives the timelines; Lenis (MIT,
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
// 1 Figma frame px in CSS px (mirrors --u in style.css)
const unit = () => (innerWidth < 900 ? innerWidth / 820 : Math.min(innerWidth / 1512, innerHeight / 900));

// ---------------------------------------------------------------- scroll
const lenis = (app.lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, anchors: false }));
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

// ---------------------------------------------------------------- stars
const stars = new Stars($('#stars'));
gsap.ticker.add((t) => { stars.scroll = lenis.animatedScroll || scrollY; stars.draw(t); });

// ---------------------------------------------------------------- helpers
// letters rise in from below as a block arrives, and lift out above as it
// leaves (and the reverse when scrolling back up)
function inOut(targets, trigger, { from = 115, stagger = 0.022, duration = 1, start = 'top 82%', end = 'bottom 12%', rotate = 4 } = {}) {
  gsap.set(targets, { yPercent: from, rotate });
  const show = () => gsap.to(targets, { yPercent: 0, rotate: 0, duration, ease: 'expo.out', stagger, overwrite: true });
  const hide = (dir) => gsap.to(targets, { yPercent: dir * from, rotate: dir * rotate, duration: duration * 0.7, ease: 'expo.in', stagger: stagger * 0.6, overwrite: true });
  ScrollTrigger.create({ trigger, start, end, onEnter: show, onEnterBack: show, onLeave: () => hide(-1), onLeaveBack: () => hide(1) });
}
const splits = [];
function splitChars(el) { const s = SplitText.create(el, { type: 'chars,lines', mask: 'lines', linesClass: 'split-line', charsClass: 'split-char' }); splits.push(s); return s.chars; }
function splitLines(el) { const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' }); splits.push(s); return s.lines; }
function splitWords(el) { const s = SplitText.create(el, { type: 'words', mask: 'words' }); splits.push(s); return s.words; }

// ---------------------------------------------------------------- nav
const nav = $('#nav');
const links = $$('[data-nav]', nav);
function setNav(id, theme) {
  const map = { landing: 'landing', about: 'about', works: 'works', projects: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
  links.forEach((a) => a.classList.toggle('is-on', a.dataset.nav === map[id]));
  nav.classList.toggle('on-light', theme === 'light');
}
$$('main > .sec').forEach((sec) => {
  ScrollTrigger.create({ trigger: sec, start: 'top 60px', end: 'bottom 60px', onToggle: (s) => s.isActive && setNav(sec.id, sec.dataset.theme) });
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.matches('.pj-next')) return;
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  lenis.scrollTo(t, { duration: 1.6, easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) });
});

// ---------------------------------------------------------------- cursor + magnets
class Cursor {
  constructor() {
    this.el = $('.cursor'); this.dot = $('.cursor-dot'); this.ring = $('.cursor-ring'); this.lab = $('.cursor-label');
    this.x = this.y = this.rx = this.ry = -100;
    if (!fine || reduced) return;
    document.documentElement.classList.add('has-cursor');
    addEventListener('pointermove', (e) => { this.x = e.clientX; this.y = e.clientY; });
    document.addEventListener('pointerover', (e) => { if (!this.forced && e.target.closest('a, button, .chips li, input, textarea')) this.el.classList.add('is-link'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest('a, button, .chips li, input, textarea')) this.el.classList.remove('is-link'); });
    gsap.ticker.add(() => {
      this.rx += (this.x - this.rx) * 0.18; this.ry += (this.y - this.ry) * 0.18;
      this.dot.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.ring.style.transform = `translate3d(${this.rx}px,${this.ry}px,0)`;
    });
  }
  state(kind, label = '') {
    this.forced = !!kind;
    this.el.classList.toggle('is-big', kind === 'big');
    this.el.classList.remove('is-link');
    this.lab.textContent = label;
  }
}
app.cursor = new Cursor();

function magnet(el, k = 0.35, max = 14) {
  if (!fine || reduced) return;
  const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
  const icon = el.querySelector('.pill-arrow');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    xTo(gsap.utils.clamp(-max, max, dx * k)); yTo(gsap.utils.clamp(-max, max, dy * k));
    if (icon) gsap.to(icon, { x: dx * 0.12, y: dy * 0.12, duration: 0.6, ease: 'power3.out' });
  });
  el.addEventListener('pointerleave', () => { xTo(0); yTo(0); if (icon) gsap.to(icon, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .5)' }); });
}

// ---------------------------------------------------------------- lenses
const lenses = [];
function barLens(title, bar, { rel = 0.62, size = null, drift = 0.35, scrub = true, chroma = 0.14 } = {}) {
  const lens = new Lens(title, { axis: 'h', chroma, depth: 0.55 });
  const st = { off: 0, mouse: 0, m: 0 };
  const place = () => {
    const th = title.offsetHeight;
    const h = size ? size() : bar.offsetHeight;
    const y = th * rel - h / 2 + (st.off + st.m) * th;
    bar.style.transform = `translate3d(0, ${(title.offsetTop + y - bar.offsetTop).toFixed(1)}px, 0)`;
    lens.set(y, h);
  };
  const item = { place, st, on: true };
  new IntersectionObserver(([e]) => { item.on = e.isIntersecting; }, { rootMargin: '20% 0px' }).observe(title);
  lenses.push(item);
  if (scrub) gsap.fromTo(st, { off: -drift }, { off: drift, ease: 'none', scrollTrigger: { trigger: title, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  if (fine) {
    const sec = title.closest('.sec');
    sec.addEventListener('pointermove', (e) => { const r = title.getBoundingClientRect(); st.mouse = gsap.utils.clamp(-0.35, 0.35, ((e.clientY - r.top) / r.height - 0.5) * 0.4); });
    sec.addEventListener('pointerleave', () => { st.mouse = 0; });
  }
  return lens;
}
gsap.ticker.add(() => lenses.forEach((l) => { if (!l.on) return; l.st.m += (l.st.mouse - l.st.m) * 0.06; l.place(); }));

// ---------------------------------------------------------------- build
async function boot() {
  try { await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 20px Montserrat'), document.fonts.ready]); } catch (e) {}

  // landing wordmark: each line rises out of its own mask
  $$('.pf-l').forEach((l) => { l.innerHTML = `<span>${l.textContent}</span>`; });
  const slabLens = new Lens($('.pf'), { axis: 'v', chroma: 0.18, depth: 0.45 });
  const slabState = { w: 0, x: 0, mx: 0, m: 0 };
  const placeSlab = () => {
    const pf = $('.pf').getBoundingClientRect();
    const slab = $('.slab');
    const w = slab.offsetWidth * slabState.w;
    const x = slabState.x + slabState.m;
    slab.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scaleX(${slabState.w.toFixed(4)})`;
    slabLens.set(x - pf.left, Math.max(4, w));
  };
  let slabOn = true;
  new IntersectionObserver(([e]) => { slabOn = e.isIntersecting; }).observe($('#landing'));
  gsap.ticker.add(() => { if (!slabOn) return; slabState.m += (slabState.mx - slabState.m) * 0.05; placeSlab(); });
  if (fine) $('#landing').addEventListener('pointermove', (e) => { slabState.mx = (e.clientX / innerWidth - 0.3) * 60; });

  // text splits
  const aboutChars = splitChars($('.about-title'));
  const contentChars = splitChars($('.content-title'));
  const thinkChars = splitChars($('.think'));
  const projChars = splitChars($('.proj-title'));
  const connectChars = splitChars($('.connect-title'));
  const contactChars = splitChars($('.contact-title'));
  const wordsEls = $$('[data-reveal="words"]').map((el) => [el, splitWords(el)]);
  const lineEls = $$('[data-reveal="lines"]').map((el) => [el, splitLines(el)]);

  // the pinned projects section first: triggers below it must see its pin spacing
  app.projects = new Projects(app);
  gsap.ticker.add((t, dt) => app.projects.update(Math.min(0.05, dt / 1000)));

  // glass bars over the big titles
  barLens($('.about-title'), $('.about .bar'), { rel: 0.72, drift: 0.18 });
  barLens($('.content-title'), $('.content .bar'), { rel: 0.5, drift: 0.3 });
  barLens($('.connect-title'), $('.connect .bar'), { rel: 0.5, drift: 0.4, chroma: 0.2 });

  // ---------------- intro: into the black hole, out into the landing
  const intro = $('#intro');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  const skip = reduced || /[?&]skip/.test(location.search);
  if (skip) { intro.remove(); stars.alpha = 1; }
  else {
    tl.to(stars, { alpha: 1, duration: 2, ease: 'power1.out' }, 0)
      .to('#intro .bh', { opacity: 1, scale: 1, duration: 2.2, ease: 'expo.out' }, 0.1)
      .fromTo('#intro .bh', { rotate: -14 }, { rotate: 4, duration: 3.2, ease: 'sine.inOut' }, 0.1)
      .to('.intro-word span', { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.6)
      .to('.intro-word span', { yPercent: -110, duration: 0.7, ease: 'expo.in' }, 2.15)
      // the dive: the hole swells past the edges of the screen and the dark swallows it
      .to('#intro .bh', { scale: 9, opacity: 0, filter: 'blur(14px)', duration: 1.5, ease: 'expo.in' }, 2.2)
      .to(intro, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.6, ease: 'power1.out' }, 3.35)
      .add(() => intro.remove(), 3.95);
  }
  const t0 = skip ? 0 : 3.2;
  gsap.set('.pf-l > span', { yPercent: 105 });
  gsap.set('.planet-red', { xPercent: 28, yPercent: -10, rotate: 16, opacity: 0 });
  gsap.set(slabState, { w: 0 });
  tl.to('.planet-red', { xPercent: 0, yPercent: 0, rotate: 0, opacity: 1, duration: 2.4, ease: 'expo.out' }, t0)
    .to('.pf-l > span', { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: { each: 0.09, from: 'start' } }, t0 + 0.15)
    .to(slabState, { w: 1, duration: 1.4, ease: 'expo.inOut' }, t0 + 0.35)
    .from('.hero-stats > div, .hero-role', { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, t0 + 0.9)
    .from('.nav > *', { y: -30, opacity: 0, duration: 1, stagger: 0.1 }, t0 + 0.7)
    .add(() => { document.documentElement.classList.remove('is-loading'); lenis.start(); app.afterIntro?.(); }, t0 + 1.2);

  // ---------------- landing: the planet turns away as you leave
  gsap.fromTo('.planet-red img', { rotate: -5 }, { rotate: 5, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '62% 48%' });
  gsap.timeline({ scrollTrigger: { trigger: '#landing', start: 'top top', end: 'bottom top', scrub: 0.8 } })
    .to('.planet-red', { rotate: -22, xPercent: -14, yPercent: -18, scale: 1.18, ease: 'none' }, 0)
    .to('.pf', { yPercent: -18, opacity: 0.15, ease: 'none' }, 0)
    .to(slabState, { x: () => innerWidth * 0.22, ease: 'none' }, 0)
    .to('.hero-stats, .hero-role', { y: -60, opacity: 0, ease: 'none' }, 0);
  if (fine) {
    const px = gsap.quickTo('.planet-red', 'x', { duration: 1.6, ease: 'power3.out' });
    const py = gsap.quickTo('.planet-red', 'y', { duration: 1.6, ease: 'power3.out' });
    $('#landing').addEventListener('pointermove', (e) => { px((e.clientX / innerWidth - 0.5) * -40); py((e.clientY / innerHeight - 0.5) * -26); });
  }

  // ---------------- about
  inOut(aboutChars, '.about-title', { stagger: 0.03 });
  // the footer is the last screen: its copy keys off the footer itself, since
  // the glass it sits on is still sliding up while it is measured
  const opt = (el) => (el.closest('#footer') ? { trigger: '#footer', start: 'top 45%', end: 'bottom top' } : {});
  wordsEls.forEach(([el, w]) => { const o = opt(el); inOut(w, o.trigger || el, { stagger: 0.04, from: 110, rotate: 0, ...o }); });
  lineEls.forEach(([el, l]) => { const o = opt(el); inOut(l, o.trigger || el, { stagger: 0.08, from: 105, rotate: 0, duration: 1.1, ...o }); });
  gsap.utils.toArray('.xp-list li').forEach((li, i) => {
    gsap.from(li, { x: 60, opacity: 0, duration: 1.1, ease: 'expo.out', delay: i * 0.06, scrollTrigger: { trigger: li, start: 'top 92%', toggleActions: 'play reverse play reverse' } });
  });
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.6, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
  });
  gsap.from('.stats > div', { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.stats', start: 'top 92%', toggleActions: 'play reverse play reverse' } });
  // the paper slides up over the dark
  gsap.fromTo('.about .paper', { y: () => 120 * unit() }, { y: 0, ease: 'none', scrollTrigger: { trigger: '.about .paper', start: 'top bottom', end: 'top 45%', scrub: 0.8 } });
  $$('.skill-col').forEach((col) => {
    const chips = $$('.chips li', col);
    gsap.from(chips, { y: 40, opacity: 0, rotate: () => gsap.utils.random(-8, 8), scale: 0.9, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.045, scrollTrigger: { trigger: col, start: 'top 88%', toggleActions: 'play reverse play reverse' } });
  });

  // ---------------- works intro: Saturn turns while the title passes under glass
  gsap.to('.sat-back, .sat-front', { rotate: 3, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 50%' });
  gsap.to('.saturn', { y: () => -14 * unit(), duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.timeline({ scrollTrigger: { trigger: '#works', start: 'top bottom', end: 'bottom top', scrub: 0.9 } })
    .fromTo('.saturn', { scale: 0.78, rotate: -10, yPercent: 14 }, { scale: 1.12, rotate: 6, yPercent: -10, ease: 'none' }, 0);
  inOut(contentChars, '.content-title', { stagger: 0.05, duration: 1.2, start: 'top 75%' });
  inOut(thinkChars, '.think', { stagger: 0.03, start: 'top 85%' });
  gsap.from('#works .pill-btn', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#works .pill-btn', start: 'top 95%', toggleActions: 'play reverse play reverse' } });

  // ---------------- projects
  inOut(projChars, '.proj-title', { stagger: 0.05, start: 'top 80%', end: 'bottom -400%' });

  // ---------------- connect
  inOut(connectChars, '.connect-title', { stagger: 0.035, start: 'top 80%' });
  gsap.from('.connect .pill-btn', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.connect .pill-btn', start: 'top 95%', toggleActions: 'play reverse play reverse' } });

  // ---------------- contact
  inOut(contactChars, '.contact-title', { stagger: 0.025, start: 'top 85%' });
  gsap.from('.sheets i', { y: () => 80 * unit(), duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#contact', start: 'top 70%', toggleActions: 'play none none reverse' } });
  gsap.from('.form-title, .topic, .field, .form-foot, .contact-card', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.contact-grid', start: 'top 80%', toggleActions: 'play none none reverse' } });

  // ---------------- footer: the wheel turns and rises out of the glass
  gsap.to('.w-ring', { rotate: 360, duration: 120, ease: 'none', repeat: -1 });
  gsap.to('.w-inner', { rotate: -360, duration: 90, ease: 'none', repeat: -1 });
  gsap.to('.w-petals', { rotate: 360, duration: 200, ease: 'none', repeat: -1 });
  gsap.timeline({ scrollTrigger: { trigger: '#footer', start: 'top bottom', end: 'top top', scrub: 0.9 } })
    .fromTo('#footer > .wheel', { yPercent: 55, scale: 0.8, rotate: -40 }, { yPercent: 0, scale: 1, rotate: 0, ease: 'none' }, 0)
    .fromTo('.wheel-lens', { yPercent: 55, scale: 0.8, rotate: -40 }, { yPercent: 0, scale: 1, rotate: 0, ease: 'none' }, 0)
    .from('.fsheet', { y: () => 140 * unit(), stagger: 0.08, ease: 'none' }, 0.1);

  // the torn edges drift a little against the scroll, like paper sliding
  $$('.tear').forEach((t) => gsap.fromTo(t, { y: () => 26 * unit() }, { y: () => -26 * unit(), ease: 'none', scrollTrigger: { trigger: t.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 } }));

  // magnets
  $$('.pill-btn, .nav a, .pj-close').forEach((el) => magnet(el));

  ScrollTrigger.refresh();
}

// ---------------------------------------------------------------- footer sheet lens (static)
(() => {
  const defs = $('svg.defs defs');
  defs.insertAdjacentHTML('beforeend', `<filter id="sheet-lens" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feOffset in="d" dx="5" result="rs"/><feColorMatrix in="rs" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
    <feOffset in="d" dx="-5" result="bs"/><feColorMatrix in="bs" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>
    <feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
    <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1"/></filter>`);
})();

// ---------------------------------------------------------------- contact form (no backend on GitHub Pages: the mail app opens, filled in)
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
addEventListener('resize', () => ScrollTrigger.refresh());
