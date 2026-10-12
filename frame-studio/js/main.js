// Boot: wires the canvas, panels, toolbar, menus, shortcuts, files and the
// code export window together.

import { S, on, emit, undo, redo, loadDoc, node, select, selNodes, change, resetHistory } from './state.js';
import { emptyDoc, isFlex, unionBox, worldBox } from './model.js';
import { Renderer } from './render.js';
import {
  initEditor, applyView, setTool, zoomBy, zoomToFit, zoomToSelection, zoomAt, startEdit, commitEdit,
  cancelDrag, finishPen, penActive, cancelPen, drawOverlay, toWorld,
} from './editor.js';
import * as cmd from './commands.js';
import { initPanels, importImages, showRightTab } from './panels.js';
import { buildCode, zip, download, rasterize } from './export.js';
import { TEMPLATES } from './blocks.js';
import { loadLocal, autosave, pickFile, readText, readDataURL, imageSize, shrinkImage } from './store.js';
import { h, icon, toast, menu, closeMenu, modal, closeModal, modalOpen, copyText, highlight } from './ui.js';

const $ = (s) => document.querySelector(s);
const viewport = $('#viewport');
const world = $('#world');
const overlay = $('#overlay');
const renderer = new Renderer(world);

/* ---------------- render loop ---------------- */

on('doc', () => {
  renderer.render();
  viewport.style.background = S.doc.bg;
  $('#doc-name').value = S.doc.name;
  autosave(S.doc, () => setSaved(true));
  setSaved(false);
});
on('bg', () => { viewport.style.background = S.doc.bg; });
on('hover', drawOverlay);
on('view', () => { $('#zoom-label').textContent = Math.round(S.zoom * 100) + '%'; });
document.fonts?.addEventListener?.('loadingdone', () => { renderer.measure(); drawOverlay(); emit('selpreview'); });

function setSaved(ok) {
  const el = $('#save-state');
  el.textContent = ok ? 'Saved in this browser' : 'Saving…';
  el.classList.toggle('ok', ok);
}

initEditor({ viewport, world, overlay, renderer });
initPanels({ openCodeModal });

/* ---------------- toolbar ---------------- */

const TOOLS = [
  ['move', 'Move', 'V', 'move'],
  ['frame', 'Frame', 'F', 'frame'],
  ['rect', 'Rectangle', 'R', 'rect', 'shapes'],
  ['ellipse', 'Ellipse', 'O', 'ellipse', 'shapes'],
  ['line', 'Line', 'L', 'line', 'shapes'],
  ['arrow', 'Arrow', 'Shift+L', 'arrow', 'shapes'],
  ['polygon', 'Polygon', '', 'polygon', 'shapes'],
  ['star', 'Star', '', 'star', 'shapes'],
  ['pen', 'Pen', 'P', 'pen', 'draw'],
  ['pencil', 'Pencil', 'Shift+P', 'pencil', 'draw'],
  ['text', 'Text', 'T', 'text'],
  ['image', 'Image', 'Shift+Ctrl+K', 'image'],
  ['hand', 'Hand', 'H', 'hand'],
];
const lastInGroup = { shapes: 'rect', draw: 'pen' };

function buildToolbar() {
  const bar = $('#toolbar');
  bar.replaceChildren();
  const seen = new Set();
  for (const [id, label, key, ic, group] of TOOLS) {
    if (group) {
      if (seen.has(group)) continue;
      seen.add(group);
      const cur = TOOLS.find((t) => t[0] === lastInGroup[group]);
      const active = TOOLS.some((t) => t[4] === group && t[0] === S.tool);
      const shown = active ? TOOLS.find((t) => t[0] === S.tool) : cur;
      bar.append(h('div', { class: 'tool-grp' },
        h('button', {
          class: 'tool' + (active ? ' on' : ''), title: `${shown[1]}${shown[2] ? ` (${shown[2]})` : ''}`, 'aria-label': shown[1], 'aria-pressed': String(active),
          html: icon(shown[3], 20), onclick: () => setTool(shown[0]),
        }),
        h('button', {
          class: 'tool-more', 'aria-label': `More ${group} tools`, title: 'More', html: icon('down', 12),
          onclick: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const m = menu(r.left, r.top, TOOLS.filter((t) => t[4] === group).map((t) => ({ label: t[1], kbd: t[2], run: () => { lastInGroup[group] = t[0]; setTool(t[0]); } })));
            m.style.top = (r.top - m.offsetHeight - 8) + 'px';
          },
        })));
      continue;
    }
    bar.append(h('button', {
      class: 'tool' + (S.tool === id ? ' on' : ''), title: `${label}${key ? ` (${key})` : ''}`, 'aria-label': label, 'aria-pressed': String(S.tool === id),
      html: icon(ic, 20),
      onclick: () => (id === 'image' ? importImages() : setTool(id)),
    }));
  }
  bar.append(h('span', { class: 'tb-sep' }),
    h('button', { class: 'tool toggle' + (S.snap ? ' on' : ''), title: 'Snapping (Shift+Ctrl+\')', 'aria-label': 'Snapping', 'aria-pressed': String(S.snap), html: icon('magnet', 20), onclick: () => { S.snap = !S.snap; buildToolbar(); toast(S.snap ? 'Snapping on' : 'Snapping off'); } }),
    h('button', { class: 'tool code-tool', title: 'Get code (Ctrl+E)', 'aria-label': 'Get code', html: icon('code', 20), onclick: () => openCodeModal() }));
}
on('tool', () => {
  buildToolbar();
  for (const g of Object.keys(lastInGroup)) if (TOOLS.some((t) => t[4] === g && t[0] === S.tool)) lastInGroup[g] = S.tool;
});
buildToolbar();

