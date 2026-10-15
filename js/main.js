// Portfolio 2026 (v7): one scaled artboard, smooth scroll and the motion of
// every section. GSAP (ScrollTrigger, SplitText) drives the timelines; Lenis
// (MIT, darkroom.engineering) eases the scroll.
import Lenis from '../vendor/lenis.mjs';
import { Stars } from './stars.js';
import { Cards } from './projects.js';
import { Glass, type } from './glass.js';
import { Saturn } from './saturn.js';

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
    app.x0 = 0;
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
  app.x0 = Math.min(0, -((w / s) - BOARD_W) / 2) - 2;   // first visible board px on the left
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
// Every panel is live glass (js/glass.js). It slides over its type once the
// letters land and off before they leave, leans a few px toward the pointer
// (a subtle magnet) and catches a soft light under it.
const glasses = [];
function glass(holder, opts, { magnet = 'y' } = {}) {
  const g = new Glass(holder.parentElement, opts);
  holder.replaceWith(g.c);
  g.c.className = holder.className;
  Object.assign(g, { wipe: 0, on: false, magnet, mo: { x: 0, y: 0, w: 0 } });
  new IntersectionObserver(([e]) => { g.on = e.isIntersecting; }, { rootMargin: '15% 0px' }).observe(g.c);
  g.show = (d = 1.3) => gsap.to(g, { wipe: 1, duration: d, ease: 'expo.inOut', overwrite: true });
  g.hide = (d = 0.6) => gsap.to(g, { wipe: 0, duration: d, ease: 'expo.in', overwrite: true });
  glasses.push(g);
  return g;
}
if (fine) {
  addEventListener('pointermove', (e) => { for (const g of glasses) if (g.on) g.pointer(e.clientX, e.clientY, true); }, { passive: true });
  document.addEventListener('pointerleave', () => glasses.forEach((g) => { g.monT = 0; }));
}
gsap.ticker.add((t) => {
  for (const g of glasses) {
    g.c.style.setProperty('--wipe', g.wipe.toFixed(4));
    // how far the slab now covers: the live letters under it hand over to the glass
    if (g.magnet === 'x') g.c.parentElement.style.setProperty('--gx', Math.min(g.rect[0] + g.wipe * g.rect[2], g.o.band[0] + g.o.band[2] + g.off.w).toFixed(1));
    if (!g.on || g.wipe <= 0.001) continue;
    // the magnet: a gentle lean toward the pointer while it is near
    const [mx, my] = g.mouse, b = g.o.band;
    let tx = 0, tw = 0;
    if (g.monT) {
      if (g.magnet === 'y') { const d = my - (b[1] + b[3] / 2); if (Math.abs(d) < 260) tx = gsap.utils.clamp(-6, 6, d * 0.045); }
      else { const d = mx - (b[0] + b[2]); if (d > -260 && d < 320 && my > b[1] && my < b[1] + b[3]) tw = gsap.utils.clamp(-9, 12, d * 0.05); }
    }
    g.off.y += (tx - g.off.y) * 0.08;
    g.off.w += (tw - g.off.w) * 0.08;
    if (!reduced) g.draw(t); else if (!g.drawn) { g.draw(0); g.drawn = 1; }
  }
});

