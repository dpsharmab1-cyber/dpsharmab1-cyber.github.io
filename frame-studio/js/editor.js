// Canvas interaction: pan / zoom, picking, selection, move with smart guides
// and live re-parenting, resize, rotate, drawing tools, pen and pencil,
// text editing, and the overlay that draws all of it.

import { S, on, emit, begin, end, live, node, parentOf, select, reindex } from './state.js';
import {
  makeNode, isFlex, chainOf, worldPos, worldBox, unionBox, remove, insert, listOf,
  isAncestor, applyConstraints, polygonPath, starPath, walk, r2,
} from './model.js';

let VP, WORLD, OV, R;
let drag = null;
let pen = null;      // { pts: [{x,y}], parent }
let pencil = null;   // { pts: [] }
let guides = [];     // [{x1,y1,x2,y2}] world coords
let marquee = null;  // world rect
let lastPointer = { x: 0, y: 0, cx: 0, cy: 0 };
let altDown = false;

export function initEditor(els) {
  ({ viewport: VP, world: WORLD, overlay: OV, renderer: R } = els);
  VP.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  VP.addEventListener('wheel', onWheel, { passive: false });
  VP.addEventListener('dblclick', onDbl);
  VP.addEventListener('contextmenu', onContext);
  VP.addEventListener('pointerleave', () => { if (!drag) { S.hover = null; drawOverlay(); } });
  window.addEventListener('keydown', (e) => { if (e.key === 'Alt') { altDown = true; drawOverlay(); } });
  window.addEventListener('keyup', (e) => { if (e.key === 'Alt') { altDown = false; drawOverlay(); } });
  window.addEventListener('blur', () => { altDown = false; });
  window.addEventListener('resize', () => applyView());
  gestureZoom();
  on('sel', drawOverlay);
  on('doc', drawOverlay);
  on('tool', drawOverlay);
  applyView();
}

/* ================= view ================= */

export function applyView() {
  WORLD.style.transform = `translate(${S.px}px, ${S.py}px) scale(${S.zoom})`;
  const g = 24 * S.zoom;
  VP.style.setProperty('--grid', `${g}px`);
  VP.style.setProperty('--gx', `${S.px}px`);
  VP.style.setProperty('--gy', `${S.py}px`);
  VP.classList.toggle('grid-off', g < 8);
  drawOverlay();
  emit('view');
}

const vpRect = () => VP.getBoundingClientRect();

export function toWorld(cx, cy) {
  const r = vpRect();
  return { x: (cx - r.left - S.px) / S.zoom, y: (cy - r.top - S.py) / S.zoom };
}
const toScreen = (x, y) => ({ x: x * S.zoom + S.px, y: y * S.zoom + S.py });

export function zoomAt(sx, sy, z) {
  z = Math.min(64, Math.max(0.02, z));
  const wx = (sx - S.px) / S.zoom, wy = (sy - S.py) / S.zoom;
  S.zoom = z;
  S.px = sx - wx * z;
  S.py = sy - wy * z;
  applyView();
}

export function zoomBy(k) {
  const r = vpRect();
  zoomAt(r.width / 2, r.height / 2, S.zoom * k);
}

export function zoomTo(box, maxZ = 1) {
  const r = vpRect();
  if (!box || !box.w || !box.h) { S.zoom = 1; S.px = r.width / 2; S.py = r.height / 2; applyView(); return; }
  const pad = 64;
  const z = Math.min((r.width - pad * 2) / box.w, (r.height - pad * 2) / box.h, maxZ);
  S.zoom = Math.max(0.02, z);
  S.px = r.width / 2 - (box.x + box.w / 2) * S.zoom;
  S.py = r.height / 2 - (box.y + box.h / 2) * S.zoom;
  applyView();
}

export function zoomToFit() { zoomTo(unionBox(S.doc.children.filter((n) => n.visible).map((n) => worldBox(S.idx, n.id))), 1); }
export function zoomToSelection() { if (S.sel.length) zoomTo(unionBox(S.sel.map((id) => worldBox(S.idx, id))), 8); }

// world point at the middle of the screen
export function viewCenter() {
  const r = vpRect();
  return { x: (r.width / 2 - S.px) / S.zoom, y: (r.height / 2 - S.py) / S.zoom };
}

function onWheel(e) {
  e.preventDefault();
  const r = vpRect();
  if (e.ctrlKey || e.metaKey) {
    const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025) * (e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 50 ? 4 : 1));
    zoomAt(e.clientX - r.left, e.clientY - r.top, S.zoom * k);
  } else {
    const m = e.deltaMode === 1 ? 16 : 1;
    if (e.shiftKey && !e.deltaX) S.px -= e.deltaY * m;
    else { S.px -= e.deltaX * m; S.py -= e.deltaY * m; }
    applyView();
  }
}

// two finger pinch on touch screens
function gestureZoom() {
  const pts = new Map();
  let start = null;
  VP.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      cancelDrag();
      const [a, b] = [...pts.values()];
      start = { d: Math.hypot(a.x - b.x, a.y - b.y), z: S.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, px: S.px, py: S.py };
    }
  }, true);
  VP.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && start) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = vpRect();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      S.px = start.px + (mx - start.mx);
      S.py = start.py + (my - start.my);
      zoomAt(mx - r.left, my - r.top, start.z * (d / start.d));
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) start = null; };
  VP.addEventListener('pointerup', up);
  VP.addEventListener('pointercancel', up);
}

