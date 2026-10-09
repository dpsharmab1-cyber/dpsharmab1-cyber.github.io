// Ready-made pack elements: food-type marks, EAN-13 barcode, QR code, nutrition
// table, MRP and legal-details block, and icons. Each one is plain SVG markup, so
// the dieline shows it crisp and the 3D texture paints the same picture.

import qrcode from './vendor/qrcode.mjs';
import { PACK_ICONS } from './pack-icons.js';

const FONT = 'Inter, Arial, Helvetica, sans-serif';
export const SAMPLE_EAN = '890000000000';

export const ELEMENTS = {
  veg: {
    name: 'Veg mark', w: 8,
    data: () => ({}),
    svg: () => ({ vb: [100, 100], body: '<rect x="6" y="6" width="88" height="88" fill="#fff" stroke="#14903b" stroke-width="9"/><circle cx="50" cy="50" r="25" fill="#14903b"/>' }),
  },
  nonveg: {
    name: 'Non-veg mark', w: 8,
    data: () => ({}),
    svg: () => ({ vb: [100, 100], body: '<rect x="6" y="6" width="88" height="88" fill="#fff" stroke="#7a3b12" stroke-width="9"/><path d="M50 24 77 72H23z" fill="#7a3b12"/>' }),
  },
  barcode: {
    name: 'Barcode (EAN-13)', w: 37.3,
    data: () => ({ code: SAMPLE_EAN }),
    svg: (d) => ean13SVG(d.code),
  },
  qr: {
    name: 'QR code', w: 20,
    data: () => ({ text: 'https://example.com' }),
    svg: (d, color) => qrSVG(d.text, color),
  },
  nutrition: {
    name: 'Nutrition table', w: 42,
    data: () => ({
      title: 'Nutritional information',
      basis: 'Approx. values per 100 g',
      rows: 'Energy | 0 kcal\nProtein | 0 g\nCarbohydrate | 0 g\n  Total sugars | 0 g\n  Added sugars | 0 g\nTotal fat | 0 g\n  Saturated fat | 0 g\n  Trans fat | 0 g\nSodium | 0 mg',
    }),
    svg: (d, color) => nutritionSVG(d, color),
  },
  legal: {
    name: 'MRP & legal details', w: 48,
    data: () => ({
      lines: 'MRP ₹ ____ (incl. of all taxes)\nNet quantity: ____\nMfd./Pkd. on: ____\nBest before: ____ from manufacture\nBatch no.: ____\nManufactured & marketed by: ____\nFSSAI Lic. No.: ____\nCustomer care: ____',
    }),
    svg: (d, color) => legalSVG(d, color),
  },
  icon: {
    name: 'Icon', w: 10,
    data: () => ({ icon: 'recycle' }),
    svg: (d, color) => ({
      vb: [24, 24],
      body: `<g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PACK_ICONS[d.icon] || PACK_ICONS.recycle}</g>`,
    }),
  },
};

export const ICON_NAMES = Object.keys(PACK_ICONS);

// font size of the smallest text inside an element, in viewBox units (print check)
export function elementFontUnits(L) {
  if (L.el === 'nutrition') return 4.6;
  if (L.el === 'legal') return 4.4;
  return null;
}

export function elementView(L) {
  const def = ELEMENTS[L.el] || ELEMENTS.icon;
  return def.svg(L.data || def.data(), L.color || '#111111');
}

export function elementMarkup(L) {
  const { vb, body } = elementView(L);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb[0]} ${vb[1]}" width="${vb[0] * 8}" height="${vb[1] * 8}">${body}</svg>`;
}