/* ---------------- top bar ---------------- */

$('#doc-name').addEventListener('change', (e) => change(() => { S.doc.name = e.target.value.trim() || 'Untitled'; }));
$('#doc-name').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
$('#btn-undo').onclick = () => undo();
$('#btn-redo').onclick = () => redo();
$('#btn-code').onclick = () => openCodeModal();
$('#btn-present').onclick = () => present();
$('#zoom-label').onclick = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  menu(r.left, r.bottom + 6, [
    { label: 'Zoom in', kbd: 'Ctrl +', run: () => zoomBy(1.25) },
    { label: 'Zoom out', kbd: 'Ctrl −', run: () => zoomBy(0.8) },
    { label: 'Zoom to 100%', kbd: 'Shift+0', run: () => { const vr = viewport.getBoundingClientRect(); zoomAt(vr.width / 2, vr.height / 2, 1); } },
    { label: 'Zoom to fit', kbd: 'Shift+1', run: zoomToFit },
    { label: 'Zoom to selection', kbd: 'Shift+2', run: zoomToSelection, disabled: !S.sel.length },
  ]);
};
$('#btn-theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('fs-theme', t); } catch { /* private mode */ }
};
$('#btn-menu').onclick = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  menu(r.left, r.bottom + 6, [
    { label: 'New file', run: newFile },
    { label: 'Open file…', kbd: 'Ctrl+O', run: openFile },
    { label: 'Save file', kbd: 'Ctrl+S', run: saveFile },
    '-',
    { label: 'Add images…', kbd: 'Shift+Ctrl+K', run: () => importImages() },
    ...TEMPLATES.map((t) => ({ label: `Add template: ${t.name}`, run: () => cmd.insertNodes([t.make()], { asFrames: true }) })),
    '-',
    { label: 'Get code…', kbd: 'Ctrl+E', run: () => openCodeModal() },
    { label: 'Preview in browser', run: present },
    '-',
    { label: 'Keyboard shortcuts', kbd: '?', run: showShortcuts },
    { label: 'About Frame Studio', run: showAbout },
  ]);
};
$('#toggle-left').onclick = () => document.body.classList.toggle('show-left');
$('#toggle-right').onclick = () => document.body.classList.toggle('show-right');

/* ---------------- files ---------------- */

function newFile() {
  if (S.doc.children.length && !confirm('Start a new file? The current one will be replaced. Save it first if you want to keep it.')) return;
  const d = emptyDoc();
  loadDoc(d);
  applyView();
  toast('New file');
}

async function openFile() {
  const [f] = await pickFile('.frame,.json,application/json');
  if (!f) return;
  try {
    const d = JSON.parse(await readText(f));
    if (!Array.isArray(d.children)) throw new Error('bad file');
    loadDoc({ ...emptyDoc(), ...d });
    requestAnimationFrame(zoomToFit);
    toast(`Opened ${f.name}`);
  } catch { toast('That file could not be opened.', 'err'); }
}

function saveFile() {
  const name = (S.doc.name || 'Untitled').replace(/[^\w -]+/g, '').trim() || 'Untitled';
  download(`${name}.frame`, JSON.stringify(S.doc), 'application/json');
  toast('File saved to your downloads');
}

/* ---------------- present / preview ---------------- */

