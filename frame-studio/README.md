# Frame Studio

A free design tool that runs in the browser, with code export for any frame.
Live at https://dpsharmab1-cyber.github.io/frame-studio/

Plain HTML, CSS and ES modules. No build step, no backend, no account.
Files autosave to the browser (IndexedDB) and can be saved / opened as `.frame` files.

## What it does

**Design**
- Infinite canvas: pan (Space, H, middle mouse, trackpad), zoom (Ctrl + wheel, pinch)
- Frames with 18 size presets (web, phone, tablet, social, print)
- Rectangle, ellipse, line, arrow, polygon, star, pen (click points), pencil (freehand), text, images
- Move, resize, rotate, Alt-drag to duplicate, smart guides and snapping, Alt-hover distances
- Auto layout (rows, columns, wrap, gap, padding, alignment, hug / fill / fixed sizing)
- Constraints (left, right, left & right, center, scale) that move children when a frame resizes
- Fill (solid, linear, radial), stroke (inside / center / outside, dashed), drop and inner shadow,
  layer blur, background blur, blend modes, opacity, corner radius
- Text: 30 Google Fonts, weights, size, line height, letter spacing, alignment, case, decoration
- Layers panel with rename, hide, lock and drag-to-reorder or nest
- Group, frame selection, align, distribute, arrange, copy / paste (also across tabs), undo / redo
- Templates (landing page, mobile app, social post), UI blocks, icons

**Export**
- Any frame to HTML + CSS, React (JSX + CSS) or Tailwind, with a live preview at desktop,
  tablet and phone widths
- Layout modes: responsive (constraints become relative CSS, plus automatic phone rules),
  fixed size, or fixed and scaled to the screen
- All frames as one multi-page site; links between frames become page links
- Download as a `.zip` (separate CSS and image files) or copy a single file
- Code tab: CSS, Tailwind classes and HTML for the selected layer
- PNG / JPG at 1x–4x, vector SVG, copy as PNG

## How the code export works

The canvas is real DOM: every layer is rendered by `nodeCSS()` in `js/css.js`, and the
exporter writes out the same CSS. Auto layout is flexbox on the canvas, so it is flexbox in
the code, and what you see is what the code renders.

| File | Role |
| --- | --- |
| `js/model.js` | Document tree, node defaults, tree helpers, constraints |
| `js/css.js` | Node → CSS, shared by canvas and export |
| `js/render.js` | Keyed DOM renderer; reads browser layout back into the model |
| `js/editor.js` | Pointer tools, selection, guides, overlay, text editing |
| `js/commands.js` | Clipboard, group, auto layout, align, arrange |
| `js/panels.js` | Layers, Assets, Design and Code panels |
| `js/export.js` | HTML / React / Tailwind / site export, PNG, SVG, zip |
| `js/blocks.js` | Templates, UI blocks, icons, frame presets |
| `js/store.js` | Autosave and file open / save |

## Not yet

Real-time collaboration, components with variants, prototyping animations, vector point
editing, plugins and comments.

Not affiliated with Figma. Figma is a trademark of Figma, Inc.
