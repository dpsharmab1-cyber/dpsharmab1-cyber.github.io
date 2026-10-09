import { TEMPLATES, CATEGORIES, MATERIALS, byId, defaults } from './templates.js';
import { compile, sheetFit } from './engine.js';
import { dielineSVG, drawDesign, PATTERNS, contrastInk } from './dieline.js';
import { exportSVG, exportPDF, exportDXF, download, fileBase } from './exporters.js';
import { Viewer } from './viewer.js';
import { Editor, newLayer, pinToPanel, panelAt, layerCenter, layerCorners, layerAt, layerName, printCheck, fontCSS, resetTextLayout, FONTS } from './editor.js';
import { ELEMENTS, ICON_NAMES, elementsReady, normaliseEAN } from './elements.js';
import { PACK_ICONS } from './pack-icons.js';
import { ALL_TYPES, searchTypes } from './catalog.js';
import { hydrateIcons, icon } from '../../assets/icons.js';
import { createCloud } from './cloud.js';
import { setupAccount } from './account.js';

const $ = (s) => document.querySelector(s);
const SWATCHES = ['#c2956a', '#2547d0', '#e5a912', '#0b1a5c', '#ffffff', '#f4efe6', '#1b1d21', '#e8553e', '#2f9e6b', '#c9a27e', '#f6c7d3'];
const TOUCH = matchMedia('(pointer: coarse)').matches;
const NARROW = () => matchMedia('(max-width: 900px)').matches;
const IN = 25.4;

const state = {
  tpl: 'rte',
  values: {},          // per template id
  mat: null, thick: null,
  units: 'mm',
  view: matchMedia('(min-width: 1180px)').matches ? 'split' : '3d',
  design: { color: '#c2956a', pattern: 'Kraft', brand: 'Your Brand', tagline: 'Made with care', logo: null, art: null, layers: [] },
  layersByTpl: {},     // artwork layers are kept per template
};
let account = null;
let model = null, viewer = null, editor = null, showArt = true, vb = null, userZoomed = false, activePanel = null;

// ---------- library ----------

function buildLibrary() {
  const lib = $('#library');
  lib.innerHTML = `<div class="lib-find"><input id="libFind" type="search" autocomplete="off" aria-label="Search templates and pack types" placeholder="Search ${ALL_TYPES.length} pack types…">
    <div class="lib-hits" id="libHits" hidden></div><a class="lib-browse" href="../catalog.html">${icon('layers-3')} Browse the library</a></div>`;
  for (const cat of CATEGORIES) {
    const list = TEMPLATES.filter((x) => x.category === cat.id && !x.hidden);
    if (!list.length) continue;
    const box = document.createElement('div');
    box.className = 'cat';
    box.innerHTML = `<h4>${cat.name}</h4>`;
    for (const t of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tpl';
      b.dataset.tpl = t.id;
      b.dataset.find = ` ${[t.name, t.desc, cat.name, ...t.keywords].join(' ').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `;
      b.innerHTML = `<span class="thumb">${thumb(t)}</span><span><b>${t.name}</b><small>${t.desc}</small></span>`;
      b.addEventListener('click', () => selectTemplate(t.id));
      box.appendChild(b);
    }
    lib.appendChild(box);
  }
  const input = $('#libFind'), hits = $('#libHits');
  const run = () => {
    const q = input.value.trim().toLowerCase(), words = q.split(/[^a-z0-9]+/).filter(Boolean);
    lib.querySelectorAll('.tpl').forEach((b) => (b.hidden = !words.every((w) => b.dataset.find.includes(' ' + w))));
    lib.querySelectorAll('.cat').forEach((c) => (c.hidden = !c.querySelector('.tpl:not([hidden])')));
    const found = q ? searchTypes(q).filter((t) => t.tpl) : [];
    const seen = new Set(), top = found.filter((t) => !seen.has(t.name) && seen.add(t.name)).slice(0, 8);
    hits.hidden = !q;
    hits.innerHTML = top.length
      ? `<p>Pack types</p>${top.map((t, i) => `<button type="button" data-hit="${i}"><b>${esc(t.name)}</b><small>${esc(byId[t.tpl].name)}</small></button>`).join('')}`
      : `<p>No pack type matches “${esc(input.value.trim())}”. <a href="../catalog.html?q=${encodeURIComponent(input.value.trim())}">Search the library</a></p>`;
    hits.querySelectorAll('[data-hit]').forEach((b) => b.addEventListener('click', () => openType(top[+b.dataset.hit])));
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hits.querySelector('[data-hit]')?.click(); } if (e.key === 'Escape') { input.value = ''; run(); } });
}

// a catalogue entry: a template at a typical starting size
function openType(t) {
  const tpl = byId[t.tpl];
  state.values[tpl.id] = { ...defaults(tpl), ...(t.v || {}) };
  $('#libFind').value = '';
  $('#libFind').dispatchEvent(new Event('input'));
  selectTemplate(tpl.id);
  const v = state.values[tpl.id];
  toast(`${t.name}: ${tpl.name}, ${tpl.dims.map((k) => fmtLen(v[k])).join(' × ')}. Change any size on the right.`);
}

function thumb(t) {
  const m = compile(t, defaults(t), MATERIALS[t.material]);
  const b = m.net, X = (x) => (x - b.minX).toFixed(1), Y = (y) => (b.maxY - y).toFixed(1);
  const d = (segs) => segs.map(([[a, c], [e, f]]) => `M${X(a)} ${Y(c)}L${X(e)} ${Y(f)}`).join('');
  return `<svg viewBox="-4 -4 ${(b.w + 8).toFixed(1)} ${(b.h + 8).toFixed(1)}" aria-hidden="true">
    <path d="${d(m.cut)}" fill="none" stroke="var(--text)" stroke-width="1.3" vector-effect="non-scaling-stroke"/>
    <path d="${d(m.crease)}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/></svg>`;
}

function selectTemplate(id, { fromHash = false } = {}) {
  const tpl = byId[id] || byId.rte;
  state.tpl = tpl.id;
  if (!state.values[tpl.id]) state.values[tpl.id] = defaults(tpl);
  state.design.layers = state.layersByTpl[tpl.id] || (state.layersByTpl[tpl.id] = []);
  activePanel = null;
  editor?.select(null);
  resetHistory();
  if (!fromHash || !state.mat) { state.mat = tpl.material; state.thick = null; }
  document.querySelectorAll('.tpl').forEach((b) => b.setAttribute('aria-current', String(b.dataset.tpl === tpl.id)));
  $('#tplCat').textContent = CATEGORIES.find((c) => c.id === tpl.category).name;
  $('#tplName').textContent = tpl.name;
  $('#tplDesc').textContent = tpl.desc;
  buildParams();
  syncMaterial();
  userZoomed = false;
  rebuild({ refit: true });
  playFold();
}

// ---------- parameters ----------

function toUnit(p, mm) { return p.unit === 'mm' && state.units === 'in' ? +(mm / IN).toFixed(3) : mm; }
function fromUnit(p, v) { return p.unit === 'mm' && state.units === 'in' ? v * IN : v; }
function unitLabel(p) { return p.unit === 'mm' ? state.units : p.unit === '#' ? '' : p.unit; }

