// Boot: wires the stage, scroll, reveals, glass and modules into one rAF loop.
import { SmoothScroll, Reveal, Spring, gradText } from './core.js';
import { hydrateIcons } from './icons.js';
import { Stage } from './gl/stage.js';
import { GlassLayer } from './glass.js';
import { Blobs, LogoCtl } from './scene.js';
import { Folders } from './folders.js';
import { Work } from './work.js';
import { ChapterPage } from './chpage.js';
import { Splash } from './splash.js';
import { Lightbox } from './lightbox.js';
import { Nav, Theme, Skills, Contact, Cursor, Magnet, counters } from './ui.js';
import { runIntro } from './intro.js';
import { Fx } from './fx.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const app = (window.__app = { themeListeners: [] });
hydrateIcons();

app.glass = new GlassLayer();
app.scroll = new SmoothScroll(document.getElementById('content'));
try {
  app.stage = new Stage(document.getElementById('gl'));
} catch (e) {
  console.warn('WebGL2 unavailable — CSS glass fallback', e);
  document.documentElement.classList.add('no-gl');
}
app.theme = new Theme(app);
app.skills = new Skills(app);          // builds the chips before glass scan
app.reveal = new Reveal(document);
app.glass.scan(document);
app.blobs = new Blobs({});
app.logo = new LogoCtl();
app.splash = app.logo.splash = new Splash(app);
app.lightbox = new Lightbox();
app.lightbox.onToggle = (open) => app.scroll.lock(open || !!app.chOpen);

// long jumps use the same language as the splash hand-over: the page sinks
// and fades, a white beat, then the destination rises from below
let curtain = null;
app.scrollToEl = (el) => {
  if (app.chpage?.route(el)) return;
  const pad = el.matches('.proj') ? 120 : el.matches('.chapter') ? 10 : 0;
  const y = el.id === 'about' ? 0 : el.getBoundingClientRect().top + app.scroll.y - pad;
  const far = Math.abs(y - app.scroll.y) > innerHeight * 1.2;
  if (far && app.scroll.enabled && !app.reducedMotion && !curtain) { curtain = { y, t: 0, phase: 1 }; return; }
  app.scroll.to(y);
};
app.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let curtainFade = 1;
function runCurtain(dt) {
  if (!curtain) return;
  const H = innerHeight, c = curtain;
  c.t += dt;
  if (c.phase === 1) {                                   // sink + fade out
    const e = inOut(Math.min(1, c.t / 0.8));
    app.scroll.shift = H * 0.3 * e; curtainFade = 1 - e;
    if (c.t >= 0.8) { c.phase = 2; c.t = 0; app.scroll.to(c.y, { immediate: true }); app.scroll.shift = H * 0.45; curtainFade = 0; }
  } else if (c.phase === 2) {                            // white beat
    if (c.t >= 0.3) { c.phase = 3; c.t = 0; }
  } else {                                               // rise into place
    const e = 1 - Math.pow(1 - Math.min(1, c.t / 1.2), 3);
    app.scroll.shift = H * 0.45 * (1 - e); curtainFade = e;
    if (c.t >= 1.2) { curtain = null; app.scroll.shift = 0; curtainFade = 1; }
  }
  app.scroll.content.style.opacity = curtainFade < 0.999 ? curtainFade.toFixed(3) : '';
}

app.folders = new Folders(document.querySelector('.folders'), {
  // phones open the chapter as its own page; larger screens scroll down to it
  onOpen: (id) => app.chpage.open(id) || app.scrollToEl(document.getElementById(`work-${id}`)),
});
app.work = new Work(app);
app.chpage = new ChapterPage(app);
app.nav = new Nav(app);
app.contact = new Contact(app);
app.cursor = new Cursor();
app.magnet = new Magnet();
app.fx = new Fx();
counters(app);

