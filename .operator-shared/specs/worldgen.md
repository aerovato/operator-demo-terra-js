# Worldgen Spec

## Contract

- Seeded, deterministic: same seed -> same world, on any machine. Seed comes from `?seed=` URL param or random; logged to console.
- World: 2048x2048 blocks centered on origin (128x128 chunks, `HALF_WORLD = 1024`); outside is Air. `CHUNK_HEIGHT = 64`, `SEA_LEVEL = 28`.
- Surface terrain only; no caves. Oceans, lakes (low terrain flooded), rivers (ridged noise valleys), biomes: ocean, beach, plains, forest, desert, taiga.
- Generation is pure function of (seed, cx, cz) living in `src/world/worldgen.ts`; runs only in the worldgen web worker (`src/world/workers/worldgen.worker.ts`), buffers transferred zero-copy.

## Noise Pipeline (`noise.ts`)

- `Noise2D`: seeded gradient noise (mulberry32-shuffled permutation), `fbm()` fractal sum in [-1, 1].
- `hash2(x, z, seed)`: deterministic per-column hash for tree placement.

## Terrain Rules

- Height: continental fbm with land bias +0.15 and linear ramp (land * 30; squaring starved dry land to ~3% of the world and broke dry-land spawn), mountain fbm gated to inland areas, roughness detail, river carving via ridged noise (`|fbm| < 0.035`) down to `SEA_LEVEL - 2`. Dry land covers roughly 40-50% of the world across seeds.
- Surface block by biome: desert/beach -> sand, deep ocean floor -> stone, shallow ocean floor -> sand, else grass; 3 blocks of dirt/sand under surface, stone below.
- Water fills every column from terrain height up to `SEA_LEVEL`.
- Biome selection: height < SEA_LEVEL-2 -> ocean; <= SEA_LEVEL+1 -> beach; else temperature x moisture fbm (taiga / desert / forest / plains).

## Trees Across Borders

- Trees are placed per-column by `hash2` density (forest 3%, taiga 2%, plains 0.4%); each chunk samples columns in `[-2, CHUNK_SIZE+2)` and writes only in-bounds blocks, so canopies span chunk borders identically from both sides. Taiga gets conical spruce; plains/forest get oak/birch blob canopies.

## Chunk Streaming (`world.ts`)

- `World.requestChunk` queues worker generation; dedupes via pending set; caches forever (2048 world is finite).
- `Game.update()` requests nearest-first each frame, meshes when all 4 neighbors exist (marks chunk dirty until then and re-meshes when neighbors arrive), disposes meshes beyond `RENDER_DISTANCE + 2`.
- Spawn: `terrainHeight(seed, x, z)` (exported, no chunk needed) drives the dry-land search; see `saving-menu.md` Spawn Rules.
- `heightAt` is deterministic per seed and shared by worker chunk generation and main-thread spawn queries.
