# MVP Vision — Voxel Sandbox (Hackathon, 7 days)

## Product Intent

- Minecraft-like creative-mode sandbox running in the browser, built for a gaming hackathon demo.
- Educational/short demo context; single-player only, no multiplayer planned.

## Locked Decisions

- Rendering: Three.js (WebGL).
- Stack: TypeScript, Vite. Client-only; no server.
- Mode: Creative only. Survival/mobs/crafting are post-MVP.
- World: finite, at least 2048x2048, procedural with random seed + seed input (shareable). Surface terrain only; no caves.
- Terrain must include: oceans, lakes, rivers, multiple biomes.
- Player: walk, jump, swim, fly toggle, pointer-lock FPS camera.
- Blocks: break/place with hold-to-break progress; 9-slot hotbar; ~12 block palette (grass, dirt, stone, sand, water, 3-4 wood types, leaves, planks, glass, brick).
- UI: hotbar + F3-style debug overlay. No menus; settings hardcoded for MVP.
- Presentation: free CC0 texture pack (16x16), no audio.
- Perf: 8-12 chunk render distance, 60fps on mid hardware; 16-32 tall chunk columns, face-culled meshing, worldgen in a web worker.

## Out of Scope (MVP)

- Multiplayer, survival rules, mobs, crafting, caves, audio, persistence of edits, menus/settings UI.
