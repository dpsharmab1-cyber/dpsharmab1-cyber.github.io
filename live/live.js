// Shared helpers for the live UI projects: theme sync with the portfolio,
// a tiny page router, and animated SVG charts.

export function theme() {
  const root = document.documentElement;
  const q = new URLSearchParams(location.search).get('theme');
  const set = (t) => { root.dataset.theme = t === 'dark' ? 'dark' : 'light'; window.dispatchEvent(new Event('themechange')); };
  set(q || 'light');
  window.addEventListener('message', (e) => { if (e.data?.type === 'theme') set(e.data.theme); });
  try { parent.postMessage({ type: 'live-theme-request' }, '*'); } catch (e) {}
  return set;
}

// pages: [data-page] sections, [data-go] triggers. Calls onShow(name).
export function router(onShow) {
  const pages = [...document.querySelectorAll('[data-page]')];
  let cur = null;
  const show = (name, push = true) => {
    if (name === cur) return;
    const next = pages.find((p) => p.dataset.page === name) || pages[0];
    pages.forEach((p) => {
      if (p === next) { p.hidden = false; requestAnimationFrame(() => p.classList.add('is-on')); }
      else { p.classList.remove('is-on'); p.hidden = true; }
    });
    document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('is-active', b.dataset.go === next.dataset.page));
    cur = next.dataset.page;
    onShow?.(cur, next);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    e.preventDefault();
    show(b.dataset.go);
  });
  show(pages[0].dataset.page);
  return show;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.appendChild(n);
  return n;
};

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function tip(host) {
  let t = host.querySelector('.chart-tip');
  if (!t) { t = document.createElement('div'); t.className = 'chart-tip'; host.appendChild(t); }
  return t;
}

