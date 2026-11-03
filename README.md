# FRAME STUDIO

**Create your own visual language.** A professional online graphic-design studio for posters, wallpapers, album covers, social formats and typographic compositions — built on mathematical Swiss grids.

- Konva canvas editor with layers, transforms, snapping, guides, rulers and undo/redo
- Typography system: 27-face catalogue, custom WOFF/WOFF2/TTF/OTF upload, text styles, vertical type
- Image system: upload (PNG/JPG/WebP/SVG), crop, masks, flip, duotone, halftone, grain, overlays…
- Swiss grid engine: column, modular, baseline, symmetrical, asymmetrical, golden ratio, Fibonacci, thirds, custom
- Algorithmic Composition Generator (10 layout algorithms, local TypeScript engine, pluggable AI provider interface)
- 20+ editable templates, 10 style presets, 10 procedural textures with blend modes
- Smart Resize (scale / preserve typography / reflow / reposition) into a new project
- Export PNG, JPG, WebP (1×/2×/3×/custom), SVG (vector + optional embedded fonts), PDF (vector shapes)
- Local-first storage (IndexedDB + crash recovery), optional Supabase accounts, cloud sync and public gallery

## Quick start

Requirements: Node.js 20+ (tested with Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000. No configuration is needed — without Supabase credentials the app runs fully locally and stores everything in your browser (IndexedDB).

### Production build

```bash
npm run build
npm start
```

## Optional: Supabase (accounts, cloud sync, Explore)

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/` (SQL editor or `supabase db push`). It creates tables, Row Level Security policies and the `assets` (private) and `thumbnails` (public-read) storage buckets.
3. Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Only the public anon key is used in the browser; ownership is enforced by RLS. Never expose the service-role key.

When signed in, saved projects are mirrored to Supabase (`frame:project-saved` event → `lib/supabase/sync.ts`), uploads can be pushed to Storage, and projects can be published to Explore after explicit consent.

## Tests

```bash
npm test                 # Vitest unit tests (grid math, text layout, store/undo, generator, smart resize, templates, SVG export, sanitiser)
npx playwright install chromium
npm run build
npm run test:e2e         # Playwright end-to-end user journey (starts `npm start` automatically)
```

`npm run typecheck` runs the TypeScript compiler.

## Architecture

```
app/                 Next.js routes (landing, templates, create, editor/[projectId], explore, projects, assets, profile, settings, auth, api/images/optimize)
components/          Site UI (landing, navigation, templates, gallery, shared design-system components)
editor/              Editor UI: canvas (Konva stage, rulers, text overlay, context menu), panels, layers, typography, images, shapes, grid, export, resize, history (autosave), shortcuts, actions
core/                Framework-free logic
  document/          Factories, ids
  geometry/          Grid engine, transforms/alignment/snapping, PRNG
  text/              Deterministic text layout (wrap, tracking, word spacing, justify, vertical)
  rendering/         The single renderer (draw.ts), image effects pipeline, vector paths, textures, procedural images
  composition/       Composition generator engine + algorithms + validation
  presets/           Style presets and controlled style application
  templates/         Template library (real editable layers)
  resize/            Smart resize
  serialization/     Versioned project schema + migrations
lib/                 IndexedDB, storage repositories (projects/assets), fonts, image resources, Supabase client/sync
stores/              Zustand stores (editor, ui, auth)
types/               Project, layer, canvas, asset types
supabase/migrations  SQL schema + RLS + storage policies
tests/               Vitest unit tests and Playwright e2e
```

Key design decisions:

- **One renderer.** Every layer is painted by `core/rendering/draw.ts`. The Konva editor calls it from custom `sceneFunc`s, and thumbnails, raster export, generator previews and PDF layers use the same code — what you see is what you export. Grid, guides and selection live on a separate Konva layer and are never exported.
- **Documents hold references, not pixels.** Layers store asset ids; decoded images live in a runtime registry (`lib/image/resources.ts`), binaries in IndexedDB. Processed (filtered) images are memoised.
- **Versioned JSON.** `Project.schemaVersion` + `core/serialization/migrate.ts` upgrade older projects step by step.
- **History** is snapshot-based with structural sharing and key-based coalescing (one undo step per slider drag).

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Undo / Redo | Ctrl/⌘ Z · Ctrl/⌘ ⇧ Z (or Ctrl Y) |
| Save | Ctrl/⌘ S |
| Duplicate | Ctrl/⌘ D |
| Delete | Delete / Backspace |
| Select all | Ctrl/⌘ A |
| Group / Ungroup | Ctrl/⌘ G · Ctrl/⌘ ⇧ G |
| Copy / Cut / Paste | Ctrl/⌘ C · X · V |
| Deselect / exit preview | Esc |
| Pan | Space + drag, or scroll |
| Zoom | Ctrl/⌘ + scroll, Ctrl/⌘ + / − / 0 (fit) / 1 (100%) |
| Nudge | Arrows (Shift = 10px) |
| Layer order | Ctrl/⌘ [ / ] (Shift = back/front) |
| Toggle grid / Preview | G · P |
| Text / Rectangle / Ellipse / Line | T · R · O · L |
| Export | Ctrl/⌘ E |

Shortcuts are ignored while typing in inputs or editing text.
