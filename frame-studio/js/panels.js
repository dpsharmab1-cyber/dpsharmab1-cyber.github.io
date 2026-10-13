// Side panels: Layers and Assets on the left, Design and Code on the right.

import { S, on, emit, change, begin, end, live, node, parentOf, select, selNodes } from './state.js';
import { isFlex, FONTS, normHex, chainOf, worldBox, applyConstraints as applyC } from './model.js';
import { WEIGHTS, WEIGHT_NAMES, nearestWeight, ensureFont } from './fonts.js';
import { h, icon, toast, copyText, highlight } from './ui.js';
import * as cmd from './commands.js';
import { layerCSS, layerTailwind, layerHTML, rasterize, vectorSVG, download } from './export.js';
import { BLOCKS, TEMPLATES, ICONS, FRAME_PRESETS, iconNode, presetFrame } from './blocks.js';
import { setTool, zoomToSelection, startEdit } from './editor.js';
import { pickFile, readDataURL, imageSize, shrinkImage } from './store.js';

const MIXED = Symbol('mixed');
let leftTab = 'layers';
let rightTab = 'design';
let raf = 0;
let layersKey = '';
let openCodeModal = () => {};

export function initPanels(opts) {
  openCodeModal = opts.openCodeModal;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderAll(); }); };
  on('doc', schedule);
  on('sel', schedule);
  on('selpreview', schedule);
  on('tool', schedule);
  on('textinput', schedule);
  document.querySelectorAll('[data-left-tab]').forEach((b) => b.addEventListener('click', () => { leftTab = b.dataset.leftTab; layersKey = ''; renderAll(); }));
  document.querySelectorAll('[data-right-tab]').forEach((b) => b.addEventListener('click', () => { rightTab = b.dataset.rightTab; renderAll(); }));
  renderAll();
}

export function showRightTab(t) { rightTab = t; renderAll(); }

function renderAll() {
  document.querySelectorAll('[data-left-tab]').forEach((b) => b.classList.toggle('on', b.dataset.leftTab === leftTab));
  document.querySelectorAll('[data-right-tab]').forEach((b) => b.classList.toggle('on', b.dataset.rightTab === rightTab));
  const left = document.getElementById('left-body');
  if (leftTab === 'layers') renderLayers(left);
  else if (left.dataset.view !== 'assets') { left.dataset.view = 'assets'; left.replaceChildren(assetsPanel()); }
  const right = document.getElementById('right-body');
  if (right.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return;
  right.replaceChildren(rightTab === 'design' ? designPanel() : codePanel());
  // new selection or tab: start the panel at the top
  const key = rightTab + S.sel.join();
  if (key !== lastRightKey) { right.scrollTop = 0; lastRightKey = key; }
}
let lastRightKey = '';

/* ======================= Layers ======================= */

const TYPE_ICON = (n) => (n.type === 'frame' ? (isFlex(n) ? (n.layout.mode === 'row' ? 'row' : 'col') : n.fill.type === 'none' && !n.clip ? 'group' : 'frame')
  : n.type === 'text' ? 'text' : n.type === 'ellipse' ? 'ellipse' : n.type === 'image' ? 'image' : n.type === 'path' ? 'vector' : 'rect');

function renderLayers(root) {
  const key = JSON.stringify([S.sel, [...S.expanded], S.doc.children.length, structKey(S.doc.children)]);
  if (key === layersKey && root.dataset.view === 'layers') return;
  layersKey = key;
  root.dataset.view = 'layers';
  const list = h('div', { class: 'layers', role: 'tree', 'aria-label': 'Layers' });
  const rows = [];
  const add = (nodes, depth) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      rows.push(layerRow(n, depth));
      if (n.children?.length && S.expanded.has(n.id)) add(n.children, depth + 1);
    }
  };
  add(S.doc.children, 0);
  if (!rows.length) {
    list.append(h('div', { class: 'empty' },
      h('p', null, 'No layers yet.'),
      h('p', { class: 'muted' }, 'Press F to draw a frame, or open Assets for templates.')));
  } else list.append(...rows);
  root.replaceChildren(list);
  const sel = list.querySelector('.layer.on');
  sel?.scrollIntoView({ block: 'nearest' });
}

const structKey = (nodes) => nodes.map((n) => [n.id, n.name, n.visible, n.locked, n.type === 'frame' ? TYPE_ICON(n) : n.type, n.children ? structKey(n.children) : 0]);