function targetFrames(ids) {
  if (ids?.length) return ids.map(node).filter(Boolean);
  const tops = new Set();
  for (const id of S.sel) {
    let e = S.idx.get(id);
    while (e && e.parent) e = S.idx.get(e.parent.id);
    if (e && e.node.type === 'frame') tops.add(e.node.id);
  }
  if (tops.size) return [...tops].map(node);
  return S.doc.children.filter((n) => n.type === 'frame' && n.visible).slice(0, 1);
}

function present() {
  const frames = targetFrames();
  if (!frames.length) { toast('Add a frame first (F).'); return; }
  const all = S.doc.children.filter((n) => n.type === 'frame' && n.visible);
  const ordered = [frames[0], ...all.filter((f) => f !== frames[0])];
  const { preview } = buildCode(ordered, { format: 'html', layout: 'scale', site: ordered.length > 1 });
  const url = URL.createObjectURL(new Blob([preview], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) toast('Allow pop-ups to preview.', 'err');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- code export window ---------------- */

function openCodeModal(ids) {
  const frames = S.doc.children.filter((n) => n.type === 'frame');
  if (!frames.length) { toast('Draw a frame first: press F, or add a template from Assets.'); return; }
  const picked = targetFrames(ids);
  const st = {
    frame: picked[0]?.id || frames[0].id,
    format: 'html', layout: 'fluid', site: false, file: 0, view: 'preview', device: 'desktop',
  };
  const body = h('div', { class: 'cx' });
  modal('Get code', body, { wide: true });

  const render = () => {
    const chosen = st.site ? frames.filter((f) => f.visible) : [node(st.frame)];
    const ordered = st.site ? [node(st.frame), ...chosen.filter((f) => f.id !== st.frame)] : chosen;
    const out = buildCode(ordered, { format: st.format, layout: st.layout, site: st.site, inline: true });
    const zipped = buildCode(ordered, { format: st.format, layout: st.layout, site: st.site, inline: false });
    st.file = Math.min(st.file, out.files.length - 1);
    const f = out.files[st.file];

    const opt = (label, key, list) => h('label', { class: 'cx-opt' }, h('span', null, label), h('select', {
      class: 'sel', onchange: (e) => { st[key] = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value; render(); },
      onkeydown: (e) => e.stopPropagation(),
    }, list.map(([v, l]) => h('option', { value: String(v), selected: String(st[key]) === String(v) }, l))));

    const preview = h('iframe', { class: 'cx-frame', title: 'Live preview', sandbox: 'allow-scripts', srcdoc: out.preview });
    const pane = st.view === 'preview'
      ? h('div', { class: 'cx-preview ' + st.device }, h('div', { class: 'cx-device' }, preview))
      : h('pre', { class: 'code big', html: highlight(f.content, f.lang === 'css' ? 'css' : 'html') });

    body.replaceChildren(
      h('div', { class: 'cx-bar' },
        opt('Frame', 'frame', frames.map((fr) => [fr.id, fr.name])),
        opt('Code', 'format', [['html', 'HTML + CSS'], ['tailwind', 'Tailwind'], ['react', 'React (JSX)']]),
        opt('Layout', 'layout', [['fluid', 'Responsive width'], ['fixed', 'Fixed size'], ['scale', 'Fixed, scale to screen']]),
        st.format !== 'react' ? opt('Pages', 'site', [[false, 'This frame only'], [true, 'All frames as one site']]) : null,
      ),
      h('div', { class: 'cx-tabs' },
        h('button', { class: st.view === 'preview' ? 'on' : '', onclick: () => { st.view = 'preview'; render(); } }, 'Preview'),
        out.files.map((file, i) => h('button', { class: st.view === 'code' && st.file === i ? 'on' : '', onclick: () => { st.view = 'code'; st.file = i; render(); } }, file.name)),
        h('span', { class: 'grow' }),
        st.view === 'preview' ? h('div', { class: 'seg sm' }, ['desktop', 'tablet', 'mobile'].map((d) => h('button', { class: st.device === d ? 'on' : '', onclick: () => { st.device = d; render(); } }, d[0].toUpperCase() + d.slice(1)))) : null,
      ),
      pane,
      h('div', { class: 'cx-foot' },
        h('p', { class: 'hint' }, st.format === 'react'
          ? 'Drop the .jsx and .css into any React app (Vite, Next.js). Images go in /public.'
          : st.format === 'tailwind' ? 'Uses the Tailwind CDN so it runs as is. Paste the classes into your own project.'
            : 'One index.html with the CSS inside. The .zip has separate files and an assets folder.'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn', onclick: () => copyText(f.content), html: `${icon('copy', 16)}<span>Copy ${st.view === 'code' ? f.name : out.files[0].name}</span>` }),
        h('button', {
          class: 'btn', html: `${icon('external', 16)}<span>Open</span>`,
          onclick: () => { const url = URL.createObjectURL(new Blob([out.preview], { type: 'text/html' })); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); },
        }),
        h('button', {
          class: 'btn primary', html: `${icon('download', 16)}<span>Download .zip</span>`,
          onclick: () => {
            const name = (ordered.length > 1 ? S.doc.name : ordered[0].name).replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'site';
            download(`${name}.zip`, zip(zipped.files.map((x) => ({ name: `${name}/${x.name}`, content: x.content }))));
            toast('Downloaded');
          },
        }),
      ),
    );
  };
  render();
}

/* ---------------- shortcuts ---------------- */

const SHORTCUTS = [
  ['Tools', [['V', 'Move'], ['F', 'Frame'], ['R', 'Rectangle'], ['O', 'Ellipse'], ['L', 'Line'], ['Shift+L', 'Arrow'], ['P', 'Pen (Enter to finish)'], ['Shift+P', 'Pencil'], ['T', 'Text'], ['H / Space', 'Hand (pan)'], ['Shift+Ctrl+K', 'Add image']]],
  ['Edit', [['Ctrl+Z / Shift+Ctrl+Z', 'Undo / redo'], ['Ctrl+C / X / V', 'Copy / cut / paste'], ['Ctrl+D', 'Duplicate'], ['Alt + drag', 'Duplicate while moving'], ['Delete', 'Delete'], ['Enter', 'Edit text / select children'], ['Shift+Enter, Esc', 'Select parent'], ['Ctrl+A', 'Select all']]],
  ['Arrange', [['Ctrl+G', 'Group'], ['Shift+Ctrl+G', 'Ungroup'], ['Ctrl+Alt+G', 'Frame selection'], ['Shift+A', 'Auto layout on / off'], ['Ctrl+] / [', 'Forward / backward'], ['Ctrl+Shift+] / [', 'To front / back'], ['Arrows', 'Nudge 1px (Shift: 10px)'], ['Alt+A / D / W / S', 'Align left / right / top / bottom'], ['Alt+H / V', 'Align centres'], ['Shift+H / V', 'Flip vector']]],
  ['View', [['Ctrl + / −', 'Zoom'], ['Shift+0', '100%'], ['Shift+1', 'Fit all'], ['Shift+2', 'Fit selection'], ['Alt + hover', 'Measure distances'], ['Ctrl+E', 'Get code'], ['Shift+Ctrl+H', 'Show / hide'], ['Shift+Ctrl+L', 'Lock / unlock']]],
];

function showShortcuts() {
  modal('Keyboard shortcuts', h('div', { class: 'keys' }, SHORTCUTS.map(([g, list]) => h('div', null, h('h3', null, g), h('dl', null, list.map(([k, d]) => [h('dt', null, d), h('dd', null, h('kbd', null, k))]))))), { wide: true });
}

function showAbout() {
  modal('About Frame Studio', h('div', { class: 'about' },
    h('p', null, 'A free design tool in your browser: frames, auto layout, vectors, text, images, constraints and effects, with code export for every frame.'),
    h('p', null, 'Your work stays on this device. It autosaves in this browser; use File → Save to keep a copy or move it to another computer.'),
    h('p', { class: 'muted' }, 'Not affiliated with Figma. Figma is a trademark of Figma, Inc.'),
  ));
}

const typing = (e) => {
  const t = e.target;
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};

window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && !typing(e)) { if (!S.space) { S.space = true; viewport.classList.add('space'); } e.preventDefault(); return; }
  if (modalOpen()) { if (e.key === 'Escape') closeModal(); return; }
  if (typing(e) || S.editing) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const run = (fn) => { e.preventDefault(); fn(); };

  if (mod) {
    if (k === 'z' && e.shiftKey) return run(redo);
    if (k === 'z') return run(undo);
    if (k === 'y') return run(redo);
    if (k === 'd') return run(cmd.duplicateSel);
    if (k === 'a') return run(cmd.selectAll);
    if (k === 'g' && e.altKey) return run(() => cmd.wrapSel('frame'));
    if (k === 'g' && e.shiftKey) return run(cmd.ungroupSel);
    if (k === 'g') return run(() => cmd.wrapSel('group'));
    if (k === 's') return run(saveFile);
    if (k === 'o') return run(openFile);
    if (k === 'e') return run(() => openCodeModal());
    if (k === 'k' && e.shiftKey) return run(() => importImages());
    if (k === 'h' && e.shiftKey) return run(() => cmd.toggleProp('visible'));
    if (k === 'l' && e.shiftKey) return run(() => cmd.toggleProp('locked'));
    if (e.key === ']' || e.key === '}') return run(() => cmd.arrange(e.shiftKey ? 'front' : 'forward'));
    if (e.key === '[' || e.key === '{') return run(() => cmd.arrange(e.shiftKey ? 'back' : 'backward'));
    if (e.key === '=' || e.key === '+') return run(() => zoomBy(1.25));
    if (e.key === '-' || e.key === '_') return run(() => zoomBy(0.8));
    if (e.key === '0') return run(() => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1); });
    if (e.key === "'" && e.shiftKey) return run(() => { S.snap = !S.snap; buildToolbar(); });
    return;
  }
  if (e.altKey) {
    const map = { a: 'left', d: 'right', w: 'top', s: 'bottom', h: 'hcenter', v: 'vcenter' };
    const c = e.code.replace('Key', '').toLowerCase();
    if (map[c]) return run(() => cmd.align(map[c]));
    return;
  }

  switch (e.key) {
    case 'Escape':
      if (penActive()) return run(() => finishPen(false));
      cancelDrag();
      if (S.tool !== 'move') return run(() => setTool('move'));
      return run(cmd.selectParent);
    case 'Enter':
      if (penActive()) return run(() => finishPen(false));
      if (e.shiftKey) return run(cmd.selectParent);
      if (S.sel.length === 1 && node(S.sel[0]).type === 'text') return run(() => startEdit(S.sel[0]));
      return run(cmd.selectChildren);
    case 'Delete': case 'Backspace':
      if (penActive()) return run(cancelPen);
      return run(cmd.deleteSel);
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
      if (!S.sel.length) return;
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      return run(() => cmd.nudge(dx, dy));
    }
    case '?': return run(showShortcuts);
  }
  if (e.shiftKey) {
    if (k === 'a') return run(cmd.toggleAutoLayout);
    if (k === 'l') return run(() => setTool('arrow'));
    if (k === 'p') return run(() => setTool('pencil'));
    if (k === 'h') return run(() => cmd.flip('h'));
    if (k === 'v') return run(() => cmd.flip('v'));
    if (e.code === 'Digit0') return run(() => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1); });
    if (e.code === 'Digit1') return run(zoomToFit);
    if (e.code === 'Digit2') return run(zoomToSelection);
    return;
  }
  const tools = { v: 'move', f: 'frame', a: 'frame', r: 'rect', o: 'ellipse', l: 'line', p: 'pen', t: 'text', h: 'hand' };
  if (tools[k]) return run(() => setTool(tools[k]));
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') { S.space = false; viewport.classList.remove('space'); }
});