function buildParams() {
  const tpl = byId[state.tpl], vals = state.values[tpl.id];
  for (const host of [$('#dims'), $('#adv')]) host.innerHTML = '';
  // one-tap common sizes (approximate starting points, e.g. 500 ml milk pouch)
  const presets = $('#presets');
  presets.hidden = !tpl.presets;
  presets.innerHTML = tpl.presets ? `<span class="muted small">Quick sizes</span>${tpl.presets.map((pr, i) =>
    `<button type="button" class="chip" data-preset="${i}" aria-pressed="${Object.entries(pr.v).every(([k, v]) => vals[k] === v)}">${pr.label}</button>`).join('')}` : '';
  presets.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(vals, tpl.presets[+b.dataset.preset].v);
    buildParams();
    scheduleRebuild();
  }));
  for (const p of tpl.params) {
    const row = document.createElement('div');
    row.className = 'param';
    const inStep = p.unit === 'mm' && state.units === 'in' ? 0.01 : p.step;
    row.innerHTML = `<label for="p-${p.k}">${p.label}</label>
      <div class="num"><input id="p-${p.k}" type="number" inputmode="decimal" step="${inStep}" min="${toUnit(p, p.min)}" max="${toUnit(p, p.max)}" value="${fmt(toUnit(p, vals[p.k]))}"><span>${unitLabel(p)}</span></div>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${vals[p.k]}" aria-label="${p.label}">`;
    const num = row.querySelector('input[type=number]'), rng = row.querySelector('input[type=range]');
    const set = (mm, from) => {
      mm = Math.min(p.max, Math.max(p.min, mm));
      if (p.unit === '#') mm = Math.round(mm);
      vals[p.k] = mm;
      if (from !== 'num') num.value = fmt(toUnit(p, mm));
      if (from !== 'rng') rng.value = mm;
      scheduleRebuild();
    };
    num.addEventListener('input', () => { const v = parseFloat(num.value); if (Number.isFinite(v)) set(fromUnit(p, v), 'num'); });
    num.addEventListener('change', () => (num.value = fmt(toUnit(p, vals[p.k]))));
    rng.addEventListener('input', () => set(+rng.value, 'rng'));
    (p.adv ? $('#adv') : $('#dims')).appendChild(row);
  }
}

function fmt(v) { return Number.isInteger(v) ? String(v) : String(+v.toFixed(state.units === 'in' ? 2 : 1)); }

// ---------- material + design ----------

function syncMaterial() {
  const sel = $('#material');
  if (!sel.options.length) {
    for (const [k, m] of Object.entries(MATERIALS)) sel.add(new Option(m.name, k));
  }
  sel.value = state.mat;
  $('#thick').value = currentMaterial().t;
}

function currentMaterial() {
  const base = MATERIALS[state.mat];
  return { ...base, t: state.thick ?? base.t };
}

function buildDesignControls() {
  const sw = $('#swatches');
  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.background = c; b.dataset.color = c;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-label', c);
    b.addEventListener('click', () => setColor(c));
    sw.appendChild(b);
  }
  sw.insertAdjacentHTML('beforeend', '<label class="swatch custom" title="Custom colour"><input type="color" id="customColor" aria-label="Custom colour"></label>');
  $('#customColor').addEventListener('input', (e) => setColor(e.target.value));

  const pt = $('#patterns');
  for (const p of PATTERNS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = p; b.dataset.pattern = p; b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { state.design.pattern = p; markDesign(); redrawArt(); writeHash(); });
    pt.appendChild(b);
  }
  $('#brand').value = state.design.brand;
  $('#tagline').value = state.design.tagline;
  markDesign();
}

function setColor(c) { state.design.color = c; markDesign(); redrawArt(); writeHash(); }

function markDesign() {
  document.querySelectorAll('.swatch[data-color]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === state.design.color)));
  document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pattern === state.design.pattern)));
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- rebuild pipeline ----------

let raf = 0;
function scheduleRebuild() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => rebuild({ refit: false }));
}

function rebuild({ refit }) {
  const tpl = byId[state.tpl];
  try {
    model = compile(tpl, state.values[tpl.id], currentMaterial());
  } catch (e) {
    console.error(e);
    toast('That size does not work for this style. Try other values.');
    return;
  }
  viewer.setModel(model, { refit });
  redrawArt();
  updateStats();
  runPrintCheck();
  writeHash();
}

let art2D = null;
function redrawArt() {
  if (!model) return;
  paint3D();
  // layers are drawn live on the dieline by the editor, so leave them out here
  art2D = drawDesign(model, state.design, 1100, { layers: false }).toDataURL('image/jpeg', 0.86);
  render2D();
}

// 3D texture refresh while dragging layers: smaller canvas, at most once per frame
let live3D = 0;
function layersChanged(kind) {
  if (kind === 'live') {
    if (live3D) return;
    live3D = requestAnimationFrame(() => { live3D = 0; paint3D(1024); });
  } else {
    cancelAnimationFrame(live3D); live3D = 0;
    paint3D();
    renderLayerPanel();
    commitHistory();
    runPrintCheck();
    account?.markDirty();
  }
}

// The 3D texture shows the selected layer's frame, so it can be found on the model.
function paint3D(px = 2048, { clean = false } = {}) {
  if (!model) return;
  viewer.setArtwork(drawDesign(model, state.design, px, { selected: clean ? null : editor?.selected, onAsset: schedulePaint3D }));
}

let paintRaf = 0;
function schedulePaint3D() {
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => { paintRaf = 0; paint3D(); });
}

// exports and thumbnails never show the selection frame
async function withCleanTexture(fn) {
  await elementsReady(state.design.layers);
  paint3D(2048, { clean: true });
  try { return await fn(); } finally { paint3D(); }
}

function updateStats() {
  const v = model.values, tpl = model.tpl;
  const dims = tpl.dims.map((k) => fmtLen(v[k])).join(' × ');
  $('#stats').innerHTML = `<b>${dims} ${state.units}</b> · flat ${fmtLen(model.art.w)} × ${fmtLen(model.art.h)} ${state.units} · ${model.boardArea.toFixed(3)} m² material · fits <b>${sheetFit(model)}</b>`;
}

function fmtLen(mm) { return state.units === 'in' ? (mm / IN).toFixed(2) : Math.round(mm * 10) / 10; }

// ---------- 2D dieline view with pan/zoom ----------

function render2D() {
  if (state.view === '3d' || !model) return;
  const host = $('#svgHost');
  host.innerHTML = dielineSVG(model, { art: showArt ? art2D : null, screen: true, labels: !showArt });
  const svg = host.firstElementChild;
  const has = { crease: model.crease.length, glue: model.panels.some((q) => q.glue), seal: model.zones.length, guide: model.guides.length };
  document.querySelectorAll('.legend [data-k]').forEach((el) => (el.hidden = !has[el.dataset.k]));
  if (!vb || !userZoomed) fit2D();
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  if (activePanel) svg.querySelector(`#Hit [data-panel="${activePanel}"]`)?.classList.add('active');
  editor.mount(svg);
}

function fit2D() {
  const host = $('#svgHost'), b = model.art, pad = Math.max(b.w, b.h) * 0.06;
  const hw = host.clientWidth || 1, hh = host.clientHeight || 1;
  let w = b.w + pad * 2, h = b.h + pad * 2;
  if (w / h > hw / hh) h = w * (hh / hw); else w = h * (hw / hh);
  vb = { x: b.w / 2 - w / 2, y: b.h / 2 - h / 2, w, h };
}

function wire2DPanZoom() {
  const host = $('#svgHost');
  const apply = () => { host.firstElementChild?.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); editor.render(); };
  host.addEventListener('wheel', (e) => {
    if (!vb) return;
    e.preventDefault();
    const r = host.getBoundingClientRect();
    const k = Math.exp(e.deltaY * 0.0015);
    const px = vb.x + ((e.clientX - r.left) / r.width) * vb.w, py = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
    vb = { x: px - (px - vb.x) * k, y: py - (py - vb.y) * k, w: vb.w * k, h: vb.h * k };
    userZoomed = true; apply();
  }, { passive: false });
  let drag = null;
  host.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: false, pan: !(TOUCH && e.pointerType === 'touch' && !pane2dLive) };
    if (drag.pan) host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag || !drag.pan) return;
    const r = host.getBoundingClientRect();
    vb = { ...drag.vb, x: drag.vb.x - ((e.clientX - drag.x) / r.width) * vb.w, y: drag.vb.y - ((e.clientY - drag.y) / r.height) * vb.h };
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) { userZoomed = true; drag.moved = true; }
    apply();
  });
  host.addEventListener('pointerup', (e) => {
    // a tap (no drag) picks the panel new layers go on, and clears the selection
    if (drag && !drag.moved && editor.svg && model) {
      const [x, y] = editor.toFlat(e);
      const id = panelAt(model, x, y)?.id || null;
      if (id !== activePanel) setActivePanel(id);
      editor.select(null);
    }
    drag = null;
  });
  host.addEventListener('pointercancel', () => (drag = null));
  host.addEventListener('dblclick', () => { userZoomed = false; fit2D(); apply(); });
  new ResizeObserver(() => { if (model && !userZoomed && state.view !== '3d') { fit2D(); apply(); } }).observe(host);
}

