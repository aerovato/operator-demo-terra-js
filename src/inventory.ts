import { Block } from './blocks';
import type { ItemStack } from './items';
import { MAX_STACK } from './items';

/**
 * Player inventory: 36 slots. Slots 0-8 are the hotbar, 9-35 the main grid.
 * Breaking blocks feeds `add`; placing consumes from the selected hotbar slot.
 */
export class Inventory {
  readonly slots: (ItemStack | null)[] = new Array<ItemStack | null>(36).fill(null);
  selected = 0;

  /** Adds items, merging into existing stacks first (hotbar before main). Returns true if fully added. */
  add(block: Block, count = 1): boolean {
    let remaining = count;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const stack = this.slots[i];
      if (stack && stack.block === block && stack.count < MAX_STACK) {
        const take = Math.min(MAX_STACK - stack.count, remaining);
        stack.count += take;
        remaining -= take;
      }
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(MAX_STACK, remaining);
        this.slots[i] = { block, count: take };
        remaining -= take;
      }
    }
    return remaining === 0;
  }

  selectedItem(): ItemStack | null {
    return this.slots[this.selected];
  }

  /** Decrements the selected hotbar slot; false when the slot is empty. */
  consumeSelected(): boolean {
    const stack = this.slots[this.selected];
    if (!stack) return false;
    stack.count--;
    if (stack.count <= 0) this.slots[this.selected] = null;
    return true;
  }
}