/* ---------------- clipboard, drop ---------------- */

document.addEventListener('copy', (e) => { if (!typing(e) && !S.editing && S.sel.length) cmd.copySel(e); });
document.addEventListener('cut', (e) => { if (!typing(e) && !S.editing && S.sel.length) cmd.cutSel(e); });
document.addEventListener('paste', async (e) => {
  if (typing(e) || S.editing || modalOpen()) return;
  const dt = e.clipboardData;
  const files = [...(dt?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); importImages(files); return; }
  const text = dt?.getData('text/plain') || '';
  const clip = cmd.parseClip(text);
  e.preventDefault();
  if (clip) { cmd.paste(clip); return; }
  if (/^\s*<svg[\s\S]*<\/svg>\s*$/i.test(text)) {
    const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    const { w, h: hh } = await imageSize(data);
    cmd.insertImage(data, w, hh);
    return;
  }
  if (text.trim()) {
    const { makeNode } = await import('./model.js');
    cmd.insertNodes([makeNode('text', { name: text.trim().slice(0, 28), text: text.trim() })]);
    return;
  }
  if (S.clipboard) cmd.paste();
});

viewport.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); viewport.classList.add('dropping'); } });
viewport.addEventListener('dragleave', () => viewport.classList.remove('dropping'));
viewport.addEventListener('drop', async (e) => {
  viewport.classList.remove('dropping');
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  e.preventDefault();
  const frameFile = files.find((f) => /\.(frame|json)$/i.test(f.name));
  if (frameFile) {
    try { const d = JSON.parse(await frameFile.text()); if (Array.isArray(d.children)) { loadDoc({ ...emptyDoc(), ...d }); requestAnimationFrame(zoomToFit); } } catch { toast('That file could not be opened.', 'err'); }
    return;
  }
  const at = toWorld(e.clientX, e.clientY);
  for (const f of files.filter((x) => x.type.startsWith('image/'))) {
    const data = await shrinkImage(await readDataURL(f));
    const { w, h: hh } = await imageSize(data);
    S.sel = [];
    cmd.insertImage(data, w, hh, at);
    at.x += 40; at.y += 40;
  }
});

