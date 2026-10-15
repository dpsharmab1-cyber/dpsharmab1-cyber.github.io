// Portfolio 2026 (v7): one scaled artboard, smooth scroll and the motion of
// every section. GSAP (ScrollTrigger, SplitText) drives the timelines; Lenis
// (MIT, darkroom.engineering) eases the scroll.
import Lenis from '../vendor/lenis.mjs';
import { Stars } from './stars.js?v=73';
import { Cards } from './projects.js?v=73';
import { Glass, type } from './glass.js?v=73';
import { Saturn } from './saturn.js?v=73';
import { BlackHole } from './blackhole.js?v=74';
import { ICONS } from './icons.js?v=73';

const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = (window.__v7 = {});
const root = document.documentElement;
const GAP = 320;                                  // extra room under the skills
const BOARD_W = 1512, BOARD_H = 7856 + GAP, FRAME_H = 982;
const BH = { x: 1198.5, y: 379 };                // black hole centre, artboard px
const NS = 'http://www.w3.org/2000/svg';
const V = document.documentElement.dataset.v || '1';
// board rows where the page is dark (the menu turns light-on-dark there)
const DARK = [[0, 1890], [2353 + GAP, 3690 + GAP], [5100 + GAP, 5650 + GAP], [6647 + GAP, BOARD_H]];

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
    app.bhDoc = { x: w / 2, y: 0 };   // phones: the hole sits half above the top edge
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
    if (!g.on || g.wipe <= 0.001) continue;
    // the magnet: a gentle lean toward the pointer while it is near
    const [mx, my] = g.mouse, b = g.o.band;
    let tx = 0, ty = 0;
    if (g.monT && g.magnet !== 'none') {
      const dx = mx - (b[0] + b[2] / 2), dy = my - (b[1] + b[3] / 2);
      if (Math.abs(dx) < b[2] / 2 + 220 && Math.abs(dy) < b[3] / 2 + 220) { tx = gsap.utils.clamp(-6, 6, dx * 0.02); ty = gsap.utils.clamp(-6, 6, dy * 0.04); }
    }
    g.off.x += (tx - g.off.x) * 0.08;
    g.off.y += (ty - g.off.y) * 0.08;
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
  const [wCore, wOuter, wInner] = await Promise.all(['core', 'outer', 'inner'].map((n) => svg(`assets/wheel-${n}.svg?v=${V}`)));

  // ---------------- the black hole, live in 3D (js/blackhole.js), drawn at
  // the frame's angle and in its flat layered reds
  const bh = $('.bh');
  const hole = new BlackHole(bh);
  addEventListener('resize', () => { hole.sized = false; });
  let landOn = true;
  new IntersectionObserver(([e]) => { landOn = e.isIntersecting; }).observe($('#landing'));
  gsap.ticker.add((t) => { if (landOn) hole.draw(reduced ? 0 : t); });
  try {
    const all = await (await fetch(`assets/stars.json?v=${V}`)).json();
    stars.seed(all.filter((s) => s[1] < FRAME_H), app.boardMap);
  } catch (e) {}

  // ---------------- Saturn, in 3D (js/saturn.js): a slow, quiet turn
  const sat = (app.saturn = new Saturn($('.saturn')));
  let satOn = false;
  new IntersectionObserver(([e]) => { satOn = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe($('.saturn'));
  addEventListener('resize', () => { sat.sized = false; });
  gsap.ticker.add((t, dt) => { if (satOn) sat.draw(reduced ? 0 : t, Math.min(0.05, dt / 1000)); });

  // ---------------- footer wheel: the two mantra rings turn opposite ways
  $('.wheel').innerHTML = `<div class="w-layer">${wCore}</div><div class="w-layer w-outer">${wOuter}</div><div class="w-layer w-inner">${wInner}</div>`;
  const img = async (src) => { const i = new Image(); i.src = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })); try { await i.decode(); } catch (e) {} return i; };
  const [iCore, iOuter, iInner] = await Promise.all([img(wCore), img(wOuter), img(wInner)]);
  const WC = { x: 756.5, y: 2235.5 - 1737 };              // the rings' centre, footer px
  const wheelRot = { a: 0, b: 0 };
  if (!reduced) {
    gsap.to(wheelRot, { a: 360, duration: 140, ease: 'none', repeat: -1 });
    gsap.to(wheelRot, { b: -360, duration: 100, ease: 'none', repeat: -1 });
  }
  const outerEl = $('.w-outer'), innerEl = $('.w-inner');
  gsap.ticker.add(() => { outerEl.style.transform = `rotate(${wheelRot.a.toFixed(3)}deg)`; innerEl.style.transform = `rotate(${wheelRot.b.toFixed(3)}deg)`; });
  const drawWheel = (c) => {
    c.drawImage(iCore, 356, 103, 800, 960);
    for (const [im, deg] of [[iOuter, wheelRot.a], [iInner, wheelRot.b]]) {
      c.save(); c.translate(WC.x, WC.y); c.rotate((deg * Math.PI) / 180); c.translate(-WC.x, -WC.y);
      c.drawImage(im, 356, 103, 800, 960); c.restore();
    }
  };

  // ---------------- glass panels, live: the capsules from the frames
  const CREAM = '#ffe0b5', RED = '#ff0000';
  const pad = (b, m = 18) => [b[0] - m, b[1] - m, b[2] + 2 * m, b[3] + 2 * m];
  const pill = (sel, band, params, texRect, source) => glass($(sel), { mode: 'pill', rect: pad(band), band, params, texRect, source });
  const gSlab = pill('.glass-slab', [220, 111, 98, 676], [70, 1.5, 0.06, 1.0], [0, 0, 560, 982],
    (c) => { for (const [t, x, y, col] of [['PO', 130, 344.785, CREAM], ['RT', 130, 534.785, CREAM], ['FOLIO', 130, 724.785, CREAM]]) type(c, t, x, y, 200, col); });
  const gAbout = pill('.glass-about', [34, 343, 654, 29], [-42, 0.33, 0.06, 0.6], [0, 250, 760, 260], (c) => type(c, 'DEEPAK SHARMA', 72, 399.16, 96, CREAM));
  const gContent = pill('.glass-content', [268, 921, 976, 84], [70, 0.72, 0.05, 0.6], [0, 760, 1512, 400], (c) => type(c, 'CONTENT', 361.48, 1069.9, 250, RED));
  const gConnect = pill('.glass-connect', [331, 427, 850, 49], [60, 0.45, 0.06, 0.6], [0, 360, 1512, 220], (c) => type(c, 'LET’S CONNECT', 406.25, 512.566, 130, RED));
  const X0 = () => app.x0 || 0, FULL = () => 1512 - 2 * X0();
  const gSheets = glass($('.glass-sheets'), { mode: 'sheets', rect: [X0(), 430, FULL(), 779], band: [0, 0, 0, 0], params: [0, 0, 0, 0], edges: [502, 557, 606], dome: [756, 502.5, 66], bg: [0.012, 0.012, 0.014], texRect: [300, 60, 912, 1100],
    maxTex: 1.1, source: drawWheel }, { magnet: 'none' });
  gSheets.wipe = 1;
  // the reflection follows the turning rings (refreshed every few frames)
  let wf = 0;
  gsap.ticker.add(() => { if (gSheets.on && !reduced && gSheets.texK && ++wf % 3 === 0) gSheets.texture(gSheets.texK); });
  // the footer glass always reaches both screen edges
  const placeGlass = () => gSheets.place([X0(), 430, FULL(), 779]);
  placeGlass(); addEventListener('resize', placeGlass);

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
  $$('.chips li').forEach((li) => {
    const name = li.textContent.trim();
    if (TIPS[name]) { li.dataset.tip = TIPS[name]; li.tabIndex = 0; }
    if (ICONS[name]) li.innerHTML = `<i class="ic">${ICONS[name]}</i><span>${li.innerHTML}</span>`;
  });

  // ---------------- splits
  $$('.pf-l').forEach((l) => l.classList.add('pf-ready'));
  const chars = (sel) => split($(sel), 'chars');
  const skillsC = chars('.skills-title'), aboutC = chars('.about-title'), contentC = chars('.content-title'), thinkC = chars('.think'), projC = chars('.proj-title');
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
  inOut(skillsC, '.skills-title', { stagger: 0.03, start: 'top 88%' });
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
  pops([$('#about .skills-eyebrow')], '#about .skills-eyebrow', { start: 'top 92%', end: 'bottom 5%' });
  $$('#about .skill-col').forEach((col) => pops($$('.skill-head, .chips li', col), col, { start: 'top 90%', end: 'bottom 5%' }));

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
