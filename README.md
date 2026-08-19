# Terra JS — an Operator demo

**Play it now: https://aerovato.github.io/operator-demo-terra-js/**

Terra JS is a browser voxel sandbox (Minecraft-like) built with Three.js +
TypeScript. It was created as a live demonstration of
[Operator](https://github.com/aerovato/operator-memory) — a durable documentation and
agent-driven development framework — showing what an AI agent can plan, build,
document, and maintain autonomously over a multi-day project.

##### Full OpenCode Conversation: [https://opncd.ai/share/2F8fjjEp](https://opncd.ai/share/2F8fjjEp)

## What this demo shows

The entire codebase, spec set, and project index were produced through an
agent session steered by the Operator framework:

- Scoping and decisions — the MVP vision (rendering stack, world size, biomes,
  player mechanics, inventory, saving) was captured as durable specs before any
  code was written.
- Spec-driven development — each module (worldgen, chunks/meshing, player,
  interaction, inventory, saving/menu) has a contract document that outlived
  the conversation that produced it.
- Bug fixes against invariants — rendering and spawn bugs were fixed by
  finding the violated contract (chunk-neighbor meshing, dry-land spawn) and
  encoding the rule back into the specs.
- A living project index — `.operator-shared/` holds a shareable map of the
  codebase and its contracts, kept current as the project grew.

In short: the agent owned a "brain" on disk, and the project's knowledge
survived across sessions instead of living in chat history.

## Play

Open the **GitHub Pages link** above, or run locally:

```sh
npm install
npm run dev          # http://localhost:5173
```

Or with Docker:

```sh
docker build -t terrajs .
docker run -p 5173:5173 terrajs
```

Build for production with `npm run build`.

### Controls

- Click to lock pointer; WASD move, Space jump/swim up, Shift sprint, F fly
- Left hold: break block; right click: place; E: inventory; 1-9/scroll: hotbar
- Esc: pause (save & quit to title); worlds save automatically to localStorage

### Features

- Procedural 2048x2048 worlds from a seed: biomes (plains, forest, desert,
  taiga), oceans, lakes, and rivers
- Chunk streaming with a worldgen web worker; face-culled meshing
- Break/place blocks with hold-to-break progress, drops, and a real
  36-slot inventory with drag-style stack moving
- World creation, saving, and loading via a main menu; autosave every 5s
- Texture-pack system with a swappable atlas (`?pack=none` for the built-in
  procedural textures)

## Attribution

The default texture pack is **Baunilha** by mirtilo —
https://codeberg.org/mirtilo/Baunilha — licensed under
**CC-BY-SA 4.0** (see `public/textures/baunilha/CC-BY-SA-4.0.txt`).
Tiles are 16x16 pngs remapped into the engine's atlas layout via that folder's
`manifest.json`. A CC0 sample pack is also included at
`public/textures/cc0-blocks/`.