/* ================= picking ================= */

const inSelection = (id) => S.sel.some((s) => s === id || isAncestor(S.idx, s, id));

export function hitAt(cx, cy, exclude) {
  for (const el of document.elementsFromPoint(cx, cy)) {
    if (!WORLD.contains(el) || el === WORLD) continue;
    const nel = el.closest('[data-id]');
    if (!nel) continue;
    const id = nel.dataset.id;
    if (exclude && exclude(id)) continue;
    const chain = chainOf(S.idx, id);
    if (!chain.length || chain.some((n) => n.locked || !n.visible)) continue;
    return id;
  }
  return null;
}

// Figma-like: a click picks the child of a top-level frame, or a sibling of
// what is already selected; Ctrl/Cmd picks the deepest layer.
export function pickTarget(hitId, deep = false) {
  const chain = chainOf(S.idx, hitId);
  let d = chain.length > 1 ? 1 : 0;
  if (S.sel.length) {
    const sp = parentOf(S.sel[0]);
    if (sp) {
      const k = chain.findIndex((n) => n.id === sp.id);
      if (k >= 0) d = Math.max(d, k + 1);
    }
  }
  if (deep) d = chain.length - 1;
  d = Math.min(d, chain.length - 1);
  return { node: chain[d], chain, topBg: chain.length === 1 && chain[0].type === 'frame' && chain[0].children.length > 0 };
}

// Frame under the pointer that would receive a new or dragged layer.
// While dragging, the dragged layers themselves are skipped.
function dropParentAt(cx, cy, exclude = inSelection) {
  const id = hitAt(cx, cy, exclude);
  if (!id) return null;
  const n = node(id);
  return n.type === 'frame' ? n : parentOf(id);
}

/* ================= pointer ================= */

function onDown(e) {
  if (e.pointerType === 'touch' && !e.isPrimary) return;
  const p = toWorld(e.clientX, e.clientY);
  closeMenus();

  if (S.editing) {
    const el = R.el(S.editing);
    if (el && el.contains(e.target)) return;
    commitEdit();
  }

  if (e.button === 1 || (e.button === 0 && (S.space || S.tool === 'hand'))) {
    e.preventDefault();
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: S.px, py: S.py };
    VP.classList.add('panning');
    return;
  }
  if (e.button !== 0) return;
  VP.setPointerCapture?.(e.pointerId);

  const moveTool = S.tool === 'move';
  const handle = moveTool && e.target.dataset?.handle;
  if (handle) { e.preventDefault(); return startResize(e, p, handle); }

  const label = moveTool && e.target.dataset?.label;
  if (label) {
    if (e.shiftKey) select(S.sel.includes(label) ? S.sel.filter((i) => i !== label) : [...S.sel, label]);
    else if (!S.sel.includes(label)) select([label]);
    return startMove(e, p);
  }

  switch (S.tool) {
    case 'move': return moveDown(e, p);
    case 'pen': return penDown(e, p);
    case 'pencil': pencil = { pts: [p], parent: dropParentAt(e.clientX, e.clientY, null) }; drag = { kind: 'pencil' }; return;
    case 'frame': case 'rect': case 'ellipse': case 'line': case 'arrow': case 'polygon': case 'star': case 'text':
      return startDraw(e, p, S.tool);
    default: return moveDown(e, p);
  }
}

function moveDown(e, p) {
  const hitId = hitAt(e.clientX, e.clientY);
  const selBox = S.sel.length ? unionBox(S.sel.map((id) => worldBox(S.idx, id))) : null;
  const inBox = selBox && p.x >= selBox.x && p.x <= selBox.x + selBox.w && p.y >= selBox.y && p.y <= selBox.y + selBox.h;

  if (!hitId) {
    if (inBox && S.sel.length > 1 && !e.shiftKey) return startMove(e, p);
    return startMarquee(e, p, null);
  }
  const t = pickTarget(hitId, e.ctrlKey || e.metaKey);
  if (t.topBg && !(e.ctrlKey || e.metaKey)) {
    if (inBox && S.sel.length && !S.sel.includes(t.node.id) && !e.shiftKey) return startMove(e, p);
    drag = { kind: 'framebg', frame: t.node, start: p, sx: e.clientX, sy: e.clientY, shift: e.shiftKey };
    return;
  }
  const id = t.node.id;
  if (e.shiftKey) {
    if (S.sel.includes(id)) { select(S.sel.filter((i) => i !== id)); return; }
    select([...S.sel, id]);
  } else if (!S.sel.includes(id)) {
    select([id]);
  }
  startMove(e, p);
}

