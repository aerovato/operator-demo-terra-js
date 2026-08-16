import { Block } from './blocks';

/** A stack of identical items in one inventory slot. */
export interface ItemStack {
  block: Block;
  count: number;
}

export const MAX_STACK = 64;

/**
 * What a broken block yields. Identity for now except grass (drops dirt, MC-like)
 * and water/air which never drop. Hook for later survival-era drop tables.
 */
export function dropFor(block: Block): Block | null {
  if (block === Block.Grass) return Block.Dirt;
  return block;
}