// ---- layout
let measureQueued = true;
const measure = () => {
  measureQueued = false;
  app.scroll.resize();
  const y = app.scroll.y;
  app.glass.measure(y);
  app.blobs.measure(y);
  app.logo.measure(y);
  app.folders.measure(y);
  app.work.measure(y);
  app.nav.measure(y);
  gradText();
};
const queue = () => { measureQueued = true; };
app.queueMeasure = queue;
addEventListener('resize', () => { app.stage?.resize(); queue(); });
if (app.stage) app.stage.onResize = queue;
new ResizeObserver(queue).observe(document.getElementById('content'));
document.fonts?.ready.then(queue);
document.fonts?.addEventListener?.('loadingdone', queue);
addEventListener('load', queue);
// any glass element that changes size (late fonts, wrapping) re-syncs its glass
const glassRO = new ResizeObserver(queue);
document.querySelectorAll('[data-glass]').forEach((el) => glassRO.observe(el));
document.querySelectorAll('#projects img').forEach((im) => im.addEventListener('load', queue, { once: true }));

// ---- assets
// blob images keep their names between redesigns; bump this so week-long
// browser caches pick up the new artwork
const BLOB_V = '2026-10-06b';
const loads = [document.fonts ? document.fonts.load('700 64px Montserrat').then(() => document.fonts.load('400 16px Montserrat')) : Promise.resolve()];
if (app.stage) {
  const used = new Set([...document.querySelectorAll('[data-blob]')].flatMap((el) => el.dataset.blob.split(/\s+/)));
  used.add('splash');
  // assets are cached for a week; the blob list must always be current
  loads.push(fetch('assets/blobs/blobs.json', { cache: 'no-cache' }).then((r) => r.json()).then((meta) => {
    app.blobs.meta = meta;
    // several sections share one artwork (meta[name].tex): load each image once
    const tex = new Set(Object.keys(meta).filter((k) => used.has(k)).map((k) => meta[k].tex || k));
    return Promise.all([...tex].map((k) => app.stage.loadTexture(k, `assets/blobs/${k}.png?v=${BLOB_V}`)));
  }));
  loads.push(app.stage.loadTexture('logo', 'assets/logo/logo-sdf.png'));
}
// the intro starts once type, logo and blobs are in (or after 4 s on a very slow line)
app.ready = Promise.race([Promise.all(loads).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);

runIntro(app);
// page glass stays hidden behind the intro and the splash, then fades in with
// the page; the wheel only waits for the intro
const pageFade = new Spring(app.introOn ? 0 : 1, 2.4);
const wheelFade = new Spring(app.introOn ? 0 : 1, 2.4);

// ---- loop
let last = performance.now();
const t0 = last;
const frame = (now) => {
  // capture tooling runs in a throttled background window: let springs catch up
  const dt = Math.min(app.capture ? 0.5 : 0.05, (now - last) / 1000);
  last = now;
  if (measureQueued) measure();
  runCurtain(dt);
  app.scroll.update(dt);
  if (app.chpage.isOpen) app.chpage.smooth.update(dt);
  const y = app.scroll.y;
  app.nav.update(dt);
  app.skills.update(dt);
  app.cursor.update(dt);
  app.magnet.update(dt);
  const st = app.stage;
  const W = st ? st.w : document.documentElement.clientWidth, H = st ? st.h : innerHeight;
  pageFade.set(app.introOn || app.splash.active ? 0 : 1);
  wheelFade.set(app.introOn ? 0 : 1);
  const pa = app.glass.pageAlpha = pageFade.step(dt) * curtainFade;
  const wa = wheelFade.step(dt) * curtainFade;
  if (st) {
    const t = (now - t0) / 1000;
    st.blobs.length = 0; st.glass.length = 0; st.logos.length = 0; st.folders.length = 0;
    app.blobs.update(t, y, W, H, st.blobs, pa, dt);
    app.splash.update(dt, W, H, st.blobs);
    app.logo.update(dt, y, W, H, st.logos, wa);
    app.folders.update(dt, y, st.folders, pa, W);
    app.work.update(dt, y, st.folders, pa, W, H);
    app.glass.update(dt, y, st.glass);
    // the chapter page covers the stage completely: keep the last frame
    if (!app.chpage.settled) st.render(t);
  } else {
    app.folders.update(dt, y, [], pa, W);
    app.work.update(dt, y, [], pa, W, H);
    app.glass.update(dt, y, []);
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
