# Red Planet asset pack (Portfolio 2026, v10)

Open `index.html` in this folder (served, e.g. `http://localhost:5173/assets/theme/`) to preview everything.

Built from Deepak's three mockups of 19 Nov 2026 (`Landing and About me`, `Content and cards`, `Connect and contact and Footer`, 1512 px frames).

| File | What it is |
| --- | --- |
| `tokens.css` | Colour, type, spacing, radii, shadows and motion variables. The site loads it first. |
| `components.css` | Buttons, chips, nav pills, topic pills, fields, info panel, stats, experience rows, project cards, labels, marquee, torn-edge helpers. Each rule names the pack class (`rp-*`) and the site class that shares it. Inside `[data-surface="paper"]` components switch to their light look. |
| `motion.css` / `motion.js` | Loops (float, sway, spin, breathe, twinkle, glow, comet, marquee), scroll reveals, the letter-mask rise, the 3D card corridor and hover tilt. The site runs the same specs with GSAP (table on the preview page). Everything respects reduced motion. |
| `icons.svg`, `icons/` | 45 icons, 24 px grid, 1.8 px round strokes in `currentColor`, plus filled theme glyphs. `<svg><use href="icons.svg#arrow-right"/></svg>` |
| `elements/` | Torn-paper edges (`tear-down`, `tear-down-2`, `tear-down-3`, `tear-up`), the emblem's star and glow ring, a flat red planet, Saturn's ring bands, a starfield tile, the SEE MORE disc. All vector. |
| `posters/` | The ten project card faces in the mockup's style, 300 × 450 vector. |
| `mockups/` | Small reference renders of the three mockups. |
| `../v10/` | The two raster worlds (`s1-planet.webp`, `s2-saturn.webp`, 2x), the footer mantra rings (`mantra.svg`, live Devanagari text) and `layers.json` (where each art layer sits in its frame). |

Rebuild (from `D:\Work Archive\Portfolio\Site`):

```
python tools/v10/build_theme.py     # tears, mantra star, planets, layers.json (needs Playwright + Edge)
python tools/v10/build_icons.py     # icons.svg + icons/
python tools/v10/build_posters.py   # posters/
```
