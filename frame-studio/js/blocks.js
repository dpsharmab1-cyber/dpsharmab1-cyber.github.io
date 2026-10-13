// Free starter content: page templates, UI blocks, icons and frame sizes.
// Built with auto layout so the exported code is real flexbox.

import { build, makeNode, starPath } from './model.js';

const F = 'Inter';

const normPad = (p) => {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  return p;
};
const paintOf = (f) => (!f ? { type: 'none' } : typeof f === 'string' ? { type: 'solid', color: f, opacity: 1 } : { opacity: 1, ...f });

function box(name, dir, o = {}, kids = []) {
  const { gap = 0, pad = 0, align = 'start', justify = 'start', wrap = false, fill = null, radius = 0,
    w = 100, h = 100, sizeW = 'hug', sizeH = 'hug', clip = false, stroke, shadow, ...rest } = o;
  const [pt, pr, pb, pl] = normPad(pad);
  const props = {
    name, w, h, sizeW, sizeH, radius, clip, fill: paintOf(fill),
    layout: { mode: dir, gap, pt, pr, pb, pl, align, justify, wrap }, ...rest,
  };
  if (stroke) props.stroke = { enabled: true, width: 1, align: 'inside', ...stroke };
  if (shadow) props.shadow = { enabled: true, ...shadow };
  return ['frame', props, kids];
}

function txt(text, size = 16, weight = 400, color = '#0F172A', o = {}) {
  const { align = 'left', lh, ls = 0, family = F, fillW = false, w, name, opacity, ...rest } = o;
  return ['text', {
    name: name || text.split('\n')[0].slice(0, 28), text,
    font: { family, size, weight, lh: lh || (size >= 36 ? 1.1 : size >= 22 ? 1.25 : 1.5), ls, align },
    fill: { type: 'solid', color, opacity: opacity ?? 1 },
    textSize: fillW || w ? 'autoH' : 'autoW', sizeW: fillW ? 'fill' : 'fixed', w: w || 200, ...rest,
  }];
}

const shape = (type, name, w, h, fill, extra = {}) => [type, { name, w, h, fill: paintOf(fill), ...extra }];