// line / area chart. series: [{name, color, data:[...], area:bool}]
export function lineChart(host, { labels, series, max, min = 0, bands, height = 220, yTicks = 4, unit = '' }) {
  host.innerHTML = '';
  host.classList.add('chart');
  const W = host.clientWidth || 600, H = height, P = { l: 34, r: 12, t: 12, b: 26 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H }, host);
  const mx = max ?? Math.max(...series.flatMap((s) => s.data)) * 1.15;
  const X = (i) => P.l + (i / (labels.length - 1)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - ((v - min) / (mx - min)) * (H - P.t - P.b);
  if (bands) bands.forEach((b) => el('rect', { x: X(b.from), y: P.t, width: X(b.to) - X(b.from), height: H - P.t - P.b, fill: b.color, rx: 6 }, svg));
  for (let i = 0; i <= yTicks; i++) {
    const v = min + (mx - min) * (i / yTicks), y = Y(v);
    el('line', { x1: P.l, x2: W - P.r, y1: y, y2: y, class: 'grid' }, svg);
    el('text', { x: P.l - 8, y: y + 3, 'text-anchor': 'end', class: 'axis' }, svg).textContent = Math.round(v) + unit;
  }
  const step = Math.ceil(labels.length / 9);
  labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = l; });
  const defs = el('defs', {}, svg);
  series.forEach((s, si) => {
    const pts = s.data.map((v, i) => [X(i), Y(v)]);
    const d = smoothPath(pts);
    if (s.area) {
      const g = el('linearGradient', { id: `g${si}${host.id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.28 }, g);
      el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }, g);
      const a = el('path', { d: `${d} L${X(s.data.length - 1)},${H - P.b} L${X(0)},${H - P.b} Z`, fill: `url(#g${si}${host.id})`, class: 'area' }, svg);
      a.style.animationDelay = si * 120 + 'ms';
    }
    const p = el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.4, 'stroke-linecap': 'round', class: 'line' }, svg);
    const len = p.getTotalLength?.() || 1000;
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    p.style.animationDelay = si * 120 + 'ms';
    if (s.dots) pts.forEach(([x, y], i) => { const c = el('circle', { cx: x, cy: y, r: 3.2, fill: s.color, class: 'dot' }, svg); c.style.animationDelay = 300 + i * 30 + 'ms'; });
  });
  // hover
  const cross = el('line', { y1: P.t, y2: H - P.b, class: 'cross' }, svg);
  const t = tip(host);
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(labels.length - 1, Math.round((x - P.l) / (W - P.l - P.r) * (labels.length - 1))));
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.style.opacity = 1;
    t.innerHTML = `<b>${labels[i]}</b>` + series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}: ${s.data[i]}${unit}</span>`).join('');
    t.style.left = (X(i) / W * r.width) + 'px'; t.style.top = '8px'; t.classList.add('on');
  });
  svg.addEventListener('pointerleave', () => { cross.style.opacity = 0; t.classList.remove('on'); });
}

export function barChart(host, { labels, data, color, max, height = 220, colors, unit = '', horizontal = false }) {
  host.innerHTML = '';
  host.classList.add('chart');
  const W = host.clientWidth || 600, H = height, P = { l: horizontal ? 110 : 30, r: 12, t: 10, b: horizontal ? 10 : 24 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H }, host);
  const mx = max ?? Math.max(...data) * 1.15;
  const t = tip(host);
  const n = data.length;
  data.forEach((v, i) => {
    let r;
    if (horizontal) {
      const bh = (H - P.t - P.b) / n, y = P.t + i * bh + bh * 0.22, w = (v / mx) * (W - P.l - P.r);
      el('rect', { x: P.l, y, width: W - P.l - P.r, height: bh * 0.56, rx: bh * 0.28, class: 'ctrack' }, svg);
      r = el('rect', { x: P.l, y, width: w, height: bh * 0.56, rx: bh * 0.28, fill: colors?.[i] || color, class: 'barh' }, svg);
      el('text', { x: P.l - 10, y: y + bh * 0.4, 'text-anchor': 'end', class: 'axis lbl' }, svg).textContent = labels[i];
    } else {
      const bw = (W - P.l - P.r) / n, x = P.l + i * bw + bw * 0.28, h = (v / mx) * (H - P.t - P.b);
      r = el('rect', { x, y: H - P.b - h, width: bw * 0.44, height: h, rx: Math.min(6, bw * 0.22), fill: colors?.[i] || color, class: 'bar' }, svg);
      if (i % Math.ceil(n / 15) === 0) el('text', { x: x + bw * 0.22, y: H - 7, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = labels[i];
    }
    r.style.animationDelay = i * 28 + 'ms';
    r.addEventListener('pointerenter', () => {
      const b = r.getBoundingClientRect(), hr = host.getBoundingClientRect();
      t.innerHTML = `<b>${labels[i]}</b><span>${v}${unit}</span>`;
      t.style.left = (b.left - hr.left + b.width / 2) + 'px'; t.style.top = (b.top - hr.top - 6) + 'px';
      t.classList.add('on', 'up');
    });
    r.addEventListener('pointerleave', () => t.classList.remove('on', 'up'));
  });
}

export function donut(host, { parts, size = 150, thick = 18, label = '', sub = '' }) {
  host.innerHTML = '';
  host.classList.add('chart', 'donut');
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size }, host);
  const R = size / 2 - thick / 2, C = 2 * Math.PI * R;
  const total = parts.reduce((a, p) => a + p.value, 0);
  el('circle', { cx: size / 2, cy: size / 2, r: R, fill: 'none', 'stroke-width': thick, class: 'ctrack' }, svg);
  let acc = 0;
  parts.forEach((p, i) => {
    const len = (p.value / total) * C;
    const c = el('circle', { cx: size / 2, cy: size / 2, r: R, fill: 'none', stroke: p.color, 'stroke-width': thick, 'stroke-dasharray': `${Math.max(0, len - 3)} ${C}`, 'stroke-dashoffset': -acc, transform: `rotate(-90 ${size / 2} ${size / 2})`, 'stroke-linecap': 'round', class: 'seg' }, svg);
    c.style.animationDelay = i * 90 + 'ms';
    acc += len;
  });
  const mid = document.createElement('div');
  mid.className = 'donut-mid';
  mid.innerHTML = `<b>${label}</b><span>${sub}</span>`;
  host.appendChild(mid);
}

export function gauge(host, { value, color = '#3aa0c9', size = 200, label = '', ticks = 34 }) {
  host.innerHTML = '';
  host.classList.add('chart', 'gauge');
  const W = size, H = size * 0.62;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, host);
  const cx = W / 2, cy = H - 6, R = W / 2 - 10;
  for (let i = 0; i < ticks; i++) {
    const a = Math.PI + (i / (ticks - 1)) * Math.PI;
    const on = i / (ticks - 1) <= value / 100;
    const r1 = R - 18, r2 = R - (i % 4 === 0 ? 0 : 5);
    const l = el('line', { x1: cx + Math.cos(a) * r1, y1: cy + Math.sin(a) * r1, x2: cx + Math.cos(a) * r2, y2: cy + Math.sin(a) * r2, stroke: on ? color : 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', class: on ? 'tick on' : 'tick' }, svg);
    l.style.animationDelay = i * 18 + 'ms';
  }
  const mid = document.createElement('div');
  mid.className = 'gauge-mid';
  mid.innerHTML = `<b data-count="${value}">0</b><span>${label}</span>`;
  host.appendChild(mid);
  countUp(mid.querySelector('b'), value, 1, '%');
}

export function countUp(node, to, decimals = 0, suffix = '') {
  const t0 = performance.now();
  const run = (t) => {
    // rAF time can predate t0 by a frame: clamp, or the count starts negative
    const k = Math.min(1, Math.max(0, (t - t0) / 1000)), e = 1 - Math.pow(1 - k, 4);
    node.textContent = (to * e).toFixed(decimals) + suffix;
    if (k < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

export function animateCounts(root) {
  root.querySelectorAll('[data-num]').forEach((n) => countUp(n, +n.dataset.num, +(n.dataset.dec || 0), n.dataset.suf || ''));
}
