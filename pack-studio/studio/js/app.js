import { TEMPLATES, CATEGORIES, MATERIALS, byId, defaults } from './templates.js';
import { compile, sheetFit } from './engine.js';
import { dielineSVG, drawDesign, PATTERNS, contrastInk } from './dieline.js';
import { exportSVG, exportPDF, exportDXF, download, fileBase } from './exporters.js';
import { Viewer } from './viewer.js';
import { Editor, newLayer, pinToPanel, panelAt, layerCenter, FONTS } from './editor.js';
import { hydrateIcons, icon } from '../../assets/icons.js';

const $ = (s) => document.querySelector(s);
const SWATCHES = ['#2547d0', '#e5a912', '#0b1a5c', '#ffffff', '#f4efe6', '#1b1d21', '#e8553e', '#2f9e6b', '#c9a27e', '#f6c7d3'];
const TOUCH = matchMedia('(pointer: coarse)').matches;
const NARROW = () => matchMedia('(max-width: 900px)').matches;
const IN = 25.4;

const state = {
  tpl: 'rte',
  values: {},          // per template id
  mat: null, thick: null,
  units: 'mm',
  view: matchMedia('(min-width: 1180px)').matches ? 'split' : '3d',
  design: { color: '#2547d0', pattern: 'Solid', brand: 'Your Brand', tagline: 'Made with care', logo: null, art: null, layers: [] },
  layersByTpl: {},     // artwork layers are kept per template
};
let model = null, viewer = null, editor = null, showArt = true, vb = null, userZoomed = false, activePanel = null;

// ---------- library ----------

function buildLibrary() {
  const lib = $('#library');
  lib.innerHTML = '';
  for (const cat of CATEGORIES) {
    const box = document.createElement('div');
    box.className = 'cat';
    box.innerHTML = `<h4>${cat.name}</h4>`;
    if (cat.soon) {
      box.insertAdjacentHTML('beforeend', `<div class="soon">${cat.soon.map((s) => `<span>${s}</span>`).join('')}</div>`);
    }
    for (const t of TEMPLATES.filter((x) => x.category === cat.id)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tpl';
      b.dataset.tpl = t.id;
      b.innerHTML = `<span class="thumb">${thumb(t)}</span><span><b>${t.name}</b><small>${t.desc}</small></span>`;
      b.addEventListener('click', () => selectTemplate(t.id));
      box.appendChild(b);
    }
    lib.appendChild(box);
  }
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
  writeHash();
}

let art2D = null;
function redrawArt() {
  if (!model) return;
  viewer.setArtwork(drawDesign(model, state.design, 2048));
  // layers are drawn live on the dieline by the editor, so leave them out here
  art2D = drawDesign(model, state.design, 1100, { layers: false }).toDataURL('image/jpeg', 0.86);
  render2D();
}

// 3D texture refresh while dragging layers: smaller canvas, at most once per frame
let live3D = 0;
function layersChanged(kind) {
  if (kind === 'live') {
    if (live3D) return;
    live3D = requestAnimationFrame(() => { live3D = 0; viewer.setArtwork(drawDesign(model, state.design, 1024)); });
  } else {
    cancelAnimationFrame(live3D); live3D = 0;
    viewer.setArtwork(drawDesign(model, state.design, 2048));
    renderLayerPanel();
  }
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
      activePanel = panelAt(model, x, y)?.id || null;
      host.querySelectorAll('#Hit .active').forEach((n) => n.classList.remove('active'));
      if (activePanel) host.querySelector(`#Hit [data-panel="${activePanel}"]`)?.classList.add('active');
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
  return { tpl: best, dims, sides: sides ? +sides : null };
}