export const ICONS = {
  'arrow-right': 'M5 12 L19 12 M13 6 L19 12 L13 18',
  'arrow-left': 'M19 12 L5 12 M11 6 L5 12 L11 18',
  check: 'M5 12.5 L10 17.5 L19 7',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  close: 'M6 6 L18 18 M18 6 L6 18',
  menu: 'M4 7 L20 7 M4 12 L20 12 M4 17 L20 17',
  search: 'M10.5 4 A6.5 6.5 0 1 1 10.5 17 A6.5 6.5 0 1 1 10.5 4 Z M15.5 15.5 L20 20',
  home: 'M4 11 L12 4 L20 11 M6 9.5 L6 20 L18 20 L18 9.5',
  user: 'M12 4 A4 4 0 1 1 12 12 A4 4 0 1 1 12 4 Z M4.5 20 C5.5 16 8.5 14 12 14 C15.5 14 18.5 16 19.5 20',
  heart: 'M12 20 C12 20 3 14.5 3 8.8 C3 6.1 5.1 4 7.7 4 C9.5 4 11.1 5 12 6.5 C12.9 5 14.5 4 16.3 4 C18.9 4 21 6.1 21 8.8 C21 14.5 12 20 12 20 Z',
  star: starPath(5, 20, 19).replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => `${(+x + 2).toFixed(2)} ${(+y + 2.5).toFixed(2)}`),
  bell: 'M6 16 L6 11 C6 7.7 8.7 5 12 5 C15.3 5 18 7.7 18 11 L18 16 L20 18 L4 18 Z M10 20.5 C10.5 21.3 11.2 21.7 12 21.7 C12.8 21.7 13.5 21.3 14 20.5',
  mail: 'M3.5 6 L20.5 6 L20.5 18 L3.5 18 Z M3.5 6.5 L12 13 L20.5 6.5',
  cart: 'M3 4 L5.5 4 L8 15 L18 15 L20 7.5 L6.5 7.5 M8 19.5 A1.25 1.25 0 1 0 10.5 19.5 A1.25 1.25 0 1 0 8 19.5 M15.5 19.5 A1.25 1.25 0 1 0 18 19.5 A1.25 1.25 0 1 0 15.5 19.5',
  play: 'M8 5 L19 12 L8 19 Z',
  download: 'M12 4 L12 15 M7 10 L12 15 L17 10 M5 20 L19 20',
  calendar: 'M4 6 L20 6 L20 20 L4 20 Z M4 10 L20 10 M8 3.5 L8 7.5 M16 3.5 L16 7.5',
  sliders: 'M4 7 L20 7 M4 17 L20 17 M9 4.5 L9 9.5 M15 14.5 L15 19.5',
  grid: 'M4 4 L10 4 L10 10 L4 10 Z M14 4 L20 4 L20 10 L14 10 Z M4 14 L10 14 L10 20 L4 20 Z M14 14 L20 14 L20 20 L14 20 Z',
  lock: 'M6 11 L18 11 L18 20 L6 20 Z M8.5 11 L8.5 8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 L15.5 11',
  globe: 'M12 3.5 A8.5 8.5 0 1 1 12 20.5 A8.5 8.5 0 1 1 12 3.5 Z M3.5 12 L20.5 12 M12 3.5 C9.5 6 9.5 18 12 20.5 C14.5 18 14.5 6 12 3.5',
  sparkle: 'M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z',
  send: 'M4 12 L20 4 L14 20 L11.5 13.5 Z M11.5 13.5 L20 4',
  image: 'M4 5 L20 5 L20 19 L4 19 Z M4 16 L9 11 L13 15 L15.5 12.5 L20 17 M15 9 A1.2 1.2 0 1 0 15 9.01',
  chat: 'M4 5 L20 5 L20 16 L10 16 L6 20 L6 16 L4 16 Z',
  wallet: 'M4 7 L20 7 L20 19 L4 19 Z M4 7 L16 4 L17 7 M15 13 L17 13',
};

export function iconNode(name, size = 24, color = '#0F172A') {
  return makeNode('path', {
    name: `Icon / ${name}`, w: size, h: size, vw: 24, vh: 24, d: ICONS[name],
    fill: { type: 'none' }, stroke: { enabled: true, color, width: 2, align: 'center' },
  });
}
const ic = (name, size = 24, color = '#0F172A') => ['path', {
  name: `Icon / ${name}`, w: size, h: size, vw: 24, vh: 24, d: ICONS[name],
  fill: { type: 'none' }, stroke: { enabled: true, color, width: 2, align: 'center' },
}];

/* ---------------- UI blocks ---------------- */

const btn = (label, bg = '#4F46E5', color = '#FFFFFF', o = {}) => box('Button', 'row', {
  pad: o.pad || [12, 20], radius: o.radius ?? 999, fill: bg, align: 'center', justify: 'center', gap: 8, tag: 'button',
  stroke: o.stroke, ...(o.props || {}),
}, [txt(label, o.size || 15, 600, color), ...(o.icon ? [ic(o.icon, 18, color)] : [])]);

const feature = (icon, title, body) => box('Feature card', 'column', {
  pad: 28, gap: 14, radius: 20, fill: '#F8FAFC', sizeW: 'fill', stroke: { color: '#E2E8F0' },
}, [
  box('Icon wrap', 'row', { w: 48, h: 48, sizeW: 'fixed', sizeH: 'fixed', radius: 14, fill: '#EEF2FF', align: 'center', justify: 'center' }, [ic(icon, 24, '#4F46E5')]),
  txt(title, 20, 600, '#0F172A', { fillW: true }),
  txt(body, 15, 400, '#64748B', { fillW: true, lh: 1.6 }),
]);

