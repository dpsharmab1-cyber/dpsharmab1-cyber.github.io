// Motion v2, layered over the classic site:
//  - text: GSAP SplitText reveals. Headlines rise letter by letter with a 3D
//    tip; paragraphs and small labels slide up line by line from a mask.
//    The page's own Reveal observer still decides when (data-state below / in /
//    above); GSAP only replaces the CSS transitions.
//  - scroll read: the two lead lines fill in word by word as they scroll past
//    (ScrollTrigger, scrubbed).
//  - view transitions: a work image grows out of its thumbnail into the viewer
//    and back; a folder page opens as a circle from the click and closes into
//    it; "Next" slides one folder out and the next one in.
//  - NumberFlow rolls the stat counters; GSAP Flip animates the social filter.
// The switch is the small script at the top of index.html (?motion=classic or
// ?motion=new to compare). With it off this file never loads.
import { gsap, SplitText, ScrollTrigger, Flip } from './vendor/motion-libs.mjs';

gsap.registerPlugin(SplitText, ScrollTrigger, Flip);

const root = document.documentElement;
const SCROLL_READ = '.hero-lead, .connect-lead';

export function initMotion(app) {
  textReveals(app);
  scrollRead(app);
  numberFlow(app);
  socialFlip(app);
  viewTransitions(app);
}

// ---------------------------------------------------------------------------
// text reveals
const HIDE = {
  chars: { below: { yPercent: 115, rotationX: -75, opacity: 0 }, above: { yPercent: -115, rotationX: 75, opacity: 0 } },
  lines: { below: { yPercent: 108, opacity: 0 }, above: { yPercent: -108, opacity: 0 } },
};

function textReveals(app) {
  const items = new Map();
  document.querySelectorAll('[data-split]').forEach((el) => {
    if (el.matches(SCROLL_READ) || el.closest('#intro')) return;
    const it = { el, tween: null, targets: [] };
    // css/motion.css styles only what carries .gs: the intro keeps the classic split
    el.classList.add('gs');
    if (el.dataset.split === 'chars') {
      // the classes match the classic split, so the per-letter gradient
      // (gradText) and the word masks keep working
      it.kind = 'chars';
      const s = SplitText.create(el, { type: 'words,chars', wordsClass: 'wd', charsClass: 'ch', tag: 'span', aria: 'auto' });
      it.targets = s.chars;
      gsap.set(s.chars, { x: 0, y: 0, rotation: 0, transformPerspective: 700, transformOrigin: '50% 100%' });
    } else {
      // paragraphs and labels: lines only exist once laid out, so autoSplit
      // re-splits on width or font changes
      it.kind = 'lines';
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'ln', aria: 'auto', autoSplit: true,
        onSplit(self) {
          it.tween?.kill();
          it.targets = self.lines;
          show(it, el.dataset.state || 'below', true);
          app.queueMeasure?.();
        },
      });
    }
    items.set(el, it);
    if (it.kind !== 'lines') show(it, el.dataset.state || 'below', true);
  });
  app.reveal.on((el, st) => { const it = items.get(el); if (it) show(it, st, false); });
  app.queueMeasure?.();
}

function show(it, st, instant) {
  it.tween?.kill();
  if (!it.targets.length) return;
  if (st === 'in') {
    const vars = { yPercent: 0, rotationX: 0, opacity: 1, overwrite: true };
    if (instant) { gsap.set(it.targets, vars); return; }
    it.tween = gsap.to(it.targets, it.kind === 'chars'
      ? { ...vars, duration: 1.15, ease: 'expo.out', stagger: { each: 0.022 } }
      : { ...vars, duration: 1.1, ease: 'expo.out', stagger: 0.09 });
    return;
  }
  const hide = { ...HIDE[it.kind][st], overwrite: true };
  if (instant) { gsap.set(it.targets, hide); return; }
  // leaving: quicker, and the last letter / line goes first when leaving upward
  it.tween = gsap.to(it.targets, { ...hide, duration: 0.55, ease: 'power3.in', stagger: { each: it.kind === 'chars' ? 0.008 : 0.04, from: st === 'above' ? 'start' : 'end' } });
}

// ---------------------------------------------------------------------------
// scroll read: words go from faint to solid as the line passes through the view
function scrollRead(app) {
  const els = [...document.querySelectorAll(SCROLL_READ)];
  els.forEach((el) => {
    const s = SplitText.create(el, { type: 'words', wordsClass: 'wr', aria: 'auto' });
    gsap.fromTo(s.words, { opacity: 0.14 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'bottom 58%', scrub: 0.6 },
    });
  });
  // the page is a fixed layer that follows the window scroll, so ScrollTrigger
  // reads the real scroll position; it only needs to re-measure when the page
  // changes height
  let t = 0;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 200); };
  new ResizeObserver(refresh).observe(document.getElementById('content'));
  app.ready?.then(refresh);
}

// ---------------------------------------------------------------------------
// stat counters: NumberFlow rolls each digit into place
function numberFlow(app) {
  document.querySelectorAll('.stat-num[data-count]').forEach((n) => {
    const nf = document.createElement('number-flow');
    nf.dataset.to = n.dataset.count;
    nf.numberSuffix = n.dataset.suffix || '';
    nf.spinTiming = { duration: 1100, easing: 'cubic-bezier(.2, .8, .2, 1)' };
    nf.transformTiming = { duration: 800, easing: 'cubic-bezier(.2, .8, .2, 1)' };
    // a fresh element without data-count: the classic counter in ui.js leaves
    // it alone, and a count it already started finishes on the old, detached one
    const m = n.cloneNode(false);
    m.removeAttribute('data-count');
    m.append(nf);
    n.replaceWith(m);
    nf.update(m.closest('[data-reveal]')?.dataset.state === 'in' ? +nf.dataset.to : 0);
  });
  app.reveal.on((el, st) => {
    const nf = el.querySelector?.('number-flow');
    if (nf) nf.update(st === 'in' ? +nf.dataset.to : 0);
  });
}

