# Pack Studio (prototype)

Type dimensions → get a print-ready dieline and a folding 3D mockup, in the browser.

- Site: `https://dpsharmab1-cyber.github.io/pack-studio/`
- Studio (the app): `https://dpsharmab1-cyber.github.io/pack-studio/studio/`

## What works today

- **16 parametric templates in 8 categories**:
  - Folding cartons: reverse and straight tuck end boxes, polygon gift box (5–12 sides)
  - Mailers & shipping: mailer box, shipping carton (FEFCO 0201 style)
  - Trays & sleeves: open tray, sleeve
  - Pouches: stand-up pouch (bottom gusset, zipper, tear notch, heat seals), flat 3-side-seal pouch
  - Paper bags: shopping bag (turn-over top, rope handles), SOS food bag
  - Tubes: squeeze tube (crimp seal, flip-top cap), paper tube with lid
  - Bottles & jars: bottle label (glass bottle, partial or full wrap), jar label (clear jar with lid)
  - Labels & wraps: can label
- **Smart input**: "mailer box 250x180x70", "shipping box 40x30x30 cm", "coffee pouch 150x230x90", "wine bottle 75 x 300".
- **Live dieline**: cut, crease, 3 mm bleed, glue and heat-seal zones, zipper and tear-notch marks, with pan/zoom.
- **Folding 3D preview**: panels fold in a realistic order. Print stays outside and the board colour shows inside.
- **Design**: colours, patterns, brand name and tagline, logo, or full artwork mapped 1:1 from the dieline.
- **Artwork editor**: add text and image layers on any panel; drag, resize and rotate them on the dieline and see
  them live on the 3D model. Layers are pinned to their panel, so they follow it when the pack is resized.
- **Phones**: the previews let the page scroll; tap "Rotate" or "Pan & zoom" to interact with them.
- **Exports**: SVG dieline, PDF (1:1 with `CutContour` and `Crease` spot colours), DXF (R12, mm),
  GLB 3D model, PNG mockup, and an SVG proof with artwork.
- **Share link**: the URL holds the template, size, material and design text.
- **Saved projects**: Save (Ctrl+S) with autosave afterwards; My projects to open, rename, duplicate and delete.
  Projects save in the browser, or to your account once accounts are switched on.
- **Accounts and payments** (switch on with [backend/SETUP.md](backend/SETUP.md)): email-link and Google
  sign-in via Supabase, projects in your account, Pro and Business plans paid through Razorpay
  (UPI, cards, netbanking), with server-side price and signature checks.
- **Policy pages**: Terms, Privacy, Refund and Contact (`terms.html`, `privacy.html`, `refund.html`, `contact.html`),
  filled from the `BUSINESS` block in `assets/config.js`.
- mm/inch units, material presets with thickness, flat size, board area and the smallest standard sheet it fits.

Everything runs client-side, so serving a user costs almost nothing. That is what makes low pricing sustainable.

## How the "one system for every category" works

```
index.html + assets/   marketing site (royal blue + mustard theme, shared fonts, icons, theme.css)
studio/                the app
studio/js/
templates.js   one entry per packaging style: params + build(params) → flat net of panels
engine.js      compiles any net: cut lines, creases, bleed, fold axes, stats
dieline.js     SVG dieline + the artwork canvas (flat coords == dieline coords)
viewer.js      3D: panels form a parent→child tree; each folds about its hinge
exporters.js   SVG / PDF / DXF writers (GLB + PNG come from the viewer)
editor.js      artwork layers: on-dieline editing and painting onto the 3D texture
cloud.js       browser storage (IndexedDB) and Supabase accounts, projects, Razorpay checkout
account.js     sign-in, My projects, Save/autosave and Upgrade dialogs
app.js         UI, smart input, share links
backend/       Supabase SQL + Edge Functions for payments, with tests (see backend/SETUP.md)
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

Four kinds of template share the engine today: `net` (folding board and paper), `pouch` (flexible film that
inflates from the flat print layout), `tube` (printed laminate that wraps into a cylinder and flattens to a
crimp) and `wrap` (labels on turned containers built from lathe profiles).

## Roadmap toward the full product

1. **Template library at scale**: more FEFCO/ECMA styles (crash-lock bottom, auto-bottom, gable, pillow, two-piece rigid),
   more flexibles (side-gusset and flat-bottom bags, spouted pouches), rigid boxes, cups and displays.
2. **Print accuracy**: per-material thickness compensation on every panel, and a printer-verified test pack for each template.
3. **Accounts and projects**: team sharing, version history, auto-renewing subscriptions.
4. **Editor**: place artwork by clicking on the 3D model, more text tools, saved brand kits.
5. **Rendering**: HDRI scenes, materials (foil, gloss, emboss), turntable video export.
6. **AI**: describe a product and get structure, size and a first design.
7. **Business**: printer marketplace and ordering prints from inside the studio.

## Running locally

Any static server works: `python3 -m http.server` in the repo root, then open `/pack-studio/`.
Nothing loads from a CDN and there is no build step. Open-source pieces are vendored with their licences:
three.js (MIT) and supabase-js (MIT) in `studio/js/vendor/`, Inter and Plus Jakarta Sans (OFL) in `assets/fonts/`, Lucide icons (ISC)
in `assets/icons.js`.
