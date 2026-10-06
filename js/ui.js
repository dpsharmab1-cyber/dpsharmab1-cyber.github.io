// Page-level interactions: nav, see-more, skills + tooltips, contact,
// stat counters and the glass cursor.
import { Spring, clamp, finePointer, reduced } from './core.js';
import { ICONS, SKILLS } from './icons.js';

// ---------------------------------------------------------------------------
export class Nav {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('nav');
    this.pill = this.el.querySelector('.nav-pill');
    this.links = [...this.pill.querySelectorAll('a')];
    this.lensEl = this.el.querySelector('.nav-lens');
    this.lx = new Spring(0, 10); this.lw = new Spring(80, 10);
    this.lens = app.glass.add(this.lensEl);
    this.lens.rectFn = () => this.lensRect();
    this.hoverLink = null;
    this.links.forEach((a) => {
      a.addEventListener('pointerenter', () => { this.hoverLink = a; });
      a.addEventListener('pointerleave', () => { this.hoverLink = null; });
    });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      app.scrollToEl(t);
    });
    this.seemore = document.getElementById('seemore');
    this.sm = app.glass.add(this.seemore);
    this.sm.manual = true;
    this.seemore.addEventListener('click', () => (app.splash?.active ? app.splash.exit() : this.next()));
    document.querySelector('.to-top')?.addEventListener('click', () => app.scroll.to(0));
    this.current = 'about';
  }
  sections() {
    // the showcase lives in the chapter page, not in the page flow
    return [...document.querySelectorAll('[data-section]')].filter((el) => !el.closest('.chpage'));
  }
  next() {
    const y = this.app.scroll.y, H = innerHeight;
    const s = (this.secs || []).find((el) => el._top > y + H * 0.3);
    if (s) this.app.scrollToEl(s);
  }
  measure(scrollY) {
    this.secs = this.sections();
    this.secs.forEach((el) => { el._top = el.getBoundingClientRect().top + scrollY; el._h = el.offsetHeight; });
    // layout offsets, not screen rects: immune to the nav's own enter animation
    this.linkBox = this.links.map((a) => ({ x: a.offsetLeft, w: a.offsetWidth }));
  }
  lensRect() {
    const pr = this.lens.pillRect;
    if (!pr) return null;
    return { x: pr.x + this.lx.v, y: pr.y + 4, w: this.lw.v, h: pr.h - 8 };
  }
  update(dt) {
    const app = this.app, y = app.scroll.y, H = innerHeight;
    let cur = 'about';
    for (const s of this.secs || []) if (s._top <= y + H * 0.45) cur = s.dataset.section;
    this.current = cur;
    // page order: Home (the About screen) → About me (the quote) → Services →
    // Projects → Contact
    const map = { about: 'home', home: 'about', services: 'services', work: 'projects', connect: 'contact', contact: 'contact', footer: 'contact' };
    const key = map[cur];
    // skip links hidden at this width (Contact sits in the pill on phones only)
    let idx = this.links.findIndex((a, i) => a.dataset.nav === key && this.linkBox?.[i]?.w > 0);
    this.links.forEach((a, i) => a.setAttribute('aria-current', i === idx ? 'true' : 'false'));
    this.contactBtn ??= this.el.querySelector('.nav-contact');
    this.contactBtn?.setAttribute('aria-current', key === 'contact' ? 'true' : 'false');
    const hov = this.hoverLink ? this.links.indexOf(this.hoverLink) : -1;
    const show = hov >= 0 ? hov : idx;
    const lb = this.linkBox?.[show];
    if (lb) { this.lx.set(lb.x); this.lw.set(lb.w); }
    this.lx.step(dt); this.lw.step(dt);
    this.lens.ext = show >= 0 ? 1 : 0;
    this.lens.appear.set(show >= 0 ? 1 : 0);
    this.lens.pillRect = this.pillItemRect();
    const hold = !!app.introOn || !!app.splash?.active;
    document.documentElement.classList.toggle('nav-hidden', hold);
    // glass of nav items follows the nav visibility
    const vis = hold ? 0 : 1;
    app.glass.items.forEach((it) => { if (it.el.closest('#nav')) { it.manual = true; it.appear.set(vis); } });
    const smShow = app.splash?.showing || (!app.introOn && !app.work?.inside && ['home', 'services', 'connect'].includes(cur) && y < app.scroll.max - 10);
    this.sm.appear.set(smShow ? 1 : 0);
    this.seemore.style.pointerEvents = smShow ? '' : 'none';
  }
  pillItemRect() {
    const it = this.pill._glass;
    if (!it) return null;
    const b = it.base;
    const a = it.appear.v;
    const dy = (1 - a) * 22;
    return { x: b.x, y: b.y + dy, w: b.w, h: b.h };
  }
}