// ---------------------------------------------------------------------------
// social wall filter: posts that stay glide to their new place, the others
// fade out and the new ones scale in (GSAP Flip)
function socialFlip(app) {
  const work = app.work;
  if (!work) return;
  work.filterSocial = (id) => {
    const wall = document.getElementById('p-social-all');
    if (!wall) return;
    wall.querySelectorAll('.sfilter [data-filter]').forEach((b) => b.classList.toggle('is-on', b.dataset.filter === id));
    const cells = [...wall.querySelectorAll('.sgrid [data-set]')];
    const state = Flip.getState(cells, { props: 'opacity' });
    cells.forEach((c) => { c.hidden = id !== 'all' && c.dataset.set !== id; });
    Flip.from(state, {
      duration: 0.75, ease: 'expo.inOut', absolute: true, stagger: 0.008, simple: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.25, ease: 'expo.out' }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.86, duration: 0.35, ease: 'power2.in' }),
      onComplete: () => app.queueMeasure?.(),
    });
  };
}

// ---------------------------------------------------------------------------
// view transitions (Chrome, Edge, Safari 18+, Firefox 144+; others keep the
// classic motion)
function viewTransitions(app) {
  if (typeof document.startViewTransition !== 'function') return;
  let px = innerWidth / 2, py = innerHeight / 2, lastThumb = null;
  addEventListener('pointerdown', (e) => { px = e.clientX; py = e.clientY; }, true);
  // the gallery handler opens the viewer during this same click
  document.addEventListener('click', (e) => {
    lastThumb = e.target.closest?.('[data-k], [data-p]')?.querySelector('img') || null;
  }, true);
  const transition = (cls, update) => {
    root.classList.add(...cls);
    const t = document.startViewTransition(update);
    t.finished.finally(() => root.classList.remove(...cls));
    return t;
  };
  const onScreen = (el) => {
    const r = el?.isConnected && el.getBoundingClientRect();
    return !!r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };

  // ---- image viewer: the thumbnail grows into the full image
  const lb = app.lightbox;
  const lbOpen = lb.open.bind(lb), lbClose = lb.close.bind(lb);
  lb.open = (list, i = 0) => {
    const thumb = lastThumb;
    lastThumb = null;
    lb.from = null;
    if (!onScreen(thumb)) return lbOpen(list, i);
    lb.from = { thumb, i };
    thumb.style.viewTransitionName = 'lb-photo';
    const t = transition(['vt-lb'], () => {
      thumb.style.viewTransitionName = '';
      lbOpen(list, i);
      // the thumbnail is already decoded: show it at once, the full image
      // replaces it as soon as it has loaded
      lb.img.src = thumb.currentSrc || thumb.src;
      lb.img.classList.add('is-in');
      lb.img.style.viewTransitionName = 'lb-photo';
    });
    t.finished.finally(() => { lb.img.style.viewTransitionName = ''; });
  };
  lb.close = () => {
    if (!lb.isOpen) return;
    const thumb = lb.from?.i === lb.i ? lb.from.thumb : null;
    lb.from = null;
    if (!onScreen(thumb)) return lbClose();
    lb.img.style.viewTransitionName = 'lb-photo';
    const t = transition(['vt-lb'], () => {
      lb.img.style.viewTransitionName = '';
      lbClose();
      thumb.style.viewTransitionName = 'lb-photo';
    });
    t.finished.finally(() => { thumb.style.viewTransitionName = ''; });
  };

  // ---- folder pages: open as a circle from the click, close back into it
  const ch = app.chpage;
  const chOpen = ch.open.bind(ch), chClose = ch.close.bind(ch), chShow = ch.show.bind(ch);
  const circle = (pseudo, grow) => {
    const r = Math.hypot(Math.max(px, innerWidth - px), Math.max(py, innerHeight - py));
    const kf = [`circle(0px at ${px}px ${py}px)`, `circle(${r}px at ${px}px ${py}px)`];
    root.animate({ clipPath: grow ? kf : kf.reverse() }, { duration: grow ? 900 : 700, easing: 'cubic-bezier(.7, 0, .2, 1)', fill: 'both', pseudoElement: pseudo });
  };
  ch.open = (id) => {
    if (ch.isOpen || !ch.phone) return chOpen(id);
    const t = transition(['vt-ch'], () => {
      chOpen(id);
      ch.el.classList.add('is-open');
    });
    t.ready.then(() => circle('::view-transition-new(root)', true)).catch(() => {});
    return true;
  };
  ch.close = () => {
    if (!ch.isOpen) return chClose();
    const t = transition(['vt-ch', 'vt-ch-close'], () => chClose());
    t.ready.then(() => circle('::view-transition-old(root)', false)).catch(() => {});
  };
  ch.show = (id, animate) => {
    if (!animate || !ch.isOpen) return chShow(id, animate);
    // "Next": the bar stays, the folder slides out to the left, the next one in
    const t = transition(['vt-ch', 'vt-ch-next'], () => chShow(id, false));
    t.ready.then(() => {
      const ease = 'cubic-bezier(.7, 0, .2, 1)';
      root.animate({ transform: ['none', 'translateX(-14%)'], opacity: [1, 0] }, { duration: 520, easing: ease, fill: 'both', pseudoElement: '::view-transition-old(root)' });
      root.animate({ transform: ['translateX(14%)', 'none'], opacity: [0, 1] }, { duration: 700, delay: 140, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  };
}