function onMove(e) {
  const p = toWorld(e.clientX, e.clientY);
  lastPointer = { ...p, cx: e.clientX, cy: e.clientY };
  if (!drag) {
    if (pen) { drawOverlay(); return; }
    if (S.tool === 'move' && !S.editing && e.target && VP.contains(e.target)) {
      const hitId = hitAt(e.clientX, e.clientY);
      const h = hitId ? pickTarget(hitId, e.ctrlKey || e.metaKey).node.id : null;
      if (h !== S.hover) { S.hover = h; drawOverlay(); }
      else if (altDown) drawOverlay();
    }
    return;
  }
  switch (drag.kind) {
    case 'pan':
      S.px = drag.px + (e.clientX - drag.sx);
      S.py = drag.py + (e.clientY - drag.sy);
      applyView();
      break;
    case 'framebg':
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) {
        const f = drag.frame;
        startMarquee({ shiftKey: drag.shift }, drag.start, f);
        marqueeMove(p);
      }
      break;
    case 'marquee': marqueeMove(p); break;
    case 'move': moveMove(e, p); break;
    case 'resize': resizeMove(e, p); break;
    case 'rotate': rotateMove(e, p); break;
    case 'draw': drawMove(e, p); break;
    case 'pencil': {
      const last = pencil.pts[pencil.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) * S.zoom > 2) { pencil.pts.push(p); drawOverlay(); }
      break;
    }
  }
}

function onUp(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  VP.classList.remove('panning');
  switch (d.kind) {
    case 'framebg':
      if (d.shift) select(S.sel.includes(d.frame.id) ? S.sel.filter((i) => i !== d.frame.id) : [...S.sel, d.frame.id]);
      else select([d.frame.id]);
      break;
    case 'marquee': marquee = null; drawOverlay(); emit('sel'); break;
    case 'move':
      guides = [];
      if (d.moved) { end(); emit('doc'); } else drawOverlay();
      if (!d.moved && !e.shiftKey && S.sel.length > 1 && d.clickId) select([d.clickId]);
      break;
    case 'resize': case 'rotate':
      guides = []; end(); emit('doc'); break;
    case 'draw': drawUp(d); break;
    case 'pencil': finishPencil(); break;
  }
}

export function cancelDrag() {
  if (!drag) return;
  if (['move', 'resize', 'rotate', 'draw'].includes(drag.kind)) { end(); }
  drag = null; marquee = null; guides = []; pencil = null;
  VP.classList.remove('panning');
  drawOverlay();
}

/* ================= marquee ================= */

function startMarquee(e, p, scope) {
  drag = { kind: 'marquee', start: p, scope, base: e.shiftKey ? [...S.sel] : [] };
  if (!e.shiftKey && S.sel.length) select([]);
}

function marqueeMove(p) {
  const a = drag.start;
  marquee = { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) };
  const list = listOf(S.doc, drag.scope);
  const hits = list.filter((n) => n.visible && !n.locked).filter((n) => {
    const b = worldBox(S.idx, n.id);
    return b.x < marquee.x + marquee.w && b.x + b.w > marquee.x && b.y < marquee.y + marquee.h && b.y + b.h > marquee.y;
  }).map((n) => n.id);
  S.sel = [...new Set([...drag.base, ...hits])];
  drawOverlay();
  emit('selpreview');
}

/* ================= move ================= */

function startMove(e, p) {
  const hitId = hitAt(e.clientX, e.clientY);
  drag = { kind: 'move', start: p, sx: e.clientX, sy: e.clientY, moved: false, alt: e.altKey, clickId: hitId ? pickTarget(hitId).node.id : null };
}

function moveMove(e, p) {
  if (!S.sel.length) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    drag.moved = true;
    begin();
    // lock-free top-level selection only (drop children whose parent is also selected)
    S.sel = S.sel.filter((id) => !S.sel.some((o) => o !== id && isAncestor(S.idx, o, id)));
    if (drag.alt) duplicateInPlace();
    drag.items = S.sel.map((id) => ({ id, w: worldPos(S.idx, id) }));
    drag.box = unionBox(S.sel.map((id) => worldBox(S.idx, id)));
    drag.from = parentOf(S.sel[0]);
  }
  let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }

  let target = dropParentAt(e.clientX, e.clientY);
  // inside an auto layout parent, dragging reorders instead of nesting
  const cur = parentOf(S.sel[0]);
  if (isFlex(cur) && !(e.ctrlKey || e.metaKey)) {
    const b = worldBox(S.idx, cur.id);
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) target = cur;
  }
  if (target && S.sel.includes(target.id)) target = parentOf(target.id);

  guides = [];
  if (isFlex(target)) {
    placeInFlex(target, p);
  } else {
    if (S.snap && !(e.ctrlKey || e.metaKey)) [dx, dy] = snapMove(drag.box, dx, dy, target);
    for (const it of drag.items) {
      const n = node(it.id);
      if ((parentOf(it.id)?.id || null) !== (target?.id || null)) {
        remove(S.doc, S.idx, it.id);
        insert(S.doc, n, target);
        reindex();
      }
      const pw = target ? worldPos(S.idx, target.id) : { x: 0, y: 0 };
      n.x = Math.round(it.w.x + dx - pw.x);
      n.y = Math.round(it.w.y + dy - pw.y);
    }
  }
  live(() => {});
}

