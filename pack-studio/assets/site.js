import { hydrateIcons, icon } from './icons.js';
import { MATERIALS, byId, defaults } from '../studio/js/templates.js';
import { LIBRARY, ALL_TYPES } from '../studio/js/catalog.js';
import { compile } from '../studio/js/engine.js';
import { drawDesign } from '../studio/js/dieline.js';

hydrateIcons();

// keep the headline numbers in step with the packaging library
document.getElementById('statTemplates').textContent = ALL_TYPES.length;
document.getElementById('statCategories').textContent = LIBRARY.length;

// mobile menu
const menu = document.getElementById('menuBtn'), links = document.querySelector('.links');
menu.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) => { if (e.target.closest('a')) links.classList.remove('open'); });

// hero search goes straight to the studio
document.getElementById('heroAsk').addEventListener('submit', (e) => {
  const q = document.getElementById('heroQ').value.trim();
  if (!q) { e.preventDefault(); location.href = 'studio/'; }
});

// ---------- packaging library: category cards ----------

document.getElementById('homeCats').innerHTML = LIBRARY.map((c) => `<a class="catcard" href="catalog.html#${c.id}">
  <div class="cc-text"><h3>${c.name}</h3><span class="cc-count">${c.types.length} types</span><span class="cc-go">${icon('arrow-right')}</span></div>
  <img src="assets/cat/${c.id}.webp" alt="" loading="lazy" width="160" height="160"></a>`).join('');
document.getElementById('libMore').innerHTML = `Browse all ${ALL_TYPES.length} pack types ${icon('arrow-right')}`;

// ---------- hero: real packs folding, one after another ----------

const SHOWCASE = [
  { id: 'mailer', v: { L: 250, W: 180, H: 70 }, color: '#2547d0' },
  { id: 'standup', v: { W: 140, H: 220, G: 80 }, color: '#e5a912' },
  { id: 'sweet2pc', v: { L: 200, W: 150, H: 50 }, color: '#13288a' },
  { id: 'milkpouch', v: { W: 150, H: 220 }, color: '#2547d0' },
  { id: 'curdcup', v: { D1: 95, D2: 75, Hc: 80 }, color: '#e5a912' },
  { id: 'shopbag', v: { L: 260, W: 120, H: 330 }, color: '#13288a' },
  { id: 'rte', v: { L: 70, W: 45, H: 130 }, color: '#e5a912' },
  { id: 'bottle', v: { D: 72, bottleH: 240 }, color: '#2547d0' },
  { id: 'squeeze', v: { D: 35, L: 140 }, color: '#13288a' },
];

(async () => {
  const host = document.getElementById('hero3d');
  let viewer;
  try {
    const { Viewer } = await import('../studio/js/viewer.js');
    viewer = new Viewer(host);
  } catch (err) {
    host.innerHTML = '<p style="padding:24px;color:#5b6484">3D preview needs WebGL. Open the studio to see the dieline.</p>';
    return;
  }
  const c = viewer.controls;
  c.enableZoom = false; // never hijack page scrolling
  c.enablePan = false;
  c.autoRotate = true;
  c.autoRotateSpeed = 1.6;
  if (matchMedia('(pointer: coarse)').matches) viewer.setInteractive(false);

  let i = 0, anim = 0;
  const show = () => {
    const s = SHOWCASE[i % SHOWCASE.length], t = byId[s.id];
    const model = compile(t, { ...defaults(t), ...s.v }, MATERIALS[t.material]);
    const ink = s.color === '#e5a912' ? '#0b1a5c' : '#ffffff';
    viewer.fold = 0;
    viewer.setModel(model, { refit: true });
    viewer.camera.position.lerp(viewer.controls.target, 0.18); // a touch closer than the studio's framing
    viewer.setArtwork(drawDesign(model, { color: s.color, pattern: 'Solid', brand: 'Your Brand', tagline: 'Made with care', ink, layers: [] }, 1024));
    document.getElementById('heroName').textContent = t.name;
    document.getElementById('heroDims').textContent = t.dims.map((k) => model.values[k]).join(' × ') + ' mm';
    document.getElementById('heroOpen').href = `studio/#t=${t.id}`;
    cancelAnimationFrame(anim);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 2200));
      viewer.setFold(k);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
    i++;
  };
  show();
  setInterval(() => { if (!document.hidden) show(); }, 6500);
})();
