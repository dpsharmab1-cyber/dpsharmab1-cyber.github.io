// Start (Figma "New UI"): a white screen until type, wheel and blobs are in,
// then the splash (DESIGNER'S PORTFOLIO, the wheel turning, See more). See more
// hands over to the intro, HI! I'M DEEPAK SHARMA, which plays in full and
// can't be skipped; its own See more then opens the page (js/splash.js).
import { split } from './core.js';

export function runIntro(app) {
  const el = document.getElementById('intro');
  const words = [...el.querySelectorAll('.w')];
  words.forEach((w) => {
    w.dataset.split = 'chars';
    split(w);
    w.dataset.state = 'below';
  });
  // the splash plays the words in and out
  app.intro = { set: (st) => words.forEach((w) => { w.dataset.state = st; }) };
  const root = document.documentElement;
  // local tooling only (screenshots / Figma export); visitors always get the splash
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (local && new URLSearchParams(location.search).get('capture') === '1') {
    app.introOn = false; app.capture = true;
    root.classList.remove('booting');
    if (new URLSearchParams(location.search).get('splash') === '1') app.splash?.begin();
    return;
  }
  if (history.scrollRestoration) history.scrollRestoration = 'manual';
  // a #section link skips the splash, but waits until the page is ready
  const hash = location.hash && location.hash !== '#about' ? location.hash.slice(1) : null;
  if (hash) history.replaceState(null, '', location.pathname + location.search);
  // page, glass and wheel stay hidden until the splash takes over
  app.introOn = true;
  app.scroll.lock(true);
  window.scrollTo(0, 0);
  app.scroll.to(0, { immediate: true });
  (app.ready || Promise.resolve()).then(() => {
    root.classList.remove('booting');
    app.introOn = false;
    if (app.splash?.begin({ skip: !!hash })) return;
    app.scroll.lock(false);
    const t = hash && document.getElementById(hash);
    if (t) setTimeout(() => app.scrollToEl(t), 500);
    if (hash) history.replaceState(null, '', '#' + hash);
  });
}
