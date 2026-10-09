// Writes the packaging library into catalog.html as plain HTML, so search engines
// (and visitors without JavaScript) see every pack type. The page script replaces
// it with the interactive version. Run after editing studio/js/catalog.js:
//   node pack-studio/tools/build-catalog.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIBRARY, typeLink } from '../studio/js/catalog.js';
import { byId } from '../studio/js/templates.js';

const page = fileURLToPath(new URL('../catalog.html', import.meta.url));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cards = LIBRARY.map((c) => `<a class="catcard" href="#${c.id}" data-cat="${c.id}"><div class="cc-text"><h3>${esc(c.name)}</h3><span class="cc-count">${c.types.length} types</span></div><img src="assets/cat/${c.id}.webp" alt="${esc(c.name)} packaging" loading="lazy" width="160" height="160"></a>`).join('\n');
const sections = LIBRARY.map((c) => `<section class="lib-cat" id="sec-${c.id}"><h2>${esc(c.name)} <small>${c.types.length}</small></h2><p class="muted">${esc(c.blurb)}</p><ul class="lib-static">${c.types.map((t) => {
  const tpl = t.tpl && byId[t.tpl];
  return `<li>${tpl ? `<a href="${typeLink(t)}">${esc(t.name)} dieline template</a>` : `${esc(t.name)} (on request)`}${t.code ? ` · ${esc(t.code)}` : ''}</li>`;
}).join('')}</ul></section>`).join('\n');
let html = fs.readFileSync(page, 'utf8');
const put = (id, inner) => {
  const re = new RegExp(`(<div[^>]*id="${id}"[^>]*>)[\\s\\S]*?(<!--/${id}-->)`);
  if (re.test(html)) html = html.replace(re, `$1\n${inner}\n$2`);
  else html = html.replace(new RegExp(`(<div[^>]*id="${id}"[^>]*>)(</div>)`), `$1\n${inner}\n<!--/${id}-->$2`);
};
put('catgrid', cards);
put('libResults', sections);
fs.writeFileSync(page, html);
console.log(`catalog.html: ${LIBRARY.length} categories, ${LIBRARY.reduce((n, c) => n + c.types.length, 0)} types written`);
