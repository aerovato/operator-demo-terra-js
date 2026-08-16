# Items & Inventory Spec

## Inventory Contract (`src/inventory.ts`)

- 36 slots: 0-8 hotbar, 9-35 main grid. `ItemStack = { block, count }`, max stack 64.
- `add(block, count)` merges into existing stacks first (hotbar before main), then fills empty slots; returns false only if full (drops are currently lost on false — acceptable, inventory rarely full).
- Placement consumes from the selected hotbar slot via `consumeSelected()`; empty slot = nothing placed.
- Selection state lives on `Inventory.selected`; UI reads/writes it (keys 1-9, scroll, hotbar clicks).

## Drops (`src/items.ts`)

- `dropFor(block)`: identity mapping except grass -> dirt (MC-like). Water/air never breakable. This is the hook for survival-era drop tables (e.g. leaves -> sapling chance, stone -> cobblestone).

## UI Behavior (`src/ui.ts`)

- Hotbar mirrors slots 0-8 with live counts and atlas-cropped icons; refreshed every frame.
- Inventory panel (E): shows all 36 slots; click picks up a stack (cursor-following ghost), click again places/swaps; same-block clicks merge up to 64. Closing with a held stack returns it to the first free slot.
- Panel open -> `Game.paused` true (player + interaction frozen; rendering/streaming continue), pointer lock released, movement keys cleared. Closing re-requests pointer lock (browsers may enforce a cooldown — clicking the canvas always re-locks).

## Game Loop Consequence

- Break -> `inventory.add(dropFor(block))`; place -> requires selected stack, consumes 1. Player starts with an empty inventory (gather to build).

## Future Survival Hook Points

- Non-block items: widen `ItemStack` to `{ item: ItemId }` with `ItemDef { block?: Block }`; keep slot/merge logic unchanged.
- Crafting reads/writes slots through `Inventory` only; tools can gate `BlockDef.breakTime` via multipliers.
