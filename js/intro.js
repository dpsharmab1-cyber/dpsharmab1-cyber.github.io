// Intro (Figma Loading 4 → 3 → 5): HELLO! → I'M DEEPAK SHARMA → WELCOME TO MY
// PORTFOLIO, black on white, then the splash takes over.
// Plays in full on every load and cannot be skipped.
import { split } from './core.js';

export function runIntro(app) {
  const el = document.getElementById('intro');
  const lines = [...el.querySelectorAll('.intro-line')];
  lines.forEach((ln) => ln.querySelectorAll('.w').forEach((w) => {
    w.dataset.split = 'chars';
    split(w);
    w.dataset.state = 'below';
  }));
  const set = (i, st) => lines[i]?.querySelectorAll('.w').forEach((w) => { w.dataset.state = st; });
  const root = document.documentElement;
  // local tooling only (screenshots / Figma export); visitors always get the intro
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (local && new URLSearchParams(location.search).get('capture') === '1') {
    app.introOn = false; app.logo.introGate = 1; app.capture = true;
    root.classList.remove('booting');
    if (new URLSearchParams(location.search).get('splash') === '1') app.splash?.begin();
    return;
  }
  if (history.scrollRestoration) history.scrollRestoration = 'manual';
  // hold any #section link until the intro has played, so the browser can't jump past it
  const hash = location.hash && location.hash !== '#about' ? location.hash.slice(1) : null;
  if (hash) history.replaceState(null, '', location.pathname + location.search);
  const pin = () => { if (app.introOn) { window.scrollTo(0, 0); app.scroll.to(0, { immediate: true }); } };
  addEventListener('load', pin);
  addEventListener('scroll', pin);
  app.introOn = true;
  app.logo.introGate = 0;
  root.classList.add('intro-on');
  app.scroll.lock(true);
  window.scrollTo(0, 0);
  app.scroll.to(0, { immediate: true });
  const timeline = [];
  const at = (t, fn) => timeline.push([t, fn]);
  const STEP = 1.75;
  lines.forEach((_, i) => {
    at(0.35 + i * STEP, () => set(i, 'in'));
    at(0.35 + i * STEP + 1.3, () => set(i, 'above'));
  });
  const end = 0.35 + lines.length * STEP;
  at(end + 0.2, () => { app.logo.introGate = 1; });
  at(end + 0.4, () => {
    app.introOn = false;
    root.classList.remove('intro-on');
    // the splash takes over (and keeps the page locked) unless a link points deeper
    if (!app.splash?.begin({ skip: !!hash || !!app.deepLink })) app.scroll.lock(false);
    removeEventListener('scroll', pin);
    if (hash) {
      const t = document.getElementById(hash);
      if (t) setTimeout(() => app.scrollToEl(t), 500);
      history.replaceState(null, '', '#' + hash);
    }
  });
  // white screen until type + logo + blobs are loaded, then play
  (app.ready || Promise.resolve()).then(() => {
    root.classList.remove('booting');
    timeline.forEach(([t, fn]) => setTimeout(fn, t * 1000));
  });
}