function placeInFlex(target, p) {
  const main = target.layout.mode === 'row' ? 'x' : 'y';
  const size = main === 'x' ? 'w' : 'h';
  const tw = worldPos(S.idx, target.id);
  const moving = drag.items.map((it) => node(it.id));
  const others = target.children.filter((c) => !moving.includes(c));
  let pos = 0;
  others.forEach((c, i) => {
    if (!c.visible) return;
    const center = tw[main] + c[main] + c[size] / 2;
    if (target.layout.wrap) {
      const cross = main === 'x' ? 'y' : 'x', csize = main === 'x' ? 'h' : 'w';
      if (p[cross] > tw[cross] + c[cross] + c[csize] || (p[cross] >= tw[cross] + c[cross] && p[main] > center)) pos = i + 1;
    } else if (p[main] > center) pos = i + 1;
  });
  const next = [...others];
  next.splice(pos, 0, ...moving);
  const same = next.length === target.children.length && next.every((c, i) => c === target.children[i]);
  if (same) return;
  for (const m of moving) { if (parentOf(m.id)?.id !== target.id) { remove(S.doc, S.idx, m.id); } }
  target.children = next;
  reindex();
}

function snapMove(box, dx, dy, target) {
  const th = 6 / S.zoom;
  const others = listOf(S.doc, target).filter((c) => c.visible && !S.sel.includes(c.id));
  const boxes = others.map((c) => worldBox(S.idx, c.id));
  if (target) boxes.push(worldBox(S.idx, target.id));
  const best = (cands, mine) => {
    let b = null;
    for (const c of cands) for (const m of mine) {
      const d = c - m;
      if (Math.abs(d) <= th && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, c };
    }
    return b;
  };
  const xs = boxes.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w]);
  const ys = boxes.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h]);
  const bx = best(xs, [box.x + dx, box.x + dx + box.w / 2, box.x + dx + box.w]);
  const by = best(ys, [box.y + dy, box.y + dy + box.h / 2, box.y + dy + box.h]);
  if (bx) dx += bx.d;
  if (by) dy += by.d;
  const mb = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
  const near = (v, b, axis) => (axis === 'x' ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h]).some((q) => Math.abs(q - v) < 0.5);
  if (bx) {
    const ms = boxes.filter((b) => near(bx.c, b, 'x')).concat([mb]);
    guides.push({ x1: bx.c, x2: bx.c, y1: Math.min(...ms.map((b) => b.y)), y2: Math.max(...ms.map((b) => b.y + b.h)) });
  }
  if (by) {
    const ms = boxes.filter((b) => near(by.c, b, 'y')).concat([mb]);
    guides.push({ y1: by.c, y2: by.c, x1: Math.min(...ms.map((b) => b.x)), x2: Math.max(...ms.map((b) => b.x + b.w)) });
  }
  return [dx, dy];
}

function duplicateInPlace() {
  const copies = [];
  for (const id of S.sel) {
    const n = node(id);
    const p = parentOf(id);
    const list = listOf(S.doc, p);
    const c = structuredClone(n);
    walk([c], (m) => { m.id = 'n' + Math.random().toString(36).slice(2, 9); });
    list.splice(list.indexOf(n) + 1, 0, c);
    copies.push(c.id);
  }
  reindex();
  S.sel = copies;
  R.render();
  emit('sel');
}

/* ================= resize / rotate ================= */

function startResize(e, p, handle) {
  if (!S.sel.length) return;
  begin();
  if (handle === 'rot') {
    const id = S.sel[0];
    const b = worldBox(S.idx, id);
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    drag = { kind: 'rotate', id, c, a0: Math.atan2(p.y - c.y, p.x - c.x), r0: node(id).rot };
    return;
  }
  if (S.sel.length === 1) {
    const n = node(S.sel[0]);
    const kids = new Map();
    if (n.children) walk(n.children, (m) => { kids.set(m.id, { x: m.x, y: m.y, w: m.w, h: m.h }); });
    drag = { kind: 'resize', handle, start: p, id: n.id, o: { x: n.x, y: n.y, w: n.w, h: n.h }, rot: n.rot, kids, shiftDown: e.shiftKey };
    if (n.type === 'text') {
      if (/[ns]/.test(handle)) n.textSize = 'fixed';
      else if (n.textSize === 'autoW') n.textSize = 'autoH';
    }
  } else {
    const items = S.sel.map((id) => ({ id, wb: worldBox(S.idx, id), pw: parentOf(id) ? worldPos(S.idx, parentOf(id).id) : { x: 0, y: 0 } }));
    drag = { kind: 'resize', handle, start: p, multi: true, items, o: unionBox(items.map((i) => i.wb)), rot: 0 };
  }
}

function resizeBox(o, h, ldx, ldy, shift, alt) {
  let l = 0, t = 0, r = o.w, b = o.h;
  if (h.includes('e')) r += ldx;
  if (h.includes('w')) l += ldx;
  if (h.includes('s')) b += ldy;
  if (h.includes('n')) t += ldy;
  if (alt) {
    if (h.includes('e')) l -= ldx;
    if (h.includes('w')) r -= ldx;
    if (h.includes('s')) t -= ldy;
    if (h.includes('n')) b -= ldy;
  }
  if (shift && o.w && o.h) {
    const ratio = o.w / o.h;
    let nw = Math.abs(r - l), nh = Math.abs(b - t);
    const corner = h.length === 2;
    if (corner) { if (nw / ratio > nh) nh = nw / ratio; else nw = nh * ratio; }
    else if (h === 'e' || h === 'w') nh = nw / ratio;
    else nw = nh * ratio;
    if (alt || !corner) {
      if (!h.includes('e') && !h.includes('w') || alt) { const cx = (l + r) / 2; l = cx - nw / 2; r = cx + nw / 2; }
      if (!h.includes('n') && !h.includes('s') || alt) { const cy = (t + b) / 2; t = cy - nh / 2; b = cy + nh / 2; }
    }
    if (!alt) {
      if (h.includes('e')) r = l + nw; else if (h.includes('w')) l = r - nw;
      if (h.includes('s')) b = t + nh; else if (h.includes('n')) t = b - nh;
    }
  }
  if (r - l < 1) { if (h.includes('w')) l = r - 1; else r = l + 1; }
  if (b - t < 1) { if (h.includes('n')) t = b - 1; else b = t + 1; }
  return { l, t, r, b };
}

