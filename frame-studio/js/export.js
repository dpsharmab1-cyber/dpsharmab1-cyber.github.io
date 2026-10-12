// Design to code. Turns frames into HTML + CSS, React, Tailwind or a small
// multi-page site, and layers into PNG / JPG / SVG. Same CSS as the canvas.

import { S } from './state.js';
import { nodeCSS, cssBlock, pathSVG, paint, px } from './css.js';
import { fontURL } from './fonts.js';
import { walk, rgba, isFlex } from './model.js';

/* ---------------- naming ---------------- */

function slug(s, fallback) {
  let v = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  if (!v || !/^[a-z]/.test(v)) v = (fallback || 'el') + (v ? '-' + v : '');
  return v;
}

function makeNamer(used = new Set()) {
  return (name, type) => {
    const base = slug(name, type);
    let v = base, i = 2;
    while (used.has(v)) v = `${base}-${i++}`;
    used.add(v);
    return v;
  };
}

const escHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escHTML(s).replace(/"/g, '&quot;');

/* ---------------- tree -> markup ---------------- */

const PHRASING = new Set(['button', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'label']);

function tagFor(n, ctx, isRoot, inPhrasing) {
  if (n.tag && n.tag !== 'auto') return n.tag;
  if (n.type === 'image') return 'img';
  // buttons, links and headings may only hold inline content
  if (inPhrasing) return 'span';
  if (n.link && !isRoot) return 'a';
  if (n.type === 'text') {
    const sz = n.font.size;
    if (sz >= 40 && !ctx.h1) { ctx.h1 = true; return 'h1'; }
    if (sz >= 28) return 'h2';
    if (sz >= 20 && n.font.weight >= 600) return 'h3';
    return 'p';
  }
  return isRoot ? (ctx.site ? 'section' : 'main') : 'div';
}

// Decide every element's tag up front (headings need document order).
function assignTags(n, ctx, parentTag = null) {
  if (!n.visible) return;
  const tag = tagFor(n, ctx, !parentTag, parentTag && PHRASING.has(parentTag));
  ctx.tags.set(n.id, tag);
  (n.children || []).forEach((c) => assignTags(c, ctx, tag));
}

function linkHref(n, ctx) {
  if (!n.link) return null;
  if (n.link.startsWith('#frame:')) {
    const id = n.link.slice(7);
    return ctx.pageIds?.get(id) ? '#' + ctx.pageIds.get(id) : '#';
  }
  return n.link;
}

// JSX needs camelCase svg attributes and object styles
function svgForJSX(svg) {
  return svg
    .replace(/ (stroke|fill|vector|stop|preserve)-([a-z]+)(?:-([a-z]+))?=/g, (m, a, b, c) => ` ${a}${b[0].toUpperCase()}${b.slice(1)}${c ? c[0].toUpperCase() + c.slice(1) : ''}=`)
    .replace(/style="display:block;overflow:visible"/, "style={{ display: 'block', overflow: 'visible' }}");
}

function genMarkup(n, parent, ctx, depth) {
  if (!n.visible) return '';
  const ind = '  '.repeat(depth);
  const isRoot = !parent;
  const cls = ctx.cls.get(n.id);
  const tag = ctx.tags.get(n.id) || 'div';
  const clsAttr = ctx.jsx ? 'className' : 'class';
  let attrs = ` ${clsAttr}="${ctx.tw ? ctx.tw.get(n.id) : cls}"`;
  if (isRoot && ctx.site) attrs = ` id="${ctx.pageIds.get(n.id)}"` + attrs;
  const href = linkHref(n, ctx);
  if (href && tag === 'a') attrs += ` href="${escAttr(href)}"`;
  if (href && /^https?:/.test(href) && tag === 'a') attrs += ctx.jsx ? ' target="_blank" rel="noreferrer"' : ' target="_blank" rel="noopener"';
  if (href && tag !== 'a') attrs += ctx.jsx ? ` onClick={() => (window.location.href = ${JSON.stringify(href)})}` : ` onclick="location.href='${escAttr(href).replace(/'/g, '%27')}'"`;

  if (tag === 'img' || n.type === 'image') {
    const src = n.src ? ctx.asset(n.src) : '';
    return `${ind}<img${attrs} src="${escAttr(src)}" alt="${escAttr(n.alt || n.name)}" />\n`;
  }
  if (n.type === 'text') {
    const lines = n.text.split('\n');
    const inner = ctx.jsx
      ? lines.map((l) => `{${JSON.stringify(l)}}`).join('<br />')
      : lines.map(escHTML).join('<br />');
    return `${ind}<${tag}${attrs}>${inner}</${tag}>\n`;
  }
  if (n.type === 'path') {
    const svg = pathSVG(n, ' aria-hidden="true"');
    return `${ind}<${tag}${attrs}>${ctx.jsx ? svgForJSX(svg) : svg}</${tag}>\n`;
  }
  const kids = (n.children || []).filter((c) => c.visible);
  if (!kids.length) return `${ind}<${tag}${attrs}></${tag}>\n`;
  return `${ind}<${tag}${attrs}>\n${kids.map((c) => genMarkup(c, n, ctx, depth + 1)).join('')}${ind}</${tag}>\n`;
}

function genCSS(n, parent, ctx, out) {
  if (!n.visible) return;
  const css = nodeCSS(n, parent, { mode: 'export', responsive: ctx.layout === 'fluid', rootFluid: ctx.layout === 'fluid' });
  if (!parent && ctx.noRootTransform) delete css.transform;
  if (!parent && ctx.site) delete css.margin;
  out.push(cssBlock('.' + ctx.cls.get(n.id), css));
  if (!parent) ctx.rootW = n.w;
  if (ctx.layout === 'fluid' && ctx.mobile && ctx.rootW > PHONE) {
    const m = phoneRules(n, parent);
    if (Object.keys(m).length) ctx.mobile.push(cssBlock('.' + ctx.cls.get(n.id), m, '  '));
  }
  (n.children || []).forEach((c) => genCSS(c, n, ctx, out));
}

// Responsive export: simple phone adjustments so a desktop layout reflows
// (wide rows wrap, big type and padding shrink, nothing wider than the screen).
const PHONE = 640;
function phoneRules(n, parent) {
  const m = {};
  if (n.type === 'text' && n.font.size > 30) {
    m['font-size'] = px(Math.max(26, Math.round(n.font.size * 0.6)));
    if (n.font.ls) m['letter-spacing'] = px(+(n.font.ls * 0.6).toFixed(2));
  }
  if (isFlex(n)) {
    const L = n.layout;
    const kids = (n.children || []).filter((c) => c.visible);
    const span = kids.reduce((a, c) => a + c.w, 0) + L.gap * Math.max(0, kids.length - 1) + L.pl + L.pr;
    if (L.mode === 'row' && kids.length > 1 && span > PHONE * 0.55) {
      m['flex-wrap'] = 'wrap';
      if (L.gap < 8) m['row-gap'] = px(12);
    }
    const ph = L.pl > 24 || L.pr > 24, pv = L.pt > 48 || L.pb > 48;
    if (ph || pv) {
      const t = pv ? Math.round(L.pt * 0.6) : L.pt, b = pv ? Math.round(L.pb * 0.6) : L.pb;
      const l = ph ? Math.min(L.pl, 20) : L.pl, r = ph ? Math.min(L.pr, 20) : L.pr;
      m.padding = `${px(t)} ${px(r)} ${px(b)} ${px(l)}`;
    }
    if (L.gap > 32) m.gap = px(20);
  }
  if (isFlex(parent) && parent.layout.mode === 'row') {
    const kids = parent.children.filter((c) => c.visible);
    const span = kids.reduce((a, c) => a + c.w, 0) + parent.layout.gap * Math.max(0, kids.length - 1) + parent.layout.pl + parent.layout.pr;
    if (kids.length > 1 && span > PHONE * 0.55 && n.sizeW === 'fill') m.flex = '1 1 100%';
  }
  if (parent && n.sizeW === 'fixed' && n.w > 360 && !(n.type === 'text' && n.textSize === 'autoW')) m['max-width'] = '100%';
  return m;
}

function fontLinks(roots) {
  const fam = new Map();
  walk(roots, (n) => {
    if (n.type !== 'text' || !n.visible) return;
    const f = fam.get(n.font.family) || { w: new Set(), it: false };
    f.w.add(n.font.weight);
    if (n.font.italic) f.it = true;
    fam.set(n.font.family, f);
  });
  return [...fam].map(([family, f]) => fontURL(family, [...f.w], f.it));
}

const BASE_CSS = `*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
h1, h2, h3, h4, h5, h6, p, figure { margin: 0; }
a { color: inherit; text-decoration: none; }
img, svg { display: block; }
button { font: inherit; color: inherit; border: 0; padding: 0; background: none; cursor: pointer; text-align: inherit; }`;

const SCALE_JS = (cls, w) => `<script>
  // keeps the fixed-width design whole on narrow screens
  (function () {
    var el = document.querySelector('.${cls}');
    function fit() { var k = Math.min(1, window.innerWidth / ${w}); el.style.zoom = k; }
    window.addEventListener('resize', fit); fit();
  })();
</script>`;

const SITE_JS = `<script>
  // one section per page; links like #pricing switch pages
  (function () {
    var pages = [].slice.call(document.querySelectorAll('.fs-page'));
    function show() {
      var id = location.hash.slice(1);
      var hit = pages.some(function (p) { return p.id === id; });
      pages.forEach(function (p, i) { p.hidden = hit ? p.id !== id : i !== 0; });
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', show); show();
  })();
</script>`;

/* ---------------- tailwind ---------------- */

const u = (v) => String(v).replace(/ /g, '_');
const TW = {
  position: (v) => v,
  left: (v) => `left-[${u(v)}]`, top: (v) => `top-[${u(v)}]`, right: (v) => `right-[${u(v)}]`, bottom: (v) => `bottom-[${u(v)}]`,
  width: (v) => (v === '100%' ? 'w-full' : `w-[${u(v)}]`), height: (v) => `h-[${u(v)}]`,
  'min-width': (v) => (v === '0' ? 'min-w-0' : `min-w-[${u(v)}]`), 'min-height': (v) => (v === '0' ? 'min-h-0' : `min-h-[${u(v)}]`),
  margin: (v) => (v === '0 auto' ? 'mx-auto' : `m-[${u(v)}]`),
  flex: (v) => (v === '1 1 0' ? 'flex-1' : `flex-[${u(v)}]`),
  'flex-shrink': (v) => (v === '0' ? 'shrink-0' : `shrink-[${v}]`),
  'align-self': (v) => `self-${v.replace('flex-', '')}`,
  display: (v) => (v === 'flex' ? 'flex' : `[display:${v}]`),
  'flex-direction': (v) => (v === 'column' ? 'flex-col' : 'flex-row'),
  'flex-wrap': () => 'flex-wrap',
  gap: (v) => `gap-[${v}]`,
  padding: (v) => `p-[${u(v)}]`,
  'align-items': (v) => `items-${v.replace('flex-', '')}`,
  'justify-content': (v) => `justify-${v.replace('flex-', '').replace('space-', '')}`,
  background: (v) => `bg-[${u(v)}]`,
  'border-radius': (v) => (v === '50%' ? 'rounded-full' : `rounded-[${v}]`),
  'box-shadow': (v) => `shadow-[${u(v)}]`,
  'object-fit': (v) => `object-${v}`,
  overflow: (v) => `overflow-${v}`,
  opacity: (v) => `opacity-[${v}]`,
  transform: (v) => { const m = v.match(/^rotate\((.+)\)$/); return m ? `rotate-[${m[1]}]` : `[transform:${u(v)}]`; },
  'font-family': (v) => `font-['${v.match(/'([^']+)'/)[1].replace(/ /g, '_')}']`,
  'font-size': (v) => `text-[${v}]`,
  'font-weight': (v) => `font-[${v}]`,
  'line-height': (v) => `leading-[${v}]`,
  'letter-spacing': (v) => `tracking-[${v}]`,
  'text-align': (v) => `text-${v}`,
  'font-style': () => 'italic',
  'text-decoration': (v) => (v === 'line-through' ? 'line-through' : 'underline'),
  'text-transform': (v) => (v === 'none' ? 'normal-case' : v),
  'white-space': (v) => `whitespace-${v}`,
  'overflow-wrap': () => 'break-words',
  color: (v) => (v === 'transparent' ? 'text-transparent' : `text-[${u(v)}]`),
  '-webkit-background-clip': () => 'bg-clip-text',
  'background-clip': () => null,
  '-webkit-backdrop-filter': () => null,
  'backdrop-filter': (v) => { const m = v.match(/^blur\((.+)\)$/); return m ? `backdrop-blur-[${m[1]}]` : `[backdrop-filter:${u(v)}]`; },
  filter: (v) => { const m = v.match(/^blur\(([^)]+)\)$/); return m ? `blur-[${m[1]}]` : `[filter:${u(v)}]`; },
  'mix-blend-mode': (v) => `mix-blend-${v}`,
  cursor: (v) => `cursor-${v}`,
};

