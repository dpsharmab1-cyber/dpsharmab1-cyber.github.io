// Inline SVG icons. UI icons use currentColor; tool icons carry their own colours.
const line = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const badge = (bg, fg, txt) => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="${bg}"/><text x="12" y="16.2" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="10" font-weight="700" fill="${fg}">${txt}</text></svg>`;

export const ICONS = {
  // ---- ui
  arrowDown: line('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  arrowUp: line('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowLeft: line('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  arrowRight: line('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  arrowUpRight: line('<path d="M7 17 17 7M8 7h9v9"/>'),
  close: line('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2"'),
  sun: line('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: line('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  external: line('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  back: line('<path d="M15 6l-6 6 6 6"/>'),
  grid: line('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  expand: line('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  info: line('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),

  // ---- design disciplines (line, tinted red by css)
  visual: line('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  brand: line('<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/><path d="M8 21h8"/>'),
  logo: line('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>'),
  uiux: line('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v11"/>'),
  packaging: line('<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
  social: line('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 15.5s-3-1.8-3-3.9A1.6 1.6 0 0 1 12 10.8a1.6 1.6 0 0 1 3 .8c0 2.1-3 3.9-3 3.9z"/>'),
  print: line('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
  type: line('<path d="M4 19 9 5l5 14M5.8 14h6.4"/><circle cx="18" cy="15.5" r="3"/><path d="M21 12.5V19"/>'),

  // ---- tools (brand colours)
  figma: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F24E1E" d="M9 2h3v6H9a3 3 0 0 1 0-6z"/><path fill="#FF7262" d="M12 2h3a3 3 0 0 1 0 6h-3z"/><path fill="#A259FF" d="M9 8h3v6H9a3 3 0 0 1 0-6z"/><circle fill="#1ABCFE" cx="15" cy="11" r="3"/><path fill="#0ACF83" d="M9 14h3v3a3 3 0 1 1-3-3z"/></svg>`,
  photoshop: badge('#001E36', '#31A8FF', 'Ps'),
  illustrator: badge('#330000', '#FF9A00', 'Ai'),
  indesign: badge('#49021F', '#FF3366', 'Id'),
  blender: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.5l6.2 4.1" stroke="#E87D0D" stroke-width="2.6" stroke-linecap="round"/><path d="M6 14.2l4-2.4" stroke="#E87D0D" stroke-width="2.6" stroke-linecap="round"/><circle cx="14" cy="13.5" r="6.3" fill="#E87D0D"/><circle cx="14" cy="13.5" r="4" fill="#fff"/><circle cx="14" cy="13.5" r="2.3" fill="#265787"/></svg>`,
  spine: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#FF4F18"/><g fill="#fff"><rect x="8" y="5.5" width="8" height="3" rx="1.5"/><rect x="7" y="10.5" width="10" height="3" rx="1.5"/><rect x="8" y="15.5" width="8" height="3" rx="1.5"/></g></svg>`,
  canva: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#00C4CC"/><circle cx="12" cy="12" r="10" fill="#7D2AE8" opacity=".35"/><path d="M15.6 15.2a4.6 4.6 0 1 1 0-6.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  corel: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c4.6 0 8 3.4 8 7.6 0 4.7-4.4 7.4-8 11.4-3.6-4-8-6.7-8-11.4 0-4.2 3.4-7.6 8-7.6z" fill="#3FA535"/><path d="M12 5.5c2.7 0 4.8 2 4.8 4.6 0 2.8-2.6 4.6-4.8 7-2.2-2.4-4.8-4.2-4.8-7 0-2.6 2.1-4.6 4.8-4.6z" fill="#B6D433"/></svg>`,
  wordpress: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#21759B"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="#fff" stroke-width="1"/><path d="M6.8 8.6l2.9 8.2 1.6-4.6-1.2-3.6M11 8.6l2.9 8.2 2.6-7.1" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  woo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v7a2.5 2.5 0 0 1-2.5 2.5H14l2 3-5-3H4.5A2.5 2.5 0 0 1 2 14.5v-7A2.5 2.5 0 0 1 4.5 5z" fill="#7F54B3"/><path d="M5.5 8.5l1.2 5 1.6-3.5 1.4 3.5 1.3-5M14.5 10.6a1.5 1.5 0 1 0 0 .01M18.6 10.6a1.5 1.5 0 1 0 0 .01" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  aitools: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3l1.8 4.9L16.7 9.7l-4.9 1.8L10 16.4l-1.8-4.9L3.3 9.7l4.9-1.8z" fill="#ff1f3d"/><path d="M18 13l.9 2.4 2.4.9-2.4.9L18 19.6l-.9-2.4-2.4-.9 2.4-.9z" fill="#ff7a59"/><circle cx="18.5" cy="5" r="1.4" fill="#ffb199"/></svg>`,
  aiflow: line('<circle cx="5" cy="6" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="12" r="2.2"/><path d="M7.2 6.4c4 .4 5.5 2.6 9.6 5M7.2 17.6c4-.4 5.5-2.6 9.6-5"/><path d="M12 3.5l.7 1.6 1.6.7-1.6.7L12 8.1l-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor"/>'),
  team: line('<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 14.6c2.6-.2 4.6 1.4 5.2 4.2"/>'),

  // ---- techniques (folder chips, line, tinted red by css)
  research: line('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  wireframe: line('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h4M8 16h8"/>'),
  prototype: line('<path d="M5 3l12 7-5.2 1.4L9.5 17z"/><path d="M12.4 12.6l5.6 5.6"/>'),
  layers: line('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  devices: line('<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M6 19h6"/><rect x="17" y="8" width="4.5" height="11" rx="1.2"/>'),
  palette: line('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.8 0-1.4-1.3-1.8-1.3-3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>'),
  tag: line('<path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
  doc: line('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  megaphone: line('<path d="M3 10v4l11 5V5z"/><path d="M14 9a3 3 0 0 1 0 6M6 14.5 7.5 20"/>'),
  calendar: line('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  gamepad: line('<path d="M7 7h10a5 5 0 0 1 4.6 7l-.9 2.1a2.2 2.2 0 0 1-3.6.6L15 14.5H9l-2.1 2.2a2.2 2.2 0 0 1-3.6-.6L2.4 14A5 5 0 0 1 7 7z"/><path d="M7.5 10v3M6 11.5h3M15.5 11h.01M17.5 12.5h.01"/>'),
  character: line('<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  mountain: line('<path d="M2.5 19.5l6.5-11 4 6.5 2.5-3.5 6 8z"/><circle cx="17.5" cy="6" r="1.8"/>'),
  star: line('<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
  cube: line('<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3 12 12l8.5-4.7M12 12v9.5"/>'),
  camera: line('<path d="M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.8"/>'),
  chart: line('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
};

export const SKILLS = {
  design: [
    ['Visual Design', 'visual', 'Layout, hierarchy and imagery that make complex ideas easy to read at a glance.'],
    ['Brand identity', 'brand', 'Logo systems, colour, type and voice — documented so teams can scale the brand.'],
    ['Logo design', 'logo', 'Marks that work from favicon to signboard, with metal, gold and mono variants.'],
    ['UI / UX design', 'uiux', 'Flows, wireframes and high-fidelity screens for dashboards, apps and websites.'],
    ['Packaging design', 'packaging', 'Die-lines, labels and shelf-ready packs for dairy, food, lighting and supplements.'],
    ['Social media design', 'social', 'Campaign systems and post templates that keep a feed consistent and on-brand.'],
    ['Book & print layout', 'print', 'Flyers, brochures, posters and multi-page layouts prepared for press.'],
    ['Typography & color', 'type', 'Type pairing and palettes chosen for character, contrast and accessibility.'],
  ],
  tools: [
    ['Figma', 'figma', 'Daily driver for UI, components, auto-layout and click-through prototypes.'],
    ['Photoshop', 'photoshop', 'Compositing, retouching and product imagery for campaigns and social.'],
    ['Illustrator', 'illustrator', 'Vector logos, illustrations, icons and packaging artwork.'],
    ['InDesign', 'indesign', 'Multi-page documents, catalogues and print-ready layouts.'],
    ['Blender 3D', 'blender', 'Modelling, lighting and rendering product shots and game assets.'],
    ['Spine 2D', 'spine', 'Skeletal animation for game characters and UI motion.'],
    ['Canva', 'canva', 'Editable templates so marketing teams can self-serve on-brand content.'],
    ['Corel Draw', 'corel', 'Print and signage files for vendors who work in Corel.'],
  ],
  web: [
    ['WordPress', 'wordpress', 'Designing and building marketing and brand websites.'],
    ['WooCommerce', 'woo', 'Product catalogues, filters and store UI on WordPress.'],
    ['AI design tools', 'aitools', 'Generative tools for moodboards, concepts and variations — refined by hand.'],
    ['AI workflows', 'aiflow', 'Automating repetitive production steps so the team spends time on ideas.'],
    ['Cross-functional leadership', 'team', 'Leading designers and working with dev, product and marketing to ship.'],
  ],
};

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone) return;
    const svg = ICONS[el.dataset.icon];
    if (svg) { el.insertAdjacentHTML('beforeend', svg); el.dataset.iconDone = '1'; }
  });
}
