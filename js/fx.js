// Small interaction touches (mouse and trackpad only, off for reduced motion):
//  - tilt: work tiles lean toward the pointer in 3D with a soft light sheen
//  - ripple: a gentle liquid wobble runs over a work image while it is hovered
import { finePointer, reduced } from './core.js';

const TILT = '.prod, .mood .m-img, .mood .m-logo, .agrid button, .ggrid button, .sgrid button';
const RIPPLE = '.mood .m-img img, .agrid img, .prod-img img';

export class Fx {
  constructor(root = document) {
    this.on = finePointer && !reduced;
    if (!this.on) return;
    root.querySelectorAll(TILT).forEach((el) => this.tilt(el));
    this.rippleSetup(root);
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
