// File outputs. Everything is generated in the browser, so exports cost nothing to serve.

import { dielineSVG } from './dieline.js';
import { panelLabels } from './engine.js';

export function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function fileBase(model) {
  const v = model.values;
  const dims = model.tpl.dims.map((k) => Math.round(v[k])).join('x');
  return `${model.tpl.id}-${dims}mm`;
}

export function exportSVG(model, artDataURL = null) {
  return dielineSVG(model, { art: artDataURL, screen: false });
}

// ---------- DXF (R12, millimetres) ----------

export function exportDXF(model) {
  const L = [];
  const add = (...kv) => { for (const x of kv) L.push(String(x)); };
  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
  const layers = [['CUT', 6], ['CREASE', 5], ['BLEED', 3]];
  add(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, layers.length);
  for (const [n, c] of layers) add(0, 'LAYER', 2, n, 70, 0, 62, c, 6, 'CONTINUOUS');
  add(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const line = (layer, [x1, y1], [x2, y2]) =>
    add(0, 'LINE', 8, layer, 10, x1.toFixed(4), 20, y1.toFixed(4), 30, 0, 11, x2.toFixed(4), 21, y2.toFixed(4), 31, 0);
  for (const [a, b] of model.cut) line('CUT', a, b);
  for (const [a, b] of model.crease) line('CREASE', a, b);
  for (const p of model.bleed) p.forEach((pt, i) => line('BLEED', pt, p[(i + 1) % p.length]));
  add(0, 'ENDSEC', 0, 'EOF');
  return L.join('\n') + '\n';
}

// ---------- PDF (vector, 1:1, CutContour + Crease spot colours) ----------

export function exportPDF(model, meta) {
  const k = 72 / 25.4, m = 12, foot = 22;
  const b = model.art;
  const W = (b.w + 2 * m) * k, H = (b.h + m + foot) * k;
  const X = (x) => ((x - b.minX + m) * k).toFixed(2);
  const Y = (y) => ((y - b.minY + foot) * k).toFixed(2);
  const seg = (s) => s.map(([[x1, y1], [x2, y2]]) => `${X(x1)} ${Y(y1)} m ${X(x2)} ${Y(y2)} l S`).join('\n');
  const txt = (s) => String(s).replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '');

  const c = [];
  c.push('q 0.3 w 0 0.6 0.25 RG [1.5 1.5] 0 d');
  for (const p of model.bleed) c.push(p.map(([x, y], i) => `${X(x)} ${Y(y)} ${i ? 'l' : 'm'}`).join(' ') + ' h S');
  c.push('Q q /CS1 CS 1 SCN 0.6 w [4 2.5] 0 d 1 J');
  c.push(seg(model.crease));
  c.push('Q q /CS0 CS 1 SCN 0.7 w 1 J 1 j');
  c.push(seg(model.cut));
  c.push('Q');
  c.push('BT 0.55 g');
  for (const l of panelLabels(model)) {
    const size = Math.max(5, l.size * k * 0.9);
    const wEst = l.text.length * size * 0.5;
    c.push(`/F1 ${size.toFixed(1)} Tf 1 0 0 1 ${(+X(l.at[0]) - wEst / 2).toFixed(2)} ${(+Y(l.at[1]) - size / 3).toFixed(2)} Tm (${txt(l.text)}) Tj`);
  }
  c.push('ET');
  const lines = [
    `${meta.title}  |  ${meta.dims}  |  ${meta.material}`,
    `Flat ${b.w.toFixed(1)} x ${b.h.toFixed(1)} mm incl. 3 mm bleed  |  Scale 1:1, millimetres  |  Magenta = CutContour, Blue dashed = Crease, Green = Bleed`,
  ];
  c.push(`BT 0.15 g /F1 9 Tf 1 0 0 1 ${(m * k).toFixed(2)} ${(foot * k * 0.55).toFixed(2)} Tm (${txt(lines[0])}) Tj ET`);
  c.push(`BT 0.45 g /F1 6.5 Tf 1 0 0 1 ${(m * k).toFixed(2)} ${(foot * k * 0.28).toFixed(2)} Tm (${txt(lines[1])}) Tj ET`);
  const stream = c.join('\n');

  const sep = (name, cmyk) => `[/Separation /${name} /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [${cmyk}] /N 1 >>]`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 5 0 R >> /ColorSpace << /CS0 6 0 R /CS1 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    sep('CutContour', '0 1 0 0'),
    sep('Crease', '1 0 0 0'),
    `<< /Producer (Pack Studio prototype) /Title (${txt(meta.title)} dieline) >>`,
  ];
  let pdf = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