export const BLOCKS = [
  { name: 'Primary button', make: () => build(btn('Get started', '#4F46E5', '#FFFFFF', { icon: 'arrow-right' })) },
  { name: 'Secondary button', make: () => build(btn('Learn more', '#FFFFFF', '#0F172A', { stroke: { color: '#E2E8F0' } })) },
  { name: 'Input field', make: () => build(box('Input', 'column', { gap: 8, w: 320, sizeW: 'fixed' }, [
    txt('Email address', 14, 500, '#334155'),
    box('Field', 'row', { pad: [12, 14], radius: 12, fill: '#FFFFFF', sizeW: 'fill', gap: 10, align: 'center', stroke: { color: '#CBD5E1' } }, [
      ic('mail', 18, '#94A3B8'), txt('you@example.com', 15, 400, '#94A3B8'),
    ]),
  ])) },
  { name: 'Badge', make: () => build(box('Badge', 'row', { pad: [5, 12], radius: 999, fill: '#DCFCE7', align: 'center', gap: 6 }, [
    shape('ellipse', 'Dot', 6, 6, '#16A34A'), txt('Active', 13, 600, '#15803D'),
  ])) },
  { name: 'Avatar + name', make: () => build(box('User', 'row', { gap: 12, align: 'center' }, [
    shape('ellipse', 'Avatar', 44, 44, { type: 'linear', color: '#F472B6', color2: '#6366F1', angle: 135 }),
    box('Meta', 'column', { gap: 2 }, [txt('Maya Patel', 15, 600), txt('Product designer', 13, 400, '#64748B')]),
  ])) },
  { name: 'Toggle', make: () => build(box('Toggle', 'row', { w: 44, h: 26, sizeW: 'fixed', sizeH: 'fixed', pad: 3, radius: 999, fill: '#4F46E5', justify: 'end', align: 'center' }, [
    shape('ellipse', 'Knob', 20, 20, '#FFFFFF', { shadow: { enabled: true, x: 0, y: 1, blur: 3, opacity: 0.25 } }),
  ])) },
  { name: 'Checkbox', make: () => build(box('Checkbox', 'row', { gap: 10, align: 'center' }, [
    box('Box', 'row', { w: 20, h: 20, sizeW: 'fixed', sizeH: 'fixed', radius: 6, fill: '#4F46E5', align: 'center', justify: 'center' }, [ic('check', 14, '#FFFFFF')]),
    txt('Remember me', 15, 400, '#334155'),
  ])) },
  { name: 'Card', make: () => build(box('Card', 'column', { w: 320, sizeW: 'fixed', radius: 20, fill: '#FFFFFF', clip: true, shadow: { x: 0, y: 12, blur: 32, opacity: 0.12 } }, [
    shape('rect', 'Cover', 320, 180, { type: 'linear', color: '#A5B4FC', color2: '#F9A8D4', angle: 135 }, { sizeW: 'fill' }),
    box('Body', 'column', { pad: 20, gap: 8, sizeW: 'fill' }, [
      txt('Card title', 18, 600, '#0F172A', { fillW: true }),
      txt('A short description that wraps over two lines to show how text fills the card.', 14, 400, '#64748B', { fillW: true }),
      btn('Open', '#0F172A', '#FFFFFF', { pad: [9, 16], size: 14 }),
    ]),
  ])) },
  { name: 'Navbar', make: () => build(box('Navbar', 'row', { w: 1200, sizeW: 'fixed', pad: [18, 28], fill: '#FFFFFF', radius: 16, align: 'center', justify: 'between', stroke: { color: '#E2E8F0' } }, [
    box('Logo', 'row', { gap: 10, align: 'center' }, [shape('rect', 'Mark', 28, 28, { type: 'linear', color: '#6366F1', color2: '#EC4899', angle: 135 }, { radius: 8 }), txt('Brand', 18, 700)]),
    box('Links', 'row', { gap: 28, align: 'center' }, ['Product', 'Pricing', 'About', 'Blog'].map((l) => txt(l, 15, 500, '#475569'))),
    btn('Sign up', '#0F172A', '#FFFFFF', { pad: [10, 18], size: 14 }),
  ])) },
  { name: 'Pricing card', make: () => build(box('Pricing', 'column', { w: 320, sizeW: 'fixed', pad: 28, gap: 18, radius: 24, fill: '#0F172A' }, [
    txt('Pro', 16, 600, '#A5B4FC'),
    box('Price', 'row', { gap: 6, align: 'end' }, [txt('$0', 44, 700, '#FFFFFF'), txt('/ forever', 15, 400, '#94A3B8')]),
    box('List', 'column', { gap: 10, sizeW: 'fill' }, ['Unlimited files', 'Code export', 'All templates'].map((l) => box('Item', 'row', { gap: 10, align: 'center' }, [ic('check', 18, '#4ADE80'), txt(l, 15, 400, '#E2E8F0')]))),
    btn('Start free', '#FFFFFF', '#0F172A', { props: { sizeW: 'fill' } }),
  ])) },
  { name: 'Testimonial', make: () => build(box('Testimonial', 'column', { w: 380, sizeW: 'fixed', pad: 24, gap: 16, radius: 20, fill: '#FFFFFF', stroke: { color: '#E2E8F0' } }, [
    txt('“We went from Figma file to live page in an afternoon. The exported code was clean enough to ship.”', 16, 400, '#334155', { fillW: true, lh: 1.6 }),
    box('Author', 'row', { gap: 12, align: 'center' }, [shape('ellipse', 'Avatar', 40, 40, { type: 'linear', color: '#FBBF24', color2: '#F43F5E', angle: 135 }), box('Meta', 'column', { gap: 2 }, [txt('Daniel Kim', 15, 600), txt('Founder, Loop', 13, 400, '#64748B')])]),
  ])) },
  { name: 'Stat', make: () => build(box('Stat', 'column', { gap: 4, pad: 20, radius: 16, fill: '#F8FAFC', w: 200, sizeW: 'fixed' }, [txt('Monthly users', 13, 500, '#64748B'), txt('48.2k', 32, 700), txt('+12% vs last month', 13, 500, '#16A34A')])) },
  { name: 'Footer', make: () => build(box('Footer', 'row', { w: 1200, sizeW: 'fixed', pad: [28, 32], align: 'center', justify: 'between', fill: '#0F172A' }, [
    txt('© 2026 Brand Inc.', 14, 400, '#94A3B8'),
    box('Links', 'row', { gap: 24 }, ['Privacy', 'Terms', 'Contact'].map((l) => txt(l, 14, 500, '#CBD5E1'))),
  ])) },
];

