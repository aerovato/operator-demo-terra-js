import { Block } from '../blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './chunk';
import { HALF_WORLD } from './worldgen';
import type { WorldgenRequest, WorldgenResponse } from './workers/worldgen.worker';

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * Chunk store with streaming: chunks are generated in a web worker on demand,
 * cached, and announced via onChunkLoaded. World spans HALF_WORLD*2 blocks
 * centered on origin; outside that is Air.
 */
export class World {
  readonly chunks = new Map<string, Chunk>();
  /** Player block edits this session, "x,y,z" -> block id; applied over generated chunks and saved. */
  readonly edits = new Map<string, number>();
  private readonly pending = new Set<string>();
  private readonly worker: Worker;
  readonly seed: number;
  private readonly onChunkLoaded: (chunk: Chunk) => void;

  constructor(seed: number, onChunkLoaded: (chunk: Chunk) => void) {
    this.seed = seed;
    this.onChunkLoaded = onChunkLoaded;
    this.worker = new Worker(new URL('./workers/worldgen.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorldgenResponse>) => {
      const { cx, cz, blocks } = e.data;
      const chunk = new Chunk(cx, cz, new Uint8Array(blocks));
      this.applyEdits(chunk);
      this.chunks.set(chunkKey(cx, cz), chunk);
      this.pending.delete(chunkKey(cx, cz));
      this.onChunkLoaded(chunk);
    };
  }

  /** Re-applies saved/player edits that fall inside a freshly generated chunk. */
  private applyEdits(chunk: Chunk): void {
    if (this.edits.size === 0) return;
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    for (const [key, block] of this.edits) {
      const [x, y, z] = key.split(',').map(Number);
      if (x < baseX || x >= baseX + CHUNK_SIZE || z < baseZ || z >= baseZ + CHUNK_SIZE) continue;
      if (y < 0 || y >= CHUNK_HEIGHT) continue;
      chunk.set(x - baseX, y, z - baseZ, block as Block);
    }
  }

  requestChunk(cx: number, cz: number): void {
    if (Math.abs(cx * CHUNK_SIZE) > HALF_WORLD || Math.abs(cz * CHUNK_SIZE) > HALF_WORLD) return;
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key) || this.pending.has(key)) return;
    this.pending.add(key);
    const request: WorldgenRequest = { cx, cz, seed: this.seed };
    this.worker.postMessage(request);
  }

  chunkAt(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getBlock(x: number, y: number, z: number): Block {
    if (y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
    if (Math.abs(x) > HALF_WORLD || Math.abs(z) > HALF_WORLD) return Block.Air;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return Block.Air;
    return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  /** Sets a block, records the edit, and marks the owning chunk (and border neighbors) dirty for re-mesh. */
  setBlock(x: number, y: number, z: number, block: Block): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.set(lx, y, lz, block);
    chunk.dirty = true;
    this.edits.set(`${x},${y},${z}`, block);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number): void {
    const chunk = this.chunkAt(cx, cz);
    if (chunk) chunk.dirty = true;
  }

  /** Highest non-air, non-water block y at column; -1 if column empty/unloaded. */
  surfaceHeight(x: number, z: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = this.getBlock(x, y, z);
      if (block !== Block.Air && block !== Block.Water) return y;
    }
    return -1;
  }
}