function resizeMove(e, p) {
  const d = drag;
  const dxw = p.x - d.start.x, dyw = p.y - d.start.y;
  const a = (-d.rot * Math.PI) / 180;
  const ldx = dxw * Math.cos(a) - dyw * Math.sin(a);
  const ldy = dxw * Math.sin(a) + dyw * Math.cos(a);
  const bx = resizeBox(d.o, d.handle, ldx, ldy, e.shiftKey, e.altKey);

  if (d.multi) {
    const nb = { x: d.o.x + bx.l, y: d.o.y + bx.t, w: bx.r - bx.l, h: bx.b - bx.t };
    const kx = nb.w / d.o.w, ky = nb.h / d.o.h;
    for (const it of d.items) {
      const n = node(it.id);
      const ow = n.w, oh = n.h;
      n.w = Math.max(1, Math.round(it.wb.w * kx));
      n.h = Math.max(1, Math.round(it.wb.h * ky));
      if (!isFlex(parentOf(it.id))) {
        n.x = Math.round(nb.x + (it.wb.x - d.o.x) * kx - it.pw.x);
        n.y = Math.round(nb.y + (it.wb.y - d.o.y) * ky - it.pw.y);
      }
      fixSizing(n);
      if (n.type === 'frame') applyConstraints(n, ow, oh);
    }
    live(() => {});
    return;
  }

  const n = node(d.id);
  const nw = Math.max(1, Math.round(bx.r - bx.l)), nh = Math.max(1, Math.round(bx.b - bx.t));
  const cxl = (bx.l + bx.r) / 2 - d.o.w / 2, cyl = (bx.t + bx.b) / 2 - d.o.h / 2;
  const rr = (d.rot * Math.PI) / 180;
  const cx = d.o.x + d.o.w / 2 + cxl * Math.cos(rr) - cyl * Math.sin(rr);
  const cy = d.o.y + d.o.h / 2 + cxl * Math.sin(rr) + cyl * Math.cos(rr);
  const wChanged = /[ew]/.test(d.handle), hChanged = /[ns]/.test(d.handle);
  if (wChanged) n.w = nw;
  if (hChanged) n.h = nh;
  if (!isFlex(parentOf(n.id))) {
    n.x = Math.round(cx - n.w / 2);
    n.y = Math.round(cy - n.h / 2);
  }
  if (wChanged && n.sizeW !== 'fixed') n.sizeW = 'fixed';
  if (hChanged && n.sizeH !== 'fixed') n.sizeH = 'fixed';
  if (n.children && d.kids.size) {
    walk(n.children, (m) => { const k = d.kids.get(m.id); if (k) Object.assign(m, k); });
    applyConstraints(n, d.o.w, d.o.h);
  }
  live(() => {});
}

function fixSizing(n) {
  if (n.sizeW !== 'fixed') n.sizeW = 'fixed';
  if (n.sizeH !== 'fixed') n.sizeH = 'fixed';
  if (n.type === 'text') n.textSize = 'fixed';
}

function rotateMove(e, p) {
  const d = drag;
  const a = Math.atan2(p.y - d.c.y, p.x - d.c.x);
  let deg = d.r0 + ((a - d.a0) * 180) / Math.PI;
  if (e.shiftKey) deg = Math.round(deg / 15) * 15;
  deg = ((deg + 540) % 360) - 180;
  node(d.id).rot = Math.round(deg * 10) / 10;
  live(() => {});
}

/* ================= draw tools ================= */

