# Player Controller Spec

## Physics Contract (`src/player.ts`)

- AABB: 0.6 wide, 1.8 tall, eye at +1.62. Position = feet center.
- Collision: axis-separated movement (x, z, then y); revert axis on intersection with any solid block in the swept AABB. `World.getBlock` is the only lookup path (crosses chunk borders).
- Gravity 28, jump 9 (only when grounded last frame), walk 4.3 / sprint 6.5.
- Water: gravity 6, max sink 3, Space swims up at 4, horizontal at 60% walk speed, drag 0.85. `inWater` sampled at mid-eye height.
- Water hop-out: in water, holding Space while pressing against a wall (horizontal collision last frame) or at the surface with movement input gives a full jump velocity, so players can exit pools at block edges.
- Fly toggle: F (requires pointer lock). Fly 12 / sprint-fly 25, Space up, Ctrl down, zero gravity.
- Pointer lock: click canvas to lock; mouse move -> yaw/pitch (0.0022 sens, pitch clamped); keys cleared on unlock.
- Safety: falling below y=-10 respawns at column surface.
- Spawn waits for chunk (0,0), then places player one block above `World.surfaceHeight`.

## Wiring

- `Game.update(dt)` calls `player.update(dt)` before chunk streaming; camera pose (position + YXZ rotation) is written by the player each frame.
- `main.ts` loop clamps dt to 50ms to avoid physics explosions after tab switches.

## Known Simplifications

- Horizontal control is instantaneous (no acceleration/momentum on ground or in air beyond one frame).
- No step-up (auto-jump); players must jump 1-block steps.
