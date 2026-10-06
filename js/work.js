// Work showcase: the five folders open one after another as you scroll, and each
// spills its projects out at full size. The markup is static (SEO, see
// tools/build_work_html.py); this module adds the motion and the interactivity.
import { Spring, clamp } from './core.js';
import { WORKS } from './data/works.js';

const CW = 264;
const ease = (t) => 1 - Math.pow(1 - t, 3);

export class Work {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('projects');
    this.chapters = [...this.root.querySelectorAll('.chapter')].map((el, i) => {
      const folder = el.querySelector('.ch-folder');
      const ch = { el, i, cat: el.dataset.cat, no: el.dataset.no, title: el.dataset.title, count: el.dataset.count, folder,
        open: new Spring(0, 3.2), hover: new Spring(0, 10), items: [...el.querySelectorAll('.proj')] };
      folder.addEventListener('pointerenter', () => ch.hover.set(1));
      folder.addEventListener('pointerleave', () => ch.hover.set(0));
      folder.addEventListener('click', () => ch.items[0] && app.scrollToEl(ch.items[0]));
      return ch;
    });
    this.items = this.chapters.flatMap((c) => c.items.map((el) => ({ el, ch: c, title: el.dataset.title || '' })));
    this.rise = [...this.root.querySelectorAll('[data-rise]')].map((el) => ({ el, top: 0, h: 0, last: '' }));
    this.motion = app.scroll.enabled;
    this.bindGalleries();
    this.bindLive();
    this.bindBar();
  }

  // ---------------------------------------------------------------- galleries
  bindGalleries() {
    const lb = this.app.lightbox;
    const allPosts = WORKS.social.flatMap((st) => st.images);
    this.root.addEventListener('click', (e) => {
      const proj = e.target.closest('.proj');
      if (!proj) return;
      const sw = e.target.closest('.swatch');
      if (sw) {
        navigator.clipboard?.writeText(sw.dataset.hex).catch(() => {});
        sw.classList.add('is-copied');
        setTimeout(() => sw.classList.remove('is-copied'), 1200);
        return;
      }
      const f = e.target.closest('.sfilter [data-filter]');
      if (f) { this.filterSocial(f.dataset.filter); return; }
      const cat = proj.dataset.cat;
      // the social wall: the gallery follows the current filter
      if (proj.dataset.i === 'all') {
        const cells = [...proj.querySelectorAll('.sgrid [data-k]')].filter((c) => !c.hidden);
        const list = cells.map((c) => allPosts[+c.dataset.k]);
        if (e.target.closest('[data-gal]')) lb.open(list, 0);
        const k = e.target.closest('.sgrid [data-k]');
        if (k) lb.open(list, cells.indexOf(k));
        return;
      }
      const item = WORKS[cat]?.[+proj.dataset.i];
      if (!item) return;
      const p = e.target.closest('[data-p]');
      if (p && item.products) { lb.open(item.products, +p.dataset.p); return; }
      if (e.target.closest('[data-gal]')) lb.open(item.images, 0);
      const k = e.target.closest('[data-k]');
      if (k) lb.open(item.images, +k.dataset.k);
    });
    // chapter index entries for social filter the wall as they scroll to it
    this.root.querySelectorAll('.ch-index [data-filter]').forEach((a) => a.addEventListener('click', () => this.filterSocial(a.dataset.filter)));
  }
  filterSocial(id) {
    const wall = document.getElementById('p-social-all');
    if (!wall) return;
    wall.querySelectorAll('.sfilter [data-filter]').forEach((b) => b.classList.toggle('is-on', b.dataset.filter === id));
    const grid = wall.querySelector('.sgrid');
    grid.classList.add('is-swapping');
    setTimeout(() => {
      grid.querySelectorAll('[data-set]').forEach((c) => { c.hidden = id !== 'all' && c.dataset.set !== id; });
      grid.classList.remove('is-swapping');
      this.app.queueMeasure?.();
    }, 260);
  }

  // ---------------------------------------------------------------- live apps
  bindLive() {
    this.lives = [...this.root.querySelectorAll('.live')].map((el) => {
      const proj = el.closest('.proj');
      const L = { el, proj, src: el.dataset.live, kind: el.dataset.kind, frame: el.dataset.frame, theme: null, frameEl: null, on: false };
      const pill = el.querySelector('.shield-pill b');
      if (pill && innerWidth < 720) pill.textContent = this.compact(L) ? 'Tap to open' : 'Tap to interact';
      el.querySelector('.live-shield').addEventListener('click', () => {
        if (this.compact(L)) { this.openFull(L); return; }
        el.classList.add('is-active');
        if (!L.frameEl) this.mount(L);
      });
      proj.querySelectorAll('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => {
        L.theme = b.dataset.themeBtn;
        proj.querySelectorAll('[data-theme-btn]').forEach((x) => x.classList.toggle('is-on', x === b));
        this.post(L);
      }));
      return L;
    });
    // load an app when it comes near, drop it once it is far away again
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const L = this.lives.find((x) => x.el === e.target);
        if (!L) continue;
        L.on = e.isIntersecting;
        if (L.on && !this.compact(L)) this.mount(L);
        else if (!L.on) this.unmount(L);
      }
    }, { rootMargin: '35% 0px 35% 0px' });
    this.lives.forEach((L) => this.io.observe(L.el));
    window.addEventListener('message', (e) => {
      if (e.data?.type !== 'live-theme-request') return;
      const L = this.lives.find((x) => x.frameEl && x.frameEl.contentWindow === e.source);
      if (L) this.post(L);
    });
    this.app.themeListeners?.push(() => this.lives.forEach((L) => { if (!L.theme) this.post(L); }));
  }
  // phones: desktop-sized apps open full screen in the page (they are responsive),
  // with a close button, instead of a tiny scaled frame or a new tab
  openFull(L) {
    const d = document.createElement('div');
    d.className = 'live-full';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', L.proj.dataset.title || 'Live project');
    const f = document.createElement('iframe');
    f.title = L.proj.dataset.title || 'Live project';
    f.src = L.kind === 'site' ? L.src : `${L.src}?theme=${L.theme || this.siteTheme()}`;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'live-close'; x.setAttribute('aria-label', 'Close');
    x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    d.append(f, x);
    document.body.append(d);
    this.app.scroll.lock(true);
    requestAnimationFrame(() => d.classList.add('is-open'));
    const close = () => {
      d.classList.remove('is-open');
      this.app.scroll.lock(false);
      removeEventListener('keydown', esc);
      setTimeout(() => d.remove(), 400);
    };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    x.addEventListener('click', close);
    addEventListener('keydown', esc);
  }
  // phones show a poster and open desktop-sized apps full screen instead
  compact(L) { return innerWidth < 720 && L.frame !== 'phone'; }
  phoneNative(L) { return innerWidth < 720 && L.frame === 'phone'; }
  mount(L) {
    if (L.frameEl) return;
    const f = document.createElement('iframe');
    f.title = L.proj.dataset.title || 'Live project';
    f.setAttribute('allow', 'fullscreen');
    f.setAttribute('loading', 'lazy');
    const theme = L.theme || this.siteTheme();
    f.src = L.kind === 'site' ? L.src : `${L.src}?theme=${theme}`;
    f.addEventListener('load', () => { L.el.classList.add('is-loaded'); this.post(L); });
    f.addEventListener('mouseenter', () => document.documentElement.classList.add('cursor-off'));
    f.addEventListener('mouseleave', () => document.documentElement.classList.remove('cursor-off'));
    L.frameEl = f;
    L.el.prepend(f);
    this.fit(L);
  }
  unmount(L) {
    L.el.classList.remove('is-active', 'is-loaded');
    L.frameEl?.remove();
    L.frameEl = null;
    document.documentElement.classList.remove('cursor-off');
  }
  fit(L) {
    const f = L.frameEl;
    if (!f) return;
    if (this.phoneNative(L)) {
      f.style.cssText = 'width:100%;height:100%;transform:none';
      return;
    }
    const s = L.el.clientWidth / 1440;
    f.style.cssText = `width:1440px;height:900px;transform:scale(${s.toFixed(5)})`;
  }
  siteTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  post(L) {
    if (!L.frameEl || L.kind === 'site') return;
    try { L.frameEl.contentWindow.postMessage({ type: 'theme', theme: L.theme || this.siteTheme() }, '*'); } catch (e) {}
  }

  // ---------------------------------------------------------------- progress bar
  bindBar() {
    this.bar = document.getElementById('workbar');
    this.barItem = this.app.glass.add(this.bar);
    this.barItem.manual = true;
    this.barNo = this.bar.querySelector('.wb-no');
    this.barCat = this.bar.querySelector('.wb-cat');
    this.barProj = this.bar.querySelector('.wb-proj');
    this.barCount = this.bar.querySelector('.wb-count');
    this.bar.querySelector('.wb-next').addEventListener('click', () => {
      const i = this.cur ?? -1;
      const next = this.items[i + 1]?.el || document.getElementById('connect');
      this.app.scrollToEl(next);
    });
  }

  // ---------------------------------------------------------------- layout
  measure(scrollY) {
    const H = innerHeight;
    const r0 = this.root.getBoundingClientRect();
    this.top = r0.top + scrollY; this.bottom = this.top + r0.height;
    for (const c of this.chapters) {
      const r = c.folder.getBoundingClientRect();
      c.box = { x: r.left, y: r.top + scrollY, s: r.width };
      c.folder.style.setProperty('--fs', (r.width / CW).toFixed(4));
      c.top = c.el.getBoundingClientRect().top + scrollY;
    }
    this.items.forEach((it) => { it.top = it.el.getBoundingClientRect().top + scrollY; });
    this.rise.forEach((r) => { r.el.style.transform = 'none'; });
    this.rise.forEach((r) => { const b = r.el.getBoundingClientRect(); r.top = b.top + scrollY; r.h = b.height; });
    this.rise.forEach((r) => { r.el.style.transform = r.last; });
    this.lives.forEach((L) => this.fit(L));
    // native lazy loading can't look ahead inside the clipped, fixed #app, so
    // images are switched to eager about two screens before they arrive
    this.lazy = [...document.querySelectorAll('#app img[loading="lazy"]')]
      .map((img) => ({ img, top: img.getBoundingClientRect().top + scrollY })).sort((a, b) => a.top - b.top);
    this.H = H;
  }

  update(dt, scrollY, out, pageAlpha, W, H) {
    if (this.lazy?.length) {
      const edge = scrollY + H * 3, back = scrollY - H;
      this.lazy = this.lazy.filter((l) => {
        if (l.top < edge && l.top > back) { l.img.loading = 'eager'; return false; }
        return true;
      });
    }
    if (!this.chapters[0]?.box) return;
    // folders: open as their chapter rises into view, close again going back up
    for (const c of this.chapters) {
      if (this.app.chpage?.phone) break;   // phones: chapters live in their own page
      const b = c.box;
      const yTop = b.y - scrollY;
      const p = clamp((H * 0.92 - yTop) / (H * 0.5));
      c.open.set(p * p * (3 - 2 * p));
      const op = c.open.step(dt);
      const hv = c.hover.step(dt);
      if (yTop > H + 120 || yTop + b.s < -160) continue;
      const sc = b.s / CW;
      const m = new DOMMatrix().translate(b.x, yTop).scale(sc, sc, 1);
      // dissolve under the nav, like the page text does
      const under = clamp((yTop + b.s - 96) / 140);
      if (under < 0.003) continue;
      out.push({ m: m.toFloat32Array(), w: CW, h: CW, scale: sc * 0.95, blur: 0, open: op, hover: hv, lift: 2.1, opacity: pageAlpha * under, level: 3, seed: c.i * 0.27 });
    }
    // projects rise out at full size, tied to the scroll (so they reverse too)
    if (this.motion && !this.app.chpage?.phone) {
      for (const r of this.rise) {
        const t = r.top - scrollY;
        if (t > H * 1.3 || t + r.h < -H * 0.3) continue;
        const e = ease(clamp((H - t) / (H * 0.42)));
        const tr = e >= 0.999 ? 'none' : `translate3d(0,${((1 - e) * 90).toFixed(1)}px,0) scale(${(0.9 + 0.1 * e).toFixed(4)})`;
        if (tr !== r.last) { r.el.style.transform = tr; r.el.style.opacity = (0.2 + 0.8 * e).toFixed(3); r.last = tr; }
      }
    }
    // where am I: chapter + project, shown in the glass bar at the bottom
    const mid = scrollY + H * 0.5;
    const inside = mid > this.top + H * 0.15 && mid < this.bottom - H * 0.1 && !this.app.introOn && !this.app.chpage;
    let cur = -1;
    this.items.forEach((it, i) => { if (it.top <= mid) cur = i; });
    let chi = 0;
    this.chapters.forEach((c, i) => { if (c.top <= mid) chi = i; });
    const ch = this.chapters[chi];
    const it = this.items[cur]?.ch === ch ? this.items[cur] : null;
    this.cur = it ? cur : this.items.indexOf(this.items.find((x) => x.ch === ch)) - 1;
    const key = `${chi}|${it ? cur : -1}`;
    if (key !== this.barKey) {
      this.barKey = key;
      this.barNo.textContent = ch.no;
      this.barCat.textContent = ch.title;
      this.barProj.textContent = it ? it.title : ch.count;
      this.barCount.textContent = it ? `${ch.items.indexOf(it.el) + 1}/${ch.items.length}` : '';
    }
    this.barItem.appear.set(inside ? 1 : 0);
    this.bar.style.pointerEvents = inside ? '' : 'none';
    // page text dissolves under the bar (the bar glass sits beneath the DOM, so
    // it can't hide text by itself), the same way it does under the nav
    const wb = Math.round(this.barItem.appear.v * 20) / 20;
    if (wb !== this.wbMask) { this.wbMask = wb; document.documentElement.style.setProperty('--wb', wb); }
    this.inside = inside;
  }
}
