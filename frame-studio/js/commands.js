// Things you do to the selection: clipboard, group, auto layout, align,
// arrange, hide, lock, insert. Each is one undo step.

import { S, change, node, parentOf, select, emit, selNodes, reindex } from './state.js';
import {
  makeNode, isFlex, worldPos, worldBox, unionBox, remove, insert, listOf, cloneWithNewIds, isAncestor,
} from './model.js';
import { viewCenter, zoomTo, nextName } from './editor.js';

const MARK = 'frame-studio/v1';

// keep only the top-most of selected nodes (no node whose ancestor is selected)
export const topSel = () => S.sel.filter((id) => !S.sel.some((o) => o !== id && isAncestor(S.idx, o, id)));

export function deleteSel() {
  if (!S.sel.length) return;
  change(() => { for (const id of topSel()) remove(S.doc, S.idx, id); S.sel = []; });
  emit('sel');
}

export function duplicateSel() {
  if (!S.sel.length) return;
  const out = [];
  change(() => {
    for (const id of topSel()) {
      const n = node(id), p = parentOf(id);
      const c = cloneWithNewIds(n);
      if (!p && n.type === 'frame') c.x += n.w + 80; else if (!isFlex(p)) { c.x += 16; c.y += 16; }
      const list = listOf(S.doc, p);
      list.splice(list.indexOf(n) + 1, 0, c);
      out.push(c.id);
    }
  });
  select(out);
}

export function copySel(e) {
  if (!S.sel.length) return false;
  const items = topSel().map((id) => ({ node: structuredClone(node(id)), pos: worldPos(S.idx, id), parent: parentOf(id)?.id || null }));
  const assets = {};
  for (const it of items) collectAssets(it.node, assets);
  S.clipboard = { items, assets };
  const text = JSON.stringify({ [MARK]: true, items, assets });
  if (e?.clipboardData) { e.clipboardData.setData('text/plain', text); e.preventDefault(); }
  else navigator.clipboard?.writeText(text).catch(() => {});
  return true;
}

export function cutSel(e) { if (copySel(e)) deleteSel(); }

function collectAssets(n, out) {
  if (n.type === 'image' && n.src && S.doc.assets[n.src]) out[n.src] = S.doc.assets[n.src];
  (n.children || []).forEach((c) => collectAssets(c, out));
}

export function parseClip(text) {
  try { const d = JSON.parse(text); if (d && d[MARK]) return d; } catch { /* not ours */ }
  return null;
}

export function paste(clip = S.clipboard) {
  if (!clip || !clip.items?.length) return;
  Object.assign(S.doc.assets, clip.assets || {});
  // target: a selected frame (not one we are pasting), else the source parent, else root
  let target = null;
  const one = S.sel.length === 1 ? node(S.sel[0]) : null;
  if (one && one.type === 'frame' && !clip.items.some((it) => it.node.id === one.id)) target = one;
  else if (one) target = parentOf(one.id);
  else if (clip.items[0].parent && node(clip.items[0].parent)) target = node(clip.items[0].parent);

  const out = [];
  change(() => {
    const tb = target ? worldBox(S.idx, target.id) : null;
    const u = unionBox(clip.items.map((it) => ({ x: it.pos.x, y: it.pos.y, w: it.node.w, h: it.node.h })));
    let ox = 0, oy = 0;
    if (tb) {
      const inside = u.x >= tb.x && u.y >= tb.y && u.x + u.w <= tb.x + tb.w && u.y + u.h <= tb.y + tb.h;
      if (!inside) { ox = tb.x + (tb.w - u.w) / 2 - u.x; oy = tb.y + (tb.h - u.h) / 2 - u.y; }
    } else {
      // root: keep position unless it is off screen
      const c = viewCenter();
      const far = Math.abs(u.x + u.w / 2 - c.x) > 3000 || Math.abs(u.y + u.h / 2 - c.y) > 3000;
      if (far) { ox = c.x - u.x - u.w / 2; oy = c.y - u.y - u.h / 2; }
    }
    const pw = tb ? { x: tb.x, y: tb.y } : { x: 0, y: 0 };
    for (const it of clip.items) {
      const c = cloneWithNewIds(it.node);
      c.x = Math.round(it.pos.x + ox - pw.x);
      c.y = Math.round(it.pos.y + oy - pw.y);
      insert(S.doc, c, target);
      out.push(c.id);
    }
  });
  select(out);
}