// ---------- views + fold ----------

function setView(v) {
  state.view = v;
  $('#views').dataset.view = v;
  document.querySelectorAll('#viewTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  requestAnimationFrame(() => { viewer.resize(); userZoomed = false; render2D(); });
}

let anim = 0;
function playFold() {
  cancelAnimationFrame(anim);
  const t0 = performance.now(), dur = 2600, slider = $('#fold');
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    viewer.setFold(k);
    slider.value = k;
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

// ---------- smart input ----------

const NGON = { pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 };

export function parseAsk(text) {
  const s = ' ' + text.toLowerCase().replace(/×/g, 'x') + ' ';
  let best = null, score = 0;
  for (const t of TEMPLATES) {
    let sc = 0;
    for (const k of [...t.keywords, t.name.toLowerCase()]) if (s.includes(k)) sc += k.length;
    if (sc > score) { score = sc; best = t; }
  }
  const unit = /\d\s*cm\b/.test(s) ? 10 : /\d\s*(in\b|inch|")/.test(s) ? IN : 1;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|in|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:mm|cm|in|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?))?/);
  const dims = m ? [m[1], m[2], m[3]].filter(Boolean).map((n) => parseFloat(n) * unit) : [];
  let sides = (s.match(/(\d+)\s*-?\s*(?:sides|sided|side)\b/) || [])[1];
  for (const [w, n] of Object.entries(NGON)) if (s.includes(w)) sides = sides || n;
  if (sides && !best) best = byId.hexbox;
  // amounts like "500 ml", "1 litre", "50 g", "1kg" pick the nearest quick size
  const qm = s.match(/(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter|g|gm|gms|gram|grams|kg|kgs)\b/);
  let qty = null;
  if (qm) {
    const n = parseFloat(qm[1]), u = qm[2];
    qty = /^(ml)$/.test(u) ? { ml: n } : /^(l|ltr|litre|liter)$/.test(u) ? { ml: n * 1000 } : /^kgs?$/.test(u) ? { g: n * 1000 } : { g: n };
  }
  return { tpl: best, dims, sides: sides ? +sides : null, qty };
}

function runAsk(text) {
  const { tpl: found, dims, sides, qty } = parseAsk(text);
  const tpl = found || byId[state.tpl];
  if (!found && !dims.length && !qty) {
    toast('Try something like “tuck box 70x45x130” or “shipping box 40x30x30 cm”.');
    return;
  }
  const vals = state.values[tpl.id] || (state.values[tpl.id] = defaults(tpl));
  let clamped = false;
  tpl.dims.forEach((k, i) => {
    if (dims[i] == null) return;
    const p = tpl.params.find((q) => q.k === k);
    const v = Math.min(p.max, Math.max(p.min, Math.round(dims[i] * 10) / 10));
    if (Math.abs(v - dims[i]) > 0.05) clamped = true;
    vals[k] = v;
  });
  if (qty && tpl.presets && !dims.length) {
    const [unit, want] = Object.entries(qty)[0];
    const near = tpl.presets.filter((pr) => pr.q?.[unit] != null).sort((a, b) => Math.abs(a.q[unit] - want) - Math.abs(b.q[unit] - want))[0];
    if (near) Object.assign(vals, near.v);
  }
  if (sides && tpl.id === 'hexbox') vals.N = Math.min(12, Math.max(5, sides));
  selectTemplate(tpl.id);
  const v = state.values[tpl.id];
  toast(`${tpl.name} · ${tpl.dims.map((k) => fmtLen(v[k])).join(' × ')} ${state.units}${clamped ? ' (some values were capped to the allowed range)' : ''}`);
}

// ---------- share link ----------

function writeHash() {
  const v = state.values[state.tpl], q = new URLSearchParams({ t: state.tpl });
  for (const [k, x] of Object.entries(v)) q.set(k, +x.toFixed(2));
  q.set('mat', state.mat);
  if (state.thick != null) q.set('th', state.thick);
  q.set('c', state.design.color.replace('#', ''));
  q.set('pt', state.design.pattern);
  q.set('b', state.design.brand);
  q.set('tg', state.design.tagline);
  history.replaceState(null, '', location.pathname + location.search + '#' + q.toString());
  account?.markDirty();
}

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const tpl = byId[q.get('t')];
  if (!tpl) return;
  state.tpl = tpl.id;
  const vals = defaults(tpl);
  for (const p of tpl.params) {
    const v = parseFloat(q.get(p.k));
    if (Number.isFinite(v)) vals[p.k] = Math.min(p.max, Math.max(p.min, v));
  }
  state.values[tpl.id] = vals;
  if (MATERIALS[q.get('mat')]) state.mat = q.get('mat');
  const th = parseFloat(q.get('th'));
  if (Number.isFinite(th) && th > 0) state.thick = th;
  if (/^[0-9a-f]{6}$/i.test(q.get('c') || '')) state.design.color = '#' + q.get('c');
  if (PATTERNS.includes(q.get('pt'))) state.design.pattern = q.get('pt');
  if (q.has('b')) state.design.brand = q.get('b').slice(0, 32);
  if (q.has('tg')) state.design.tagline = q.get('tg').slice(0, 48);
}

// ---------- exports ----------

async function doExport(kind) {
  if (!model) return;
  const base = fileBase(model), m = currentMaterial();
  try {
    if (kind === 'svg') download(`${base}-dieline.svg`, exportSVG(model), 'image/svg+xml');
    if (kind === 'proof') {
      await elementsReady(state.design.layers);
      download(`${base}-proof.svg`, exportSVG(model, drawDesign(model, state.design, 2400).toDataURL('image/png')), 'image/svg+xml');
    }
    if (kind === 'dxf') download(`${base}-dieline.dxf`, exportDXF(model), 'application/dxf');
    if (kind === 'pdf') {
      const dims = model.tpl.dims.map((k) => `${model.tpl.params.find((p) => p.k === k).label} ${Math.round(model.values[k] * 10) / 10}`).join(', ');
      download(`${base}-dieline.pdf`, exportPDF(model, { title: model.tpl.name, dims: dims + ' mm', material: `${m.name}, ${m.t} mm` }), 'application/pdf');
    }
    if ((kind === 'glb' || kind === 'dxf') && account && !account.can(kind)) {
      account.openUpgrade(`${kind.toUpperCase()} export is part of Pro.`);
      return;
    }
    if (kind === 'glb') {
      const buf = await withCleanTexture(() => viewer.exportGLB());
      download(`${base}.glb`, new Blob([buf], { type: 'model/gltf-binary' }));
    }
    if (kind === 'png') {
      const hd = account ? account.can('hd') : true;
      const shot = await withCleanTexture(() => viewer.snapshot(hd ? 2 : 1));
      const blob = await (await fetch(hd ? shot : await watermark(shot))).blob();
      download(`${base}-mockup.png`, blob);
    }
    toast(`Downloaded ${kind.toUpperCase()}`);
  } catch (e) {
    console.error(e);
    toast('Export failed: ' + e.message);
  }
}

// ---------- misc UI ----------

function wireUI() {
  $('#ask').addEventListener('submit', (e) => { e.preventDefault(); runAsk($('#askInput').value); });
  document.querySelectorAll('#viewTabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('#units button').forEach((b) => b.addEventListener('click', () => {
    state.units = b.dataset.u;
    document.querySelectorAll('#units button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    buildParams(); updateStats();
  }));
  $('#fold').addEventListener('input', (e) => { cancelAnimationFrame(anim); viewer.setFold(+e.target.value); });
  $('#play').addEventListener('click', playFold);
  $('#fit3d').addEventListener('click', () => viewer.fit());
  $('#fit2d').addEventListener('click', () => { userZoomed = false; render2D(); });
  $('#showArt').addEventListener('change', (e) => { showArt = e.target.checked; render2D(); });
  $('#material').addEventListener('change', (e) => { state.mat = e.target.value; state.thick = null; syncMaterial(); rebuild({ refit: false }); });
  $('#thick').addEventListener('change', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v > 0) { state.thick = Math.min(10, v); rebuild({ refit: false }); }
  });
  $('#brand').addEventListener('input', (e) => { state.design.brand = e.target.value; redrawArt(); writeHash(); });
  $('#tagline').addEventListener('input', (e) => { state.design.tagline = e.target.value; redrawArt(); writeHash(); });
  for (const [id, key, label, empty] of [['logo', 'logo', '#logoLabel', 'Add logo'], ['art', 'art', '#artLabel', 'Upload full artwork']]) {
    $('#' + id).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.design[key] = await loadImage(file);
        $(label).textContent = file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name;
        $(label).parentElement.classList.add('has');
        redrawArt();
      } catch { toast('Could not read that image.'); }
      e.target.value = '';
    });
    $(label).parentElement.querySelector('.clear').addEventListener('click', (e) => {
      e.preventDefault();
      state.design[key] = null; $(label).textContent = empty; $(label).parentElement.classList.remove('has'); redrawArt();
    });
  }
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('#share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied. It opens this exact size and style.'); }
    catch { toast('Copy the address bar to share this exact setup.'); }
  });
  wire2DPanZoom();
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}


