// Editor state, a tiny event bus and undo / redo.

import { emptyDoc, makeIndex } from './model.js';

export const S = {
  doc: emptyDoc(),
  idx: new Map(),
  sel: [],
  tool: 'move',
  zoom: 1, px: 0, py: 0,
  editing: null,     // id of the text node being typed into
  hover: null,
  expanded: new Set(),
  snap: true,
  clipboard: null,
};

const handlers = {};
export const on = (ev, fn) => { (handlers[ev] ||= []).push(fn); };
export const emit = (ev, ...a) => { (handlers[ev] || []).forEach((f) => f(...a)); };

export function reindex() {
  S.idx = makeIndex(S.doc);
  const before = S.sel.length;
  S.sel = S.sel.filter((id) => S.idx.has(id));
  if (S.sel.length !== before) emit('sel');
}

export const node = (id) => S.idx.get(id)?.node || null;
export const parentOf = (id) => S.idx.get(id)?.parent || null;
export const selNodes = () => S.sel.map(node).filter(Boolean);

export function select(ids) {
  S.sel = [...new Set(ids)].filter((id) => S.idx.has(id));
  for (const id of S.sel) {
    let p = parentOf(id);
    while (p) { S.expanded.add(p.id); p = parentOf(p.id); }
  }
  emit('sel');
}

/* ---------- history ---------- */

const past = [];
const future = [];
let pending = null;
let pendingSel = null;

const snap = () => JSON.stringify({ name: S.doc.name, bg: S.doc.bg, children: S.doc.children });

export function begin() {
  if (pending == null) { pending = snap(); pendingSel = [...S.sel]; }
}

export function end() {
  if (pending == null) return;
  const now = snap();
  if (now !== pending) {
    past.push({ s: pending, sel: pendingSel });
    if (past.length > 300) past.shift();
    future.length = 0;
  }
  pending = null;
}

// Run a mutation as one undo step, then re-render.
export function change(fn) {
  begin();
  fn();
  reindex();
  end();
  emit('doc');
}

// Mutate without closing the step (used while dragging).
export function live(fn) {
  begin();
  fn();
  reindex();
  emit('doc');
}

export function undo() {
  end();
  const p = past.pop();
  if (!p) return false;
  future.push({ s: snap(), sel: [...S.sel] });
  restore(p);
  return true;
}

export function redo() {
  end();
  const f = future.pop();
  if (!f) return false;
  past.push({ s: snap(), sel: [...S.sel] });
  restore(f);
  return true;
}

function restore(p) {
  const d = JSON.parse(p.s);
  S.doc.name = d.name; S.doc.bg = d.bg; S.doc.children = d.children;
  S.idx = makeIndex(S.doc);
  S.sel = p.sel.filter((id) => S.idx.has(id));
  emit('doc');
  emit('sel');
}

export function resetHistory() { past.length = 0; future.length = 0; pending = null; }

export function loadDoc(doc) {
  S.doc = doc;
  S.doc.assets ||= {};
  S.sel = [];
  S.editing = null;
  reindex();
  resetHistory();
  emit('doc');
  emit('sel');
}