const TYPE = { frame: 'frame', rect: 'rect', ellipse: 'ellipse', text: 'text', line: 'path', arrow: 'path', polygon: 'path', star: 'path' };
const NAME = { frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', text: 'Text', line: 'Line', arrow: 'Arrow', polygon: 'Polygon', star: 'Star' };

export function nextName(base) {
  let max = 0;
  walk(S.doc.children, (n) => {
    const m = String(n.name).match(new RegExp('^' + base + ' (\\d+)$'));
    if (m) max = Math.max(max, +m[1]);
  });
  return `${base} ${max + 1}`;
}

function startDraw(e, p, tool) {
  const parent = dropParentAt(e.clientX, e.clientY, null);
  begin();
  const props = { name: nextName(NAME[tool]) };
  if (tool === 'polygon' || tool === 'star') Object.assign(props, { fill: { type: 'solid', color: '#D9D9D9' }, stroke: { enabled: false } });
  if (tool === 'text') props.text = '';
  const n = makeNode(TYPE[tool], props);
  const pw = parent ? worldPos(S.idx, parent.id) : { x: 0, y: 0 };
  n.x = Math.round(p.x - pw.x);
  n.y = Math.round(p.y - pw.y);
  if (tool !== 'text') { n.w = 1; n.h = 1; }
  if (tool === 'frame' && parent) n.fill.color = '#FFFFFF';
  insert(S.doc, n, parent);
  reindex();
  drag = { kind: 'draw', tool, id: n.id, a: p, pw, sx: e.clientX, sy: e.clientY, moved: false };
  if (tool !== 'text') { S.sel = [n.id]; }
  live(() => {});
}

function shapePath(n, tool, a, b) {
  if (tool === 'polygon') { n.d = polygonPath(3, n.w, n.h); n.vw = n.w; n.vh = n.h; }
  else if (tool === 'star') { n.d = starPath(5, n.w, n.h); n.vw = n.w; n.vh = n.h; }
  else if (tool === 'line' || tool === 'arrow') {
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    n.vw = Math.max(1, n.w); n.vh = Math.max(1, n.h);
    const ax = r2(a.x - x0), ay = r2(a.y - y0), bx = r2(b.x - x0), by = r2(b.y - y0);
    n.d = `M${ax} ${ay} L${bx} ${by}`;
    if (tool === 'arrow') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 12;
      const p1 = [bx - L * Math.cos(ang - 0.5), by - L * Math.sin(ang - 0.5)];
      const p2 = [bx - L * Math.cos(ang + 0.5), by - L * Math.sin(ang + 0.5)];
      n.d += ` M${r2(p1[0])} ${r2(p1[1])} L${bx} ${by} L${r2(p2[0])} ${r2(p2[1])}`;
    }
  }
}

function drawMove(e, p) {
  const d = drag;
  if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
  d.moved = true;
  const n = node(d.id);
  const a = d.a;
  let b = { ...p };
  if (d.tool === 'line' || d.tool === 'arrow') {
    if (e.shiftKey) {
      const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      b = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    }
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    n.x = Math.round(x0 - d.pw.x); n.y = Math.round(y0 - d.pw.y);
    n.w = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    n.h = Math.max(1, Math.round(Math.abs(b.y - a.y)));
    shapePath(n, d.tool, a, b);
  } else {
    let dx = b.x - a.x, dy = b.y - a.y;
    if (e.shiftKey) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * s; dy = Math.sign(dy || 1) * s; }
    let x0 = a.x, y0 = a.y, x1 = a.x + dx, y1 = a.y + dy;
    if (e.altKey) { x0 = a.x - dx; y0 = a.y - dy; }
    n.x = Math.round(Math.min(x0, x1) - d.pw.x);
    n.y = Math.round(Math.min(y0, y1) - d.pw.y);
    n.w = Math.max(1, Math.round(Math.abs(x1 - x0)));
    n.h = Math.max(1, Math.round(Math.abs(y1 - y0)));
    if (d.tool === 'text') n.textSize = 'autoH';
    shapePath(n, d.tool, a, b);
  }
  live(() => {});
}

function drawUp(d) {
  const n = node(d.id);
  if (!n) { end(); return; }
  if (!d.moved) {
    const size = { frame: [400, 300], text: [0, 0] }[d.tool] || [100, 100];
    if (d.tool === 'line' || d.tool === 'arrow') {
      n.w = 120; n.h = 1;
      shapePath(n, d.tool, { x: 0, y: 0 }, { x: 120, y: 0 });
      n.vh = 1; n.d = n.d.replace(/ 0(?= |$)/g, ' 0.5');
    } else if (d.tool !== 'text') {
      n.w = size[0]; n.h = size[1];
      shapePath(n, d.tool);
    }
  }
  setTool('move');
  if (d.tool === 'text') {
    R.render();
    startEdit(n.id);
    return;
  }
  end();
  select([n.id]);
  emit('doc');
}

/* ================= pen & pencil ================= */

function penDown(e, p) {
  if (!pen) pen = { pts: [], parent: dropParentAt(e.clientX, e.clientY, null) };
  const pts = pen.pts;
  if (pts.length >= 2 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) * S.zoom < 9) return finishPen(true);
  if (e.shiftKey && pts.length) p = snap45(pts[pts.length - 1], p);
  const last = pts[pts.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.5) pts.push(p);
  drawOverlay();
}

function snap45(a, b) {
  const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
}

export function finishPen(closed = false) {
  if (!pen) return;
  const { pts, parent } = pen;
  pen = null;
  if (pts.length < 2) { drawOverlay(); return; }
  createPath(pts, closed, parent, (q) => q.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + (closed ? ' Z' : ''));
}

export const penActive = () => !!pen;
export function cancelPen() { pen = null; drawOverlay(); }

function finishPencil() {
  const pts = pencil?.pts || [];
  const parent = pencil?.parent || null;
  pencil = null;
  if (pts.length < 2) { drawOverlay(); return; }
  createPath(pts, false, parent, (q) => {
    if (q.length < 3) return `M${q[0][0]} ${q[0][1]} L${q[1][0]} ${q[1][1]}`;
    let d = `M${q[0][0]} ${q[0][1]}`;
    for (let i = 1; i < q.length - 1; i++) {
      const mx = r2((q[i][0] + q[i + 1][0]) / 2), my = r2((q[i][1] + q[i + 1][1]) / 2);
      d += ` Q${q[i][0]} ${q[i][1]} ${mx} ${my}`;
    }
    const l = q[q.length - 1];
    return d + ` L${l[0]} ${l[1]}`;
  });
}

