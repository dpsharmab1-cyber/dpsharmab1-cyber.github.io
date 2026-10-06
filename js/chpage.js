// The work showcase doesn't run under Services. The six folders are the whole
// section; opening one shows its chapter as a separate page (a full-screen sheet:
// the description first, then every project), on phones,
// tablets and desktop alike. The markup stays in the document for SEO; it is only
// moved into the sheet. It scrolls with the same smooth scroll as the page.
import { InnerSmooth } from './core.js';

export class ChapterPage {
  constructor(app) {
    this.app = app;
    this.work = document.getElementById('projects');
    this.home = document.createComment('projects');
    this.work.before(this.home);
    this.cur = null;

    const el = this.el = document.createElement('div');
    el.className = 'chpage';
    el.id = 'chpage';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.innerHTML = `<div class="chp-bar">
        <button class="chp-back" type="button" aria-label="Back to services"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="chp-label"><b class="chp-no"></b><span class="chp-title"></span></span>
        <button class="chp-next" type="button"><span>Next</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="chp-scroll"></div>`;
    document.body.append(el);
    this.scroller = el.querySelector('.chp-scroll');
    // Lenis watches this inner box, so late images re-measure the scroll
    this.inner = document.createElement('div');
    this.inner.className = 'chp-inner';
    this.scroller.append(this.inner);
    this.smooth = new InnerSmooth(this.scroller, this.inner);
    // Figma "folders section-1": every chapter opens on a full-screen cover, its
    // name in the black -> red display type over the blue + red strokes
    this.cover = document.createElement('section');
    this.cover.className = 'chp-cover';
    this.cover.innerHTML = `<div class="chp-cover-bg" aria-hidden="true"></div>
      <h2 class="chp-cover-title grad-v"></h2>
      <button class="chp-more" type="button"><span>SEE MORE</span><i class="seemore-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></i></button>`;
    this.inner.append(this.cover);
    this.cover.querySelector('.chp-more').addEventListener('click', () => {
      this.smooth.to(this.cover.offsetHeight - 8);
    });
    el.querySelector('.chp-back').addEventListener('click', () => this.back());
    el.querySelector('.chp-next').addEventListener('click', () => {
      const list = this.chapters();
      const i = list.findIndex((c) => c.dataset.cat === this.cur);
      this.show(list[(i + 1) % list.length].dataset.cat, true);
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen && !document.querySelector('.lightbox.is-open, .live-full')) this.back(); });
    addEventListener('popstate', () => { if (this.isOpen && !history.state?.chpage) this.close(); });

    this.place();
    // shared links (#work-brand) open their chapter once the intro is done
    const m = /^#work-([\w-]+)$/.exec(location.hash);
    if (m && this.chapters().some((c) => c.dataset.cat === m[1])) {
      app.deepLink = true;
      history.replaceState(null, '', location.pathname + location.search);
      const wait = () => (app.introOn ? requestAnimationFrame(wait) : setTimeout(() => this.open(m[1]), 600));
      requestAnimationFrame(wait);
    }
  }

  // kept as a flag so the other modules read one switch
  get phone() { return true; }
  get isOpen() { return !!this.cur; }
  chapters() { return [...this.work.querySelectorAll('.chapter')]; }

  // phones keep the showcase in the sheet, larger screens keep it in the page
  place() {
    if (this.phone && this.work.parentNode !== this.inner) {
      this.inner.append(this.work);
      this.work.querySelectorAll('[data-rise]').forEach((r) => { r.style.transform = 'none'; r.style.opacity = ''; });
    } else if (!this.phone && this.work.parentNode === this.inner) {
      if (this.isOpen) this.close();
      this.home.after(this.work);
    }
    document.documentElement.classList.toggle('work-sheet-mode', this.phone);
    this.app.queueMeasure?.();
  }

  open(id) {
    if (!this.phone) return false;
    const pushed = !this.isOpen;
    this.show(id, false);
    if (pushed) {
      try { history.pushState({ chpage: id }, '', `#work-${id}`); } catch (e) {}
      this.pushed = true;
    }
    this.el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('chpage-open');
    this.app.scroll.lock(true);
    this.app.chOpen = true;
    requestAnimationFrame(() => this.el.classList.add('is-open'));
    clearTimeout(this.settleT);
    this.settleT = setTimeout(() => { if (this.isOpen) this.settled = true; }, 700);
    setTimeout(() => this.el.focus({ preventScroll: true }), 450);
    return true;
  }

  show(id, animate) {
    const list = this.chapters();
    const ch = list.find((c) => c.dataset.cat === id) || list[0];
    this.cur = ch.dataset.cat;
    list.forEach((c) => c.classList.toggle('is-current', c === ch));
    // live frames were measured while hidden: size them now
    this.app.work?.lives?.forEach((L) => this.app.work.fit(L));
    this.el.querySelector('.chp-no').textContent = ch.dataset.no;
    this.el.querySelector('.chp-title').textContent = ch.dataset.title;
    // replay the cover: strokes fade in and drift, the name rises
    this.cover.querySelector('.chp-cover-title').textContent = ch.dataset.title.replace('UI/UX', 'UI / UX');
    this.cover.classList.toggle('is-flip', list.indexOf(ch) % 2 === 1);
    this.cover.classList.remove('is-in');
    void this.cover.offsetWidth;
    requestAnimationFrame(() => this.cover.classList.add('is-in'));
    const next = list[(list.indexOf(ch) + 1) % list.length];
    this.el.querySelector('.chp-next span').textContent = next.dataset.title.replace(/ Design$/, '');
    if (animate) {
      this.scroller.classList.add('is-swapping');
      setTimeout(() => { this.smooth.jump(0); this.scroller.classList.remove('is-swapping'); }, 220);
    } else this.smooth.jump(0);
    try { if (history.state?.chpage) history.replaceState({ chpage: this.cur }, '', `#work-${this.cur}`); } catch (e) {}
  }

  back() {
    if (this.pushed && history.state?.chpage) history.back();   // popstate closes it
    else this.close();
  }

  close() {
    if (!this.isOpen) return;
    this.cur = null;
    this.pushed = false;
    this.settled = false;
    clearTimeout(this.settleT);
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('chpage-open');
    this.app.scroll.lock(false);
    this.app.chOpen = false;
    this.work.querySelectorAll('.live.is-active').forEach((l) => l.classList.remove('is-active'));
  }

  // in-page links into the showcase (footer, chapter index, "See my work")
  route(el) {
    if (!this.phone || !this.work.contains(el)) return false;
    if (el === this.work) { this.app.scrollToEl(document.getElementById('services')); return true; }
    const ch = el.closest('.chapter');
    if (!ch) return false;
    const was = this.isOpen;
    if (!was) this.open(ch.dataset.cat);
    else if (ch.dataset.cat !== this.cur) this.show(ch.dataset.cat, false);
    if (el !== ch) {
      setTimeout(() => {
        const top = el.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top + this.scroller.scrollTop - 76;
        this.smooth.to(top);
      }, was ? 60 : 520);
    }
    return true;
  }
}
