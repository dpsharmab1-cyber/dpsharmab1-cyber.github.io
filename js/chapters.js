// Work: picking a folder in Services opens its chapter right below the
// carousel, in the page, one chapter at a time (phones included). All six
// chapters stay in the document for SEO; only the open one is shown.
export class Chapters {
  constructor(app) {
    this.app = app;
    this.work = document.getElementById('projects');
    this.cur = null;
    document.documentElement.classList.add('work-inline');
  }
  list() { return [...this.work.querySelectorAll('.chapter')]; }
  get(id) { return this.list().find((c) => c.dataset.cat === id); }
  get isOpen() { return !!this.cur; }

  // show a chapter in place of the open one (no scrolling)
  show(id) {
    const ch = this.get(id);
    if (!ch || this.cur === id) return ch;
    this.cur = id;
    this.list().forEach((c) => c.classList.toggle('is-current', c === ch));
    this.work.classList.add('has-open');
    // what was hidden has no position yet: everything starts below the view
    // and plays in as it scrolls into sight
    this.app.reveal.reset(ch);
    this.app.work?.lives?.forEach((L) => this.app.work.fit(L));
    // the page just changed height: scroll targets need the new size now
    this.app.scroll.resize();
    this.app.queueMeasure?.();
    this.app.folders?.openById(id);   // the carousel keeps the open folder centred
    return ch;
  }

  // a folder was picked: open its chapter and glide down to it
  open(id) {
    const ch = this.show(id);
    if (ch) requestAnimationFrame(() => this.app.scrollToEl(ch));
    return !!ch;
  }

  // in-page links (#projects, #work-brand, #p-…): open the right chapter
  // first, then the page scrolls to the target as usual
  route(el) {
    if (!this.work.contains(el)) return false;
    const f = this.app.folders;
    const id = el.closest('.chapter')?.dataset.cat || this.cur || f?.cards[f.centerIndex()].c.id;
    if (id) this.show(id);
    return false;
  }
}