/* ---------------- templates ---------------- */

function landing() {
  return build(box('Landing page', 'column', { w: 1440, h: 1600, sizeW: 'fixed', sizeH: 'hug', fill: '#FFFFFF', clip: true, align: 'stretch' }, [
    box('Nav', 'row', { pad: [22, 80], align: 'center', justify: 'between', sizeW: 'fill', tag: 'header' }, [
      box('Logo', 'row', { gap: 10, align: 'center' }, [
        shape('rect', 'Mark', 30, 30, { type: 'linear', color: '#6366F1', color2: '#EC4899', angle: 135 }, { radius: 9 }),
        txt('Nova', 20, 700),
      ]),
      box('Links', 'row', { gap: 36, align: 'center', tag: 'nav' }, ['Product', 'Templates', 'Pricing', 'Blog'].map((l) => txt(l, 15, 500, '#475569'))),
      btn('Get started', '#0F172A', '#FFFFFF', { pad: [11, 20], size: 14 }),
    ]),
    box('Hero', 'column', { pad: [88, 80, 64, 80], gap: 24, align: 'center', sizeW: 'fill', tag: 'section' }, [
      box('Pill', 'row', { pad: [6, 14], radius: 999, fill: '#EEF2FF', gap: 8, align: 'center' }, [ic('sparkle', 14, '#4F46E5'), txt('New: any frame to clean code', 13, 600, '#4F46E5')]),
      txt('Design it once.\nShip the code today.', 68, 800, '#0F172A', { align: 'center', fillW: true, ls: -1.5, lh: 1.05 }),
      txt('Draw your page with frames and auto layout, then export real HTML, CSS, React or Tailwind. Free, in your browser, no sign up.', 20, 400, '#475569', { align: 'center', fillW: true, lh: 1.55 }),
      box('Actions', 'row', { gap: 12, align: 'center', pad: [8, 0, 24, 0] }, [
        btn('Start designing', '#4F46E5', '#FFFFFF', { icon: 'arrow-right', pad: [14, 24], size: 16 }),
        btn('See templates', '#FFFFFF', '#0F172A', { pad: [14, 24], size: 16, stroke: { color: '#E2E8F0' } }),
      ]),
      box('Product shot', 'column', { h: 520, sizeW: 'fill', sizeH: 'fixed', radius: 28, pad: 28, gap: 16, clip: true,
        fill: { type: 'linear', color: '#E0E7FF', color2: '#FCE7F3', angle: 135 }, shadow: { x: 0, y: 30, blur: 60, opacity: 0.12, color: '#4F46E5' } }, [
        box('Window', 'column', { sizeW: 'fill', sizeH: 'fill', radius: 18, fill: '#FFFFFF', clip: true, shadow: { x: 0, y: 8, blur: 24, opacity: 0.08 } }, [
          box('Toolbar', 'row', { pad: [14, 18], gap: 8, sizeW: 'fill', align: 'center', fill: '#F8FAFC' }, [
            shape('ellipse', 'Dot', 11, 11, '#F87171'), shape('ellipse', 'Dot', 11, 11, '#FBBF24'), shape('ellipse', 'Dot', 11, 11, '#34D399'),
          ]),
          box('Canvas', 'row', { pad: 28, gap: 24, sizeW: 'fill', sizeH: 'fill' }, [
            box('Sidebar', 'column', { w: 220, sizeW: 'fixed', sizeH: 'fill', gap: 12 }, [1, 2, 3, 4, 5].map((i) => shape('rect', 'Line', 220, 14, i === 1 ? '#C7D2FE' : '#EEF2F7', { radius: 7, sizeW: 'fill' }))),
            box('Main', 'column', { sizeW: 'fill', sizeH: 'fill', gap: 16 }, [
              shape('rect', 'Banner', 400, 160, { type: 'linear', color: '#818CF8', color2: '#F472B6', angle: 120 }, { radius: 14, sizeW: 'fill' }),
              box('Tiles', 'row', { gap: 16, sizeW: 'fill', sizeH: 'fill' }, [1, 2, 3].map(() => shape('rect', 'Tile', 100, 100, '#F1F5F9', { radius: 14, sizeW: 'fill', sizeH: 'fill' }))),
            ]),
          ]),
        ]),
      ]),
    ]),
    box('Features', 'row', { pad: [48, 80, 96, 80], gap: 24, sizeW: 'fill', tag: 'section' }, [
      feature('grid', 'Auto layout = flexbox', 'Rows, columns, gaps and padding map one to one to CSS flexbox, so pages stay responsive.'),
      feature('download', 'Export anything', 'HTML + CSS, React, Tailwind, a multi-page site as a .zip, or PNG, JPG and SVG.'),
      feature('lock', 'Private by default', 'Everything stays in your browser. No account, no upload, no watermark.'),
    ]),
    box('CTA', 'column', { pad: [80, 80], gap: 20, align: 'center', sizeW: 'fill', fill: { type: 'linear', color: '#4F46E5', color2: '#9333EA', angle: 120 }, tag: 'section' }, [
      txt('Your next site starts as a frame.', 44, 800, '#FFFFFF', { align: 'center', fillW: true, ls: -1 }),
      txt('Open a template, change the words, export the code.', 18, 400, '#E0E7FF', { align: 'center', fillW: true }),
      btn('Open Frame Studio', '#FFFFFF', '#4F46E5', { pad: [14, 26], size: 16 }),
    ]),
    box('Footer', 'row', { pad: [32, 80], align: 'center', justify: 'between', sizeW: 'fill', tag: 'footer' }, [
      txt('© 2026 Nova Inc.', 14, 400, '#94A3B8'),
      box('Links', 'row', { gap: 24 }, ['Privacy', 'Terms', 'Contact'].map((l) => txt(l, 14, 500, '#64748B'))),
    ]),
  ]));
}

