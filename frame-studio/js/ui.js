// DOM helpers, interface icons, toasts, menus and modals.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const P = {
  move: '<path d="M5 3l14 8-6.5 1.5L10 19z"/>',
  frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  ellipse: '<circle cx="12" cy="12" r="8"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  polygon: '<path d="M12 4l8.5 15h-17z"/>',
  star: '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7z"/>',
  pen: '<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.6"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 013 0v5V4.5a1.5 1.5 0 013 0V11V6a1.5 1.5 0 013 0v8c0 4-2.5 6.5-6 6.5S6.5 18 5 15.5L3.5 13a1.5 1.5 0 012.5-1.5L8 14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6a9.9 9.9 0 011.4-.1C18 5.9 21.5 12 21.5 12a17 17 0 01-3 3.7M6.5 6.8C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.7-1.5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  assets: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  alL: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  alCH: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alR: '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  alT: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  alCV: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alB: '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  disH: '<path d="M4 4v16M20 4v16"/><rect x="9" y="8" width="6" height="8" rx="1"/>',
  disV: '<path d="M4 4h16M4 20h16"/><rect x="8" y="9" width="8" height="6" rx="1"/>',
  row: '<rect x="3" y="7" width="5" height="10" rx="1"/><rect x="10" y="7" width="5" height="10" rx="1"/><path d="M18 12h3M19.5 10.5L21 12l-1.5 1.5"/>',
  col: '<rect x="7" y="3" width="10" height="5" rx="1"/><rect x="7" y="10" width="10" height="5" rx="1"/><path d="M12 18v3M10.5 19.5L12 21l1.5-1.5"/>',
  wrap: '<rect x="3" y="4" width="5" height="6" rx="1"/><rect x="10" y="4" width="5" height="6" rx="1"/><rect x="3" y="14" width="5" height="6" rx="1"/><path d="M17 7h3v7h-6"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  sparkle: '<path d="M12 3l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 014.5 5H9l2 2h8.5A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  group: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.5"/>',
  vector: '<path d="M5 19C8 9 16 15 19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  clip: '<path d="M7 3v14a0 0 0 000 0h14M3 7h14v14"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  shape: '<rect x="3.5" y="10" width="10" height="10.5" rx="1.5"/><circle cx="15.5" cy="8.5" r="5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 014.6 1.3c0 1.7-2.1 2-2.1 3.7M12 17.5h.01"/>',
  magnet: '<path d="M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z"/><path d="M6 8h4M14 8h4"/>',
};

export function icon(name, size = 18) {
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export const iconEl = (name, size) => {
  const t = document.createElement('template');
  t.innerHTML = icon(name, size);
  return t.content.firstChild;
};

let toastTimer;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.appendChild(t); }
  t.className = 'show ' + kind;
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2400);
}

// Floating menu at a screen position. items: [{label, kbd, run, disabled}|'-']
export function menu(x, y, items) {
  closeMenu();
  const m = h('div', { class: 'menu', role: 'menu' }, items.map((it) => (it === '-'
    ? h('div', { class: 'menu-sep' })
    : h('button', {
      class: 'menu-item', role: 'menuitem', disabled: !!it.disabled,
      onclick: () => { closeMenu(); it.run?.(); },
    }, h('span', null, it.label), it.kbd ? h('kbd', null, it.kbd) : null))));
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  setTimeout(() => {
    const close = (e) => { if (!m.contains(e.target)) { closeMenu(); } };
    document.addEventListener('pointerdown', close, { capture: true, once: true });
  });
  return m;
}

export function closeMenu() { document.querySelectorAll('.menu').forEach((m) => m.remove()); }

export function modal(title, body, { wide = false, onClose } = {}) {
  closeModal();
  const close = () => { closeModal(); onClose?.(); };
  const m = h('div', { class: 'modal-back', onpointerdown: (e) => { if (e.target === e.currentTarget) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'ib', title: 'Close', 'aria-label': 'Close', html: icon('close'), onclick: close })),
      h('div', { class: 'modal-body' }, body)));
  document.body.appendChild(m);
  m._close = close;
  return m;
}

export function closeModal() { document.querySelectorAll('.modal-back').forEach((m) => m.remove()); }
export const modalOpen = () => !!document.querySelector('.modal-back');

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch {
    const t = h('textarea', { style: 'position:fixed;opacity:0' }, text);
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Copied');
  }
}

// Very small syntax colouring for the code views
export function highlight(code, lang) {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (lang === 'css') {
    return esc
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<i class="c">$1</i>')
      .replace(/^([^{}\n]+)(\{)/gm, '<i class="s">$1</i>$2')
      .replace(/([a-z-]+)(:\s)/g, '<i class="p">$1</i>$2');
  }
  // attributes first: the tag pass only looks at escaped "&lt;", so it never
  // touches the markup this inserts
  return esc
    .replace(/ ([a-zA-Z-:]+)=(")/g, ' <i class="a">$1</i>=$2')
    .replace(/(&lt;\/?)([a-zA-Z][\w.]*)/g, '$1<i class="t">$2</i>')
    .replace(/^(\s*\/\/[^\n]*)/gm, '<i class="c">$1</i>');
}
