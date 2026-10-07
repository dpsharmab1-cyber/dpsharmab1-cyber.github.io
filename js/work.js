// Work showcase: the chapter a folder opens (js/chapters.js) and its projects:
// galleries, live apps and the rise as they scroll in. The markup is static
// (SEO); this module adds the motion and the interactivity.
import { clamp } from './core.js';
import { WORKS } from './data/works.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class Work {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('projects');
    this.rise = [...this.root.querySelectorAll('[data-rise]')].map((el) => ({ el, top: 0, h: 0, last: '' }));
    this.motion = app.scroll.enabled;
    this.bindGalleries();
    this.bindLive();
    this.bindStrips();
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
      const cat = proj.dataset.cat;
      // the social wall: every post, one gallery
      if (proj.dataset.i === 'all') {
        if (this.dragged) return;
        if (e.target.closest('[data-gal]')) lb.open(allPosts, 0);
        const k = e.target.closest('.sgrid [data-k]');
        if (k) lb.open(allPosts, +k.dataset.k);
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

  // ---------------------------------------------------------------- sideways strips
  // the social wall scrolls sideways in rows: trackpad swipes, drag with the
  // mouse, or the arrows; touch scrolls it natively
  bindStrips() {
    this.root.querySelectorAll('.sgrid').forEach((g) => {
      const wrap = g.parentElement;
      wrap.querySelectorAll('.strip-nav [data-dir]').forEach((b) => b.addEventListener('click', () => {
        g.scrollBy({ left: +b.dataset.dir * g.clientWidth * 0.8, behavior: 'smooth' });
      }));
      // sideways swipes belong to the strip, not to the page scroll
      g.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation(); }, { passive: true });
      let down = false, sx = 0, sl = 0;
      g.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button) return;
        down = true; this.dragged = false; sx = e.clientX; sl = g.scrollLeft;
      });
      addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 6) { this.dragged = true; g.classList.add('is-dragging'); }
        if (this.dragged) g.scrollLeft = sl - dx;
      });
      addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        g.classList.remove('is-dragging');
        setTimeout(() => { this.dragged = false; }, 0);
      });
      g.addEventListener('dragstart', (e) => e.preventDefault());
    });
  }

  // ---------------------------------------------------------------- layout
  measure(scrollY) {
    const H = innerHeight;
    this.rise.forEach((r) => { r.el.style.transform = 'none'; });
    this.rise.forEach((r) => { const b = r.el.getBoundingClientRect(); r.top = b.top + scrollY; r.h = b.height; });
    this.rise.forEach((r) => { r.el.style.transform = r.last; });
    this.lives.forEach((L) => this.fit(L));
    // native lazy loading can't look ahead inside the clipped, fixed #app, so
    // images are switched to eager about two screens before they arrive
    // (images in closed chapters have no box yet and wait)
    this.lazy = [...document.querySelectorAll('#app img[loading="lazy"]')].filter((img) => img.getClientRects().length)
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
    // projects rise out at full size, tied to the scroll (so they reverse too)
    if (this.motion) {
      for (const r of this.rise) {
        if (!r.h) continue;
        const t = r.top - scrollY;
        if (t > H * 1.3 || t + r.h < -H * 0.3) continue;
        const e = ease(clamp((H - t) / (H * 0.42)));
        const tr = e >= 0.999 ? 'none' : `translate3d(0,${((1 - e) * 90).toFixed(1)}px,0) scale(${(0.9 + 0.1 * e).toFixed(4)})`;
        if (tr !== r.last) { r.el.style.transform = tr; r.el.style.opacity = (0.2 + 0.8 * e).toFixed(3); r.last = tr; }
      }
    }
  }
}