function twClasses(css) {
  const out = [];
  for (const [k, v] of Object.entries(css)) {
    const f = TW[k];
    const c = f ? f(v) : `[${k}:${u(v)}]`;
    if (c) out.push(c);
  }
  return out.join(' ');
}

/* ---------------- public: build code ---------------- */

/**
 * frames: node[] (usually top-level frames)
 * opts.format: 'html' | 'react' | 'tailwind'
 * opts.layout: 'fixed' | 'fluid' | 'scale'
 * opts.site: true = every frame becomes a page of one site
 * opts.inline: true = images as data URLs (single file), false = assets/ files
 */
export function buildCode(frames, opts = {}) {
  const format = opts.format || 'html';
  const layout = opts.layout || 'fixed';
  const site = !!opts.site && frames.length > 1;
  const inline = opts.inline !== false;
  const namer = makeNamer();
  const assets = new Map(); // assetId -> filename
  const ctx = {
    layout, site, jsx: format === 'react', h1: false,
    cls: new Map(), pageIds: new Map(), mobile: [],
    asset: (id) => {
      const data = S.doc.assets[id];
      if (!data) return '';
      if (inline) return data;
      if (!assets.has(id)) {
        const ext = (data.match(/^data:image\/(\w+)/) || [, 'png'])[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        assets.set(id, `assets/image-${assets.size + 1}.${ext}`);
      }
      return (format === 'react' ? '/' : '') + assets.get(id);
    },
  };
  const pageNamer = makeNamer();
  for (const f of frames) ctx.pageIds.set(f.id, pageNamer(f.name, 'page'));
  for (const f of frames) walk([f], (n) => { ctx.cls.set(n.id, namer(n.name, n.type)); });
  ctx.tags = new Map();
  for (const f of frames) { ctx.h1 = false; assignTags(f, ctx); }

  if (format === 'tailwind') {
    ctx.tw = new Map();
    let rootW = 0;
    const visit = (n, parent) => {
      const css = nodeCSS(n, parent, { mode: 'export', responsive: layout === 'fluid', rootFluid: layout === 'fluid' });
      if (!parent && site) delete css.margin;
      let cls = twClasses(css);
      if (!parent) rootW = n.w;
      if (layout === 'fluid' && rootW > PHONE) {
        const m = twClasses(phoneRules(n, parent));
        if (m) cls += ' ' + m.split(' ').map((c) => 'max-sm:' + c).join(' ');
      }
      ctx.tw.set(n.id, (!parent && site ? 'fs-page ' : '') + cls);
      (n.children || []).forEach((c) => visit(c, n));
    };
    frames.forEach((f) => visit(f, null));
  }

  const cssParts = [];
  if (format !== 'tailwind') frames.forEach((f) => genCSS(f, null, ctx, cssParts));
  const bodyBg = paintBody(frames[0]);
  const fonts = fontLinks(frames);
  const phone = ctx.mobile.length ? `\n\n/* phones */\n@media (max-width: ${PHONE}px) {\n${ctx.mobile.join('\n')}\n}` : '';
  const css = `${BASE_CSS}\nbody { background: ${bodyBg}; }\n${site ? '.fs-page[hidden] { display: none; }\n' : ''}\n${cssParts.join('\n\n')}${phone}\n`;

  let markup = frames.map((f) => {
    let m = genMarkup(f, null, ctx, ctx.jsx ? (frames.length > 1 ? 3 : 2) : 1);
    if (site && format !== 'tailwind') m = m.replace(/^(\s*<\w+[^>]*?class=")/, '$1fs-page ');
    return m;
  }).join('\n');

  const title = frames.length === 1 ? frames[0].name : S.doc.name;
  const fontTags = fonts.map((h) => `  <link rel="stylesheet" href="${h}">`).join('\n');
  const head = (style) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHTML(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontTags}
${style}
</head>`;
  const scripts = [
    layout === 'scale' && !site ? SCALE_JS(ctx.cls.get(frames[0].id) || 'x', frames[0].w) : '',
    site ? SITE_JS : '',
  ].filter(Boolean).join('\n');

  const files = [];
  let preview;
  if (format === 'html') {
    const page = (styleTag) => `${head(styleTag)}\n<body>\n${markup}${scripts ? scripts + '\n' : ''}</body>\n</html>\n`;
    if (inline) {
      files.push({ name: 'index.html', lang: 'html', content: page(`  <style>\n${indent(css, 4)}\n  </style>`) });
    } else {
      files.push({ name: 'index.html', lang: 'html', content: page('  <link rel="stylesheet" href="styles.css">') });
      files.push({ name: 'styles.css', lang: 'css', content: css });
    }
    preview = page(`<style>${css}</style>`);
  } else if (format === 'tailwind') {
    const twTag = `  <script src="https://cdn.tailwindcss.com"></script>\n  <style>\n${indent(BASE_CSS, 4)}\n    body { background: ${bodyBg}; }\n${site ? '    .fs-page[hidden] { display: none; }\n' : ''}  </style>`;
    const html = `${head(twTag)}\n<body>\n${markup}${scripts ? scripts + '\n' : ''}</body>\n</html>\n`;
    files.push({ name: 'index.html', lang: 'html', content: html });
    preview = html;
  } else {
    const comp = pascal(frames.length === 1 ? frames[0].name : S.doc.name) || 'Page';
    const jsx = `// ${comp}.jsx: generated by Frame Studio
// Fonts: add these to your index.html <head>
${fonts.map((h) => `//   <link rel="stylesheet" href="${h}">`).join('\n') || '//   (none)'}
import './${comp}.css';

export default function ${comp}() {
  return (
${frames.length > 1 ? `    <>\n${markup}    </>` : markup.replace(/\n$/, '')}
  );
}
`;
    files.push({ name: `${comp}.jsx`, lang: 'jsx', content: jsx });
    files.push({ name: `${comp}.css`, lang: 'css', content: css });
    ctx.jsx = false;
    const htmlMarkup = frames.map((f) => genMarkup(f, null, { ...ctx, jsx: false, asset: (id) => S.doc.assets[id] || '' }, 1)).join('\n');
    preview = `${head(`<style>${css}</style>`)}\n<body>\n${htmlMarkup}${scripts}</body>\n</html>`;
  }
  if (!inline) {
    for (const [id, name] of assets) files.push({ name: (format === 'react' ? 'public/' : '') + name, lang: 'binary', content: dataURLBytes(S.doc.assets[id]) });
  }
  if (!inline || format === 'react') {
    // preview always inlines images
    preview = preview.replace(/(?:\/)?assets\/image-\d+\.\w+/g, (m) => {
      const name = m.replace(/^\//, '');
      for (const [id, n] of assets) if (n === name) return S.doc.assets[id];
      return m;
    });
  }
  return { files, preview };
}

function paintBody(root) {
  const p = paint(root.fill);
  return root.fill.type === 'solid' && p ? p : '#ffffff';
}

const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');
const pascal = (s) => String(s).replace(/[^a-zA-Z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^[^a-zA-Z]+/, '').replace(/^./, (c) => c.toUpperCase());

// CSS for one layer, as shown in the Code tab (positions as on canvas)
export function layerCSS(n, parent) {
  return cssBlock('.' + slug(n.name, n.type), nodeCSS(n, parent, { mode: 'export' }));
}

export function layerTailwind(n, parent) {
  return twClasses(nodeCSS(n, parent, { mode: 'export' }));
}

export function layerHTML(n) {
  const namer = makeNamer();
  const ctx = { layout: 'fixed', cls: new Map(), pageIds: new Map(), tags: new Map(), h1: false, asset: () => 'image.png' };
  walk([n], (m) => { ctx.cls.set(m.id, namer(m.name, m.type)); });
  assignTags(n, ctx);
  return genMarkup(n, null, ctx, 0).replace(/ src="data:[^"]+"/g, ' src="image.png"');
}

/* ---------------- images ---------------- */

const fontCache = new Map();
async function embedFonts(urls) {
  const parts = await Promise.all(urls.map(async (url) => {
    if (fontCache.has(url)) return fontCache.get(url);
    try {
      let css = await (await fetch(url)).text();
      const refs = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
      for (const r of refs) {
        const b = await (await fetch(r)).blob();
        css = css.split(r).join(await blobToDataURL(b));
      }
      fontCache.set(url, css);
      return css;
    } catch { return ''; }
  }));
  return parts.join('\n');
}

function blobToDataURL(b) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
}

// The layer and its children as a standalone SVG with HTML inside (exact match).
async function htmlSVG(n) {
  const namer = makeNamer();
  const ctx = { layout: 'fixed', cls: new Map(), pageIds: new Map(), tags: new Map(), h1: false, noRootTransform: true, asset: (id) => S.doc.assets[id] || '' };
  walk([n], (m) => { ctx.cls.set(m.id, namer(m.name, m.type)); });
  assignTags(n, ctx);
  const out = [];
  genCSS(n, null, ctx, out);
  const css = BASE_CSS + '\n' + out.join('\n') + `\n.${ctx.cls.get(n.id)} { margin: 0 !important; }`;
  const fonts = await embedFonts(fontLinks([n]));
  const html = genMarkup(n, null, ctx, 0);
  const w = Math.max(1, Math.round(n.w)), h = Math.max(1, Math.round(n.h));
  return {
    w, h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px"><style>${xmlEsc(fonts)}\n${xmlEsc(css)}</style>${html}</div></foreignObject></svg>`,
  };
}

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export async function rasterize(n, scale = 2, type = 'image/png') {
  const { svg, w, h } = await htmlSVG(n);
  const img = new Image();
  img.decoding = 'sync';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.scale(scale, scale);
  g.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => {
    try { c.toBlob((b) => (b ? res(b) : rej(new Error('blocked'))), type, 0.92); } catch (e) { rej(e); }
  });
}

// Real vector SVG: shapes as SVG elements, text kept as HTML inside the SVG.
export function vectorSVG(n) {
  const defs = [];
  let gid = 0;
  const fillRef = (f) => {
    if (!f || f.type === 'none') return 'none';
    if (f.type === 'solid') return rgba(f.color, f.opacity);
    const id = 'g' + gid++;
    const a = ((f.angle - 90) * Math.PI) / 180;
    const geo = f.type === 'linear' ? ` x1="${0.5 - Math.cos(a) / 2}" y1="${0.5 - Math.sin(a) / 2}" x2="${0.5 + Math.cos(a) / 2}" y2="${0.5 + Math.sin(a) / 2}"` : '';
    const tag = f.type === 'linear' ? 'linearGradient' : 'radialGradient';
    defs.push(`<${tag} id="${id}"${geo}><stop offset="0" stop-color="${rgba(f.color, f.opacity)}"/><stop offset="1" stop-color="${rgba(f.color2, f.opacity)}"/></${tag}>`);
    return `url(#${id})`;
  };
  const shadowRef = (m) => {
    if (!m.shadow.enabled || m.shadow.inset) return '';
    const id = 'f' + gid++;
    const s = m.shadow;
    defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${s.x}" dy="${s.y}" stdDeviation="${s.blur / 2}" flood-color="${s.color}" flood-opacity="${s.opacity}"/></filter>`);
    return ` filter="url(#${id})"`;
  };
  const strokeAttrs = (m) => (m.stroke.enabled && m.stroke.width ? ` stroke="${rgba(m.stroke.color, m.stroke.opacity)}" stroke-width="${m.stroke.width}"${m.stroke.style === 'dashed' ? ` stroke-dasharray="${m.stroke.width * 3} ${m.stroke.width * 2}"` : ''}` : '');

  const visit = (m, ox, oy) => {
    if (!m.visible) return '';
    const x = ox + m.x, y = oy + m.y;
    const tr = m.rot ? ` transform="rotate(${m.rot} ${x + m.w / 2} ${y + m.h / 2})"` : '';
    const op = m.opacity < 1 ? ` opacity="${m.opacity}"` : '';
    let body = '';
    if (m.type === 'frame' || m.type === 'rect' || m.type === 'image') {
      const rx = m.radius ? ` rx="${Math.min(m.radius, m.w / 2, m.h / 2)}"` : '';
      body += `<rect x="${x}" y="${y}" width="${m.w}" height="${m.h}"${rx} fill="${fillRef(m.fill)}"${strokeAttrs(m)}${shadowRef(m)}/>`;
      if (m.type === 'image' && m.src && S.doc.assets[m.src]) {
        const id = 'c' + gid++;
        defs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${m.w}" height="${m.h}"${rx}/></clipPath>`);
        const par = m.fit === 'contain' ? 'xMidYMid meet' : m.fit === 'fill' ? 'none' : 'xMidYMid slice';
        body += `<image href="${S.doc.assets[m.src]}" x="${x}" y="${y}" width="${m.w}" height="${m.h}" preserveAspectRatio="${par}" clip-path="url(#${id})"/>`;
      }
      if (m.children?.length) {
        let inner = m.children.map((c) => visit(c, x, y)).join('');
        if (m.clip) {
          const id = 'c' + gid++;
          defs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${m.w}" height="${m.h}"${rx}/></clipPath>`);
          inner = `<g clip-path="url(#${id})">${inner}</g>`;
        }
        body += inner;
      }
    } else if (m.type === 'ellipse') {
      body = `<ellipse cx="${x + m.w / 2}" cy="${y + m.h / 2}" rx="${m.w / 2}" ry="${m.h / 2}" fill="${fillRef(m.fill)}"${strokeAttrs(m)}${shadowRef(m)}/>`;
    } else if (m.type === 'path') {
      body = `<svg x="${x}" y="${y}" width="${m.w}" height="${m.h}" viewBox="0 0 ${m.vw} ${m.vh}" preserveAspectRatio="none" overflow="visible"><path d="${m.d}" fill="${fillRef(m.fill)}"${strokeAttrs(m)} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"${shadowRef(m)}/></svg>`;
    } else if (m.type === 'text') {
      const css = nodeCSS({ ...m, rot: 0, opacity: 1 }, null, { mode: 'export' });
      delete css.position; delete css.margin; delete css['min-height']; delete css.width;
      const style = Object.entries(css).map(([k, v]) => `${k}:${v}`).join(';').replace(/"/g, "'");
      body = `<foreignObject x="${x}" y="${y}" width="${m.w + 2}" height="${m.h + 2}"><div xmlns="http://www.w3.org/1999/xhtml" style="${escAttr(style)};margin:0;width:${m.w + (m.textSize === 'autoW' ? 2 : 0)}px">${m.text.split('\n').map(escHTML).join('<br/>')}</div></foreignObject>`;
    }
    return tr || op ? `<g${tr}${op}>${body}</g>` : body;
  };
  const content = visit({ ...n, x: 0, y: 0, rot: 0 }, 0, 0);
  const fonts = fontLinks([n]).map((h) => `@import url('${h}');`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n.w}" height="${n.h}" viewBox="0 0 ${n.w} ${n.h}">${fonts ? `<style>${xmlEsc(fonts)}</style>` : ''}${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${content}</svg>`;
}

/* ---------------- files ---------------- */

export function dataURLBytes(d) {
  const b64 = d.split(',')[1] || '';
  if (!/;base64,/.test(d)) return new TextEncoder().encode(decodeURIComponent(b64));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function download(name, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Minimal ZIP writer (stored, no compression), enough for a site folder.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dtime, true); h.setUint16(12, ddate, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dtime, true); c.setUint16(14, ddate, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, csize, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

export { px, isFlex };