// Insert ready-made nodes (blocks, templates, images) where it makes sense.
export function insertNodes(nodes, { asFrames = false, at = null } = {}) {
  const out = [];
  let target = null;
  const one = S.sel.length === 1 ? node(S.sel[0]) : null;
  if (!asFrames && one) target = one.type === 'frame' ? one : parentOf(one.id);
  change(() => {
    if (asFrames || !target) {
      const roots = S.doc.children.filter((n) => n.visible);
      let x, y;
      if (asFrames && roots.length) {
        const u = unionBox(roots.map((n) => worldBox(S.idx, n.id)));
        x = u.x + u.w + 120; y = u.y;
      } else {
        const c = at || viewCenter();
        const w = Math.max(...nodes.map((n) => n.w)), h = Math.max(...nodes.map((n) => n.h));
        x = c.x - w / 2; y = c.y - h / 2;
      }
      for (const n of nodes) { n.x = Math.round(x); n.y = Math.round(y); insert(S.doc, n, null); out.push(n.id); x += n.w + 80; }
    } else {
      for (const n of nodes) {
        if (!isFlex(target)) {
          n.x = Math.max(0, Math.round((target.w - n.w) / 2));
          n.y = Math.max(0, Math.round((target.h - n.h) / 2));
        }
        insert(S.doc, n, target);
        out.push(n.id);
      }
    }
  });
  select(out);
  if (asFrames) zoomTo(unionBox(out.map((id) => worldBox(S.idx, id))), 1);
}

/* ---------- group / frame / auto layout ---------- */

function sameParentSel() {
  const ids = topSel();
  if (!ids.length) return null;
  const p = parentOf(ids[0]);
  if (!ids.every((id) => parentOf(id) === p)) return null;
  return { ids, parent: p };
}

export function wrapSel(kind = 'group') {
  const g = sameParentSel();
  if (!g) return;
  const { ids, parent } = g;
  let wrap;
  change(() => {
    const list = listOf(S.doc, parent);
    const nodes = ids.map(node).sort((a, b) => list.indexOf(a) - list.indexOf(b));
    const u = unionBox(nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })));
    const at = list.indexOf(nodes[0]);
    wrap = makeNode('frame', {
      name: kind === 'group' ? nextName('Group') : nextName('Frame'),
      x: Math.round(u.x), y: Math.round(u.y), w: Math.round(u.w), h: Math.round(u.h),
    });
    if (kind === 'group') { wrap.fill.type = 'none'; wrap.clip = false; }
    for (const n of nodes) { remove(S.doc, S.idx, n.id); n.x -= wrap.x; n.y -= wrap.y; }
    wrap.children = nodes;
    if (kind === 'auto') setupAutoLayout(wrap, true);
    list.splice(Math.min(at, list.length), 0, wrap);
  });
  select([wrap.id]);
}

export function ungroupSel() {
  const out = [];
  change(() => {
    for (const id of topSel()) {
      const g = node(id);
      if (g.type !== 'frame' || !g.children.length) continue;
      const p = parentOf(id);
      const list = listOf(S.doc, p);
      const at = list.indexOf(g);
      const kids = g.children;
      list.splice(at, 1, ...kids);
      for (const k of kids) { k.x += g.x; k.y += g.y; out.push(k.id); }
    }
  });
  if (out.length) select(out);
}

