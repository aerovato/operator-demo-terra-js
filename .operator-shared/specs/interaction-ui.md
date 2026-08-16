# Interaction & UI Spec

## Raycast (`src/interaction.ts`)

- Voxel DDA from camera along view direction; max reach 5 blocks; skips Air and Water (can't target water).
- Returns hit block coords plus face normal (used for placement offset).

## Break / Place

- Left mouse hold = break with progress: `dt / BlockDef.breakTime`; a centered progress bar shows via UI callback; block removed at 100%. Switching targets resets progress.
- Right mouse click (edge-triggered, one block per click) places the selected hotbar block at hit + normal; consumes 1 from the inventory stack (see inventory-items spec). Broken blocks drop into the inventory via `dropFor`.
- Placement rejects: non-air/water targets, and solid blocks intersecting the player AABB (0.6 x 1.8 at feet).
- Edits go through `World.setBlock`, which marks the owning chunk dirty plus border neighbors (see chunks-meshing spec); re-mesh happens in `Game.update`'s dirty pass on the main thread.
- Mouse input only applies while pointer-locked; context menu suppressed on canvas. Player + interaction freeze while the inventory panel is open.

## Visuals

- Hit block: black wireframe outline (`EdgesGeometry`), always visible when targeting.
- Breaking: translucent black overlay box whose opacity = progress * 0.45.
- Mesh face windings are CCW-from-outside with index pattern 0,1,2 / 2,1,3 (regression here culls top/side faces — see mesher FACES table).

## Texture Atlas (`src/atlas.ts`)

- 256x256 canvas, 16x16 tiles of 16px, `NearestFilter`, sRGB. Tile indices are fixed by contract (0 grass top, 1 dirt, 2 grass side, 3 stone, 4 sand, 5 water, 6-11 log top/side pairs, 12 leaves, 13 planks, 14 glass, 15 brick) and mirrored by `BlockDef.tiles`.
- Texture packs: `?pack=<name>` loads `public/textures/<name>/manifest.json` (tile-name -> 16x16 png mapping, see `public/textures/example-pack/`); missing tiles fall back to procedural; load failure falls back entirely. Default is fully procedural.

## UI (`src/ui.ts`)

- Hotbar + inventory panel + debug overlay; see inventory-items spec for inventory behavior.
- Debug overlay: fps (30-frame window), position, chunk, seed, mode (walk/swim/fly), selected item.
- All DOM-created (no HTML templating); z-index above canvas.

## Seed Input

- `?seed=<int>` URL param; random when absent/invalid; logged to console and shown in debug overlay.