let dragId = null;
function layerRow(n, depth) {
  const sel = S.sel.includes(n.id);
  const hasKids = !!n.children?.length;
  const exp = S.expanded.has(n.id);
  const row = h('div', {
    class: `layer${sel ? ' on' : ''}${!n.visible ? ' hidden' : ''}${n.locked ? ' locked' : ''}${depth === 0 && n.type === 'frame' ? ' top' : ''}`,
    role: 'treeitem', 'aria-selected': String(sel), draggable: 'true', style: `--d:${depth}`,
    onclick: (e) => {
      if (e.target.closest('.lr-act, .lr-tw, input')) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) select(S.sel.includes(n.id) ? S.sel.filter((i) => i !== n.id) : [...S.sel, n.id]);
      else select([n.id]);
    },
    ondblclick: (e) => { if (!e.target.closest('.lr-act, .lr-tw')) renameInline(row, n); },
    onpointerenter: () => { S.hover = n.id; emit('hover'); },
    onpointerleave: () => { S.hover = null; emit('hover'); },
    ondragstart: (e) => { dragId = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.id); },
    ondragend: () => { dragId = null; document.querySelectorAll('.layer.drop-a,.layer.drop-b,.layer.drop-in').forEach((r) => r.classList.remove('drop-a', 'drop-b', 'drop-in')); },
    ondragover: (e) => {
      if (!dragId || dragId === n.id || isInside(n.id, dragId)) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const y = (e.clientY - r.top) / r.height;
      const zone = n.type === 'frame' && y > 0.25 && y < 0.75 ? 'in' : y < 0.5 ? 'a' : 'b';
      row.classList.remove('drop-a', 'drop-b', 'drop-in');
      row.classList.add('drop-' + zone);
      row.dataset.zone = zone;
    },
    ondragleave: () => row.classList.remove('drop-a', 'drop-b', 'drop-in'),
    ondrop: (e) => { e.preventDefault(); const zone = row.dataset.zone; row.classList.remove('drop-a', 'drop-b', 'drop-in'); if (dragId) moveLayer(dragId, n.id, zone); },
  },
  h('button', { class: 'lr-tw', 'aria-label': exp ? 'Collapse' : 'Expand', style: hasKids ? '' : 'visibility:hidden', html: icon(exp ? 'down' : 'chev', 12), onclick: () => { if (exp) S.expanded.delete(n.id); else S.expanded.add(n.id); layersKey = ''; renderAll(); } }),
  h('span', { class: 'lr-ic', html: icon(TYPE_ICON(n), 14) }),
  h('span', { class: 'lr-name' }, n.name),
  h('span', { class: 'lr-acts' },
    h('button', { class: 'lr-act' + (n.locked ? ' keep' : ''), title: n.locked ? 'Unlock' : 'Lock', 'aria-label': n.locked ? 'Unlock' : 'Lock', html: icon(n.locked ? 'lock' : 'unlock', 14), onclick: () => change(() => { n.locked = !n.locked; }) }),
    h('button', { class: 'lr-act' + (!n.visible ? ' keep' : ''), title: n.visible ? 'Hide' : 'Show', 'aria-label': n.visible ? 'Hide' : 'Show', html: icon(n.visible ? 'eye' : 'eyeoff', 14), onclick: () => change(() => { n.visible = !n.visible; }) }),
  ));
  return row;
}

const isInside = (id, maybeAncestor) => chainOf(S.idx, id).some((n) => n.id === maybeAncestor);

function moveLayer(id, targetId, zone) {
  const n = node(id), t = node(targetId);
  if (!n || !t || isInside(targetId, id)) return;
  change(() => {
    const wb = worldBox(S.idx, id);
    const from = parentOf(id);
    const fromList = from ? from.children : S.doc.children;
    fromList.splice(fromList.indexOf(n), 1);
    let parent, list, at;
    if (zone === 'in') { parent = t; list = t.children; at = list.length; S.expanded.add(t.id); }
    else {
      parent = parentOf(targetId);
      list = parent ? parent.children : S.doc.children;
      // the panel lists top layers first, so "above" means after in the array
      at = list.indexOf(t) + (zone === 'a' ? 1 : 0);
    }
    list.splice(at, 0, n);
    if (parent !== from && !isFlex(parent)) {
      let px = 0, py = 0, p = parent;
      while (p) { px += p.x; py += p.y; p = S.idx.get(p.id)?.parent || null; }
      n.x = Math.round(wb.x - px); n.y = Math.round(wb.y - py);
    }
  });
  select([id]);
}

function renameInline(row, n) {
  const span = row.querySelector('.lr-name');
  const input = h('input', { class: 'lr-input', value: n.name, 'aria-label': 'Layer name' });
  span.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const commit = (save) => {
    if (done) return; done = true;
    if (save && input.value.trim() && input.value !== n.name) change(() => { n.name = input.value.trim(); });
    layersKey = ''; renderAll();
  };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(true); if (e.key === 'Escape') commit(false); });
  input.addEventListener('blur', () => commit(true));
}

/* ======================= Assets ======================= */

function assetsPanel() {
  const wrap = h('div', { class: 'assets' });
  wrap.append(
    h('h3', { class: 'sec-t' }, 'Templates'),
    h('div', { class: 'tpl-grid' }, TEMPLATES.map((t) => h('button', {
      class: 'tpl', onclick: () => { cmd.insertNodes([t.make()], { asFrames: true }); toast(`${t.name} added`); },
    }, h('span', { class: 'tpl-thumb', 'data-k': t.name }), h('b', null, t.name), h('small', null, t.size)))),
    h('h3', { class: 'sec-t' }, 'UI blocks'),
    h('p', { class: 'hint' }, 'Click to add. Goes inside the selected frame.'),
    h('div', { class: 'blk-list' }, BLOCKS.map((b) => h('button', { class: 'blk', onclick: () => cmd.insertNodes([b.make()]) }, h('span', { html: icon('shape', 15) }), b.name))),
    h('h3', { class: 'sec-t' }, 'Icons'),
    h('div', { class: 'ico-grid' }, Object.keys(ICONS).map((k) => h('button', {
      class: 'ico', title: k, 'aria-label': `Icon ${k}`,
      html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]}"/></svg>`,
      onclick: () => cmd.insertNodes([iconNode(k)]),
    }))),
    h('h3', { class: 'sec-t' }, 'Images'),
    h('button', { class: 'btn wide', onclick: importImages, html: `${icon('upload', 16)}<span>Upload images</span>` }),
    h('p', { class: 'hint' }, 'You can also drop or paste images on the canvas.'),
    h('h3', { class: 'sec-t' }, 'Frame sizes'),
    framePresets(),
  );
  return wrap;
}

