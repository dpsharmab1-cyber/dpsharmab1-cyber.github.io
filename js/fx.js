// Small interaction touches (mouse and trackpad only, off for reduced motion):
//  - scramble: nav and button labels shuffle through letters and resolve on hover
//  - tilt: work tiles lean toward the pointer in 3D with a soft light sheen
//  - ripple: a gentle liquid wobble runs over a work image while it is hovered
import { clamp, finePointer, reduced } from './core.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SCRAMBLE = '.nav-pill a, .nav-contact, .seemore-text, .send > span, .to-top > span, .chp-more > span, .foot-links a';
const TILT = '.prod, .mood .m-img, .mood .m-logo, .agrid button, .ggrid button, .sgrid button';
const RIPPLE = '.mood .m-img img, .agrid img, .prod-img img';

export class Fx {
  constructor(root = document) {
    this.on = finePointer && !reduced;
    if (!this.on) return;
    root.querySelectorAll(SCRAMBLE).forEach((el) => this.scramble(el));
    root.querySelectorAll(TILT).forEach((el) => this.tilt(el));
    this.rippleSetup(root);
  }

  // ---- letter scramble: left to right, each letter settles after a few swaps
  scramble(el) {
    const text = el.textContent;
    if (!text.trim() || el.children.length) return;
    let raf = 0;
    el.addEventListener('pointerenter', () => {
      cancelAnimationFrame(raf);
      const w = el.getBoundingClientRect().width;
      if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
      el.style.width = w + 'px';                      // no layout shift while it shuffles
      el.style.justifyContent = 'center';
      const t0 = performance.now(), dur = 420;
      const tick = (now) => {
        const p = clamp((now - t0) / dur);
        const done = Math.floor(p * text.length);
        el.textContent = [...text].map((c, i) => (i < done || c === ' ' ? c : GLYPHS[(Math.random() * 26) | 0])).join('');
        if (p < 1) raf = requestAnimationFrame(tick);
        else { el.textContent = text; el.style.width = ''; el.style.justifyContent = ''; el.style.display = ''; }
      };
      raf = requestAnimationFrame(tick);
    });
  }

  // ---- 3D tilt with a sheen that follows the pointer
  tilt(el) {
    el.classList.add('fx-tilt');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) translateY(-3px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 7).toFixed(2)}deg)`;
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      el.classList.add('is-tilting');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.transform = '';
    });
  }

  // ---- liquid ripple: one shared SVG filter, applied to the hovered image only
  rippleSetup(root) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="fx-ripple" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    document.body.append(svg);
    const turb = svg.querySelector('feTurbulence'), disp = svg.querySelector('feDisplacementMap');
    let cur = null, amt = 0, goal = 0, raf = 0, t0 = performance.now();
    const loop = (now) => {
      amt += (goal - amt) * 0.08;
      const t = (now - t0) / 1000;
      turb.setAttribute('baseFrequency', `${(0.008 + Math.sin(t * 0.9) * 0.002).toFixed(4)} ${(0.012 + Math.cos(t * 0.7) * 0.003).toFixed(4)}`);
      disp.setAttribute('scale', (amt * 14).toFixed(2));
      if (goal === 0 && amt < 0.01) { if (cur) cur.style.filter = ''; cur = null; raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };
    root.querySelectorAll(RIPPLE).forEach((img) => {
      img.addEventListener('pointerenter', () => {
        if (cur && cur !== img) cur.style.filter = '';
        cur = img; img.style.filter = 'url(#fx-ripple)'; goal = 1;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      img.addEventListener('pointerleave', () => { if (cur === img) goal = 0; });
    });
  }
}