// ---------- touch: let the page scroll past the previews on phones ----------

let pane2dLive = false;
function setupTouchLocks() {
  if (!TOUCH) return;
  document.body.classList.add('touch');
  viewer.setInteractive(false);
  for (const [btn, pane] of [['#lock3d', '#view3d'], ['#lock2d', '#view2d']]) {
    $(btn).hidden = false;
    $(btn).addEventListener('click', () => {
      const on = !$(pane).classList.contains('live');
      $(pane).classList.toggle('live', on);
      $(btn).innerHTML = on ? `${icon('check')} Done` : `${icon('hand')} ${pane === '#view3d' ? 'Rotate' : 'Pan & zoom'}`;
      if (pane === '#view3d') viewer.setInteractive(on); else pane2dLive = on;
    });
  }
}

// ---------- artwork editor panel ----------

const DEFAULT_PALETTE = ['#ffffff', '#1b1d21', '#0b1a5c', '#2547d0', '#e5a912', '#e8553e', '#2f9e6b', '#c9a27e'];
const LAYER_ICON = { text: 'type', image: 'image-plus', shape: 'shapes' };
const EL_ICON = { barcode: 'scan-barcode', qr: 'qr-code' };
const MENU_SHAPES = [['rect', 'Rectangle', 'Panels, bands, price boxes'], ['ellipse', 'Circle / ellipse', 'Seals and spot colour'], ['burst', 'Starburst badge', '“New”, “20% extra”'], ['ribbon', 'Ribbon banner', 'Behind a headline'], ['line', 'Line', 'Dividers and rules']];
const MENU_ELEMENTS = [['veg', 'Food-type mark (veg)'], ['nonveg', 'Food-type mark (non-veg)'], ['legal', 'MRP & legal details', 'MRP, net qty, dates, FSSAI no.'], ['nutrition', 'Nutrition table', 'Per 100 g values'], ['barcode', 'Barcode (EAN-13)', 'Standard retail barcode'], ['qr', 'QR code', 'Link to your site or menu'], ['icon', 'Icon', 'Recycle, keep cool, veg, more']];

