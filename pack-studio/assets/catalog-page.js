// Packaging library page: category cards, search, and every pack type with a
// link to its template (or a request link when it isn't built yet).
import { hydrateIcons, icon } from './icons.js';
import { LIBRARY, ALL_TYPES, searchTypes, typeLink } from '../studio/js/catalog.js';
import { byId, defaults, MATERIALS } from '../studio/js/templates.js';
import { compile } from '../studio/js/engine.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ready = ALL_TYPES.filter((t) => t.tpl).length;
const state = { q: new URLSearchParams(location.search).get('q') || '', cat: location.hash.slice(1), f: 'all' };

$('#libLead').textContent = `${ALL_TYPES.length} pack types in ${LIBRARY.length} categories. ${ready} open as a ready template at a typical size; the rest you can request.`;
$('#libQ').value = state.q;

function passes(t) { return state.f === 'all' || (state.f === 'ready' ? !!t.tpl : !t.tpl); }

function renderCats() {
  $('#catgrid').innerHTML = LIBRARY.map((c) => {
    const n = c.types.filter(passes).length;
    return `<a class="catcard${c.id === state.cat ? ' on' : ''}" href="#${c.id}" data-cat="${c.id}">
      <div class="cc-text"><h3>${esc(c.name)}</h3><span class="cc-count">${n} type${n === 1 ? '' : 's'}</span><span class="cc-go">${icon('arrow-right')}</span></div>
      <img src="assets/cat/${c.id}.webp" alt="" loading="lazy" width="160" height="160"></a>`;
  }).join('');
}

function sizeText(t) {
  const tpl = byId[t.tpl], v = { ...defaults(tpl), ...t.v };
  const unit = (k) => tpl.params.find((p) => p.k === k)?.unit === 'mm';
  return tpl.dims.map((k) => Math.round(v[k] * 10) / 10).join(' × ') + (tpl.dims.every(unit) ? ' mm' : '');
}

function card(t, i) {
  const tpl = t.tpl && byId[t.tpl];
  const go = tpl
    ? `<a class="ty-go" href="${typeLink(t)}">Customise ${icon('arrow-right')}</a>`
    : `<a class="ty-go req" href="contact.html?topic=${encodeURIComponent('Template request')}&msg=${encodeURIComponent(`Please add a template for: ${t.name} (${t.catName})`)}">Request ${icon('mail')}</a>`;
  return `<article class="tycard${tpl ? '' : ' is-req'}">
    <div class="ty-art" ${tpl ? `data-i="${i}"` : ''}>${tpl ? '' : `<span class="ty-soon">${icon('pencil')}<small>On request</small></span>`}</div>
    <div class="ty-body"><b>${esc(t.name)}</b>
      <small>${tpl ? `${esc(tpl.name)} · ${sizeText(t)}` : esc(t.catName)}</small>
      ${t.code ? `<span class="ty-code">${esc(t.code)}</span>` : ''}
      ${go}</div></article>`;
}

