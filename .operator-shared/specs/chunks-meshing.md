# Chunks & Meshing Spec

## Chunk Contract

- Chunk = 16x16 blocks horizontally, 64 blocks tall (y-up), `y * 256 + z * 16 + x` index into `Uint8Array`.
- Block ids come from the `Block` const-object union in `src/blocks.ts`. 0 is always Air.
- `World.getBlock(x, y, z)` is world-space and the single lookup path across chunk borders; out-of-range y or missing chunk returns Air. Mesher and (later) physics/raycast must use it, never raw chunk access, so borders cull and collide correctly.

## Meshing Rules

- One opaque and one transparent geometry per chunk; transparent blocks (water, glass, leaves) go in the transparent pass with `depthWrite: false`.
- A face is culled when its neighbor is a non-transparent block, or when neighbor is the same block type as the current one (hides water interiors and glass-glass seams).
- Face order and `BlockDef.tiles` indexing: `[+x, -x, +y, -y, +z, -z]`.
- Atlas: 16x16 tile grid; UVs inset by 0.02 tile to avoid bleeding.
- Block edits: `World.setBlock` marks the chunk dirty, plus the adjacent chunk when the block sits on a border (x/z local 0 or 15); `Game.update` re-meshes dirty chunks with all 4 neighbors present. Meshing currently runs on the main thread (worker move is post-MVP).

## Known Simplifications (to fix on schedule)

- Meshing (including edit re-meshes) runs on the main thread; worker move is post-MVP optimization.
- Transparent material uses DoubleSide + alphaTest so glass edges and water surface render from both sides.