function wireEditorUI() {
  const fonts = $('#lpFont');
  for (const f of Object.keys(FONTS)) fonts.add(new Option(f === 'Hindi' ? 'Hindi (देवनागरी)' : f, f));

  // add menus
  $('#shapeList').innerHTML = MENU_SHAPES.map(([k, n, d]) => `<button type="button" data-shape="${k}"><span class="sw">${shapeGlyph(k)}</span><span>${n}<small>${d}</small></span></button>`).join('');
  $('#elList').innerHTML = MENU_ELEMENTS.map(([k, n, d]) => `<button type="button" data-el="${k}"><span class="sw">${elementGlyph(k)}</span><span>${n}${d ? `<small>${d}</small>` : ''}</span></button>`).join('');
  const closeMenus = () => document.querySelectorAll('details.menu[open]').forEach((m) => m.removeAttribute('open'));
  $('#shapeList').addEventListener('click', (e) => { const b = e.target.closest('[data-shape]'); if (b) { closeMenus(); addLayer('shape', { shape: b.dataset.shape }); } });
  $('#elList').addEventListener('click', (e) => { const b = e.target.closest('[data-el]'); if (b) { closeMenus(); addLayer('element', { el: b.dataset.el }); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('details.menu')) closeMenus(); });
  document.querySelectorAll('details.menu').forEach((m) => m.addEventListener('toggle', () => { if (m.open) document.querySelectorAll('details.menu[open]').forEach((o) => o !== m && o.removeAttribute('open')); }));

  $('#lpIcons').innerHTML = ICON_NAMES.map((n) => `<button type="button" role="radio" data-icon-name="${n}" title="${n.replace(/-/g, ' ')}" aria-label="${n.replace(/-/g, ' ')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PACK_ICONS[n]}</svg></button>`).join('');

  $('#addText').addEventListener('click', () => addLayer('text'));
  $('#addImage').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const img = await loadImage(file);
      addLayer('image', { img, src: img.src, name: file.name });
    } catch { toast('Could not read that image.'); }
  });

  // property bindings: live while typing or dragging, one history step on change
  const edit = (fn, live = true) => (e) => {
    const L = selectedLayer();
    if (!L) return;
    fn(L, e.target, e);
    syncProps(L, e.target.id);
    editor.render();
    layersChanged(live && e.type === 'input' ? 'live' : 'commit');
  };
  const on = (id, evt, fn) => { $(id).addEventListener(evt, edit(fn)); if (evt === 'input') $(id).addEventListener('change', () => selectedLayer() && layersChanged('commit')); };
  on('#lpText', 'input', (L, t) => (L.text = t.value));
  on('#lpFont', 'change', (L, t) => { L.font = t.value; loadFontFor(L); });
  $('#lpBold').addEventListener('click', edit((L) => (L.weight = (L.weight || 400) >= 700 ? 400 : 800)));
  $('#lpItalic').addEventListener('click', edit((L) => { L.italic = !L.italic; loadFontFor(L); }));
  on('#lpColor', 'input', (L, t) => (L.color = t.value));
  $('#lpAlign').addEventListener('click', edit((L, t, e) => { const b = e.target.closest('[data-align]'); if (b) L.align = b.dataset.align; }));
  on('#lpOutline', 'input', (L, t) => { L.outline = t.value; if (!(L.ow > 0)) L.ow = 0.3; });
  on('#lpOwR', 'input', (L, t) => { L.ow = +t.value; if (!L.outline) L.outline = '#ffffff'; });
  on('#lpLsR', 'input', (L, t) => (L.ls = +t.value));
  on('#lpCurveR', 'input', (L, t) => (L.curve = +t.value));
  on('#lpFillOn', 'change', (L, t) => (L.fill = t.checked ? $('#lpFill').value : null));
  on('#lpFill', 'input', (L, t) => (L.fill = t.value));
  on('#lpStrokeOn', 'change', (L, t) => { L.stroke = t.checked ? $('#lpStroke').value : null; if (t.checked && !(L.sw > 0)) L.sw = 0.5; });
  on('#lpStroke', 'input', (L, t) => { L.stroke = t.value; if (!(L.sw > 0)) L.sw = 0.5; });
  on('#lpSw', 'input', (L, t) => { const v = parseFloat(t.value); if (v > 0) L.sw = Math.min(20, v); });
  on('#lpRadiusR', 'input', (L, t) => (L.radius = +t.value));
  on('#lpPointsR', 'input', (L, t) => (L.points = +t.value));
  on('#lpCode', 'input', (L, t) => (L.data.code = t.value.replace(/\D/g, '').slice(0, 13)));
  $('#lpCode').addEventListener('change', (e) => { const L = selectedLayer(); if (L?.el === 'barcode') e.target.value = normaliseEAN(L.data.code); });
  on('#lpQr', 'input', (L, t) => (L.data.text = t.value));
  on('#lpNTitle', 'input', (L, t) => (L.data.title = t.value));
  on('#lpNBasis', 'input', (L, t) => (L.data.basis = t.value));
  on('#lpNRows', 'input', (L, t) => (L.data.rows = t.value));
  on('#lpLegal', 'input', (L, t) => (L.data.lines = t.value));
  $('#lpIcons').addEventListener('click', edit((L, t, e) => { const b = e.target.closest('[data-icon-name]'); if (b) L.data.icon = b.dataset.iconName; }));
  on('#lpElColor', 'input', (L, t) => (L.color = t.value));
  $('#lpPalette').addEventListener('click', edit((L, t, e) => { const b = e.target.closest('[data-c]'); if (b) setMainColor(L, b.dataset.c); }));
  const setSize = (L, v) => { if (!(v > 0)) return; if (L.type === 'text') L.size = Math.min(300, v); else L.w = Math.min(2000, v); };
  on('#lpSize', 'input', (L, t) => setSize(L, parseFloat(t.value)));
  on('#lpSizeR', 'input', (L, t) => setSize(L, +t.value));
  on('#lpH', 'input', (L, t) => { const v = parseFloat(t.value); if (v > 0) L.h = Math.min(2000, v); });
  on('#lpHR', 'input', (L, t) => (L.h = +t.value));
  on('#lpRot', 'input', (L, t) => { const v = parseFloat(t.value); if (Number.isFinite(v)) L.rot = v; });
  on('#lpRotR', 'input', (L, t) => (L.rot = +t.value));
  on('#lpOpacityR', 'input', (L, t) => (L.opacity = +t.value));

  $('#layerProps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-place]');
    const L = selectedLayer();
    if (!b || !L) return;
    if (b.dataset.place) placeOnPanel(L, b.dataset.place);
    const list = state.design.layers, i = list.indexOf(L);
    if (b.dataset.act === 'up' && i < list.length - 1) [list[i], list[i + 1]] = [list[i + 1], list[i]];
    if (b.dataset.act === 'down' && i > 0) [list[i], list[i - 1]] = [list[i - 1], list[i]];
    if (b.dataset.act === 'dup') duplicateLayer(L);
    if (b.dataset.act === 'del') deleteLayer(L);
    editor.render();
    layersChanged('commit');
  });

  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);

  document.addEventListener('keydown', (e) => {
    const typing = /input|select|textarea/i.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && !typing && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && !typing && key === 'y') { e.preventDefault(); redo(); return; }
    const L = selectedLayer();
    if (!L || typing) return;
    if (e.key === 'Escape') { editor.select(null); return; }
    if (mod && key === 'd') { e.preventDefault(); duplicateLayer(L); editor.render(); layersChanged('commit'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteLayer(L); layersChanged('commit'); return; }
    const step = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d || L.locked) return;
    e.preventDefault();
    const [x, y] = layerCenter(model, L);
    pinToPanel(model, L, x + d[0], y + d[1]);
    editor.render();
    layersChanged('commit');
  });

  $('#checkList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) { editor.select(b.dataset.id); $('#layerProps').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });

  // web fonts change text widths once they arrive
  document.fonts?.addEventListener?.('loadingdone', () => { resetTextLayout(); editor.render(); schedulePaint3D(); runPrintCheck(); });
  renderLayerPanel();
}

function loadFontFor(L) {
  document.fonts?.load(fontCSS(L, 40), L.text || 'Aa').then(() => { resetTextLayout(); editor.render(); schedulePaint3D(); }).catch(() => {});
}

function selectedLayer() { return state.design.layers.find((L) => L.id === editor.selected) || null; }

function duplicateLayer(L) {
  const list = state.design.layers;
  const c = { ...L, data: L.data ? { ...L.data } : L.data, id: newLayer(L.type).id, locked: false, u: Math.min(0.95, L.u + 0.06), v: Math.max(0.05, L.v - 0.06) };
  list.splice(list.indexOf(L) + 1, 0, c);
  editor.select(c.id);
}

function deleteLayer(L) {
  state.design.layers.splice(state.design.layers.indexOf(L), 1);
  editor.select(null);
}

function mainColor(L) {
  if (L.type === 'text') return L.color;
  if (L.type === 'shape') return L.shape === 'line' ? L.stroke : L.fill || L.stroke;
  return L.color;
}

function setMainColor(L, c) {
  if (L.type === 'text') L.color = c;
  else if (L.type === 'shape') { if (L.shape === 'line') L.stroke = c; else L.fill = c; }
  else if (L.type === 'element') L.color = c;
}

// align the layer's rotated outline to its panel, keeping a 3 mm safe margin
function placeOnPanel(L, where) {
  const q = model.byId[L.panel];
  if (!q || L.locked) return;
  const xs = q.pts.map((p) => p[0]), ys = q.pts.map((p) => p[1]);
  const P = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const cs = layerCorners(model, L), [cx, cy] = layerCenter(model, L);
  const B = { minX: Math.min(...cs.map((p) => p[0])), maxX: Math.max(...cs.map((p) => p[0])), minY: Math.min(...cs.map((p) => p[1])), maxY: Math.max(...cs.map((p) => p[1])) };
  const m = Math.min(3, (P.maxX - P.minX - (B.maxX - B.minX)) / 2, (P.maxY - P.minY - (B.maxY - B.minY)) / 2);
  const M = Math.max(0, m);
  let x = cx, y = cy;
  if (where === 'left') x = P.minX + M + (cx - B.minX);
  if (where === 'right') x = P.maxX - M - (B.maxX - cx);
  if (where === 'hcenter') x = (P.minX + P.maxX) / 2;
  if (where === 'bottom') y = P.minY + M + (cy - B.minY);
  if (where === 'top') y = P.maxY - M - (B.maxY - cy);
  if (where === 'vmiddle') y = (P.minY + P.maxY) / 2;
  const b = { w: P.maxX - P.minX, h: P.maxY - P.minY };
  L.u = (x - P.minX) / b.w;
  L.v = (y - P.minY) / b.h;
  // step inward until clear of heat seals (pouch and pillow-pack ends and fins)
  const dir = { left: [0.5, 0], right: [-0.5, 0], top: [0, -0.5], bottom: [0, 0.5] }[where];
  if (!dir || !model.zones.length) return;
  let i = 0;
  for (; i < 160 && printCheck(model, [L]).some((it) => /heat-seal/.test(it.msg)); i++) {
    L.u += dir[0] / b.w;
    L.v += dir[1] / b.h;
  }
  if (i) { L.u += (dir[0] * 4) / b.w; L.v += (dir[1] * 4) / b.h; } // plus 2 mm breathing room
}