function runAsk(text) {
  const { tpl: found, dims, sides } = parseAsk(text);
  const tpl = found || byId[state.tpl];
  if (!found && !dims.length) {
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
  history.replaceState(null, '', '#' + q.toString());
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
    if (kind === 'proof') download(`${base}-proof.svg`, exportSVG(model, drawDesign(model, state.design, 2400).toDataURL('image/png')), 'image/svg+xml');
    if (kind === 'dxf') download(`${base}-dieline.dxf`, exportDXF(model), 'application/dxf');
    if (kind === 'pdf') {
      const dims = model.tpl.dims.map((k) => `${model.tpl.params.find((p) => p.k === k).label} ${Math.round(model.values[k] * 10) / 10}`).join(', ');
      download(`${base}-dieline.pdf`, exportPDF(model, { title: model.tpl.name, dims: dims + ' mm', material: `${m.name}, ${m.t} mm` }), 'application/pdf');
    }
    if (kind === 'glb') {
      const buf = await viewer.exportGLB();
      download(`${base}.glb`, new Blob([buf], { type: 'model/gltf-binary' }));
    }
    if (kind === 'png') {
      const blob = await (await fetch(viewer.snapshot(2))).blob();
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

function wireEditorUI() {
  const fonts = $('#lpFont');
  for (const f of Object.keys(FONTS)) fonts.add(new Option(f, f));
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
  const bind = (id, key, conv = (v) => v, evt = 'input') => $(id).addEventListener(evt, (e) => {
    const L = selectedLayer();
    if (!L) return;
    L[key] = conv(e.target.value);
    syncProps(L, id);
    editor.render();
    layersChanged('live');
  });
  bind('#lpText', 'text');
  bind('#lpFont', 'font', String, 'change');
  bind('#lpColor', 'color');
  bind('#lpRot', 'rot', Number); bind('#lpRotR', 'rot', Number);
  bind('#lpOpacityR', 'opacity', Number);
  const setSize = (v) => { const L = selectedLayer(); if (!L) return; if (L.type === 'image') L.w = v; else L.size = v; syncProps(L); editor.render(); layersChanged('live'); };
  $('#lpSize').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v > 0) setSize(v); });
  $('#lpSizeR').addEventListener('input', (e) => setSize(+e.target.value));
  for (const id of ['#lpText', '#lpColor', '#lpRotR', '#lpSizeR', '#lpOpacityR', '#lpSize', '#lpRot']) $(id).addEventListener('change', () => layersChanged('commit'));
  $('#lpBold').addEventListener('click', () => { const L = selectedLayer(); if (!L) return; L.weight = L.weight >= 700 ? 400 : 800; syncProps(L); editor.render(); layersChanged('commit'); });
  $('#layerProps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    const L = selectedLayer();
    if (!b || !L) return;
    const list = state.design.layers, i = list.indexOf(L);
    if (b.dataset.act === 'center') { const q = model.byId[L.panel]; if (q) { L.u = 0.5; L.v = 0.5; } }
    if (b.dataset.act === 'up' && i < list.length - 1) [list[i], list[i + 1]] = [list[i + 1], list[i]];
    if (b.dataset.act === 'down' && i > 0) [list[i], list[i - 1]] = [list[i - 1], list[i]];
    if (b.dataset.act === 'dup') { const c = { ...L, id: newLayer(L.type).id, u: Math.min(0.95, L.u + 0.06), v: Math.max(0.05, L.v - 0.06) }; list.splice(i + 1, 0, c); editor.select(c.id); }
    if (b.dataset.act === 'del') { list.splice(i, 1); editor.select(null); }
    editor.render();
    layersChanged('commit');
  });
  document.addEventListener('keydown', (e) => {
    const L = selectedLayer();
    if (!L || /input|select|textarea/i.test(document.activeElement?.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { state.design.layers.splice(state.design.layers.indexOf(L), 1); editor.select(null); layersChanged('commit'); e.preventDefault(); return; }
    const step = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [x, y] = layerCenter(model, L);
    pinToPanel(model, L, x + d[0], y + d[1]);
    editor.render();
    layersChanged('commit');
  });
  renderLayerPanel();
}

function selectedLayer() { return state.design.layers.find((L) => L.id === editor.selected) || null; }

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
  const L = type === 'text'
    ? newLayer('text', { text: 'Your text', size: Math.max(3, Math.min(40, Math.round(span * 0.12))), font: 'Display', weight: 800, color: contrastInk(state.design.color) === '#ffffff' ? '#e5a912' : '#0b1a5c', rot })
    : newLayer('image', { w: Math.max(8, span * 0.5), rot, ...extra });
  pinToPanel(model, L, x, y);
  state.design.layers.push(L);
  if (state.view === '3d') setView(NARROW() ? '2d' : 'split');
  requestAnimationFrame(() => { editor.select(L.id); layersChanged('commit'); if (type === 'text') $('#lpText').select(); });
}

function renderLayerPanel() {
  const list = $('#layerList'), L = selectedLayer();
  list.innerHTML = state.design.layers.slice().reverse().map((x) => `<li><button type="button" data-id="${x.id}" aria-current="${x.id === editor.selected}">
    ${icon(x.type === 'text' ? 'type' : 'image-plus')}<span>${x.type === 'text' ? esc(x.text || 'Text') : esc(x.name || 'Image')}</span><small>${esc(model?.byId[x.panel]?.name || '')}</small></button></li>`).join('')
    || '<li class="empty">No layers yet. Tap a panel on the dieline, then add text or an image.</li>';
  list.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => {
    if (state.view === '3d') setView(NARROW() ? '2d' : 'split');
    editor.select(b.dataset.id);
  }));
  $('#layerProps').hidden = !L;
  if (L) syncProps(L);
}

function syncProps(L, skip) {
  const set = (id, v) => { if (id !== skip) $(id).value = v; };
  document.querySelectorAll('#layerProps [data-for="text"]').forEach((n) => (n.hidden = L.type !== 'text'));
  set('#lpText', L.text || '');
  set('#lpFont', L.font || 'Sans');
  set('#lpColor', L.color || '#000000');
  $('#lpBold').setAttribute('aria-pressed', String(L.weight >= 700));
  const size = L.type === 'image' ? L.w : L.size;
  set('#lpSize', +size.toFixed(1)); set('#lpSizeR', size);
  $('#lpSizeLabel').textContent = L.type === 'image' ? 'Width' : 'Text size';
  set('#lpRot', Math.round(L.rot)); set('#lpRotR', Math.round(L.rot));
  set('#lpOpacityR', L.opacity ?? 1);
  const item = $(`#layerList [data-id="${L.id}"] span`);
  if (item && L.type === 'text') item.textContent = L.text || 'Text';
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- boot (last, so every module-level binding exists) ----------

readHash();
buildLibrary();
buildDesignControls();
viewer = new Viewer($('#view3d'));
editor = new Editor({
  getModel: () => model,
  getLayers: () => state.design.layers,
  onChange: layersChanged,
  onSelect: () => renderLayerPanel(),
  pxToMm: () => (vb ? vb.w / ($('#svgHost').clientWidth || 1) : 1),
});
hydrateIcons();
setupTouchLocks();
wireEditorUI();
selectTemplate(state.tpl, { fromHash: true });
setView(state.view);
wireUI();

// arriving from the site's hero box: /studio/?q=mailer box 250x180x70
const askQ = new URLSearchParams(location.search).get('q');
if (askQ) { $('#askInput').value = askQ; runAsk(askQ); history.replaceState(null, '', location.pathname + location.hash); }

// handy for debugging in the console
window.packStudio = { state, get model() { return model; }, viewer, parseAsk, runAsk, selectTemplate, doExport };