/* ---------------- context menu ---------------- */

on('contextmenu', (x, y) => {
  const has = S.sel.length > 0;
  const one = S.sel.length === 1 ? node(S.sel[0]) : null;
  menu(x, y, has ? [
    { label: 'Copy', kbd: 'Ctrl+C', run: () => cmd.copySel() },
    { label: 'Paste', kbd: 'Ctrl+V', run: () => cmd.paste(), disabled: !S.clipboard },
    { label: 'Duplicate', kbd: 'Ctrl+D', run: cmd.duplicateSel },
    { label: 'Delete', kbd: 'Del', run: cmd.deleteSel },
    '-',
    { label: 'Bring to front', kbd: 'Ctrl+Shift+]', run: () => cmd.arrange('front') },
    { label: 'Send to back', kbd: 'Ctrl+Shift+[', run: () => cmd.arrange('back') },
    '-',
    { label: 'Group', kbd: 'Ctrl+G', run: () => cmd.wrapSel('group') },
    { label: 'Frame selection', kbd: 'Ctrl+Alt+G', run: () => cmd.wrapSel('frame') },
    { label: 'Ungroup', kbd: 'Shift+Ctrl+G', run: cmd.ungroupSel, disabled: !selNodes().some((n) => n.children?.length) },
    { label: one && isFlex(one) ? 'Remove auto layout' : 'Add auto layout', kbd: 'Shift+A', run: cmd.toggleAutoLayout },
    '-',
    { label: 'Show / hide', kbd: 'Shift+Ctrl+H', run: () => cmd.toggleProp('visible') },
    { label: 'Lock / unlock', kbd: 'Shift+Ctrl+L', run: () => cmd.toggleProp('locked') },
    '-',
    { label: 'Copy as PNG', run: copyPNG },
    { label: 'Copy CSS', run: () => { showRightTab('code'); toast('CSS is in the Code tab'); } },
    { label: 'Get code for frame…', kbd: 'Ctrl+E', run: () => openCodeModal() },
  ] : [
    { label: 'Paste here', kbd: 'Ctrl+V', run: () => cmd.paste(), disabled: !S.clipboard },
    { label: 'Select all', kbd: 'Ctrl+A', run: cmd.selectAll },
    '-',
    { label: 'Zoom to fit', kbd: 'Shift+1', run: zoomToFit },
    { label: 'Add images…', run: () => importImages() },
  ]);
});
on('closemenus', closeMenu);

