// Dieline SVG (screen and print) and the artwork canvas shared by 2D and 3D views.

import { panelLabels } from './engine.js';

export const INK = { cut: '#e6007e', crease: '#0a84ff', bleed: '#16a34a', glue: '#f59e0b', seal: '#8b5cf6', guide: '#64748b' };

const f = (n) => +n.toFixed(3);

export function dielineSVG(model, { art = null, screen = false, labels = true } = {}) {
  const b = model.art;
  const X = (x) => f(x - b.minX), Y = (y) => f(b.maxY - y);
  const segPath = (segs) => segs.map(([[x1, y1], [x2, y2]]) => `M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}`).join('');
  const poly = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  const sw = (mm, px) => (screen ? `stroke-width="${px}" vector-effect="non-scaling-stroke"` : `stroke-width="${mm}"`);

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${screen ? '' : `width="${f(b.w)}mm" height="${f(b.h)}mm" `}viewBox="0 0 ${f(b.w)} ${f(b.h)}">`);
  out.push(`<defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="${INK.glue}" stroke-width="0.6" opacity="0.6"/></pattern><pattern id="hatchSeal" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="2.5" stroke="${INK.seal}" stroke-width="0.5" opacity="0.55"/></pattern></defs>`);
  if (!screen) out.push(`<title>${esc(model.tpl.name)} dieline, 1:1, millimetres</title>`);

  if (art) {
    // clip the artwork to the die shape plus bleed, like the printed and cut sheet
    out.push(`<clipPath id="dieClip">${model.bleed.map((p) => `<polygon points="${poly(p)}"/>`).join('')}</clipPath>`);
    out.push(`<g id="Artwork" clip-path="url(#dieClip)"><image href="${art}" xlink:href="${art}" x="0" y="0" width="${f(b.w)}" height="${f(b.h)}" preserveAspectRatio="none"/></g>`);
  }
  else if (screen) out.push(`<g id="Board">${model.panels.map((q) => `<polygon points="${poly(q.pts)}" fill="var(--sheet)"/>`).join('')}</g>`);

  out.push(`<g id="Bleed" fill="none" stroke="${INK.bleed}" ${sw(0.15, 0.8)} stroke-dasharray="1 1" opacity="0.7">${model.bleed.map((p) => `<polygon points="${poly(p)}"/>`).join('')}</g>`);

  const glue = model.panels.filter((q) => q.glue);
  if (glue.length) out.push(`<g id="Glue" stroke="none">${glue.map((q) => `<polygon points="${poly(q.pts)}" fill="url(#hatch)"/>`).join('')}</g>`);

  if (model.zones.length) out.push(`<g id="Seal" stroke="${INK.seal}" ${sw(0.1, 0.6)} fill="url(#hatchSeal)">${model.zones.map((p) => `<polygon points="${poly(p)}"/>`).join('')}</g>`);
  if (model.guides.length) {
    out.push(`<g id="Guides" fill="none" stroke="${INK.guide}" ${sw(0.2, 1)} stroke-dasharray="${screen ? '6 3 1 3' : '4 1.5 0.8 1.5'}"><path d="${segPath(model.guides.map((g) => g.seg))}"/></g>`);
    out.push(`<g id="GuideLabels" fill="${INK.guide}" font-family="Helvetica, Arial, sans-serif" font-size="3">${model.guides.filter((g) => g.label).map((g) => `<text x="${X(Math.max(g.seg[0][0], g.seg[1][0]) + 1.5)}" y="${Y(g.seg[0][1]) - 1}">${esc(g.label)}</text>`).join('')}</g>`);
  }
  out.push(`<g id="CutContour" fill="none" stroke="${INK.cut}" ${sw(0.25, 1.4)} stroke-linecap="round"><path d="${segPath(model.cut)}"/></g>`);
  out.push(`<g id="Crease" fill="none" stroke="${INK.crease}" ${sw(0.25, 1.2)} stroke-dasharray="${screen ? '3 2' : '3 1.5'}"><path d="${segPath(model.crease)}"/></g>`);

  if (labels) {
    out.push(`<g id="Info" fill="${screen ? 'var(--label)' : '#8a8f98'}" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">`);
    for (const l of panelLabels(model)) out.push(`<text x="${X(l.at[0])}" y="${Y(l.at[1])}" font-size="${f(l.size)}">${esc(l.text)}</text>`);
    out.push('</g>');
  }
  if (screen) {
    out.push(`<g id="Hit">${model.panels.map((q) => `<polygon points="${poly(q.pts)}" fill="transparent" data-panel="${q.id}"><title>${esc(q.name || q.id)}</title></polygon>`).join('')}</g>`);
  }
  out.push('</svg>');
  return out.join('');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- artwork canvas (flat coordinates == dieline coordinates) ----------