let shown = [];
function renderResults() {
  const host = $('#libResults'), head = $('#libHead');
  shown = [];
  const grid = (types) => `<div class="tygrid">${types.map((t) => { shown.push(t); return card(t, shown.length - 1); }).join('')}</div>`;
  if (state.q || state.cat) {
    let list = state.q ? searchTypes(state.q) : ALL_TYPES;
    if (state.cat) list = list.filter((t) => t.cat === state.cat);
    // a type listed in several categories shows once in search results
    if (state.q && !state.cat) { const seen = new Set(); list = list.filter((t) => { const k = t.name + t.tpl + JSON.stringify(t.v); return !seen.has(k) && seen.add(k); }); }
    list = list.filter(passes);
    const c = LIBRARY.find((x) => x.id === state.cat);
    head.hidden = false;
    $('#libTitle').textContent = state.q ? `Results for “${state.q}”${c ? ` in ${c.name}` : ''}` : c.name;
    $('#libSub').textContent = `${list.length} type${list.length === 1 ? '' : 's'}${c && !state.q ? ` · ${c.blurb}` : ''}`;
    host.innerHTML = list.length ? grid(list) : `<div class="lib-empty"><p>No pack type matches that yet.</p><a class="btn btn-gold btn-sm" href="contact.html?topic=${encodeURIComponent('Template request')}&msg=${encodeURIComponent(`Please add packaging for: ${state.q}`)}">Request “${esc(state.q)}” ${icon('arrow-right')}</a></div>`;
  } else {
    head.hidden = true;
    host.innerHTML = LIBRARY.map((c) => {
      const types = c.types.map((t) => ({ ...t, cat: c.id, catName: c.name })).filter(passes);
      return types.length ? `<section class="lib-cat" id="sec-${c.id}"><h2>${esc(c.name)} <small>${types.length}</small></h2>${grid(types)}</section>` : '';
    }).join('');
  }
  observeThumbs();
}

// dieline thumbnails are drawn when they scroll into view
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { drawThumb(e.target); io.unobserve(e.target); }
}, { rootMargin: '200px' }) : null;
function observeThumbs() { document.querySelectorAll('.ty-art[data-i]').forEach((n) => (io ? io.observe(n) : drawThumb(n))); }

function drawThumb(node) {
  const t = shown[+node.dataset.i], tpl = byId[t.tpl];
  try {
    const m = compile(tpl, { ...defaults(tpl), ...t.v }, MATERIALS[tpl.material]);
    const b = m.net, X = (x) => (x - b.minX).toFixed(1), Y = (y) => (b.maxY - y).toFixed(1);
    const d = (segs) => segs.map(([[a, c], [e, f]]) => `M${X(a)} ${Y(c)}L${X(e)} ${Y(f)}`).join('');
    const fill = m.panels.map((q) => `<polygon points="${q.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`).join('');
    node.innerHTML = `<svg viewBox="-6 -6 ${(b.w + 12).toFixed(1)} ${(b.h + 12).toFixed(1)}" aria-hidden="true"><g fill="#ffffff">${fill}</g>
      <path d="${d(m.cut)}" fill="none" stroke="#13288a" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      <path d="${d(m.crease)}" fill="none" stroke="#e5a912" stroke-width="1.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/></svg>`;
  } catch { node.textContent = ''; }
}

function sync() {
  const url = new URL(location.href);
  if (state.q) url.searchParams.set('q', state.q); else url.searchParams.delete('q');
  url.hash = state.cat;
  history.replaceState(null, '', url.pathname + url.search + (state.cat ? '#' + state.cat : ''));
  renderCats();
  renderResults();
}

$('#libSearch').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('#libQ').value.trim(); state.cat = ''; sync(); $('#catgrid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
let typing = 0;
$('#libQ').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { state.q = $('#libQ').value.trim(); state.cat = ''; sync(); }, 180); });
$('#catgrid').addEventListener('click', (e) => {
  const a = e.target.closest('[data-cat]');
  if (!a) return;
  e.preventDefault();
  state.cat = state.cat === a.dataset.cat && !state.q ? '' : a.dataset.cat;
  state.q = ''; $('#libQ').value = '';
  sync();
  $('#libHead').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#libAll').addEventListener('click', () => { state.cat = ''; state.q = ''; $('#libQ').value = ''; sync(); });
document.querySelectorAll('.lib-filter [data-f]').forEach((b) => b.addEventListener('click', () => {
  state.f = b.dataset.f;
  document.querySelectorAll('.lib-filter [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  sync();
}));
addEventListener('hashchange', () => { state.cat = location.hash.slice(1); renderCats(); renderResults(); });

const menu = $('#menuBtn'), links = document.querySelector('.links');
menu.addEventListener('click', () => { const open = links.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });

renderCats();
renderResults();
hydrateIcons();