// Turn a frame's free-form children into an auto layout that looks the same.
export function setupAutoLayout(f, wrapping = false) {
  const kids = f.children.filter((c) => c.visible);
  const L = f.layout;
  if (!kids.length) { L.mode = 'column'; f.sizeW = 'fixed'; f.sizeH = 'hug'; return; }
  const spreadX = Math.max(...kids.map((c) => c.x + c.w)) - Math.min(...kids.map((c) => c.x));
  const spreadY = Math.max(...kids.map((c) => c.y + c.h)) - Math.min(...kids.map((c) => c.y));
  const sumW = kids.reduce((a, c) => a + c.w, 0), sumH = kids.reduce((a, c) => a + c.h, 0);
  const row = kids.length > 1 ? spreadX - sumW > spreadY - sumH || spreadX > spreadY : f.w > f.h;
  L.mode = row ? 'row' : 'column';
  const key = row ? 'x' : 'y', size = row ? 'w' : 'h';
  f.children.sort((a, b) => a[key] - b[key]);
  const ordered = f.children.filter((c) => c.visible);
  let gap = 0;
  if (ordered.length > 1) {
    const gaps = [];
    for (let i = 1; i < ordered.length; i++) gaps.push(ordered[i][key] - (ordered[i - 1][key] + ordered[i - 1][size]));
    gap = Math.max(0, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
  }
  L.gap = gap;
  const minX = Math.min(...kids.map((c) => c.x)), minY = Math.min(...kids.map((c) => c.y));
  const maxX = Math.max(...kids.map((c) => c.x + c.w)), maxY = Math.max(...kids.map((c) => c.y + c.h));
  if (wrapping) { L.pt = L.pb = L.pl = L.pr = 0; }
  else {
    L.pl = Math.max(0, Math.round(minX)); L.pt = Math.max(0, Math.round(minY));
    L.pr = Math.max(0, Math.round(f.w - maxX)); L.pb = Math.max(0, Math.round(f.h - maxY));
  }
  L.align = 'start';
  L.justify = 'start';
  f.sizeW = 'hug'; f.sizeH = 'hug';
}

export function toggleAutoLayout() {
  const ns = selNodes();
  if (!ns.length) return;
  if (ns.length === 1 && ns[0].type === 'frame') {
    const f = ns[0];
    change(() => {
      if (isFlex(f)) { f.layout.mode = 'none'; f.sizeW = 'fixed'; f.sizeH = 'fixed'; }
      else setupAutoLayout(f);
    });
    emit('sel');
    return;
  }
  wrapSel('auto');
}

/* ---------- arrange ---------- */

export function arrange(dir) { // front | back | forward | backward
  change(() => {
    for (const id of topSel()) {
      const list = listOf(S.doc, parentOf(id));
      const n = node(id);
      const i = list.indexOf(n);
      list.splice(i, 1);
      const j = dir === 'front' ? list.length : dir === 'back' ? 0 : dir === 'forward' ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
      list.splice(j, 0, n);
    }
  });
}

export function align(how) {
  const ids = topSel().filter((id) => !isFlex(parentOf(id)));
  if (!ids.length) return;
  let ref;
  if (ids.length === 1) {
    const p = parentOf(ids[0]);
    if (!p) return;
    ref = worldBox(S.idx, p.id);
  } else ref = unionBox(ids.map((id) => worldBox(S.idx, id)));
  change(() => {
    for (const id of ids) {
      const n = node(id), b = worldBox(S.idx, id);
      let dx = 0, dy = 0;
      if (how === 'left') dx = ref.x - b.x;
      if (how === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (how === 'right') dx = ref.x + ref.w - (b.x + b.w);
      if (how === 'top') dy = ref.y - b.y;
      if (how === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (how === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
      n.x = Math.round(n.x + dx); n.y = Math.round(n.y + dy);
    }
  });
}

export function distribute(axis) {
  const ids = topSel().filter((id) => !isFlex(parentOf(id)));
  if (ids.length < 3) return;
  const k = axis === 'h' ? 'x' : 'y', s = axis === 'h' ? 'w' : 'h';
  change(() => {
    const items = ids.map((id) => ({ n: node(id), b: worldBox(S.idx, id) })).sort((a, b) => a.b[k] - b.b[k]);
    const first = items[0].b, last = items[items.length - 1].b;
    const total = last[k] + last[s] - first[k];
    const used = items.reduce((a, it) => a + it.b[s], 0);
    const gap = (total - used) / (items.length - 1);
    let pos = first[k];
    for (const it of items) { it.n[k] = Math.round(it.n[k] + (pos - it.b[k])); pos += it.b[s] + gap; }
  });
}

export function nudge(dx, dy) {
  const ids = topSel().filter((id) => !node(id).locked);
  if (!ids.length) return;
  const flex = ids.filter((id) => isFlex(parentOf(id)));
  change(() => {
    for (const id of ids) {
      const n = node(id), p = parentOf(id);
      if (isFlex(p)) {
        // arrow keys reorder inside auto layout
        const fwd = (p.layout.mode === 'row' ? dx : dy) > 0, back = (p.layout.mode === 'row' ? dx : dy) < 0;
        const i = p.children.indexOf(n);
        if (fwd && i < p.children.length - 1) { p.children.splice(i, 1); p.children.splice(i + 1, 0, n); }
        if (back && i > 0) { p.children.splice(i, 1); p.children.splice(i - 1, 0, n); }
      } else { n.x += dx; n.y += dy; }
    }
  });
  return flex.length;
}

export function toggleProp(prop) {
  const ns = selNodes();
  if (!ns.length) return;
  const v = !ns.every((n) => n[prop]);
  change(() => { for (const n of ns) n[prop] = v; });
}

export function selectAll() {
  const p = S.sel.length ? parentOf(S.sel[0]) : null;
  select(listOf(S.doc, p).filter((n) => n.visible && !n.locked).map((n) => n.id));
}

export function selectParent() {
  if (!S.sel.length) return;
  const p = parentOf(S.sel[0]);
  select(p ? [p.id] : []);
}

export function selectChildren() {
  const ns = selNodes().filter((n) => n.children?.length);
  if (ns.length) select(ns.flatMap((n) => n.children.map((c) => c.id)));
}

export function renameSel(name) {
  if (!S.sel.length) return;
  change(() => { for (const n of selNodes()) n.name = name; });
}

// Mirror vector layers (path points are plain "x y" pairs).
export function flip(axis) {
  const ns = selNodes().filter((n) => n.type === 'path');
  if (!ns.length) return;
  change(() => {
    for (const n of ns) {
      n.d = n.d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => (axis === 'h' ? `${+(n.vw - x).toFixed(2)} ${y}` : `${x} ${+(n.vh - y).toFixed(2)}`));
    }
  });
}

export function addImageAsset(dataURL) {
  const id = 'a' + Math.random().toString(36).slice(2, 10);
  S.doc.assets[id] = dataURL;
  return id;
}

export function insertImage(dataURL, w, h, at) {
  const max = 800;
  const k = Math.min(1, max / Math.max(w, h));
  const n = makeNode('image', { name: nextName('Image'), w: Math.round(w * k), h: Math.round(h * k), src: addImageAsset(dataURL) });
  insertNodes([n], { at });
}

export function replaceImage(dataURL) {
  const ns = selNodes().filter((n) => n.type === 'image');
  if (!ns.length) return false;
  const id = addImageAsset(dataURL);
  change(() => { for (const n of ns) n.src = id; });
  return true;
}

export { reindex };
