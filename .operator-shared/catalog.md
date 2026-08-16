# Shared Partition Catalog

## Tree

- `operator.md`
  - Description: Shared Operator Instructions; records the share policy (main index shared, rest private).
  - Read If: Auto-injected.
- `catalog.md`
  - Description: This catalog.
  - Read If: Auto-injected.
- `README.md`
  - Description: Operator Memory README for the shared partition.
  - Read If: New contributors or agents onboarding to the shared brain.
- `index/`
  - Directory auto-handled by Operator; contains the shared Project Index.
- `specs/`
  - Shared system contracts and architecture notes; project has collaborators.
- `product/`
  - Shared product intent and vision.

### `specs/` - System contracts

- `architecture.md`
  - Description: Module breakdown (worldgen, chunks, mesher, render, player, interaction, ui, assets) and data flow between them.
  - Read If: Before designing or implementing any module; when deciding where new code belongs.
- `chunks-meshing.md`
  - Description: Chunk data contract, cross-border lookup rules, meshing/culling rules, atlas conventions.
  - Read If: Touching chunk storage, the mesher, block edits, or anything that reads blocks across chunk borders.
- `worldgen.md`
  - Description: Seeded terrain contract — noise pipeline, biome rules, water features, tree border-crossing scheme, chunk streaming.
  - Read If: Working on worldgen, the worker pipeline, chunk streaming, or terrain/biome behavior.
- `player.md`
  - Description: Player physics contract — AABB dimensions, axis-separated collision, gravity/jump/swim/fly tuning, pointer-lock input, spawn rules.
  - Read If: Touching player movement, collision, controls, camera, or spawn logic.
- `interaction-ui.md`
  - Description: Raycast/break/place contract, mesher winding invariants, atlas tile layout + texture-pack loading, UI behavior.
  - Read If: Working on block interaction, the atlas/textures/packs, or UI.
- `inventory-items.md`
  - Description: Inventory slot model, drops, hotbar/panel behavior, and survival-era extension hook points.
  - Read If: Working on inventory, items, drops, hotbar, or planning crafting/survival.
- `saving-menu.md`
  - Description: localStorage save format, edit replay, main menu flow, autosave, chunk-neighbor meshing invariant, texture-pack defaults.
  - Read If: Working on saves, the menu, chunk streaming/meshing timing, or texture pack loading.

### `product/` - Product intent

- `mvp-vision.md`
  - Description: Locked MVP decisions for the hackathon voxel sandbox (stack, world, player, blocks, UI, perf targets, out-of-scope list).
  - Read If: Planning features, scoping work, or revisiting any MVP decision.