function createPath(pts, closed, parent, toD) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - x0), h = Math.max(1, Math.max(...ys) - y0);
  const q = pts.map((p) => [r2(p.x - x0), r2(p.y - y0)]);
  const pw = parent ? worldPos(S.idx, parent.id) : { x: 0, y: 0 };
  const n = makeNode('path', {
    name: nextName(closed ? 'Shape' : 'Vector'),
    x: Math.round(x0 - pw.x), y: Math.round(y0 - pw.y), w: Math.round(w), h: Math.round(h), vw: r2(w), vh: r2(h), d: toD(q),
    fill: closed ? { type: 'solid', color: '#C7D2FE' } : { type: 'none' },
    stroke: { enabled: true, color: '#111111', width: 2 },
  });
  begin();
  insert(S.doc, n, parent);
  reindex();
  end();
  S.sel = [n.id];
  setTool('move');
  emit('doc');
  emit('sel');
}

/* ================= text editing ================= */

export function startEdit(id) {
  const n = node(id);
  if (!n || n.type !== 'text' || n.locked) return;
  const el = R.el(id);
  if (!el) return;
  begin();
  S.editing = id;
  S.sel = [id];
  emit('sel');
  try { el.contentEditable = 'plaintext-only'; } catch { /* older browsers */ }
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.classList.add('editing');
  el.spellcheck = false;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(range);
  el.oninput = () => {
    n.text = readText(el);
    R.measure();
    drawOverlay();
    emit('textinput');
  };
  el.onpaste = (ev) => {
    ev.preventDefault();
    document.execCommand('insertText', false, ev.clipboardData.getData('text/plain'));
  };
  el.onblur = () => commitEdit();
  el.onkeydown = (ev) => {
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey))) { ev.preventDefault(); ev.stopPropagation(); commitEdit(); }
  };
  drawOverlay();
}

const readText = (el) => el.innerText.replace(/\n$/, '');

export function commitEdit() {
  const id = S.editing;
  if (!id) return;
  S.editing = null;
  const el = R.el(id);
  const n = node(id);
  if (el) {
    el.oninput = el.onblur = el.onkeydown = el.onpaste = null;
    if (n) n.text = readText(el);
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el._text = null;
  }
  if (n && !n.text.trim()) {
    remove(S.doc, S.idx, id);
    S.sel = [];
  }
  reindex();
  end();
  emit('doc');
  emit('sel');
}

/* ================= tools ================= */

export function setTool(t) {
  if (pen && t !== 'pen') finishPen(false);
  S.tool = t;
  VP.dataset.tool = t;
  emit('tool');
}

function onDbl(e) {
  if (S.tool === 'pen') { finishPen(false); return; }
  if (S.tool !== 'move') return;
  const hitId = hitAt(e.clientX, e.clientY);
  if (!hitId) return;
  const t = pickTarget(hitId);
  if (t.node.type === 'text') { startEdit(t.node.id); return; }
  const k = t.chain.indexOf(t.node);
  const next = t.chain[k + 1];
  if (S.sel.includes(t.node.id) && next) {
    select([next.id]);
  } else if (t.topBg) {
    select([t.node.id]);
  }
}

function onContext(e) {
  e.preventDefault();
  const hitId = hitAt(e.clientX, e.clientY);
  if (hitId) {
    const t = pickTarget(hitId, e.ctrlKey || e.metaKey);
    if (!S.sel.includes(t.node.id)) select([t.node.id]);
  }
  emit('contextmenu', e.clientX, e.clientY);
}

function closeMenus() { emit('closemenus'); }

/* ================= overlay ================= */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function screenBox(id) {
  const n = node(id);
  const wp = worldPos(S.idx, id);
  const s = toScreen(wp.x, wp.y);
  return { x: s.x, y: s.y, w: n.w * S.zoom, h: n.h * S.zoom, rot: n.rot || 0 };
}

const boxStyle = (b) => `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;${b.rot ? `transform:rotate(${b.rot}deg);` : ''}`;
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function handlesHTML(withRot) {
  return ['n', 'e', 's', 'w'].map((h) => `<b class="edge edge-${h}" data-handle="${h}"></b>`).join('')
    + HANDLES.filter((h) => h.length === 2).map((h) => `<i class="hd hd-${h}" data-handle="${h}"></i>`).join('')
    + (withRot ? ['nw', 'ne', 'se', 'sw'].map((h) => `<u class="rz rz-${h}" data-handle="rot"></u>`).join('') : '');
}

