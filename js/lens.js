// Liquid glass over type. An SVG filter bends the element's own pixels inside
// a band (a horizontal bar, or a vertical slab) and splits red and blue a
// little, the way the glass bars in the Figma frames do. Outside the band the
// type stays untouched and crisp. The band can move every frame.
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

// displacement profiles; t runs across the band, -1..1 (bar) or 0..1 (slab)
const PROFILES = {
  // a cylinder lens: squeezes the type above and below into the bar, and folds
  // it back over itself near the rims
  bar: (t) => 1.55 * t - 2.15 * t * t * t,
  // the slab bends hard only near its right edge, smearing the letters there
  // the slab folds the type back on itself near its right edge, like the rim of
  // thick glass reflecting what is beside it (returns a share of the width)
  slab: (u) => {
    const u0 = 0.8, w = 0.05;                     // fold line and how soft its corner is
    const x = u - u0;
    const soft = x < -w ? 0 : x > w ? x : (x + w) * (x + w) / (4 * w);
    return -2 * soft;
  },
};

export class Lens {
  constructor(el, { axis = 'h', chroma = 0.12, depth = 0.5, soft = 0.6 } = {}) {
    this.el = el;
    this.axis = axis;
    this.chroma = chroma;
    this.depth = depth;              // max bend as a share of the band size
    this.id = 'lens-' + ++uid;
    const defs = document.querySelector('svg.defs defs');
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', this.id);
    f.setAttribute('x', '-20%'); f.setAttribute('y', '-40%');
    f.setAttribute('width', '140%'); f.setAttribute('height', '180%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `
      <feFlood flood-color="rgb(128,128,128)" result="neutral"/>
      <feImage preserveAspectRatio="none" result="map"/>
      <feComposite in="map" in2="neutral" operator="over" result="dmap"/>
      <feDisplacementMap in="SourceGraphic" in2="dmap" xChannelSelector="R" yChannelSelector="G" result="d1"/>
      <feColorMatrix in="d1" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="dmap" xChannelSelector="R" yChannelSelector="G" result="d2"/>
      <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feDisplacementMap in="SourceGraphic" in2="dmap" xChannelSelector="R" yChannelSelector="G" result="d3"/>
      <feColorMatrix in="d3" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>
      <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="split"/>
      <feGaussianBlur in="split" stdDeviation="${soft}" result="glass"/>
      <feComposite in="glass" in2="map" operator="in" result="inside"/>
      <feComposite in="SourceGraphic" in2="map" operator="out" result="outside"/>
      <feMerge><feMergeNode in="outside"/><feMergeNode in="inside"/></feMerge>`;
    defs.append(f);
    this.img = f.querySelector('feImage');
    this.maps = [...f.querySelectorAll('feDisplacementMap')];
    this.size = 0;
    el.style.filter = `url(#${this.id})`;
  }

  // band position in the element's own CSS px: bar = (y, h), slab = (x, w)
  set(a, b) {
    const L = Math.max(4, b);
    const w = this.axis === 'h' ? this.el.offsetWidth : this.el.offsetHeight;
    // the filter re-renders on every attribute write: skip frames where nothing moved
    if (Math.abs(a - this.la) < 0.08 && Math.abs(L - this.lb) < 0.08 && w === this.lw) return;
    this.la = a; this.lb = L; this.lw = w;
    if (Math.abs(L - this.size) > 0.5) this.build(L);
    const pad = 400;                              // the band always spans the type
    if (this.axis === 'h') {
      this.img.setAttribute('x', -pad); this.img.setAttribute('width', this.el.offsetWidth + 2 * pad);
      this.img.setAttribute('y', a.toFixed(2)); this.img.setAttribute('height', L.toFixed(2));
    } else {
      this.img.setAttribute('y', -pad); this.img.setAttribute('height', this.el.offsetHeight + 2 * pad);
      this.img.setAttribute('x', a.toFixed(2)); this.img.setAttribute('width', L.toFixed(2));
    }
  }

  build(L) {
    this.size = L;
    const n = Math.min(512, Math.max(16, Math.round(L)));
    const c = document.createElement('canvas');
    const h = this.axis === 'h';
    c.width = h ? 2 : n; c.height = h ? n : 2;
    const g = c.getContext('2d');
    const id = g.createImageData(c.width, c.height);
    const prof = h ? PROFILES.bar : PROFILES.slab;
    const vals = [];
    for (let i = 0; i < n; i++) vals.push(prof(h ? ((i + 0.5) / n) * 2 - 1 : (i + 0.5) / n));
    // bars are normalised to their depth; the slab profile is already in widths
    const peak = h ? Math.max(...vals.map(Math.abs)) || 1 : 1;
    const amp = h ? L * this.depth : L;
    const S = Math.max(...vals.map((v) => Math.abs(v / peak))) * amp * 2 + 2;   // feDisplacementMap scale (px)
    for (let i = 0; i < n; i++) {
      const d = (vals[i] / peak) * amp;            // px
      const v = Math.round(128 + (d / S) * 255);
      for (let j = 0; j < 2; j++) {
        const k = (h ? (i * 2 + j) : (j * n + i)) * 4;
        id.data[k] = h ? 128 : v; id.data[k + 1] = h ? v : 128; id.data[k + 2] = 128; id.data[k + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    this.img.setAttribute('href', c.toDataURL());
    const c0 = this.chroma;
    [S * (1 + c0), S, S * (1 - c0)].forEach((s, i) => this.maps[i].setAttribute('scale', s.toFixed(2)));
  }
}