// ---------------------------------------------------------------- nav
const nav = $('#nav');
const links = $$('[data-nav]', nav);
const secs = $$('section.sec, footer.sec');
const navMap = { landing: 'landing', about: 'about', works: 'works', projects: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
let secTops = [];
// section rows, measured on resize only: reading layout every frame made the page stutter
const measure = () => { const y = lenis.animatedScroll || scrollY; secTops = secs.map((el) => { const r = el.getBoundingClientRect(); return { el, top: r.top + y, h: r.height }; }); };
addEventListener('resize', () => setTimeout(measure, 50));
gsap.ticker.add(() => {
  const probe = 60, y = (lenis.animatedScroll || scrollY) + probe;
  if (!secTops.length) measure();
  let cur = secTops[0];
  for (const s of secTops) if (y >= s.top && y < s.top + s.h) cur = s;
  cur = cur.el;
  let light;
  if (app.toBoard) { const by = app.toBoard(y); light = !DARK.some(([a, b]) => by >= a && by < b); }
  else light = cur.dataset.theme === 'light';
  if (light !== app.navLight) { nav.classList.toggle('on-light', light); app.navLight = light; }
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
  const [bhSvg, wheelSvg] = await Promise.all([svg('assets/blackhole.svg'), svg('assets/wheel.svg')]);

  // ---------------- the black hole, live from the frame. Its art stays still
  // (one layer, painted once); the stars falling into it live on a small canvas.
  const bh = $('.bh');
  bh.innerHTML = bhSvg;
  const fallC = document.createElement('canvas');
  fallC.className = 'bh-fall';
  bh.append(fallC);
  const fx = fallC.getContext('2d'), FR = 340;
  const fall = Array.from({ length: 90 }, () => ({ a: Math.random() * 6.283, r: 20 + Math.random() * 320, sp: 5 + Math.random() * 9, o: 0.3 + Math.random() * 0.6, s: 0.7 + Math.random() * 1.5, tw: Math.random() * 6 }));
  const fallSize = () => { const k = Math.min(2, devicePixelRatio || 1) * Math.max(0.5, app.scale || 1); fallC.width = fallC.height = Math.round(FR * 2 * k); fx.setTransform(k, 0, 0, k, 0, 0); };
  fallSize(); addEventListener('resize', fallSize);
  let landOn = true;
  new IntersectionObserver(([e]) => { landOn = e.isIntersecting; }).observe($('#landing'));
  gsap.ticker.add((t, dt) => {
    if (!landOn) return;
    const d = Math.min(0.05, dt / 1000);
    fx.clearRect(0, 0, FR * 2, FR * 2);
    fx.fillStyle = '#fff';
    for (const p of fall) {
      p.r -= (p.sp + p.r * 0.05) * d;
      p.a += d * 0.08;
      if (p.r < 6) { p.r = 300 + Math.random() * 36; p.a = Math.random() * 6.283; }
      fx.globalAlpha = p.o * Math.min(1, (p.r - 6) / 90) * (0.65 + 0.35 * Math.sin(t * 1.3 + p.tw));
      fx.beginPath(); fx.arc(FR + Math.cos(p.a) * p.r, FR + Math.sin(p.a) * p.r, p.s, 0, 6.283); fx.fill();
    }
  });
  try {
    const all = await (await fetch('assets/stars.json')).json();
    stars.seed(all.filter((s) => s[1] < FRAME_H), app.boardMap);
  } catch (e) {}

  // ---------------- Saturn, in 3D
  const sat = new Saturn($('.saturn'));
  let satOn = false;
  new IntersectionObserver(([e]) => { satOn = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe($('.saturn'));
  addEventListener('resize', () => { sat.sized = false; });
  gsap.ticker.add((t) => { if (satOn) sat.draw(reduced ? 0 : t); });

  // ---------------- footer wheel
  $('.wheel').innerHTML = wheelSvg;
  const wheelImg = new Image();
  wheelImg.src = URL.createObjectURL(new Blob([wheelSvg], { type: 'image/svg+xml' }));
  try { await wheelImg.decode(); } catch (e) {}

  // ---------------- glass panels, live
  const X0 = () => app.x0 || 0, FULL = () => 1512 - 2 * X0();
  const CREAM = '#ffe0b5', RED = '#ff0000';
  const gSlab = glass($('.glass-slab'), { mode: 'slab', rect: [X0(), 0, 350 - X0(), 982], band: [X0(), 0, 328 - X0(), 979], params: [0.85, 60, 0.09, 1.0], texRect: [0, 0, 560, 982],
    source: (c) => { for (const [t, x, y, col] of [['PO', 130, 344.785, CREAM], ['RT', 130, 534.785, CREAM], ['FOLIO', 130, 724.785, CREAM], ['20', 330.344, 343.717, RED], ['26', 330.344, 533.717, RED]]) type(c, t, x, y, 200, col); } }, { magnet: 'x' });
  const gAbout = glass($('.glass-about'), { mode: 'bar', rect: [X0(), 344, 735 - X0(), 94], band: [X0(), 358, 721 - X0(), 66], params: [1.0, 0.16, 0.07, 0.7], texRect: [0, 250, 760, 260],
    source: (c) => type(c, 'DEEPAK SHARMA', 72, 399.16, 96, CREAM) });
  const gContent = glass($('.glass-content'), { mode: 'bar', rect: [X0(), 888, FULL(), 151], band: [X0(), 902, FULL(), 123], params: [1.0, 0.26, 0.07, 0.7], texRect: [0, 760, 1512, 400],
    source: (c) => type(c, 'CONTENT', 361.48, 1069.9, 250, RED) });
  const gConnect = glass($('.glass-connect'), { mode: 'bar', rect: [X0(), 416, FULL(), 72], band: [X0(), 430, FULL(), 44], params: [1.35, 0.3, 0.08, 0.6], texRect: [0, 360, 1512, 220],
    source: (c) => type(c, 'LET’S CONNECT', 406.25, 512.566, 130, RED) });
  const gSheets = glass($('.glass-sheets'), { mode: 'sheets', rect: [X0(), 430, FULL(), 779], band: [0, 0, 0, 0], params: [0, 0, 0, 0], edges: [502, 557, 606], dome: [756, 502.5, 66], bg: [0.012, 0.012, 0.014], texRect: [300, 200, 912, 912],
    source: (c) => c.drawImage(wheelImg, 356, 263, 800, 800) }, { magnet: 'none' });
  gSheets.wipe = 1;
  addEventListener('resize', () => {
    // the full-width panes always reach both screen edges; the slab and the about bar the left one
    const x0 = X0(), W = FULL();
    gSlab.place([x0, 0, 350 - x0, 982]); gSlab.o.band = [x0, 0, 328 - x0, 979];
    gAbout.place([x0, 344, 735 - x0, 94]); gAbout.o.band = [x0, 358, 721 - x0, 66];
    for (const [g, r, b] of [[gContent, [888, 151], [902, 123]], [gConnect, [416, 72], [430, 44]]]) { g.place([x0, r[0], W, r[1]]); g.o.band = [x0, b[0], W, b[1]]; }
    gSheets.place([x0, 430, W, 779]);
  });

  // ---------------- skills: a line on what each one means in practice
  const TIPS = {
    'Visual Design': 'Layouts, campaigns and key visuals that hold a brand together.',
    'Branding': 'Identity systems: logo, colour, type and how they live everywhere.',
    'Logo design': 'Marks that read at 16 px and on a billboard alike.',
    'UI / UX': 'Flows, wireframes and polished screens for apps and dashboards.',
    'Packaging': 'Dielines, labels and shelf-ready packs, print files included.',
    'Social Media': 'Post systems and campaigns planned as a grid, not one-offs.',
    'Print designing': 'Brochures, catalogues and large-format, press-ready.',
    'Typography & color': 'Type pairing and palettes that set the tone first.',
    'Figma': 'UI design, prototypes, components and design systems.',
    'Photoshop': 'Retouching, compositing and campaign key visuals.',
    'Illustrator': 'Logos, icons, illustration and vector packaging art.',
    'InDesign': 'Multi-page layouts: catalogues, brochures, books.',
    'Blender 3D': '3D product renders, mock-ups and game assets.',
    'Spine 2D': 'Rigged 2D character animation for games.',
    'Canva': 'Quick, on-brand templates teams can edit themselves.',
    'Corel Draw': 'Print and signage files, the way print shops want them.',
    'WordPress': 'Building and styling sites clients can run on their own.',
    'WooCommerce': 'Online stores: product pages, checkout, catalogues.',
    'AI design tools': 'Midjourney, Firefly and friends for faster concepts.',
    'AI workflows': 'AI built into the pipeline: briefs, variants, resizing.',
    'Cross-functional leadership': 'Leading designers alongside dev, product and marketing.',
  };
  $$('.chips li').forEach((li) => { const tip = TIPS[li.textContent.trim()]; if (!tip) return; li.dataset.tip = tip; li.tabIndex = 0; });

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
  gsap.fromTo('#works .saturn', { yPercent: 8 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '#works', start: 'top bottom', end: 'bottom top', scrub: 0.9 } });
  gsap.from('.sheets i', { y: 70, duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#contact', start: 'top 75%', toggleActions: 'play none none reverse' } });

  // marquee: an endless, steady run that leans on the scroll speed
  const track = $('.mq-track');
  const unit = track.innerHTML, unitW = track.scrollWidth, pair = unitW / 4;
  while (track.scrollWidth < track.parentElement.offsetWidth + unitW * 2) track.insertAdjacentHTML('beforeend', unit);
  // start where the frame has it: a "Welcome" at x -194
  let mx = ((2000 - 194) % pair) - pair * 2, boost = 0;
  lenis.on('scroll', (l) => { boost = Math.min(6, Math.abs(l.velocity) * 0.25); });
  gsap.ticker.add((t, dt) => { boost *= 0.94; mx -= (0.9 + boost) * (dt / 16.7); if (mx < -unitW) mx += unitW; track.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`; });

  // projects: the cards
  app.cards = new Cards(app);

  // footer: the wheel and its glass come up out of the dark together
  gsap.fromTo('.wheel, .glass-sheets', { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#footer', start: 'top bottom', end: 'top 30%', scrub: 0.6 } });

  $$('.pill, .nav-pill, .nav-contact, .pj-close, .topic').forEach(swell);
  measure();
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