export function drawOverlay() {
  if (!OV) return;
  const out = [];
  const z = S.zoom;

  // frame name labels
  for (const n of S.doc.children) {
    if (n.type !== 'frame' || !n.visible) continue;
    const s = toScreen(n.x, n.y);
    const on = S.sel.includes(n.id) || S.hover === n.id;
    out.push(`<div class="ov-label${on ? ' on' : ''}" data-label="${n.id}" style="left:${s.x}px;top:${s.y - 20}px;max-width:${Math.max(40, n.w * z)}px">${esc(n.name)}</div>`);
  }

  if (S.hover && node(S.hover) && !S.sel.includes(S.hover) && !drag) {
    out.push(`<div class="ov-box ov-hover" style="${boxStyle(screenBox(S.hover))}"></div>`);
  }

  const busy = drag && (drag.kind === 'move' && drag.moved);
  if (S.sel.length === 1 && node(S.sel[0])) {
    const id = S.sel[0];
    const n = node(id);
    const b = screenBox(id);
    const editing = S.editing === id;
    const showHandles = !editing && !busy && !n.locked && S.tool === 'move';
    out.push(`<div class="ov-box ov-sel${n.type === 'frame' && isFlex(n) ? ' flex' : ''}" style="${boxStyle(b)}">${showHandles ? handlesHTML(true) : ''}${!editing ? `<span class="ov-size">${Math.round(n.w)} × ${Math.round(n.h)}${isFlex(parentOf(id)) || isFlex(n) ? '<em>auto</em>' : ''}</span>` : ''}</div>`);
  } else if (S.sel.length > 1) {
    const boxes = S.sel.filter(node).map((id) => worldBox(S.idx, id));
    for (const id of S.sel) if (node(id)) out.push(`<div class="ov-box ov-sel thin" style="${boxStyle(screenBox(id))}"></div>`);
    const u = unionBox(boxes);
    if (u) {
      const s = toScreen(u.x, u.y);
      const b = { x: s.x, y: s.y, w: u.w * z, h: u.h * z };
      out.push(`<div class="ov-box ov-sel" style="${boxStyle(b)}">${!busy && S.tool === 'move' ? handlesHTML(false) : ''}<span class="ov-size">${Math.round(u.w)} × ${Math.round(u.h)}</span></div>`);
    }
  }

  // spacing redlines while Alt is held
  if (altDown && S.sel.length && S.hover && !S.sel.includes(S.hover) && node(S.hover)) {
    out.push(measureHTML(unionBox(S.sel.map((id) => worldBox(S.idx, id))), worldBox(S.idx, S.hover)));
  }

  if (marquee) {
    const s = toScreen(marquee.x, marquee.y);
    out.push(`<div class="ov-marquee" style="left:${s.x}px;top:${s.y}px;width:${marquee.w * z}px;height:${marquee.h * z}px"></div>`);
  }

  if (guides.length) {
    const lines = guides.map((g) => {
      const a = toScreen(g.x1, g.y1), b = toScreen(g.x2, g.y2);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }).join('');
    out.push(`<svg class="ov-guides">${lines}</svg>`);
  }

  if (pen && pen.pts.length) {
    const pts = pen.pts.map((p) => toScreen(p.x, p.y));
    const cur = toScreen(lastPointer.x, lastPointer.y);
    const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const close = pts.length >= 2 && Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) < 9;
    out.push(`<svg class="ov-pen"><polyline points="${poly} ${cur.x},${cur.y}"/>${pts.map((p, i) => `<rect x="${p.x - 3.5}" y="${p.y - 3.5}" width="7" height="7" class="${i === 0 && close ? 'hot' : ''}"/>`).join('')}</svg>`);
  }
  if (pencil && pencil.pts.length > 1) {
    const pts = pencil.pts.map((p) => toScreen(p.x, p.y)).map((p) => `${p.x},${p.y}`).join(' ');
    out.push(`<svg class="ov-pen"><polyline points="${pts}"/></svg>`);
  }

  OV.innerHTML = out.join('');
}

function measureHTML(a, b) {
  const z = S.zoom;
  const parts = [];
  const line = (x1, y1, x2, y2, label) => {
    const p = toScreen(x1, y1), q = toScreen(x2, y2);
    parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`);
    if (label > 0) parts.push(`<foreignObject x="${(p.x + q.x) / 2 - 30}" y="${(p.y + q.y) / 2 - 10}" width="60" height="20"><div class="ov-dist">${Math.round(label)}</div></foreignObject>`);
  };
  const inside = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  const cy = a.y + a.h / 2, cx = a.x + a.w / 2;
  if (inside) {
    line(b.x, cy, a.x, cy, a.x - b.x);
    line(a.x + a.w, cy, b.x + b.w, cy, b.x + b.w - a.x - a.w);
    line(cx, b.y, cx, a.y, a.y - b.y);
    line(cx, a.y + a.h, cx, b.y + b.h, b.y + b.h - a.y - a.h);
  } else {
    if (b.x >= a.x + a.w) line(a.x + a.w, cy, b.x, cy, b.x - a.x - a.w);
    else if (b.x + b.w <= a.x) line(b.x + b.w, cy, a.x, cy, a.x - b.x - b.w);
    if (b.y >= a.y + a.h) line(cx, a.y + a.h, cx, b.y, b.y - a.y - a.h);
    else if (b.y + b.h <= a.y) line(cx, b.y + b.h, cx, a.y, a.y - b.y - b.h);
  }
  const s = toScreen(b.x, b.y);
  return `<div class="ov-box ov-measure" style="left:${s.x}px;top:${s.y}px;width:${b.w * z}px;height:${b.h * z}px"></div><svg class="ov-guides measure">${parts.join('')}</svg>`;
}
