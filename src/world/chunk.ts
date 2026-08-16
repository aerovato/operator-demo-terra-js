import { Block } from '../blocks';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

/** A 16x16 column of blocks, y-up, stored as Uint8Array [y * 256 + z * 16 + x]. */
export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  dirty = true;

  constructor(cx: number, cz: number, blocks?: Uint8Array) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = blocks ?? new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  }

  get(x: number, y: number, z: number): Block {
    return this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] as Block;
  }

  set(x: number, y: number, z: number, block: Block): void {
    this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = block;
  }
}