export async function importImages(files) {
  if (!files || files instanceof Event) files = await pickFile('image/*');
  let i = 0;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const data = await shrinkImage(await readDataURL(f));
    const { w, h: hh } = await imageSize(data);
    cmd.insertImage(data, w, hh);
    i++;
  }
  if (i) toast(`${i} image${i > 1 ? 's' : ''} added`);
}

function framePresets() {
  return h('div', { class: 'presets' }, FRAME_PRESETS.map(([group, list]) => h('div', { class: 'preset-g' },
    h('div', { class: 'preset-h' }, group),
    list.map(([name, w, hh]) => h('button', {
      class: 'preset', onclick: () => { cmd.insertNodes([presetFrame(name, w, hh)], { asFrames: true }); setTool('move'); },
    }, h('span', null, name), h('small', null, `${w} × ${hh}`))))));
}

/* ======================= Design ======================= */

function common(ns, get) {
  if (!ns.length) return MIXED;
  const v0 = get(ns[0]);
  for (const n of ns) if (get(n) !== v0) return MIXED;
  return v0;
}

const set = (fn) => change(() => { for (const n of selNodes()) fn(n); });

function evalNum(s) {
  const t = String(s).trim().replace(/,/g, '.');
  if (!/^[\d+\-*/().\s]+$/.test(t)) return NaN;
  try { return Function(`"use strict";return (${t})`)(); } catch { return NaN; }
}

function num(label, value, apply, o = {}) {
  const { min = -Infinity, max = Infinity, step = 1, suffix = '', title, disabled, scale = 1 } = o;
  const show = value === MIXED ? '' : +(value * scale).toFixed(2) + suffix;
  const input = h('input', {
    class: 'num', value: show, placeholder: value === MIXED ? 'Mixed' : '', disabled, 'aria-label': title || label,
    onkeydown: (e) => {
      if (e.key === 'Enter') { input.blur(); }
      if (e.key === 'Escape') { input.value = show; input.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = parseFloat(input.value) || 0;
        const v = clamp(cur + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
        input.value = +v.toFixed(2) + suffix;
        set((n) => apply(n, v / scale));
      }
      e.stopPropagation();
    },
    onchange: () => {
      const v = evalNum(input.value.replace(suffix, ''));
      if (Number.isFinite(v)) set((n) => apply(n, clamp(v) / scale));
      else input.value = show;
    },
    onfocus: () => input.select(),
  });
  function clamp(v) { return Math.min(max, Math.max(min, v)); }
  const lab = h('span', { class: 'fld-l', title: (title || label) + ' (drag to change)' }, label);
  if (!disabled) {
    lab.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      lab.setPointerCapture(e.pointerId);
      const start = e.clientX;
      const base = value === MIXED ? 0 : value * scale;
      begin();
      const move = (ev) => {
        const v = clamp(Math.round((base + (ev.clientX - start) * step * (ev.shiftKey ? 10 : 1)) / step) * step);
        input.value = +v.toFixed(2) + suffix;
        live(() => { for (const n of selNodes()) apply(n, v / scale); });
      };
      const up = () => { lab.removeEventListener('pointermove', move); lab.removeEventListener('pointerup', up); end(); emit('doc'); };
      lab.addEventListener('pointermove', move);
      lab.addEventListener('pointerup', up);
    });
  }
  return h('label', { class: 'fld' + (disabled ? ' dis' : '') }, lab, input);
}

function seg(options, value, apply, o = {}) {
  return h('div', { class: 'seg' + (o.small ? ' sm' : ''), role: 'group', 'aria-label': o.label || '' }, options.map(([v, label, ic]) => h('button', {
    class: value === v ? 'on' : '', title: label, 'aria-label': label, 'aria-pressed': String(value === v),
    html: ic ? icon(ic, 16) : label,
    onclick: () => set((n) => apply(n, v)),
  })));
}

function sel(options, value, apply, o = {}) {
  const s = h('select', {
    class: 'sel' + (o.cls ? ' ' + o.cls : ''), 'aria-label': o.label || '',
    onchange: () => set((n) => apply(n, s.value)),
    onkeydown: (e) => e.stopPropagation(),
  }, value === MIXED ? h('option', { value: '', selected: true, disabled: true }, 'Mixed') : null,
  options.map(([v, label]) => h('option', { value: String(v), selected: String(v) === String(value) }, label)));
  return s;
}

function colorField(get, apply, o = {}) {
  const ns = selNodes();
  const c = common(ns, (n) => get(n).color);
  const a = common(ns, (n) => get(n).opacity ?? 1);
  const hex = c === MIXED ? '#000000' : normHex(c);
  const picker = h('input', {
    type: 'color', class: 'swatch', value: hex.toLowerCase(), 'aria-label': (o.label || 'Colour') + ' picker',
    onpointerdown: () => begin(),
    oninput: () => { live(() => { for (const n of selNodes()) apply(n, { color: picker.value.toUpperCase() }); }); text.value = picker.value.slice(1).toUpperCase(); },
    onchange: () => { end(); emit('doc'); },
  });
  const text = h('input', {
    class: 'hex', value: c === MIXED ? '' : hex.slice(1), placeholder: c === MIXED ? 'Mixed' : '', 'aria-label': (o.label || 'Colour') + ' hex', maxlength: 7,
    onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') text.blur(); },
    onchange: () => { const v = text.value.trim().replace('#', ''); if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) set((n) => apply(n, { color: normHex(v) })); },
    onfocus: () => text.select(),
  });
  const op = num('', a === MIXED ? MIXED : a, (n, v) => apply(n, { opacity: Math.max(0, Math.min(1, v)) }), { scale: 100, suffix: '%', min: 0, max: 100, title: 'Opacity' });
  op.classList.add('op');
  return h('div', { class: 'color' }, h('span', { class: 'sw-wrap' }, h('span', { class: 'sw-chk' }), picker), text, op);
}

