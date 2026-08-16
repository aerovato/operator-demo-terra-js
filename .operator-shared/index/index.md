---
description: Shared main Project Index for terra-js, a browser voxel sandbox (Minecraft-like) built with Three.js + TypeScript for a hackathon.
read_if: Starting work in this repository and needing a map of the codebase.
---

# Shared Project Index

## Architecture

- Vite + TypeScript client, Three.js rendering; no server, single-player only. Dev/Docker server binds 0.0.0.0:5173.
- Core loop: seeded worldgen (worker) -> `Chunk` block store (Uint8Array columns, 16x16x64) -> face-culled mesher -> Three.js meshes (opaque + transparent passes), streamed around the camera.
- Block identity: const-object `Block` union in `src/blocks.ts` (project bans TS enums via `erasableSyntaxOnly` in tsconfig).
- See `.operator-shared/specs/` for module contracts and MVP scope.

## Project Index

- `index.html` — Entry page; full-viewport canvas `#game`.
- `package.json` — Vite + three; `npm run build` = tsc + vite build.
- `tsconfig.json` — Strict, `erasableSyntaxOnly`, `noUnusedLocals/Parameters`.
- `vite.config.ts` — Dev server host 0.0.0.0, port 5173.
- `Dockerfile` / `.dockerignore` — Node 22 container running `npm run dev` on 5173.

- `README.md` — Project intro, run instructions, controls, Baunilha CC-BY-SA-4.0 attribution.

### `public/`

- `textures/example-pack/manifest.json` — Texture-pack template documenting the tile-name mapping.
- `textures/baunilha/` — Default pack; Baunilha by mirtilo (CC-BY-SA-4.0, license file inside).
- `textures/cc0-blocks/` — CC0 16x16 pack (opengameart, see its LICENSE.txt); alternate.

### `src/`

- `main.ts` — Async bootstrap: menu/quick-start, seed `?seed=`, texture pack `?pack=`, canvas, resize, dt-clamped loop, beforeunload save.
- `game.ts` — `Game`: scene, camera, lights, fog, chunk streaming + mesh lifecycle, player/interaction/inventory/UI wiring, mouse input, pause-on-panel, save restore + autosave.
- `player.ts` — `Player`: pointer-lock FPS controller, AABB collision, gravity/jump/swim (with edge hop-out), fly toggle.
- `interaction.ts` — Voxel DDA raycast, block highlight, hold-to-break with progress, placement rules, inventory drops/consumption.
- `inventory.ts` — `Inventory`: 36 slots (9 hotbar + 27 main), stack merging, selection.
- `items.ts` — `ItemStack`, max stack size, `dropFor` block-drop mapping.
- `save.ts` — localStorage world registry, save snapshots, edit-map serialization.
- `menu.ts` — Title screen: world list/create/delete, quick play.
- `atlas.ts` — Procedural 256x256 atlas + `loadAtlas` texture-pack loader (`public/textures/<pack>/manifest.json`).
- `ui.ts` — `UI`: hotbar + inventory panel (E, click-to-move stacks), debug overlay, break progress bar.
- `blocks.ts` — Block registry: ids, solidity, transparency, break times, atlas tile indices per face.

#### `src/world/`

- `chunk.ts` — `Chunk`: 16x16x64 Uint8Array column, y*256+z*16+x layout, dirty flag.
- `world.ts` — `World`: streaming chunk map backed by worldgen worker, world-space `getBlock`, `surfaceHeight`.
- `worldgen.ts` — Seeded terrain: continents, mountains, rivers, biomes (ocean/beach/plains/forest/desert/taiga), trees.
- `noise.ts` — `Noise2D` gradient noise + fbm, `hash2` for tree placement.
- `mesher.ts` — Face-culled chunk mesher producing opaque/transparent BufferGeometries with atlas UVs.

#### `src/world/workers/`

- `worldgen.worker.ts` — Worker entry: generates chunks, transfers buffers; also hosts request/response types.
