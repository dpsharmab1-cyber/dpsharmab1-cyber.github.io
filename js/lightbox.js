// Image viewer used by every gallery.
import { hydrateIcons } from './icons.js';

export class Lightbox {
  constructor() {
    this.el = document.getElementById('lightbox');
    this.img = this.el.querySelector('img');
    this.count = this.el.querySelector('.lb-count');
    this.list = [];
    this.i = 0;
    hydrateIcons(this.el);
    this.el.querySelector('.lb-prev').addEventListener('click', () => this.step(-1));
    this.el.querySelector('.lb-next').addEventListener('click', () => this.step(1));
    this.el.querySelector('.lb-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el || e.target.classList.contains('lb-stage')) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
    }, true);
    let sx = null;
    this.el.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    this.el.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) this.step(e.clientX < sx ? 1 : -1); sx = null; });
  }
  get isOpen() { return this.el.classList.contains('is-open'); }
  open(list, i = 0) {
    this.list = list; this.i = i;
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    this.onToggle?.(true);
    this.show();
  }
  show() {
    const it = this.list[this.i];
    this.img.classList.remove('is-in');
    const next = new Image();
    next.onload = () => {
      this.img.src = it.src;
      this.img.alt = it.alt || '';
      requestAnimationFrame(() => this.img.classList.add('is-in'));
    };
    next.src = it.src;
    this.count.textContent = `${String(this.i + 1).padStart(2, '0')} / ${String(this.list.length).padStart(2, '0')}`;
    const many = this.list.length > 1;
    this.el.querySelector('.lb-prev').style.display = many ? '' : 'none';
    this.el.querySelector('.lb-next').style.display = many ? '' : 'none';
  }
  step(d) { if (this.list.length < 2) return; this.i = (this.i + d + this.list.length) % this.list.length; this.show(); }
  close() {
    if (!this.isOpen) return;
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    this.onToggle?.(false);
  }
}