// The same markup as an <img>, for painting onto canvases. Cached by content.
const cache = new Map();
export function elementImage(L, onReady) {
  const markup = elementMarkup(L);
  let hit = cache.get(markup);
  if (!hit) {
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    const img = new Image();
    hit = { img, ready: false, waiters: [] };
    img.onload = () => { hit.ready = true; hit.waiters.splice(0).forEach((f) => f()); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    cache.set(markup, hit);
  }
  if (!hit.ready && onReady) hit.waiters.push(onReady);
  return hit.ready ? hit.img : null;
}

export function elementsReady(layers) {
  return Promise.all(layers.filter((L) => L.type === 'element').map((L) => new Promise((res) => {
    if (elementImage(L, res)) res();
  })));
}

// ---------- EAN-13 ----------

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function eanCheckDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +d12[i] * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// Accepts 12 digits (check digit added) or 13 (check digit recomputed).
export function normaliseEAN(code) {
  const digits = String(code || '').replace(/\D/g, '').slice(0, 13).padEnd(12, '0').slice(0, 12);
  return digits + eanCheckDigit(digits);
}

function ean13SVG(code) {
  const c = normaliseEAN(code), first = +c[0], par = PARITY[first];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? EAN_L : EAN_G)[+c[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[+c[i]];
  bits += '101';
  // module units: 11 quiet + 95 symbol + 7 quiet; bars 69 tall, guards 74
  const Q = 11, H = 69, G = 74, out = [];
  const guard = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  for (let i = 0; i < 95; i++) {
    if (bits[i] !== '1') continue;
    let j = i;
    while (j + 1 < 95 && bits[j + 1] === '1' && guard(j + 1) === guard(i)) j++;
    out.push(`<rect x="${Q + i}" y="3" width="${j - i + 1}" height="${guard(i) ? G : H}"/>`);
    i = j;
  }
  const t = (x, s) => `<text x="${x}" y="82" text-anchor="middle" font-size="9.5" font-family="${FONT}" letter-spacing="1.2">${s}</text>`;
  return {
    vb: [113, 86],
    body: `<rect width="113" height="86" fill="#fff"/><g fill="#000">${out.join('')}${t(5.5, c[0])}${t(Q + 3 + 21, c.slice(1, 7))}${t(Q + 50 + 21, c.slice(7))}</g>`,
  };
}

// ---------- QR ----------

function qrSVG(text, color) {
  const qr = qrcode(0, 'M');
  // byte mode with UTF-8, so links and Hindi text both encode correctly
  qr.addData(unescape(encodeURIComponent(text || ' ')), 'Byte');
  qr.make();
  const n = qr.getModuleCount(), q = 4, path = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) path.push(`M${x + q} ${y + q}h1v1h-1z`);
  return { vb: [n + q * 2, n + q * 2], body: `<rect width="${n + q * 2}" height="${n + q * 2}" fill="#fff"/><path fill="${color}" d="${path.join('')}"/>` };
}

// ---------- text blocks ----------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function nutritionSVG(d, color) {
  const W = 100, pad = 3, rows = String(d.rows || '').split('\n').filter((r) => r.trim());
  let y = pad + 6.2;
  const parts = [`<text x="${pad}" y="${y}" font-size="6" font-weight="800">${esc(d.title || '')}</text>`];
  y += 5.4;
  parts.push(`<text x="${pad}" y="${y}" font-size="4.6">${esc(d.basis || '')}</text>`);
  y += 2.4;
  parts.push(`<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="1.4"/>`);
  y += 1.4;
  for (const r of rows) {
    const sub = /^\s{2,}/.test(r);
    const [k, v = ''] = r.trim().split(/\s*\|\s*/);
    y += 6.4;
    parts.push(`<text x="${pad + (sub ? 4 : 0)}" y="${y - 1.9}" font-size="4.6"${sub ? '' : ' font-weight="700"'}>${esc(k)}</text>`);
    parts.push(`<text x="${W - pad}" y="${y - 1.9}" font-size="4.6" text-anchor="end">${esc(v)}</text>`);
    parts.push(`<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="0.35"/>`);
  }
  const H = y + pad;
  return {
    vb: [W, H],
    body: `<rect x=".6" y=".6" width="${W - 1.2}" height="${H - 1.2}" fill="#fff" stroke="${color}" stroke-width="1.2"/><g fill="${color}" font-family="${FONT}">${parts.join('')}</g>`,
  };
}

function legalSVG(d, color) {
  const W = 100, pad = 3.5, fs = 4.4, lh = 6, maxChars = Math.floor((W - pad * 2) / (fs * 0.53));
  const lines = [];
  for (const raw of String(d.lines || '').split('\n')) {
    let line = '';
    for (const word of raw.split(' ')) {
      if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word;
    }
    lines.push(line);
  }
  const H = pad * 2 + lines.length * lh;
  const text = lines.map((s, i) => {
    const bold = /^(MRP|M\.R\.P)/i.test(s);
    return `<text x="${pad}" y="${pad + (i + 1) * lh - 1.6}" font-size="${fs}"${bold ? ' font-weight="800"' : ''}>${esc(s)}</text>`;
  }).join('');
  return {
    vb: [W, H],
    body: `<rect x=".6" y=".6" width="${W - 1.2}" height="${H - 1.2}" fill="#fff" stroke="${color}" stroke-width="1"/><g fill="${color}" font-family="${FONT}">${text}</g>`,
  };
}