function section(title, kids, o = {}) {
  return h('section', { class: 'sec' + (o.cls ? ' ' + o.cls : '') },
    h('div', { class: 'sec-h' }, h('h3', null, title), o.action || null),
    kids.length ? h('div', { class: 'sec-b' }, kids) : null);
}

const grid = (...k) => h('div', { class: 'g2' }, k);
const row = (...k) => h('div', { class: 'row' }, k);
const iconBtn = (ic, label, run, o = {}) => h('button', { class: 'ib' + (o.on ? ' on' : ''), title: label, 'aria-label': label, html: icon(ic, o.size || 16), onclick: run, disabled: o.disabled });

function designPanel() {
  const ns = selNodes();
  const wrap = h('div', { class: 'design' });
  if (S.tool === 'frame') { wrap.append(section('Frame', [framePresets()])); return wrap; }
  if (!ns.length) return pagePanel(wrap);

  const one = ns.length === 1 ? ns[0] : null;
  const parents = ns.map((n) => parentOf(n.id));
  const allFlexKids = parents.every(isFlex);
  const anyFlexKid = parents.some(isFlex);
  const types = new Set(ns.map((n) => n.type));

  // header
  wrap.append(h('div', { class: 'sel-head' },
    h('span', { class: 'lr-ic', html: icon(one ? TYPE_ICON(one) : 'layers', 16) }),
    one ? h('input', {
      class: 'name-in', value: one.name, 'aria-label': 'Layer name',
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); },
      onchange: (e) => { if (e.target.value.trim()) cmd.renameSel(e.target.value.trim()); },
    }) : h('b', null, `${ns.length} layers`),
    h('span', { class: 'sel-type' }, one ? (one.type === 'frame' && isFlex(one) ? 'Auto layout' : one.type[0].toUpperCase() + one.type.slice(1)) : ''),
  ));

  // align
  wrap.append(h('div', { class: 'align-bar' },
    iconBtn('alL', 'Align left (Alt+A)', () => cmd.align('left')),
    iconBtn('alCH', 'Align horizontal centers (Alt+H)', () => cmd.align('hcenter')),
    iconBtn('alR', 'Align right (Alt+D)', () => cmd.align('right')),
    iconBtn('alT', 'Align top (Alt+W)', () => cmd.align('top')),
    iconBtn('alCV', 'Align vertical centers (Alt+V)', () => cmd.align('vcenter')),
    iconBtn('alB', 'Align bottom (Alt+S)', () => cmd.align('bottom')),
    iconBtn('disH', 'Distribute horizontally', () => cmd.distribute('h'), { disabled: ns.length < 3 }),
    iconBtn('disV', 'Distribute vertically', () => cmd.distribute('v'), { disabled: ns.length < 3 }),
  ));

  // position & size
  const posKids = [
    grid(
      num('X', common(ns, (n) => n.x), (n, v) => { n.x = Math.round(v); }, { disabled: allFlexKids }),
      num('Y', common(ns, (n) => n.y), (n, v) => { n.y = Math.round(v); }, { disabled: allFlexKids }),
    ),
    grid(
      num('W', common(ns, (n) => n.w), (n, v) => resizeNode(n, Math.max(1, v), n.h), { min: 1 }),
      num('H', common(ns, (n) => n.h), (n, v) => resizeNode(n, n.w, Math.max(1, v)), { min: 1 }),
    ),
    grid(
      num('°', common(ns, (n) => n.rot), (n, v) => { n.rot = ((v + 540) % 360) - 180; }, { title: 'Rotation' }),
      !types.has('ellipse') && !types.has('text') && !types.has('path')
        ? num('R', common(ns, (n) => n.radius), (n, v) => { n.radius = Math.max(0, v); }, { min: 0, title: 'Corner radius' })
        : h('span'),
    ),
  ];
  if (anyFlexKid || ns.some(isFlex) || types.has('text')) {
    const canHug = ns.every((n) => isFlex(n) || n.type === 'text');
    const optsW = [['fixed', 'Fixed width'], ...(canHug ? [['hug', 'Hug contents']] : []), ...(anyFlexKid ? [['fill', 'Fill container']] : [])];
    const optsH = [['fixed', 'Fixed height'], ...(canHug ? [['hug', 'Hug contents']] : []), ...(anyFlexKid ? [['fill', 'Fill container']] : [])];
    if (types.size === 1 && types.has('text')) {
      posKids.push(h('div', { class: 'lbl' }, 'Resizing'), seg([
        ['autoW', 'Auto width', null], ['autoH', 'Auto height', null], ['fixed', 'Fixed size', null],
      ], common(ns, (n) => n.textSize), (n, v) => { n.textSize = v; if (v === 'autoW') n.sizeW = 'fixed'; }, { label: 'Text resizing' }));
      if (anyFlexKid) posKids.push(grid(
        sel([['fixed', 'Fixed width'], ['fill', 'Fill width']], common(ns, (n) => (n.sizeW === 'fill' ? 'fill' : 'fixed')), (n, v) => { n.sizeW = v; if (v === 'fill' && n.textSize === 'autoW') n.textSize = 'autoH'; }, { label: 'Width' }),
        sel([['fixed', 'Fixed height'], ['fill', 'Fill height']], common(ns, (n) => (n.sizeH === 'fill' ? 'fill' : 'fixed')), (n, v) => { n.sizeH = v; if (v === 'fill') n.textSize = 'fixed'; }, { label: 'Height' }),
      ));
    } else if (optsW.length > 1) {
      posKids.push(grid(
        sel(optsW, common(ns, (n) => n.sizeW), (n, v) => { n.sizeW = v; }, { label: 'Width sizing' }),
        sel(optsH, common(ns, (n) => n.sizeH), (n, v) => { n.sizeH = v; }, { label: 'Height sizing' }),
      ));
    }
  }
  wrap.append(section('Layout', posKids));

  // constraints
  if (!anyFlexKid && parents.every((p) => p && p.type === 'frame')) {
    wrap.append(section('Constraints', [grid(
      sel([['left', 'Left'], ['right', 'Right'], ['stretch', 'Left & right'], ['center', 'Center'], ['scale', 'Scale']], common(ns, (n) => n.cH), (n, v) => { n.cH = v; }, { label: 'Horizontal constraint' }),
      sel([['top', 'Top'], ['bottom', 'Bottom'], ['stretch', 'Top & bottom'], ['center', 'Center'], ['scale', 'Scale']], common(ns, (n) => n.cV), (n, v) => { n.cV = v; }, { label: 'Vertical constraint' }),
    ), h('p', { class: 'hint' }, 'How the layer moves when its frame resizes, and in responsive code.')], { cls: 'compact' }));
  }

  // auto layout
  if (one && one.type === 'frame') {
    if (!isFlex(one)) {
      wrap.append(section('Auto layout', [], { action: iconBtn('plus', 'Add auto layout (Shift+A)', () => cmd.toggleAutoLayout()) }));
    } else {
      const L = one.layout;
      const dirVal = L.mode === 'row' && L.wrap ? 'wrap' : L.mode;
      const alignGrid = h('div', { class: 'al-grid', role: 'group', 'aria-label': 'Alignment' });
      for (const r of ['start', 'center', 'end']) for (const c of ['start', 'center', 'end']) {
        const [ai, jc] = L.mode === 'row' ? [r, c] : [c, r];
        const on = (L.align === ai || (L.align === 'stretch' && ai === 'start')) && (L.justify === 'between' ? jc === 'center' : L.justify === jc);
        alignGrid.append(h('button', {
          class: on ? 'on' : '', 'aria-label': `Align ${r} ${c}`, title: `${r} / ${c}`,
          onclick: () => set((n) => { n.layout.align = ai; if (n.layout.justify !== 'between') n.layout.justify = jc; }),
        }, h('i')));
      }
      wrap.append(section('Auto layout', [
        row(seg([['row', 'Horizontal', 'row'], ['column', 'Vertical', 'col'], ['wrap', 'Wrap', 'wrap']], dirVal, (n, v) => { n.layout.mode = v === 'wrap' ? 'row' : v; n.layout.wrap = v === 'wrap'; }, { label: 'Direction' })),
        h('div', { class: 'al-row' }, alignGrid, h('div', { class: 'al-side' },
          num('Gap', L.gap, (n, v) => { n.layout.gap = Math.max(0, Math.round(v)); }, { min: 0, title: 'Gap between items' }),
          sel([['start', 'Packed'], ['between', 'Space between']], L.justify === 'between' ? 'between' : 'start', (n, v) => { n.layout.justify = v === 'between' ? 'between' : 'start'; }, { label: 'Spacing mode' }),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: L.align === 'stretch', onchange: (e) => set((n) => { n.layout.align = e.target.checked ? 'stretch' : 'start'; }) }), 'Stretch items'),
        )),
        grid(
          num('↔', L.pl === L.pr ? L.pl : MIXED, (n, v) => { n.layout.pl = n.layout.pr = Math.max(0, Math.round(v)); }, { title: 'Horizontal padding', min: 0 }),
          num('↕', L.pt === L.pb ? L.pt : MIXED, (n, v) => { n.layout.pt = n.layout.pb = Math.max(0, Math.round(v)); }, { title: 'Vertical padding', min: 0 }),
        ),
        h('details', { class: 'pad4' }, h('summary', null, 'Each side'), grid(
          num('T', L.pt, (n, v) => { n.layout.pt = Math.max(0, Math.round(v)); }, { title: 'Padding top', min: 0 }),
          num('R', L.pr, (n, v) => { n.layout.pr = Math.max(0, Math.round(v)); }, { title: 'Padding right', min: 0 }),
          num('B', L.pb, (n, v) => { n.layout.pb = Math.max(0, Math.round(v)); }, { title: 'Padding bottom', min: 0 }),
          num('L', L.pl, (n, v) => { n.layout.pl = Math.max(0, Math.round(v)); }, { title: 'Padding left', min: 0 }),
        )),
      ], { action: iconBtn('minus', 'Remove auto layout', () => cmd.toggleAutoLayout()) }));
    }
  }

  // frame options
  if (ns.every((n) => n.type === 'frame')) {
    wrap.append(section('Frame', [
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: common(ns, (n) => !!n.clip) === true, onchange: (e) => set((n) => { n.clip = e.target.checked; }) }), 'Clip content'),
    ], { cls: 'compact' }));
  }

  // layer
  wrap.append(section('Layer', [grid(
    num('', common(ns, (n) => n.opacity), (n, v) => { n.opacity = Math.max(0, Math.min(1, v)); }, { scale: 100, suffix: '%', min: 0, max: 100, title: 'Opacity' }),
    sel([['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Color dodge'], ['color-burn', 'Color burn'], ['hard-light', 'Hard light'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']],
      common(ns, (n) => n.blend), (n, v) => { n.blend = v; }, { label: 'Blend mode' }),
  )]));

  // text
  if (types.size === 1 && types.has('text')) wrap.append(textSection(ns));

  // image
  if (types.has('image')) {
    wrap.append(section('Image', [
      grid(
        sel([['cover', 'Fill (crop)'], ['contain', 'Fit'], ['fill', 'Stretch']], common(ns.filter((n) => n.type === 'image'), (n) => n.fit), (n, v) => { if (n.type === 'image') n.fit = v; }, { label: 'Image fit' }),
        h('button', { class: 'btn', onclick: async () => { const [f] = await pickFile('image/*'); if (f) cmd.replaceImage(await shrinkImage(await readDataURL(f))); } }, 'Replace…'),
      ),
      one && one.type === 'image' ? h('input', {
        class: 'txt', placeholder: 'Alt text (for code export)', value: one.alt || '', 'aria-label': 'Alt text',
        onkeydown: (e) => e.stopPropagation(), onchange: (e) => set((n) => { n.alt = e.target.value; }),
      }) : null,
    ].filter(Boolean)));
  }

  // fill
  const fillType = common(ns, (n) => n.fill.type);
  const fillKids = [sel([['none', 'None'], ['solid', 'Solid'], ['linear', 'Linear gradient'], ['radial', 'Radial gradient']], fillType, (n, v) => { n.fill.type = v; }, { label: 'Fill type' })];
  if (fillType !== 'none' && fillType !== MIXED) {
    fillKids.push(colorField((n) => n.fill, (n, p) => Object.assign(n.fill, p), { label: 'Fill' }));
    if (fillType !== 'solid') {
      fillKids.push(colorField((n) => ({ color: n.fill.color2, opacity: n.fill.opacity }), (n, p) => { if (p.color) n.fill.color2 = p.color; if (p.opacity != null) n.fill.opacity = p.opacity; }, { label: 'Gradient end' }));
      if (fillType === 'linear') fillKids.push(grid(num('∠', common(ns, (n) => n.fill.angle), (n, v) => { n.fill.angle = ((Math.round(v) % 360) + 360) % 360; }, { title: 'Gradient angle', suffix: '°' }), h('span')));
    }
  }
  wrap.append(section(types.size === 1 && types.has('text') ? 'Text colour' : 'Fill', fillKids));

  // stroke
  const strokeOn = common(ns, (n) => n.stroke.enabled);
  wrap.append(section('Stroke', strokeOn === true ? [
    colorField((n) => n.stroke, (n, p) => Object.assign(n.stroke, p), { label: 'Stroke' }),
    grid(
      num('W', common(ns, (n) => n.stroke.width), (n, v) => { n.stroke.width = Math.max(0, v); }, { min: 0, step: 0.5, title: 'Stroke width' }),
      types.has('path') || types.has('text') ? sel([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], common(ns, (n) => n.stroke.style), (n, v) => { n.stroke.style = v; }, { label: 'Stroke style' })
        : sel([['inside', 'Inside'], ['center', 'Center'], ['outside', 'Outside']], common(ns, (n) => n.stroke.align), (n, v) => { n.stroke.align = v; }, { label: 'Stroke position' }),
    ),
    !types.has('path') && !types.has('text') ? grid(sel([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], common(ns, (n) => n.stroke.style), (n, v) => { n.stroke.style = v; }, { label: 'Stroke style' }), h('span')) : null,
  ].filter(Boolean) : [], { action: iconBtn(strokeOn === true ? 'minus' : 'plus', strokeOn === true ? 'Remove stroke' : 'Add stroke', () => set((n) => { n.stroke.enabled = strokeOn !== true; })) }));

  // effects
  const shOn = common(ns, (n) => n.shadow.enabled);
  const fx = [];
  if (shOn === true) {
    fx.push(
      sel([['drop', 'Drop shadow'], ['inner', 'Inner shadow']], common(ns, (n) => (n.shadow.inset ? 'inner' : 'drop')), (n, v) => { n.shadow.inset = v === 'inner'; }, { label: 'Shadow type' }),
      grid(
        num('X', common(ns, (n) => n.shadow.x), (n, v) => { n.shadow.x = v; }, { title: 'Shadow X' }),
        num('Y', common(ns, (n) => n.shadow.y), (n, v) => { n.shadow.y = v; }, { title: 'Shadow Y' }),
        num('Blur', common(ns, (n) => n.shadow.blur), (n, v) => { n.shadow.blur = Math.max(0, v); }, { min: 0, title: 'Shadow blur' }),
        num('Spread', common(ns, (n) => n.shadow.spread), (n, v) => { n.shadow.spread = v; }, { title: 'Shadow spread' }),
      ),
      colorField((n) => n.shadow, (n, p) => Object.assign(n.shadow, p), { label: 'Shadow' }),
    );
  }
  fx.push(grid(
    num('Blur', common(ns, (n) => n.blur), (n, v) => { n.blur = Math.max(0, v); }, { min: 0, title: 'Layer blur' }),
    num('BG', common(ns, (n) => n.bgBlur), (n, v) => { n.bgBlur = Math.max(0, v); }, { min: 0, title: 'Background blur (glass)' }),
  ));
  wrap.append(section('Effects', fx, { action: iconBtn(shOn === true ? 'minus' : 'plus', shOn === true ? 'Remove shadow' : 'Add shadow', () => set((n) => { n.shadow.enabled = shOn !== true; })) }));

  // code / prototype
  if (one) {
    const frames = S.doc.children.filter((n) => n.type === 'frame' && n.id !== one.id);
    const linkKind = !one.link ? '' : one.link.startsWith('#frame:') ? one.link : 'url';
    const linkSel = h('select', {
      class: 'sel', 'aria-label': 'Link',
      onchange: () => {
        const v = linkSel.value;
        set((n) => { n.link = v === 'url' ? (n.link && !n.link.startsWith('#frame:') ? n.link : 'https://') : v; });
      },
      onkeydown: (e) => e.stopPropagation(),
    }, h('option', { value: '', selected: linkKind === '' }, 'No link'), h('option', { value: 'url', selected: linkKind === 'url' }, 'Web address…'),
    frames.length ? h('optgroup', { label: 'Go to frame' }, frames.map((f) => h('option', { value: '#frame:' + f.id, selected: linkKind === '#frame:' + f.id }, f.name))) : null);
    wrap.append(section('Link & code', [
      linkSel,
      linkKind === 'url' ? h('input', { class: 'txt', value: one.link, 'aria-label': 'Link address', onkeydown: (e) => e.stopPropagation(), onchange: (e) => set((n) => { n.link = e.target.value.trim(); }) }) : null,
      grid(h('span', { class: 'lbl' }, 'HTML tag'), sel([['auto', 'Auto'], ...['div', 'section', 'header', 'nav', 'main', 'footer', 'article', 'aside', 'button', 'a', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'label', 'ul', 'li'].map((t) => [t, `<${t}>`])], one.tag || 'auto', (n, v) => { n.tag = v; }, { label: 'HTML tag' })),
    ].filter(Boolean)));
  }

  // export
  wrap.append(exportSection(ns));
  return wrap;
}

function resizeNode(n, w, hh) {
  const ow = n.w, oh = n.h;
  if (w !== ow) { n.w = Math.round(w); if (n.sizeW !== 'fill') n.sizeW = 'fixed'; if (n.type === 'text' && n.textSize === 'autoW') n.textSize = 'autoH'; }
  if (hh !== oh) { n.h = Math.round(hh); if (n.sizeH !== 'fill') n.sizeH = 'fixed'; if (n.type === 'text') n.textSize = 'fixed'; }
  if (n.type === 'frame') applyC(n, ow, oh);
}


function textSection(ns) {
  const fam = common(ns, (n) => n.font.family);
  const weights = WEIGHTS[fam === MIXED ? 'Inter' : fam] || [400, 700];
  return section('Text', [
    sel(FONTS.map((f) => [f, f]), fam, (n, v) => { n.font.family = v; n.font.weight = nearestWeight(v, n.font.weight); ensureFont(v, n.font.weight); }, { label: 'Font family', cls: 'font-sel' }),
    grid(
      sel(weights.map((w) => [w, `${WEIGHT_NAMES[w]}`]), common(ns, (n) => n.font.weight), (n, v) => { n.font.weight = +v; }, { label: 'Font weight' }),
      num('', common(ns, (n) => n.font.size), (n, v) => { n.font.size = Math.max(1, v); }, { min: 1, title: 'Font size' }),
    ),
    grid(
      num('LH', common(ns, (n) => n.font.lh), (n, v) => { n.font.lh = Math.max(0.5, +v.toFixed(2)); }, { step: 0.05, min: 0.5, title: 'Line height (× size)' }),
      num('LS', common(ns, (n) => n.font.ls), (n, v) => { n.font.ls = +v.toFixed(2); }, { step: 0.1, title: 'Letter spacing (px)' }),
    ),
    row(
      seg([['left', 'Align left', 'alL'], ['center', 'Align center', 'alCH'], ['right', 'Align right', 'alR'], ['justify', 'Justify', 'menu']], common(ns, (n) => n.font.align), (n, v) => { n.font.align = v; }, { label: 'Text align', small: true }),
      h('div', { class: 'seg sm' },
        h('button', { class: common(ns, (n) => n.font.italic) === true ? 'on' : '', title: 'Italic', 'aria-label': 'Italic', html: '<i style="font-family:Georgia,serif">I</i>', onclick: () => set((n) => { n.font.italic = !n.font.italic; }) }),
        h('button', { class: common(ns, (n) => n.font.deco) === 'underline' ? 'on' : '', title: 'Underline', 'aria-label': 'Underline', html: '<u>U</u>', onclick: () => set((n) => { n.font.deco = n.font.deco === 'underline' ? 'none' : 'underline'; }) }),
        h('button', { class: common(ns, (n) => n.font.deco) === 'line-through' ? 'on' : '', title: 'Strikethrough', 'aria-label': 'Strikethrough', html: '<s>S</s>', onclick: () => set((n) => { n.font.deco = n.font.deco === 'line-through' ? 'none' : 'line-through'; }) }),
      ),
    ),
    sel([['none', 'Aa  As typed'], ['uppercase', 'AA  Uppercase'], ['lowercase', 'aa  Lowercase'], ['capitalize', 'Aa  Title case']], common(ns, (n) => n.font.case), (n, v) => { n.font.case = v; }, { label: 'Letter case' }),
    ns.length === 1 ? h('button', { class: 'btn wide ghost', onclick: () => startEdit(ns[0].id) }, 'Edit text (Enter)') : null,
  ].filter(Boolean));
}

function exportSection(ns) {
  const scale = h('select', { class: 'sel', 'aria-label': 'Export scale', onkeydown: (e) => e.stopPropagation() }, ['1', '2', '3', '4'].map((s) => h('option', { value: s, selected: s === '2' }, s + 'x')));
  const fmt = h('select', { class: 'sel', 'aria-label': 'Export format', onkeydown: (e) => e.stopPropagation() }, ['PNG', 'JPG', 'SVG'].map((f) => h('option', { value: f }, f)));
  const go = async () => {
    try {
      for (const n of ns) {
        const base = n.name.replace(/[^\w -]+/g, '').trim() || 'export';
        if (fmt.value === 'SVG') download(`${base}.svg`, vectorSVG(n), 'image/svg+xml');
        else {
          const b = await rasterize(n, +scale.value, fmt.value === 'PNG' ? 'image/png' : 'image/jpeg');
          download(`${base}@${scale.value}x.${fmt.value.toLowerCase()}`, b);
        }
      }
      toast('Exported');
    } catch (e) {
      console.error(e);
      toast('This browser blocked the image export. Try SVG, or Chrome / Edge / Firefox.', 'err');
    }
  };
  const top = ns.length === 1 && ns[0].type === 'frame';
  return section('Export', [
    grid(scale, fmt),
    h('button', { class: 'btn wide', onclick: go, html: `${icon('download', 16)}<span>Export ${ns.length > 1 ? ns.length + ' layers' : ns[0].name}</span>` }),
    top ? h('button', { class: 'btn wide primary', onclick: () => openCodeModal([ns[0].id]), html: `${icon('code', 16)}<span>Get code for this frame</span>` }) : null,
  ].filter(Boolean));
}

function pagePanel(wrap) {
  wrap.append(section('Page', [
    h('div', { class: 'lbl' }, 'Canvas colour'),
    pageColor(),
  ]));
  const roots = S.doc.children.filter((n) => n.type === 'frame');
  wrap.append(section('Frames on this page', roots.length ? roots.map((f) => h('button', {
    class: 'blk', onclick: () => { select([f.id]); zoomToSelection(); },
  }, h('span', { html: icon('frame', 15) }), f.name, h('small', null, `${Math.round(f.w)} × ${Math.round(f.h)}`))) : [h('p', { class: 'hint' }, 'None yet. Press F or pick a size below.')]));
  wrap.append(section('New frame', [framePresets()]));
  wrap.append(section('Tips', [h('ul', { class: 'tips' },
    h('li', null, h('b', null, 'Shift+A'), ' turns a frame into auto layout (flexbox).'),
    h('li', null, h('b', null, 'Alt'), ' + hover shows distances.'),
    h('li', null, h('b', null, 'Ctrl/Cmd'), ' + click picks the deepest layer.'),
    h('li', null, h('b', null, '?'), ' lists every shortcut.'),
  )]));
  return wrap;
}

function pageColor() {
  const p = h('input', {
    type: 'color', class: 'swatch', value: normHex(S.doc.bg).toLowerCase(), 'aria-label': 'Canvas colour',
    oninput: () => { S.doc.bg = p.value.toUpperCase(); emit('bg'); },
    onchange: () => change(() => { S.doc.bg = p.value.toUpperCase(); }),
  });
  return h('div', { class: 'color' }, h('span', { class: 'sw-wrap' }, p), h('span', { class: 'hex ro' }, normHex(S.doc.bg).slice(1)));
}

/* ======================= Code (dev mode) ======================= */

function codeBlock(title, code, lang) {
  return h('div', { class: 'code-card' },
    h('div', { class: 'code-h' }, h('span', null, title), h('button', { class: 'ib', title: 'Copy', 'aria-label': `Copy ${title}`, html: icon('copy', 15), onclick: () => copyText(code) })),
    h('pre', { class: 'code', html: highlight(code, lang) }));
}

function codePanel() {
  const ns = selNodes();
  const wrap = h('div', { class: 'devpanel' });
  if (!ns.length) {
    wrap.append(h('div', { class: 'empty' },
      h('p', null, 'Select a layer to inspect its CSS, Tailwind classes and HTML.'),
      h('p', { class: 'muted' }, 'Or export a whole frame as a site.'),
      h('button', { class: 'btn primary', onclick: () => openCodeModal(), html: `${icon('code', 16)}<span>Export code</span>` })));
    return wrap;
  }
  const n = ns[0];
  const p = parentOf(n.id);
  wrap.append(
    h('div', { class: 'insp' },
      h('div', null, h('span', null, 'Size'), h('b', null, `${Math.round(n.w)} × ${Math.round(n.h)}`)),
      h('div', null, h('span', null, 'Position'), h('b', null, `${Math.round(n.x)}, ${Math.round(n.y)}`)),
      n.type === 'text' ? h('div', null, h('span', null, 'Font'), h('b', null, `${n.font.family} ${n.font.weight} · ${n.font.size}px`)) : null,
      p ? h('div', null, h('span', null, 'In'), h('b', null, p.name)) : null,
    ),
    codeBlock('CSS', layerCSS(n, p), 'css'),
    codeBlock('Tailwind', layerTailwind(n, p), 'html'),
    codeBlock('HTML', layerHTML(n), 'html'),
    h('button', {
      class: 'btn wide primary',
      onclick: () => { const top = chainOf(S.idx, n.id)[0]; openCodeModal([top.id]); },
      html: `${icon('code', 16)}<span>Export the whole frame</span>`,
    }),
  );
  return wrap;
}