async function copyPNG() {
  const n = selNodes()[0];
  if (!n) return;
  try {
    const blob = await rasterize(n, 2, 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('PNG copied');
  } catch { toast('Copying images is blocked here. Use Export instead.', 'err'); }
}

/* ---------------- boot ---------------- */

(async function boot() {
  try { const t = localStorage.getItem('fs-theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* private mode */ }
  const saved = await loadLocal();
  if (saved && Array.isArray(saved.children)) {
    loadDoc({ ...emptyDoc(), ...saved });
  } else {
    const d = emptyDoc();
    d.name = 'Welcome';
    loadDoc(d);
    cmd.insertNodes([TEMPLATES[0].make()], { asFrames: true });
    cmd.insertNodes([TEMPLATES[1].make()], { asFrames: true });
    resetHistory();
    S.sel = [];
    emit('sel');
  }
  requestAnimationFrame(() => {
    renderer.render();
    zoomToFit();
    document.body.classList.remove('booting');
  });
  // first visit hint
  try {
    if (!localStorage.getItem('fs-seen')) { localStorage.setItem('fs-seen', '1'); setTimeout(() => toast('Tip: select a frame and press Ctrl+E to get its code'), 1200); }
  } catch { /* ignore */ }
})();

// expose for debugging in the console
window.frameStudio = { S, cmd, buildCode, commitEdit, select, unionBox, worldBox };