function addLayer(type, extra = {}) {
  if (!model) return;
  // place on the tapped panel, else on the front face
  let x, y, rot = 0;
  const fr = model.frontRect;
  const q = activePanel && model.byId[activePanel];
  if (q) {
    const xs = q.pts.map((p) => p[0]), ys = q.pts.map((p) => p[1]);
    x = (Math.min(...xs) + Math.max(...xs)) / 2; y = (Math.min(...ys) + Math.max(...ys)) / 2;
  } else {
    x = fr.x + fr.w / 2; y = fr.y + fr.h / 2;
    rot = Math.round((Math.atan2(-fr.up[0], fr.up[1]) * 180) / Math.PI);
  }
  const span = q ? Math.min(...['w', 'h'].map((k) => { const v = q.pts.map((p) => p[k === 'w' ? 0 : 1]); return Math.max(...v) - Math.min(...v); })) : Math.min(fr.w, fr.h);
  const ink = contrastInk(state.design.color) === '#ffffff' ? '#ffffff' : '#1b1d21';
  const accent = contrastInk(state.design.color) === '#ffffff' ? '#e5a912' : '#0b1a5c';
  const r1 = (v) => Math.round(v * 10) / 10;
  let L;
  if (type === 'text') {
    // readable on whatever it lands on: a filled shape underneath, else the pack colour
    const under = layerAt(model, state.design.layers.filter((l) => l.type === 'shape' && l.fill), x, y);
    const color = under ? (contrastInk(under.fill) === '#ffffff' ? '#ffffff' : '#0b1a5c') : accent;
    L = newLayer('text', { text: 'Your text', size: Math.max(3, Math.min(40, Math.round(span * 0.12))), font: activeKit?.font || 'Display', weight: 800, color, align: 'center', rot });
  } else if (type === 'image') {
    L = newLayer('image', { w: r1(Math.max(8, span * 0.5)), rot, ...extra });
  } else if (type === 'shape') {
    const k = extra.shape, wide = { rect: [0.6, 0.3], ellipse: [0.4, 0.4], burst: [0.42, 0.42], ribbon: [0.75, 0.18], line: [0.6, 0] }[k] || [0.5, 0.3];
    L = newLayer('shape', {
      shape: k, w: r1(span * wide[0]), h: r1(Math.max(1, span * wide[1])), rot,
      fill: k === 'line' ? null : accent, stroke: k === 'line' ? ink : null, sw: k === 'line' ? 0.6 : 0.5,
      radius: k === 'rect' ? r1(span * 0.04) : 0, points: 16,
    });
  } else {
    const def = ELEMENTS[extra.el];
    const w = extra.el === 'veg' || extra.el === 'nonveg' ? def.w : r1(Math.min(def.w, span * 0.9));
    L = newLayer('element', { el: extra.el, data: def.data(), w, rot, color: extra.el === 'icon' ? ink : '#1b1d21' });
  }
  pinToPanel(model, L, x, y);
  // background shapes slide in beneath text they would otherwise cover
  const list = state.design.layers;
  const covered = type === 'shape' && L.fill ? list.findIndex((l) => l.type === 'text' && !l.hidden && layerAt(model, [L], ...layerCenter(model, l))) : -1;
  if (covered >= 0) list.splice(covered, 0, L); else list.push(L);
  editor.select(L.id);
  layersChanged('commit');
  if (type === 'text') requestAnimationFrame(() => $('#lpText').select());
  const warn = printCheck(model, [L]).find((i) => i.level === 'warn');
  if (warn && type === 'element') toast(warn.msg);
}

function renderLayerPanel() {
  const list = $('#layerList'), L = selectedLayer();
  list.innerHTML = state.design.layers.slice().reverse().map((x) => `<li class="${x.hidden ? 'is-hidden' : ''}">
    <button type="button" data-id="${x.id}" aria-current="${x.id === editor.selected}">${icon(x.type === 'element' ? EL_ICON[x.el] || 'badge-check' : LAYER_ICON[x.type])}<span>${esc(layerName(x))}</span><small>${esc(model?.byId[x.panel]?.name || '')}</small></button>
    <button type="button" class="lbtn" data-vis="${x.id}" aria-pressed="${!!x.hidden}" title="${x.hidden ? 'Show' : 'Hide'}" aria-label="${x.hidden ? 'Show' : 'Hide'} layer">${icon(x.hidden ? 'eye-off' : 'eye')}</button>
    <button type="button" class="lbtn" data-lock="${x.id}" aria-pressed="${!!x.locked}" title="${x.locked ? 'Unlock' : 'Lock'}" aria-label="${x.locked ? 'Unlock' : 'Lock'} layer">${icon(x.locked ? 'lock' : 'lock-open')}</button></li>`).join('')
    || '<li class="empty">No layers yet. Tap a panel (on the dieline or the 3D model), then add text, an image, a shape or a pack label.</li>';
  list.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => editor.select(b.dataset.id)));
  list.querySelectorAll('button[data-vis], button[data-lock]').forEach((b) => b.addEventListener('click', () => {
    const x = state.design.layers.find((l) => l.id === (b.dataset.vis || b.dataset.lock));
    if (!x) return;
    if (b.dataset.vis) x.hidden = !x.hidden; else x.locked = !x.locked;
    editor.render();
    layersChanged('commit');
  }));
  $('#layerProps').hidden = !L;
  if (L) syncProps(L);
}

