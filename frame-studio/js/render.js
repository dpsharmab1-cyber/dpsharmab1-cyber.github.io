// Renders the document tree as real DOM inside the canvas "world" element and
// keeps elements keyed by node id, so only what changed is touched.
// After layout it reads sizes back for anything the browser decides
// (auto layout children, hug frames, auto sized text).

import { S } from './state.js';
import { nodeCSS, cssText, pathSVG, sizing } from './css.js';
import { isFlex } from './model.js';
import { ensureFont } from './fonts.js';

export class Renderer {
  constructor(world) {
    this.world = world;
    this.els = new Map();
  }

  el(id) { return this.els.get(id) || null; }

  render() {
    const seen = new Set();
    this.sync(this.world, S.doc.children, null, seen);
    for (const [id, el] of this.els) if (!seen.has(id)) { el.remove(); this.els.delete(id); }
    this.measure();
  }

  sync(container, list, parent, seen) {
    let prev = null;
    for (const n of list) {
      seen.add(n.id);
      let el = this.els.get(n.id);
      if (!el || el.dataset.type !== n.type) {
        if (el) el.remove();
        el = this.create(n);
        this.els.set(n.id, el);
      }
      this.update(el, n, parent);
      const want = prev ? prev.nextSibling : container.firstChild;
      if (el.parentNode !== container || want !== el) container.insertBefore(el, want);
      if (n.children) this.sync(el, n.children, n, seen);
      prev = el;
    }
    // Elements moved elsewhere leave on their own (insertBefore re-parents);
    // deleted nodes are removed by render().
  }

  create(n) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.id = n.id;
    el.dataset.type = n.type;
    if (n.type === 'image') {
      const img = document.createElement('img');
      img.draggable = false;
      img.alt = '';
      el.appendChild(img);
    }
    return el;
  }

  update(el, n, parent) {
    const css = nodeCSS(n, parent, { mode: 'editor' });
    if (!n.visible) css.display = 'none';
    const t = cssText(css);
    if (el._css !== t) { el.style.cssText = t; el._css = t; }
    if (n.type === 'text') {
      ensureFont(n.font.family, n.font.weight, n.font.italic);
      if (S.editing !== n.id && el._text !== n.text) { el.textContent = n.text; el._text = n.text; }
    } else if (n.type === 'image') {
      const img = el.firstChild;
      const src = (n.src && S.doc.assets[n.src]) || '';
      if (img._src !== src) { img._src = src; if (src) img.src = src; else img.removeAttribute('src'); }
      el.classList.toggle('no-src', !src);
      if (img.style.objectFit !== n.fit) img.style.objectFit = n.fit;
    } else if (n.type === 'path') {
      const key = JSON.stringify([n.d, n.vw, n.vh, n.fill, n.stroke]);
      if (el._key !== key) { el._key = key; el.innerHTML = pathSVG(n); }
    }
  }

  // Write browser-computed geometry back to the model (no undo step).
  measure() {
    const visit = (list, parent) => {
      for (const n of list) {
        if (!n.visible) continue;
        const el = this.els.get(n.id);
        if (!el) continue;
        const sz = sizing(n, parent);
        if (isFlex(parent)) { n.x = el.offsetLeft; n.y = el.offsetTop; }
        if (sz.w !== 'fixed') n.w = el.offsetWidth;
        if (sz.h !== 'fixed') n.h = el.offsetHeight;
        if (n.children) visit(n.children, n);
      }
    };
    // children first matters for hug, but offset* forces a full layout anyway
    visit(S.doc.children, null);
  }
}
