# Pack Studio (prototype)

Type dimensions → get a print-ready dieline and a folding 3D mockup, in the browser.

Live (after merge): `https://dpsharmab1-cyber.github.io/pack-studio/`

## What works today

- **12 parametric templates in 6 categories**:
  - Folding cartons: reverse and straight tuck end boxes, polygon gift box (5–12 sides)
  - Mailers & shipping: mailer box, shipping carton (FEFCO 0201 style)
  - Trays & sleeves: open tray, sleeve
  - Pouches & bags: stand-up pouch (bottom gusset, zipper, tear notch, heat seals), flat 3-side-seal pouch
  - Bottles & jars: bottle label (glass bottle, partial or full wrap), jar label (clear jar with lid)
  - Labels & wraps: can label
- **Smart input**: "mailer box 250x180x70", "shipping box 40x30x30 cm", "coffee pouch 150x230x90", "wine bottle 75 x 300".
- **Live dieline**: cut, crease, 3 mm bleed, glue and heat-seal zones, zipper and tear-notch marks, with pan/zoom.
- **Folding 3D preview**: panels fold in a realistic order. Print stays outside and the board colour shows inside.
- **Design**: colours, patterns, brand name and tagline, logo, or full artwork mapped 1:1 from the dieline.
- **Exports**: SVG dieline, PDF (1:1 with `CutContour` and `Crease` spot colours), DXF (R12, mm),
  GLB 3D model, PNG mockup, and an SVG proof with artwork.
- **Share link**: the URL holds the template, size, material and design text.
- mm/inch units, material presets with thickness, flat size, board area and the smallest standard sheet it fits.

Everything runs client-side, so serving a user costs almost nothing. That is what makes low pricing sustainable.

## How the "one system for every category" works

```
templates.js   one entry per packaging style: params + build(params) → flat net of panels
engine.js      compiles any net: cut lines, creases, bleed, fold axes, stats
dieline.js     SVG dieline + the artwork canvas (flat coords == dieline coords)
viewer.js      3D: panels form a parent→child tree; each folds about its hinge
exporters.js   SVG / PDF / DXF writers (GLB + PNG come from the viewer)
app.js         UI, smart input, share links
```

A template only describes panels:

```js
{ id: 'lid', pts: rect(0, H, L, W), parent: 'back', hinge: [[0, H], [L, H]], angle: 90, layer: 0, seq: 6 }
```

From that one description the engine derives everything else:
- **Cut lines**: every panel edge minus the hinge segments.
- **Creases**: the hinges.
- **Fold direction**: always away from the printed side.
- **Stacking**: `layer` keeps overlapping flaps from z-fighting.
- **Fold order**: `seq` sets the animation sequence.
- **UV mapping**: comes from flat coordinates, so artwork made on the SVG lines up on the 3D model.

**Adding a new category means writing one `build()` function, about 20–60 lines.** No new 3D, export or UI code is needed.

Three kinds of template share the engine today: `net` (folding board), `pouch` (flexible film that
inflates from the flat print layout) and `wrap` (labels on turned containers built from lathe profiles).

## Roadmap toward the full product

1. **Template library at scale**: more FEFCO/ECMA styles (crash-lock bottom, auto-bottom, gable, pillow, two-piece rigid),
   more flexibles (side-gusset and flat-bottom bags, spouted pouches), plus tubes, cups and paper bags.
2. **Print accuracy**: per-material thickness compensation on every panel, and a printer-verified test pack for each template.
3. **Accounts and projects**: saved designs, team sharing, version history (e.g. Supabase).
4. **Editor**: place, move and scale artwork per panel directly on the 3D model or dieline, plus text tools.
5. **Rendering**: HDRI scenes, materials (foil, gloss, emboss), turntable video export.
6. **AI**: describe a product and get structure, size and a first design.
7. **Business**: free tier (dieline exports) and Pro (commercial 3D/render exports) via Razorpay/Stripe, plus a printer marketplace.

## Running locally

Any static server works: `python3 -m http.server` in the repo root, then open `/pack-studio/`.
three.js is vendored in `js/vendor/` (MIT), so there is no build step and nothing is loaded from a CDN.