function syncProps(L, skip) {
  const set = (id, v) => { if (id !== skip) $(id).value = v; };
  const tokens = [L.type, `${L.type}:${L.shape || L.el}`];
  document.querySelectorAll('#layerProps [data-for]').forEach((n) => (n.hidden = !n.dataset.for.split(' ').some((t) => tokens.includes(t))));
  if (L.type === 'text') {
    set('#lpText', L.text || '');
    set('#lpFont', L.font || 'Sans');
    set('#lpColor', L.color || '#000000');
    $('#lpBold').setAttribute('aria-pressed', String((L.weight || 400) >= 700));
    $('#lpItalic').setAttribute('aria-pressed', String(!!L.italic));
    document.querySelectorAll('#lpAlign [data-align]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.align === (L.align || 'center'))));
    set('#lpOutline', L.outline || '#ffffff');
    set('#lpOwR', L.ow || 0);
    set('#lpLsR', L.ls || 0);
    set('#lpCurveR', L.curve || 0);
    $('#lpCurveVal').textContent = L.curve ? (L.curve > 0 ? `arch ${L.curve}` : `smile ${-L.curve}`) : 'straight';
  }
  if (L.type === 'shape') {
    $('#lpFillOn').checked = !!L.fill; set('#lpFill', L.fill || '#e5a912');
    $('#lpStrokeOn').checked = !!L.stroke; set('#lpStroke', L.stroke || '#1b1d21');
    set('#lpSw', +(L.sw || 0.5).toFixed(2));
    set('#lpRadiusR', L.radius || 0);
    set('#lpPointsR', L.points || 16);
    set('#lpH', +(L.h || 1).toFixed(1)); set('#lpHR', L.h || 1);
    $('#lpHR').max = Math.max(200, Math.ceil((L.h || 1) * 2));
  }
  if (L.type === 'element') {
    const d = L.data || {};
    if (L.el === 'barcode') set('#lpCode', d.code || '');
    if (L.el === 'qr') set('#lpQr', d.text || '');
    if (L.el === 'nutrition') { set('#lpNTitle', d.title || ''); set('#lpNBasis', d.basis || ''); set('#lpNRows', d.rows || ''); }
    if (L.el === 'legal') set('#lpLegal', d.lines || '');
    if (L.el === 'icon') document.querySelectorAll('#lpIcons [data-icon-name]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.iconName === d.icon)));
    set('#lpElColor', L.color || '#1b1d21');
  }
  // brand colours for the layer's main colour (not for photos, barcodes or diet marks)
  const pal = $('#lpPalette');
  const fixed = L.type === 'image' || ['barcode', 'veg', 'nonveg'].includes(L.el);
  pal.innerHTML = fixed ? '' : `<span>${activeKit ? esc(activeKit.name) : 'Colours'}</span>` + paletteColors().map((c) =>
    `<button type="button" data-c="${c}" style="background:${c}" title="${c}" aria-label="Use ${c}"${c === mainColor(L) ? ' aria-current="true"' : ''}></button>`).join('');
  const size = L.type === 'text' ? L.size : L.w;
  set('#lpSize', +size.toFixed(1)); set('#lpSizeR', size);
  $('#lpSizeR').max = Math.max(200, Math.ceil(size * 2));
  $('#lpSizeLabel').textContent = L.type === 'text' ? 'Text size' : 'Width';
  set('#lpRot', Math.round(L.rot)); set('#lpRotR', Math.round(L.rot));
  set('#lpOpacityR', L.opacity ?? 1);
  const item = $(`#layerList [data-id="${L.id}"] span`);
  if (item) item.textContent = layerName(L);
}

function paletteColors() {
  const used = state.design.layers.flatMap((L) => [L.color, L.fill, L.stroke]).filter((c) => /^#[0-9a-f]{6}$/i.test(c || ''));
  const base = activeKit ? activeKit.colors : [state.design.color, ...DEFAULT_PALETTE];
  return [...new Set([...base, ...used].map((c) => c.toLowerCase()))].slice(0, 12);
}

function shapeGlyph(k) {
  const d = { rect: '<rect x="3" y="6" width="18" height="12" rx="2"/>', ellipse: '<circle cx="12" cy="12" r="8"/>', line: '<path d="M4 12h16"/>', ribbon: '<path d="M2 7h20l-3 5 3 5H2l3-5z"/>', burst: '<path d="m12 2 2.1 3.4 3.9-.9-.4 4 3.4 2.2-3 2.6 1.4 3.7-4-.2L13.6 20 12 16.4 10.4 20l-1.8-3.2-4 .2L6 13.3 3 10.7l3.4-2.2-.4-4 3.9.9z"/>' }[k];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

function elementGlyph(k) {
  if (k === 'veg') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" fill="#fff" stroke="#14903b" stroke-width="2.4"/><circle cx="12" cy="12" r="5" fill="#14903b"/></svg>';
  if (k === 'nonveg') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" fill="#fff" stroke="#7a3b12" stroke-width="2.4"/><path d="M12 6.5 17.5 16h-11z" fill="#7a3b12"/></svg>';
  return icon({ barcode: 'scan-barcode', qr: 'qr-code', nutrition: 'info', legal: 'indian-rupee', icon: 'badge-check' }[k] || 'badge-check');
}

// ---------- 3D: pick and drag layers on the model ----------

function wire3DEditing() {
  const host = $('#view3d'), canvas = viewer.renderer.domElement;
  let drag = null, tap = null, hover = 0;
  const pickLayer = (e) => {
    const p = viewer.pick(e.clientX, e.clientY);
    return { p, L: p && model ? layerAt(model, state.design.layers, p[0], p[1], 1) : null };
  };
  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target !== canvas || !model) return;
    const { p, L } = pickLayer(e);
    tap = { x: e.clientX, y: e.clientY, p, L };
    // phones: dragging a layer needs "Rotate" mode, so the page can still scroll
    const live = e.pointerType !== 'touch' || viewer.controls.enabled;
    if (!L || !live) return;
    e.stopPropagation();
    e.preventDefault();
    if (editor.selected !== L.id) editor.select(L.id);
    const c = layerCenter(model, L);
    drag = { L, off: [c[0] - p[0], c[1] - p[1]], moved: false };
    host.setPointerCapture(e.pointerId);
  }, { capture: true });
  host.addEventListener('pointermove', (e) => {
    if (drag) {
      e.stopPropagation();
      const p = viewer.pick(e.clientX, e.clientY);
      if (!p) return;
      drag.moved = true;
      pinToPanel(model, drag.L, p[0] + drag.off[0], p[1] + drag.off[1]);
      editor.render();
      layersChanged('live');
      return;
    }
    if (e.pointerType === 'mouse' && !e.buttons && !hover) {
      hover = requestAnimationFrame(() => { hover = 0; canvas.classList.toggle('can-move', !!pickLayer(e).L); });
    }
  }, { capture: true });
  const end = (e) => {
    if (drag) {
      e.stopPropagation();
      try { host.releasePointerCapture(e.pointerId); } catch {}
      const moved = drag.moved;
      drag = null; tap = null;
      if (moved) layersChanged('commit');
      return;
    }
    if (tap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 6) {
      if (tap.L) editor.select(tap.L.id);
      else {
        editor.select(null);
        if (tap.p) setActivePanel(panelAt(model, tap.p[0], tap.p[1])?.id || null);
      }
    }
    tap = null;
  };
  host.addEventListener('pointerup', end, { capture: true });
  host.addEventListener('pointercancel', end, { capture: true });
}

function setActivePanel(id) {
  activePanel = id;
  const host = $('#svgHost');
  host.querySelectorAll('#Hit .active').forEach((n) => n.classList.remove('active'));
  if (id) host.querySelector(`#Hit [data-panel="${id}"]`)?.classList.add('active');
  if (id) toast(`New layers go on the ${model.byId[id].name.toLowerCase()} panel`);
}

// ---------- undo / redo ----------

const undoStack = { past: [], future: [], cur: null };
const layerSig = (ls) => JSON.stringify(ls, (k, v) => (k === 'img' || k === 'src' ? undefined : v));
const cloneLayers = (ls) => ls.map((L) => ({ ...L, data: L.data ? { ...L.data } : L.data }));

function resetHistory() {
  const ls = state.design.layers;
  undoStack.past = []; undoStack.future = [];
  undoStack.cur = { sig: layerSig(ls), layers: cloneLayers(ls) };
  updateHistoryButtons();
}

function commitHistory() {
  const ls = state.design.layers, sig = layerSig(ls);
  if (!undoStack.cur) return resetHistory();
  if (sig === undoStack.cur.sig) return;
  undoStack.past.push(undoStack.cur);
  if (undoStack.past.length > 100) undoStack.past.shift();
  undoStack.cur = { sig, layers: cloneLayers(ls) };
  undoStack.future = [];
  updateHistoryButtons();
}

function undo() { if (undoStack.past.length) { undoStack.future.push(undoStack.cur); undoStack.cur = undoStack.past.pop(); applyHistory(); } }
function redo() { if (undoStack.future.length) { undoStack.past.push(undoStack.cur); undoStack.cur = undoStack.future.pop(); applyHistory(); } }

function applyHistory() {
  const ls = state.design.layers;
  ls.splice(0, ls.length, ...cloneLayers(undoStack.cur.layers));
  if (!ls.some((L) => L.id === editor.selected)) editor.selected = null;
  editor.render();
  paint3D();
  renderLayerPanel();
  runPrintCheck();
  updateHistoryButtons();
  account?.markDirty();
}

function updateHistoryButtons() {
  $('#undo').disabled = !undoStack.past.length;
  $('#redo').disabled = !undoStack.future.length;
}

// ---------- print check ----------

function runPrintCheck() {
  if (!model) return;
  const issues = printCheck(model, state.design.layers), warn = issues.filter((i) => i.level === 'warn').length;
  const count = $('#checkCount');
  count.textContent = warn ? `${warn} to fix` : issues.length ? `${issues.length} tip${issues.length > 1 ? 's' : ''}` : 'OK';
  count.className = 'count' + (warn ? ' warn' : '');
  $('#checkList').innerHTML = issues.length
    ? issues.map((i) => `<li><button type="button" class="${i.level}" data-id="${i.id}">${icon(i.level === 'warn' ? 'triangle-alert' : 'info')}<span><b>${esc(i.name)}</b>${esc(i.msg)}</span></button></li>`).join('')
    : `<li class="clean">${state.design.layers.length ? 'Every layer sits inside its panel, clear of folds and cuts.' : 'Add layers and they are checked here for folds, cut lines, small text, image resolution and barcode size.'}</li>`;
}

// ---------- brand kits (saved in this browser) ----------

const KIT_KEY = 'packstudio.brandkits.v1';
let activeKit = null;

function loadKits() { try { return JSON.parse(localStorage.getItem(KIT_KEY)) || []; } catch { return []; } }
function storeKits(kits) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(kits)); return true; }
  catch { toast('Could not save the brand kit in this browser (storage full or blocked).'); return false; }
}

