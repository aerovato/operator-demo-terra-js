# Saving & Main Menu Spec

## Storage (`src/save.ts`)

- All persistence via localStorage. Registry key `terrajs:worlds` holds `WorldRecord[]` (id, name, seed, createdAt, lastPlayed). Each world's data lives at `terrajs:world:<id>` as one `WorldSave` JSON: player position + flying flag, inventory slots (nullable `{block, count}` array), sparse block edits keyed `"x,y,z"` -> block id, savedAt.
- Text seed input hashes to a 31-bit int (polynomial, deterministic); numeric seeds used directly; blank = random.
- Quota failures are caught and warned, never fatal (saves dropped, game continues).

## Edit Replay

- `World.edits` is the live session edit map; `World.setBlock` records into it. On every worker-generated chunk, `applyEdits` overlays saved edits before the chunk is announced, so re-meshed/respawned chunks always show player edits. This map is the single source of truth for persistence.

## Menu (`src/menu.ts`)

- Title screen shown on boot (unless `?seed=` quick-start): world list sorted by lastPlayed, create form (name + seed), delete per world, "quick play (no saving)" escape.
- Selecting a world loads its save and resumes at the saved position/flying state (bypasses surface spawn). Quick play and `?seed=` never touch storage.
- Pause menu: Esc / pointer-lock exit while playing shows resume + save-and-quit (saves, then reloads to the title screen). Opening the inventory (E) also releases the lock but is guarded by the panel-open flag, so it must not trigger pause.

## Spawn Rules

- New worlds spawn on dry land: `Player.findLandColumn` spirals out (8 samples/ring, 16 rings) for a column whose surface is above sea level. While candidate chunks are still streaming, spawn returns false and `Game` retries on each chunk load. Falls back to the raw spot only when scanned rings are loaded and none qualify.

## Underwater Ambiance

- When the camera block is water, background + fog switch to deep blue with fog 2-24; otherwise sky blue with the render-distance fog. Single `THREE.Fog` instance mutated in `Game.update`.

## Autosave

- `Game.update` autosaves every 5s + `beforeunload` + pause-menu quit. No-op without a world id. Autosave also refreshes `lastPlayed` for menu ordering.

## Rendering Invariant (bug fix)

- Chunks are only meshed when all 4 horizontal neighbors exist; until then they stay dirty. Missing neighbors read as Air in `World.getBlock`, and meshing against Air leaks water side faces at chunk borders (the reported bug). `onChunkLoaded` marks dirty; the streaming loop's dirty pass builds once neighbors arrive.

## Texture Packs

- Default is `baunilha` — Baunilha by mirtilo (codeberg.org/mirtilo/Baunilha), CC-BY-SA-4.0; attribution lives in the project `README.md` and the pack's license file. Full 16-tile coverage (aspen maps to birch, pine to spruce).
- `?pack=` overrides (e.g. `cc0-blocks` CC0 sample), `?pack=none` forces fully procedural. Unmapped tile names keep procedural art.
