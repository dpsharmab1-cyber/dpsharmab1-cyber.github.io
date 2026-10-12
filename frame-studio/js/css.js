// One function turns a node into CSS. The canvas renders with it and the code
// exporter writes it out, so what you see on the canvas is what you get in code.

import { rgba, isFlex } from './model.js';

export const px = (v) => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? '0' : r + 'px';
};

export function paint(f) {
  if (!f || f.type === 'none') return null;
  const a = rgba(f.color, f.opacity);
  if (f.type === 'solid') return a;
  const b = rgba(f.color2, f.opacity);
  if (f.type === 'linear') return `linear-gradient(${f.angle}deg, ${a}, ${b})`;
  if (f.type === 'radial') return `radial-gradient(circle at center, ${a}, ${b})`;
  return null;
}

// Effective sizing per axis: 'fixed' | 'hug' | 'fill'
export function sizing(n, parent) {
  const flexChild = isFlex(parent);
  let w = n.sizeW, h = n.sizeH;
  if (n.type === 'text') {
    if (n.textSize === 'autoW') { w = 'hug'; h = 'hug'; }
    else if (n.textSize === 'autoH') { h = 'hug'; if (w === 'hug') w = 'fixed'; }
    else { if (w === 'hug') w = 'fixed'; if (h === 'hug') h = 'fixed'; }
  } else if (!isFlex(n)) {
    if (w === 'hug') w = 'fixed';
    if (h === 'hug') h = 'fixed';
  }
  if (!flexChild) { if (w === 'fill') w = 'fixed'; if (h === 'fill') h = 'fixed'; }
  return { w, h };
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' };
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };

export function fontStack(family) {
  const mono = /mono/i.test(family);
  const serif = /(serif display|playfair|fraunces|lora|merriweather)/i.test(family) && !/sans/i.test(family);
  return `'${family}', ${mono ? 'ui-monospace, monospace' : serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
}

/**
 * opts.mode: 'editor' | 'export'
 * opts.responsive: export children of plain frames with their constraints
 * opts.rootFluid: export root takes the full page width
 */
export function nodeCSS(n, parent, opts = {}) {
  const s = {};
  const exp = opts.mode === 'export';
  const flexChild = isFlex(parent);
  const sz = sizing(n, parent);

  // ---- position ----
  if (!parent) {
    if (exp) s.position = 'relative';
    else { s.position = 'absolute'; s.left = px(n.x); s.top = px(n.y); }
  } else if (flexChild) {
    s.position = 'relative';
    s['flex-shrink'] = '0';
  } else {
    s.position = 'absolute';
  }

  let skipW = false, skipH = false;
  if (parent && !flexChild) {
    if (exp && opts.responsive) {
      skipW = axisCSS(s, n.cH, n.x, n.w, parent.w, 'left', 'right', 'width', sz.w);
      skipH = axisCSS(s, n.cV, n.y, n.h, parent.h, 'top', 'bottom', 'height', sz.h);
    } else {
      s.left = px(n.x);
      s.top = px(n.y);
    }
  }

  // ---- size ----
  if (!parent && exp) {
    if (opts.rootFluid) {
      s.width = '100%';
      if (sz.h !== 'hug') s['min-height'] = px(n.h);
    } else {
      if (sz.w !== 'hug') s.width = px(n.w);
      if (sz.h !== 'hug') s['min-height'] = px(n.h);
      s.margin = '0 auto';
    }
  } else {
    const main = flexChild ? (parent.layout.mode === 'row' ? 'w' : 'h') : null;
    for (const ax of ['w', 'h']) {
      const prop = ax === 'w' ? 'width' : 'height';
      const mode = sz[ax];
      if (ax === 'w' ? skipW : skipH) continue;
      if (mode === 'fixed') s[prop] = px(n[ax]);
      else if (mode === 'fill') {
        if (ax === main) { s.flex = '1 1 0'; s[ax === 'w' ? 'min-width' : 'min-height'] = '0'; }
        else s['align-self'] = 'stretch';
      }
    }
  }

  // ---- auto layout ----
  if (isFlex(n)) {
    const L = n.layout;
    s.display = 'flex';
    if (L.mode !== 'row') s['flex-direction'] = 'column';
    if (L.wrap && L.mode === 'row') s['flex-wrap'] = 'wrap';
    if (L.gap) s.gap = px(L.gap);
    if (L.pt || L.pr || L.pb || L.pl) {
      s.padding = L.pt === L.pb && L.pl === L.pr
        ? (L.pt === L.pl ? px(L.pt) : `${px(L.pt)} ${px(L.pl)}`)
        : `${px(L.pt)} ${px(L.pr)} ${px(L.pb)} ${px(L.pl)}`;
    }
    s['align-items'] = ALIGN[L.align] || 'flex-start';
    if (L.justify && L.justify !== 'start') s['justify-content'] = JUSTIFY[L.justify];
  }

  // ---- look ----
  if (n.type === 'text') {
    const f = n.font;
    s['font-family'] = fontStack(f.family);
    s['font-size'] = px(f.size);
    s['font-weight'] = String(f.weight);
    s['line-height'] = String(f.lh);
    if (f.ls) s['letter-spacing'] = px(f.ls);
    if (f.align !== 'left') s['text-align'] = f.align;
    if (f.italic) s['font-style'] = 'italic';
    if (f.deco !== 'none') s['text-decoration'] = f.deco;
    if (f.case !== 'none') s['text-transform'] = f.case;
    s['white-space'] = n.textSize === 'autoW' ? 'pre' : 'pre-wrap';
    if (n.textSize !== 'autoW') s['overflow-wrap'] = 'break-word';
    const fill = n.fill;
    if (fill.type === 'solid') s.color = rgba(fill.color, fill.opacity);
    else if (fill.type !== 'none') {
      s.background = paint(fill);
      s['-webkit-background-clip'] = 'text';
      s['background-clip'] = 'text';
      s.color = 'transparent';
    } else s.color = 'transparent';
    if (n.stroke.enabled) s['-webkit-text-stroke'] = `${px(n.stroke.width)} ${rgba(n.stroke.color, n.stroke.opacity)}`;
    if (n.shadow.enabled && !n.shadow.inset) s['text-shadow'] = `${px(n.shadow.x)} ${px(n.shadow.y)} ${px(n.shadow.blur)} ${rgba(n.shadow.color, n.shadow.opacity)}`;
  } else if (n.type !== 'path') {
    const bg = paint(n.fill);
    if (bg) s.background = bg;
    if (n.type === 'ellipse') s['border-radius'] = '50%';
    else if (n.radius) s['border-radius'] = px(n.radius);
    if (n.stroke.enabled && n.stroke.width > 0) {
      const w = n.stroke.width;
      s.outline = `${px(w)} ${n.stroke.style} ${rgba(n.stroke.color, n.stroke.opacity)}`;
      const off = n.stroke.align === 'inside' ? -w : n.stroke.align === 'center' ? -w / 2 : 0;
      if (off) s['outline-offset'] = px(off);
    }
    if (n.shadow.enabled) {
      const sh = n.shadow;
      s['box-shadow'] = `${sh.inset ? 'inset ' : ''}${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${px(sh.spread)} ${rgba(sh.color, sh.opacity)}`;
    }
    if (n.type === 'image') s['object-fit'] = n.fit;
  }

  const filters = [];
  if (n.type === 'path' && n.shadow.enabled && !n.shadow.inset) {
    const sh = n.shadow;
    filters.push(`drop-shadow(${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)})`);
  }
  if (n.blur) filters.push(`blur(${px(n.blur)})`);
  if (filters.length) s.filter = filters.join(' ');
  if (n.bgBlur) {
    s['-webkit-backdrop-filter'] = `blur(${px(n.bgBlur)})`;
    s['backdrop-filter'] = `blur(${px(n.bgBlur)})`;
  }
  if (n.opacity < 1) s.opacity = String(+n.opacity.toFixed(3));
  if (n.blend && n.blend !== 'normal') s['mix-blend-mode'] = n.blend;
  if (n.rot) s.transform = `rotate(${+n.rot.toFixed(2)}deg)`;
  if ((n.type === 'frame' && n.clip) || n.type === 'image') s.overflow = 'hidden';
  if (exp && n.link) s.cursor = 'pointer';
  return s;
}

// Constraint-aware placement for exported code. Returns true when the size
// on this axis is implied by the two offsets (no explicit width/height).
function axisCSS(s, mode, pos, size, P, a, b, prop, sizeMode) {
  const fixed = sizeMode === 'fixed';
  switch (mode) {
    case 'right': case 'bottom':
      s[b] = px(P - pos - size); return false;
    case 'center':
      s[a] = `calc(50% ${pos - P / 2 < 0 ? '-' : '+'} ${px(Math.abs(pos - P / 2))})`; return false;
    case 'stretch':
      s[a] = px(pos); s[b] = px(P - pos - size); return fixed;
    case 'scale':
      s[a] = pct(pos, P);
      if (fixed) { s[prop] = pct(size, P); return true; }
      return false;
    default:
      s[a] = px(pos); return false;
  }
}

const pct = (v, P) => (P ? +((v / P) * 100).toFixed(3) + '%' : '0');

export const cssText = (obj) => Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(';');

export function cssBlock(sel, obj, indent = '') {
  const body = Object.entries(obj).map(([k, v]) => `${indent}  ${k}: ${v};`).join('\n');
  return `${indent}${sel} {\n${body}\n${indent}}`;
}

export function pathSVG(n, extraAttrs = '') {
  const st = n.stroke;
  const fill = n.fill.type === 'none' ? 'none' : n.fill.type === 'solid' ? rgba(n.fill.color, n.fill.opacity) : `url(#g-${n.id})`;
  let defs = '';
  if (n.fill.type === 'linear' || n.fill.type === 'radial') {
    const tag = n.fill.type === 'linear' ? 'linearGradient' : 'radialGradient';
    const a = ((n.fill.angle - 90) * Math.PI) / 180;
    const geo = n.fill.type === 'linear'
      ? ` x1="${r(0.5 - Math.cos(a) / 2)}" y1="${r(0.5 - Math.sin(a) / 2)}" x2="${r(0.5 + Math.cos(a) / 2)}" y2="${r(0.5 + Math.sin(a) / 2)}"`
      : '';
    defs = `<defs><${tag} id="g-${n.id}"${geo}><stop offset="0" stop-color="${rgba(n.fill.color, n.fill.opacity)}"/><stop offset="1" stop-color="${rgba(n.fill.color2, n.fill.opacity)}"/></${tag}></defs>`;
  }
  const stroke = st.enabled && st.width > 0
    ? ` stroke="${rgba(st.color, st.opacity)}" stroke-width="${st.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"${st.style === 'dashed' ? ` stroke-dasharray="${st.width * 3} ${st.width * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0 ${st.width * 2}"` : ''}`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n.vw} ${n.vh}" width="100%" height="100%" preserveAspectRatio="none" fill="none" style="display:block;overflow:visible"${extraAttrs}>${defs}<path d="${n.d}" fill="${fill}"${stroke} fill-rule="evenodd"/></svg>`;
}

const r = (v) => Math.round(v * 1000) / 1000;