// ---------------------------------------------------------------------------
export class Theme {
  // the site is light only (the Figma theme); kept as a class so the stage,
  // glass and live embeds still get one place that sets the theme
  constructor(app) {
    this.app = app;
    this.set('light');
    try { localStorage.removeItem('site-theme'); } catch (e) {}
  }
  set(t) {
    this.dark = false;
    document.documentElement.dataset.theme = 'light';
    this.app.stage?.setTheme(false);
    this.app.glass.dark = false;
    this.app.themeListeners?.forEach((fn) => fn('light'));
  }
}

// ---------------------------------------------------------------------------
export class Skills {
  constructor(app) {
    this.app = app;
    this.note = document.querySelector('.skill-note');
    this.noteIcon = this.note.querySelector('.skill-note-icon');
    this.noteText = this.note.querySelector('.skill-note-text');
    this.tip = document.getElementById('tip');
    this.tipItem = app.glass.add(this.tip);
    this.tipItem.manual = true;
    this.tipItem.rectFn = () => this.tipRect();
    this.tx = new Spring(0, 16); this.ty = new Spring(0, 16);
    document.querySelectorAll('[data-chips]').forEach((ul) => {
      SKILLS[ul.dataset.chips].forEach(([name, icon, desc], i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="chip" tabindex="0" data-glass="chip" data-level="3" style="--d:${i * 40}ms"><span class="chip-ic">${ICONS[icon] || ''}</span>${name}</span>`;
        const chip = li.firstChild;
        if (!['figma', 'photoshop', 'illustrator', 'indesign', 'blender', 'spine', 'canva', 'corel', 'wordpress', 'woo', 'aitools'].includes(icon)) chip.querySelector('.chip-ic').style.color = 'var(--red-ink)';
        const show = () => this.show(chip, name, icon, desc);
        chip.addEventListener('pointerenter', show);
        chip.addEventListener('focus', show);
        chip.addEventListener('pointerleave', () => this.hide());
        chip.addEventListener('blur', () => this.hide());
        chip.addEventListener('click', show);
        ul.appendChild(li);
      });
    });
  }
  show(chip, name, icon, desc) {
    this.chip = chip;
    this.tip.querySelector('.tip-icon').innerHTML = ICONS[icon] || '';
    this.tip.querySelector('.tip-icon').style.color = 'var(--red-ink)';
    this.tip.querySelector('.tip-title').textContent = name;
    this.tip.querySelector('.tip-text').textContent = desc;
    this.noteIcon.innerHTML = ICONS[icon] || '';
    this.noteText.textContent = `${name} — ${desc}`;
    const r = chip.getBoundingClientRect();
    const tw = 280, th = this.tip.offsetHeight || 84;
    const x = clamp(r.left + r.width / 2 - tw / 2, 12, innerWidth - tw - 12);
    let y = r.top - th - 12;
    if (y < 90) y = r.bottom + 12;
    if (this.tipItem.appear.v < 0.05) { this.tx.jump(x); this.ty.jump(y + 8); }
    this.tx.set(x); this.ty.set(y);
    this.tipItem.appear.set(1);
  }
  hide() { this.tipItem.appear.set(0); }
  tipRect() {
    const w = 280, h = this.tip.offsetHeight;
    return { x: this.tx.v, y: this.ty.v, w, h };
  }
  update(dt) {
    const x = this.tx.step(dt), y = this.ty.step(dt);
    const a = this.tipItem.appear.v;
    this.tip.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    this.tip.style.opacity = a.toFixed(3);
  }
}

// ---------------------------------------------------------------------------
export class Contact {
  constructor(app) {
    this.app = app;
    const form = document.querySelector('.contact-form');
    const topics = [...form.querySelectorAll('.topic')];
    const pick = (t) => {
      topics.forEach((b) => {
        const on = b === t;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on);
        if (b._glass) b._glass.tint.set(on ? 1 : 0);
      });
      form.querySelector('input[name="topic"]').value = t.textContent;
    };
    topics.forEach((b) => b.addEventListener('click', () => pick(b)));
    requestAnimationFrame(() => pick(topics[0]));
    const status = form.querySelector('.form-status');
    const send = form.querySelector('.send span');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const d = Object.fromEntries(fd);
      const topic = form.querySelector('.topic.is-on')?.textContent || '';
      fd.set('topic', topic);
      if (!d.email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { status.textContent = 'Add your email so I can reply.'; form.email.focus(); return; }
      if (!d.message?.trim()) { status.textContent = 'Add a short message so I know how to help.'; form.message.focus(); return; }
      status.textContent = 'Sending…';
      form.classList.add('is-sending');
      try {
        // Netlify Forms when hosted there; on GitHub Pages the POST is refused
        // and the visitor's mail app opens with the message filled in
        const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        status.textContent = 'Thank you! Your message is in. I’ll reply within 24 hours.';
        send.textContent = 'Sent';
        setTimeout(() => { send.textContent = 'Send Message'; }, 4000);
      } catch (err) {
        // no form backend (GitHub Pages, offline, local preview): the mail app
        const body = [`Topic: ${topic}`, d.name && `Name: ${d.name}`, d.email && `Email: ${d.email}`, d.phone && `Phone: ${d.phone}`, d.company && `Company / link: ${d.company}`, '', d.message].filter((x) => x !== undefined && x !== '').join('\n');
        location.href = `mailto:dpsharmab1@gmail.com?subject=${encodeURIComponent(`${topic} — ${d.name || 'Portfolio enquiry'}`)}&body=${encodeURIComponent(body)}`;
        status.textContent = 'Opening your mail app… thank you!';
      }
      form.classList.remove('is-sending');
    });
    const tick = () => {
      const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = t; });
    };
    tick();
    setInterval(tick, 15000);
  }
}

// ---------------------------------------------------------------------------
export function counters(app) {
  app.reveal.on((el, st) => {
    if (!el.matches('[data-reveal]')) return;
    const n = el.querySelector('[data-count]');
    if (!n) return;
    const to = +n.dataset.count, suf = n.dataset.suffix || '';
    if (st !== 'in') { n.textContent = '0' + suf; return; }
    const t0 = performance.now();
    const run = (t) => {
      const k = clamp((t - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 4);
      n.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  });
}

// ---------------------------------------------------------------------------
// glass cursor: a DOM lens on top of everything (so it bends text too)
export class Cursor {
  constructor() {
    this.on = finePointer && !reduced;
    if (!this.on) return;
    this.el = document.getElementById('cursor');
    this.lens = this.el.querySelector('.cursor-lens');
    this.label = this.el.querySelector('.cursor-label');
    this.x = new Spring(innerWidth / 2, 22); this.y = new Spring(innerHeight / 2, 22);
    this.s = new Spring(0.72, 12);
    this.p = new Spring(0, 14);
    const root = document.documentElement;
    const chromium = !!window.chrome && /Chrome\//.test(navigator.userAgent);
    if (chromium) { this.makeMap(); root.classList.add('lens-svg'); }
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!this.seen) { this.seen = true; root.classList.add('has-cursor'); this.x.jump(e.clientX); this.y.jump(e.clientY); }
      this.x.set(e.clientX); this.y.set(e.clientY);
      const t = e.target;
      const hot = t.closest?.('a, button, [role="button"], input, textarea, .chip, .c3, .fcard, .m-img');
      const text = t.closest?.('input, textarea');
      const lbl = t.closest?.('.fcard.is-center, .c3.is-center:not(.is-live), .m-img, .sgrid button, .thumbs button');
      this.s.set(text ? 0.45 : hot ? 1.25 : 0.72);
      let l = '';
      if (lbl) l = lbl.classList.contains('fcard') ? 'Open' : 'View';
      if (l !== this.lastL) { this.label.textContent = l; this.el.classList.toggle('has-label', !!l); this.lastL = l; }
    }, { passive: true });
    window.addEventListener('pointerdown', () => this.p.set(1));
    window.addEventListener('pointerup', () => this.p.set(0));
    document.addEventListener('mouseleave', () => root.classList.add('cursor-off'));
    document.addEventListener('mouseenter', () => root.classList.remove('cursor-off'));
  }
  makeMap() {
    // displacement map for a convex lens: sample toward the centre near the rim
    const N = 88, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const vx = (x + 0.5) / N * 2 - 1, vy = (y + 0.5) / N * 2 - 1;
      const r = Math.hypot(vx, vy);
      const f = r < 1 ? Math.pow(r, 2.2) : 0;
      const i = (y * N + x) * 4;
      img.data[i] = 128 + clamp(-vx * f, -1, 1) * 127;
      img.data[i + 1] = 128 + clamp(-vy * f, -1, 1) * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const fe = document.getElementById('lens-map');
    fe.setAttribute('href', c.toDataURL());
    fe.setAttribute('x', 0); fe.setAttribute('y', 0);
    fe.setAttribute('width', 44); fe.setAttribute('height', 44);
  }
  update(dt) {
    if (!this.on) return;
    const x = this.x.step(dt), y = this.y.step(dt), s = this.s.step(dt) * (1 - 0.12 * this.p.step(dt));
    this.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    this.lens.style.transform = `scale(${s.toFixed(3)})`;
  }
}