function renderKits() {
  const sel = $('#kitSel'), kits = loadKits();
  sel.innerHTML = '<option value="">Brand kit…</option>' + kits.map((k) => `<option value="${esc(k.id)}">${esc(k.name)}</option>`).join('');
  sel.value = activeKit && kits.some((k) => k.id === activeKit.id) ? activeKit.id : '';
  $('#kitDel').hidden = !sel.value;
}

function wireBrandKits() {
  $('#kitSave').addEventListener('click', () => {
    const name = (prompt('Name this brand kit', activeKit?.name || state.design.brand || 'My brand') || '').trim().slice(0, 40);
    if (!name) return;
    const d = state.design;
    const colors = [...new Set([d.color, ...d.layers.flatMap((L) => [L.color, L.fill, L.stroke, L.outline])].filter((c) => /^#[0-9a-f]{6}$/i.test(c || '')).map((c) => c.toLowerCase()))];
    for (const c of DEFAULT_PALETTE) if (colors.length < 6 && !colors.includes(c)) colors.push(c);
    const kits = loadKits(), old = kits.find((k) => k.name.toLowerCase() === name.toLowerCase());
    const kit = {
      id: old?.id || 'K' + crypto.randomUUID().slice(0, 8), name, colors: colors.slice(0, 10),
      font: d.layers.find((L) => L.type === 'text')?.font || 'Display',
      brand: d.brand, tagline: d.tagline, pattern: d.pattern,
      logo: d.logo ? imgToDataURL(d.logo, 600) : null,
    };
    if (old) kits[kits.indexOf(old)] = kit; else kits.push(kit);
    if (!storeKits(kits)) return;
    activeKit = kit;
    renderKits();
    if (selectedLayer()) syncProps(selectedLayer());
    toast(`Saved brand kit “${name}”. Pick it on any pack to apply its colours, name and logo.`);
  });
  $('#kitSel').addEventListener('change', async (e) => {
    const kit = loadKits().find((k) => k.id === e.target.value) || null;
    activeKit = kit;
    $('#kitDel').hidden = !kit;
    if (kit) {
      const d = state.design;
      d.color = kit.colors[0] || d.color;
      if (PATTERNS.includes(kit.pattern)) d.pattern = kit.pattern;
      d.brand = kit.brand ?? d.brand; d.tagline = kit.tagline ?? d.tagline;
      $('#brand').value = d.brand; $('#tagline').value = d.tagline;
      if (kit.logo) {
        try {
          d.logo = await loadImageURL(kit.logo);
          $('#logoLabel').textContent = 'Logo'; $('#logoLabel').parentElement.classList.add('has');
        } catch {}
      }
      markDesign(); redrawArt(); writeHash();
      toast(`Applied “${kit.name}”. Its colours are in each layer's palette.`);
    }
    if (selectedLayer()) syncProps(selectedLayer());
  });
  $('#kitDel').addEventListener('click', () => {
    if (!activeKit || !confirm(`Delete the brand kit “${activeKit.name}”?`)) return;
    storeKits(loadKits().filter((k) => k.id !== activeKit.id));
    activeKit = null;
    renderKits();
    if (selectedLayer()) syncProps(selectedLayer());
  });
  renderKits();
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }


// ---------- saved projects ----------

function loadImageURL(src) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
}

function imgToDataURL(img, max = 1600) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.9); // keeps transparency; falls back to PNG where WebP isn't supported
}

function thumbnail() {
  if (editor.selected) paint3D(1024, { clean: true });
  try { return thumbnailShot(); } finally { if (editor.selected) paint3D(); }
}

function thumbnailShot() {
  const src = viewer.renderer.domElement, w = 360, h = Math.round((w * src.height) / Math.max(1, src.width)) || 270;
  viewer.renderer.render(viewer.scene, viewer.camera);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f5ff'; g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.78);
}

async function snapshotProject() {
  const d = state.design;
  const layers = d.layers.map(({ img, ...L }) => (L.type === 'image' ? { ...L, src: imgToDataURL(img) } : L));
  return {
    template: state.tpl,
    thumb: thumbnail(),
    state: {
      v: 1, tpl: state.tpl, values: { ...state.values[state.tpl] }, mat: state.mat, thick: state.thick, units: state.units,
      design: {
        color: d.color, pattern: d.pattern, brand: d.brand, tagline: d.tagline,
        logo: d.logo ? imgToDataURL(d.logo, 1200) : null,
        art: d.art ? imgToDataURL(d.art, 2400) : null,
        layers,
      },
    },
  };
}

async function restoreProject(s) {
  const tpl = byId[s?.tpl];
  if (!tpl) throw new Error('This project uses a template that no longer exists.');
  const d = s.design || {};
  const [logo, art, layers] = await Promise.all([
    d.logo ? loadImageURL(d.logo) : null,
    d.art ? loadImageURL(d.art) : null,
    Promise.all((d.layers || []).map(async (L) => (L.type === 'image' ? { ...L, img: await loadImageURL(L.src) } : { ...L }))),
  ]);
  state.values[tpl.id] = { ...defaults(tpl), ...s.values };
  state.mat = MATERIALS[s.mat] ? s.mat : tpl.material;
  state.thick = s.thick ?? null;
  if (s.units && s.units !== state.units) document.querySelector(`#units [data-u="${s.units}"]`)?.click();
  Object.assign(state.design, {
    color: d.color || state.design.color, pattern: PATTERNS.includes(d.pattern) ? d.pattern : 'Solid',
    brand: d.brand ?? '', tagline: d.tagline ?? '', logo, art,
  });
  $('#brand').value = state.design.brand;
  $('#tagline').value = state.design.tagline;
  for (const [key, label, empty] of [['logo', '#logoLabel', 'Add logo'], ['art', '#artLabel', 'Upload full artwork']]) {
    $(label).textContent = state.design[key] ? (key === 'logo' ? 'Logo' : 'Artwork') : empty;
    $(label).parentElement.classList.toggle('has', !!state.design[key]);
  }
  state.layersByTpl[tpl.id] = layers;
  markDesign();
  selectTemplate(tpl.id, { fromHash: true });
}

async function watermark(dataURL) {
  const img = await loadImageURL(dataURL);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const s = Math.max(12, Math.round(c.width / 60));
  g.font = `700 ${s}px Inter, system-ui, sans-serif`;
  g.fillStyle = 'rgba(19, 40, 138, .55)';
  g.textAlign = 'right';
  g.fillText('Made with Pack Studio', c.width - s, c.height - s);
  return c.toDataURL('image/png');
}

// ---------- boot (last, so every module-level binding exists) ----------

readHash();
buildLibrary();
buildDesignControls();
viewer = new Viewer($('#view3d'));
editor = new Editor({
  getModel: () => model,
  getLayers: () => state.design.layers,
  onChange: layersChanged,
  onSelect: () => { renderLayerPanel(); schedulePaint3D(); },
  pxToMm: () => (vb ? vb.w / ($('#svgHost').clientWidth || 1) : 1),
});
hydrateIcons();
setupTouchLocks();
wireEditorUI();
wireBrandKits();
wire3DEditing();
selectTemplate(state.tpl, { fromHash: true });
setView(state.view);
wireUI();

createCloud().then((cloud) => {
  account = setupAccount({
    cloud, toast,
    snapshot: snapshotProject,
    restore: restoreProject,
    templateName: (id) => byId[id]?.name || id,
  });
});

// arriving from the site's hero box: /studio/?q=mailer box 250x180x70
const askQ = new URLSearchParams(location.search).get('q');
if (askQ) { $('#askInput').value = askQ; runAsk(askQ); history.replaceState(null, '', location.pathname + location.hash); }

// handy for debugging in the console
window.packStudio = { state, get model() { return model; }, get account() { return account; }, viewer, parseAsk, runAsk, selectTemplate, doExport, snapshotProject, restoreProject };