export const PATTERNS = ['Solid', 'Stripes', 'Dots', 'Grid', 'Waves'];

export function drawDesign(model, d, maxPx = 2048) {
  const b = model.art, s = maxPx / Math.max(b.w, b.h);
  const cw = Math.max(2, Math.round(b.w * s)), ch = Math.max(2, Math.round(b.h * s));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');

  g.fillStyle = d.color; g.fillRect(0, 0, cw, ch);
  if (d.art) g.drawImage(d.art, 0, 0, cw, ch);
  else drawPattern(g, d.pattern, cw, ch, s, d.color);

  const fr = model.frontRect, [ux, uy] = fr.up;
  const cx = (fr.x + fr.w / 2 - b.minX) * s, cy = (b.maxY - (fr.y + fr.h / 2)) * s;
  const sideways = Math.abs(ux) > Math.abs(uy);
  const tw = (sideways ? fr.h : fr.w) * s, th = (sideways ? fr.w : fr.h) * s;
  const ink = d.ink || contrastInk(d.color);

  g.save();
  g.translate(cx, cy);
  g.rotate(Math.atan2(ux, uy));
  let y = 0;
  const hasLogo = d.logo && d.logo.width;
  const brandSize = d.brand ? Math.min(th * 0.16, (tw * 0.82) / Math.max(4, d.brand.length * 0.62)) : 0;
  const tagSize = d.tagline ? Math.min(brandSize * 0.42 || th * 0.06, (tw * 0.8) / Math.max(6, d.tagline.length * 0.55)) : 0;
  const logoH = hasLogo ? Math.min(th * 0.3, tw * 0.45 * (d.logo.height / d.logo.width)) : 0;
  const gap = th * 0.04;
  const total = logoH + (logoH && brandSize ? gap : 0) + brandSize + (tagSize ? gap * 0.6 + tagSize : 0);
  y = -total / 2;
  if (hasLogo) {
    const lw = logoH * (d.logo.width / d.logo.height);
    g.drawImage(d.logo, -lw / 2, y, lw, logoH);
    y += logoH + (brandSize ? gap : 0);
  }
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'top';
  if (brandSize) {
    g.font = `700 ${brandSize}px ${d.font || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'}`;
    g.fillText(d.brand, 0, y);
    y += brandSize + gap * 0.6;
  }
  if (tagSize) {
    g.globalAlpha = 0.78;
    g.font = `500 ${tagSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    g.fillText(d.tagline.toUpperCase(), 0, y);
  }
  g.restore();
  return c;
}

function drawPattern(g, kind, w, h, s, base) {
  if (!kind || kind === 'Solid') return;
  g.save();
  g.globalAlpha = 0.14;
  g.fillStyle = g.strokeStyle = contrastInk(base);
  const step = 12 * s;
  if (kind === 'Stripes') {
    g.lineWidth = step * 0.35;
    for (let x = -h; x < w + h; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
  } else if (kind === 'Dots') {
    for (let y = 0; y < h + step; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w + step; x += step) {
      g.beginPath(); g.arc(x, y, step * 0.14, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'Grid') {
    g.lineWidth = Math.max(1, s * 0.4);
    for (let x = 0; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  } else if (kind === 'Waves') {
    g.lineWidth = Math.max(1, s * 0.8);
    for (let y = 0; y < h + step; y += step * 0.8) {
      g.beginPath();
      for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin(x / (step * 0.6)) * step * 0.18);
      g.stroke();
    }
  }
  g.restore();
}

export function contrastInk(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
  return lum > 0.6 ? '#1b1d21' : '#ffffff';
}