function mobile() {
  const action = (icon, label) => box('Action', 'column', { gap: 8, align: 'center', sizeW: 'fill' }, [
    box('Circle', 'row', { w: 54, h: 54, sizeW: 'fixed', sizeH: 'fixed', radius: 999, fill: '#FFFFFF', align: 'center', justify: 'center', shadow: { x: 0, y: 4, blur: 12, opacity: 0.06 } }, [ic(icon, 22, '#4F46E5')]),
    txt(label, 12, 500, '#475569'),
  ]);
  const item = (icon, tint, title, sub, amt, amtColor = '#0F172A') => box('Transaction', 'row', { pad: 14, gap: 12, radius: 18, fill: '#FFFFFF', align: 'center', sizeW: 'fill' }, [
    box('Icon', 'row', { w: 42, h: 42, sizeW: 'fixed', sizeH: 'fixed', radius: 14, fill: tint, align: 'center', justify: 'center' }, [ic(icon, 20, '#0F172A')]),
    box('Text', 'column', { gap: 2, sizeW: 'fill' }, [txt(title, 15, 600), txt(sub, 13, 400, '#94A3B8')]),
    txt(amt, 15, 600, amtColor),
  ]);
  return build(box('Mobile / Wallet', 'column', { w: 393, h: 852, sizeW: 'fixed', sizeH: 'fixed', pad: [20, 20, 24, 20], gap: 22, fill: '#F4F5FA', clip: true, radius: 0 }, [
    box('Header', 'row', { align: 'center', justify: 'between', sizeW: 'fill' }, [
      box('Hello', 'column', { gap: 2 }, [txt('Good morning', 13, 500, '#94A3B8'), txt('Aisha Khan', 21, 700)]),
      shape('ellipse', 'Avatar', 42, 42, { type: 'linear', color: '#F9A8D4', color2: '#818CF8', angle: 135 }),
    ]),
    box('Balance card', 'column', { pad: 22, gap: 6, radius: 26, sizeW: 'fill', fill: { type: 'linear', color: '#4F46E5', color2: '#9333EA', angle: 135 }, shadow: { x: 0, y: 16, blur: 32, opacity: 0.3, color: '#6D28D9' } }, [
      txt('Total balance', 13, 500, '#E0E7FF'),
      txt('$24,560.80', 34, 700, '#FFFFFF', { ls: -0.5 }),
      box('Row', 'row', { pad: [10, 0, 0, 0], justify: 'between', align: 'center', sizeW: 'fill' }, [
        box('Change', 'row', { pad: [5, 10], radius: 999, fill: { type: 'solid', color: '#FFFFFF', opacity: 0.18 }, gap: 6, align: 'center' }, [txt('+4.2% this month', 12, 600, '#FFFFFF')]),
        txt('•••• 4821', 13, 500, '#E0E7FF'),
      ]),
    ]),
    box('Actions', 'row', { gap: 8, sizeW: 'fill' }, [action('send', 'Send'), action('download', 'Receive'), action('wallet', 'Top up'), action('grid', 'More')]),
    box('Section title', 'row', { justify: 'between', align: 'center', sizeW: 'fill' }, [txt('Recent activity', 17, 700), txt('See all', 14, 600, '#4F46E5')]),
    box('List', 'column', { gap: 10, sizeW: 'fill' }, [
      item('cart', '#FEF3C7', 'Grocery market', 'Today, 9:41', '−$64.20'),
      item('wallet', '#DCFCE7', 'Salary', 'Yesterday', '+$3,200.00', '#16A34A'),
      item('play', '#E0E7FF', 'Music subscription', 'Mon, 8:00', '−$9.99'),
    ]),
    box('Spacer', 'none', { w: 10, h: 10, sizeW: 'fill', sizeH: 'fill' }),
    box('Tab bar', 'row', { pad: [14, 26], radius: 999, fill: '#0F172A', justify: 'between', align: 'center', sizeW: 'fill', shadow: { x: 0, y: 10, blur: 30, opacity: 0.25 } }, [
      ic('home', 22, '#FFFFFF'), ic('chat', 22, '#64748B'), ic('calendar', 22, '#64748B'), ic('user', 22, '#64748B'),
    ]),
  ]));
}

