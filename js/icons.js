// Small icons for the skill chips. Tools wear simplified versions of their
// own marks and colours; design and web skills get line icons drawn in their
// group's colour (currentColor).
// line icons carry pathLength="1" so CSS can draw them in, stroke by stroke
const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`.replace(/<(path|circle|rect)/g, '<$1 class="dr" pathLength="1"');
const tile = (bg, fg, t, fs = 10) => `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5.5" fill="${bg}"/><text x="12" y="${12 + fs * 0.36}" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${t}</text></svg>`;
const disc = (bg, fg, t, fs = 12) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${bg}"/><text x="12" y="${12 + fs * 0.36}" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${t}</text></svg>`;

export const ICONS = {
  'Visual Design': line('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  'Branding': line('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
  'Logo design': line('<path d="M12 3l7 7-7 11-7-11z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v8"/>'),
  'UI / UX': line('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v11"/>'),
  'Packaging': line('<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>'),
  'Social Media': line('<path d="M4 5h16v11H9l-5 4z"/><path d="M12 13.2s-3-1.8-3-3.7a1.6 1.6 0 013-.8 1.6 1.6 0 013 .8c0 1.9-3 3.7-3 3.7z"/>'),
  'Print designing': line('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  'Typography & color': line('<path d="M3 20L9 4h1l6 16M5.4 14h8.2"/><circle cx="19" cy="17" r="2.5"/>'),
  'Figma': '<svg viewBox="0 0 24 24"><path d="M8.5 2h3.5v6.5H8.5a3.25 3.25 0 010-6.5z" fill="#F24E1E"/><path d="M12 2h3.5a3.25 3.25 0 010 6.5H12z" fill="#FF7262"/><path d="M8.5 8.5H12V15H8.5a3.25 3.25 0 010-6.5z" fill="#A259FF"/><circle cx="15.5" cy="11.75" r="3.25" fill="#1ABCFE"/><path d="M8.5 15H12v3.25A3.25 3.25 0 118.5 15z" fill="#0ACF83"/></svg>',
  'Photoshop': tile('#001E36', '#31A8FF', 'Ps'),
  'Illustrator': tile('#330000', '#FF9A00', 'Ai'),
  'InDesign': tile('#49021F', '#FF3366', 'Id'),
  'Blender 3D': '<svg viewBox="0 0 24 24"><path d="M2.5 8.5h8" stroke="#EA7600" stroke-width="3" stroke-linecap="round"/><path d="M4.5 13l5.5-4.5" stroke="#EA7600" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="13.5" r="7.5" fill="#EA7600"/><circle cx="14" cy="13.5" r="4.4" fill="#fff"/><circle cx="14" cy="13.5" r="2.6" fill="#265787"/></svg>',
  'Spine 2D': tile('#1E1E1E', '#FF4F00', 'Sp'),
  'Canva': disc('#00C4CC', '#fff', 'C', 13),
  'Corel Draw': disc('#3BA935', '#fff', 'Cd', 10),
  'WordPress': disc('#21759B', '#fff', 'W', 12),
  'WooCommerce': '<svg viewBox="0 0 24 24"><path d="M3.5 5h17A2.5 2.5 0 0123 7.5v7a2.5 2.5 0 01-2.5 2.5H14l-3 3v-3H3.5A2.5 2.5 0 011 14.5v-7A2.5 2.5 0 013.5 5z" fill="#7F54B3"/><text x="12" y="13.6" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="700" font-size="7.2" fill="#fff">Woo</text></svg>',
  'AI design tools': line('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  'AI workflows': line('<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.1 7.8l4.8 8.4M17.9 7.8l-4.8 8.4"/>'),
  'Cross-functional leadership': line('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 14.5c3 0 5.5 2.1 5.5 5"/>'),
};
