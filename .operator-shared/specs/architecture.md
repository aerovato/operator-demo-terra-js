# Architecture — Voxel Sandbox MVP

Modules and the contracts between them. Greenfield; names may shift during implementation.

## Modules

- `world/worldgen` — seeded noise (simplex/value) pipeline: heightmap -> biome map (temperature/moisture) -> surface blocks; carve oceans/lakes/rivers below sea level. Pure functions of (seed, x, z). Runs in a web worker.
- `world/chunks` — chunk store: fixed world size (>= 2048² blocks, 16x16 columns, height 64-128), block get/set, dirty tracking. Edits are session-only.
- `world/mesher` — builds per-chunk meshes with face culling (only faces exposed to air/water); separate opaque and transparent (water/glass/leaves) meshes. Runs in worker.
- `render` — Three.js scene, camera, lighting (ambient + directional sun, simple fog), chunk mesh lifecycle (load/unload by distance), texture atlas material.
- `player` — pointer-lock controls, AABB collision vs blocks, gravity, jump, swimming (buoyancy/slow fall in water), fly toggle.
- `interaction` — voxel raycast (DDA), block highlight outline, hold-to-break with progress overlay, place block with collision check against player.
- `ui` — hotbar (9 slots, icons from atlas, scroll/number keys), debug overlay (fps, position, chunk, seed).
- `assets` — CC0 16x16 texture pack packed into one atlas; block registry mapping block id -> faces/texture/properties (solid, transparent, break time).

## Data Flow

worldgen worker -> chunk data (SharedArrayBuffer/typed arrays) -> mesher worker -> geometry buffers -> render. Block edits: main thread sets block, marks chunk (+neighbors) dirty, re-mesh via worker.