function social() {
  return build(['frame', { name: 'Instagram post', w: 1080, h: 1080, fill: { type: 'linear', color: '#0F172A', color2: '#312E81', angle: 160 }, clip: true }, [
    ['ellipse', { name: 'Glow', x: 640, y: -200, w: 640, h: 640, fill: { type: 'solid', color: '#A855F7', opacity: 0.55 }, blur: 120, cH: 'right' }],
    ['ellipse', { name: 'Glow 2', x: -220, y: 760, w: 560, h: 560, fill: { type: 'solid', color: '#06B6D4', opacity: 0.35 }, blur: 120, cV: 'bottom' }],
    ['frame', { name: 'Tag', x: 80, y: 96, w: 220, h: 48, radius: 999, fill: { type: 'solid', color: '#FFFFFF', opacity: 0.12 }, bgBlur: 12, layout: { mode: 'row', pt: 12, pb: 12, pl: 22, pr: 22, gap: 10, align: 'center' }, sizeW: 'hug', sizeH: 'hug', clip: false, stroke: { enabled: true, color: '#FFFFFF', opacity: 0.25, width: 1 } }, [
      ['text', { name: 'Tag text', text: 'FREE DESIGN TOOL', font: { family: 'Space Grotesk', size: 18, weight: 600, lh: 1.2, ls: 2, align: 'left' }, fill: { type: 'solid', color: '#FFFFFF' }, textSize: 'autoW' }],
    ]],
    ['text', { name: 'Headline', x: 80, y: 300, w: 920, text: 'Design to code,\nfree forever.', font: { family: 'Space Grotesk', size: 112, weight: 700, lh: 1, ls: -3, align: 'left' }, fill: { type: 'linear', color: '#FFFFFF', color2: '#C4B5FD', angle: 180 }, textSize: 'autoH', cH: 'stretch' }],
    ['text', { name: 'Body', x: 80, y: 600, w: 760, text: 'Frames, auto layout and components in the browser. Export HTML, React or Tailwind with one click.', font: { family: 'Inter', size: 32, weight: 400, lh: 1.45, align: 'left' }, fill: { type: 'solid', color: '#CBD5E1' }, textSize: 'autoH' }],
    ['text', { name: 'Handle', x: 80, y: 960, text: '@framestudio', font: { family: 'Inter', size: 26, weight: 600, lh: 1.2, align: 'left' }, fill: { type: 'solid', color: '#FFFFFF' }, textSize: 'autoW', cV: 'bottom' }],
    ['path', { name: 'Arrow', x: 920, y: 940, w: 80, h: 80, vw: 24, vh: 24, d: ICONS['arrow-right'], fill: { type: 'none' }, stroke: { enabled: true, color: '#FFFFFF', width: 3, align: 'center' }, cH: 'right', cV: 'bottom' }],
  ]]);
}

export const TEMPLATES = [
  { name: 'Landing page', size: '1440 wide', make: landing },
  { name: 'Mobile wallet app', size: '393 × 852', make: mobile },
  { name: 'Instagram post', size: '1080 × 1080', make: social },
];

export const FRAME_PRESETS = [
  ['Web', [['Desktop', 1440, 1024], ['Laptop', 1280, 800], ['Wide', 1920, 1080]]],
  ['Phone', [['iPhone 16', 393, 852], ['iPhone 16 Pro Max', 440, 956], ['Android', 412, 915]]],
  ['Tablet', [['iPad', 834, 1194], ['iPad Pro 13', 1032, 1376]]],
  ['Social', [['Instagram post', 1080, 1080], ['Instagram portrait', 1080, 1350], ['Story / Reel', 1080, 1920], ['YouTube thumbnail', 1280, 720], ['LinkedIn banner', 1584, 396], ['X / Twitter post', 1600, 900]]],
  ['Print & slides', [['Presentation 16:9', 1920, 1080], ['A4', 595, 842], ['Letter', 612, 792], ['Business card', 1050, 600]]],
];

export function presetFrame(name, w, h) {
  return makeNode('frame', { name, w, h });
}
