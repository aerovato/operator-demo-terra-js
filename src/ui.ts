import type { Atlas } from './atlas';
import { BLOCKS } from './blocks';
import type { Inventory } from './inventory';
import type { ItemStack } from './items';

const SLOT_PX = 46;

/** Draws a block's side tile from the atlas into a slot's canvas. */
function drawIcon(canvas: HTMLCanvasElement, atlasCanvas: HTMLCanvasElement, block: number): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const tile = BLOCKS[block as keyof typeof BLOCKS].tiles[0];
  const tx = (tile % 16) * 16;
  const ty = Math.floor(tile / 16) * 16;
  ctx.drawImage(atlasCanvas, tx, ty, 16, 16, 0, 0, canvas.width, canvas.height);
}

function makeSlotEl(index: number): { el: HTMLDivElement; icon: HTMLCanvasElement; count: HTMLSpanElement } {
  const el = document.createElement('div');
  el.style.cssText =
    `width:${SLOT_PX}px;height:${SLOT_PX}px;border:2px solid #555;border-radius:4px;` +
    'background-color:rgba(20,20,20,0.75);display:flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box;';
  const icon = document.createElement('canvas');
  icon.width = 32;
  icon.height = 32;
  icon.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
  el.appendChild(icon);
  const count = document.createElement('span');
  count.style.cssText =
    'position:absolute;bottom:1px;right:3px;font:bold 12px monospace;color:#fff;' +
    'text-shadow:1px 1px 0 #000;';
  el.appendChild(count);
  void index;
  return { el, icon, count };
}

/**
 * HUD + inventory screen. Hotbar mirrors inventory slots 0-8 with live counts;
 * the E panel shows all 36 slots with click-to-pick/click-to-place stack moving.
 */
export class UI {
  private readonly hotbarEls: { el: HTMLDivElement; count: HTMLSpanElement; icon: HTMLCanvasElement }[] = [];
  private readonly panelEls: { el: HTMLDivElement; count: HTMLSpanElement; icon: HTMLCanvasElement }[] = [];
  private readonly panel: HTMLDivElement;
  private readonly cursorItem: HTMLDivElement;
  private readonly cursorIcon: HTMLCanvasElement;
  private readonly cursorCount: HTMLSpanElement;
  private readonly debugEl: HTMLElement;
  private readonly breakBar: HTMLElement;
  private held: ItemStack | null = null;
  private panelOpen = false;
  private fpsSamples: number[] = [];
  private readonly atlas: Atlas;
  private readonly inventory: Inventory;
  private readonly getDebugInfo: () => Record<string, string>;
  private readonly onPanelToggle: (open: boolean) => void;

  constructor(
    atlas: Atlas,
    inventory: Inventory,
    getDebugInfo: () => Record<string, string>,
    onPanelToggle: (open: boolean) => void,
  ) {
    this.atlas = atlas;
    this.inventory = inventory;
    this.getDebugInfo = getDebugInfo;
    this.onPanelToggle = onPanelToggle;
    const hotbar = document.createElement('div');
    hotbar.style.cssText =
      'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;' +
      'padding:4px;background:rgba(0,0,0,0.45);border-radius:6px;z-index:10;';
    document.body.appendChild(hotbar);
    for (let i = 0; i < 9; i++) {
      const slot = makeSlotEl(i);
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      num.style.cssText = 'position:absolute;top:1px;left:3px;font:9px monospace;color:#bbb;';
      slot.el.appendChild(num);
      const idx = i;
      slot.el.addEventListener('click', () => this.select(idx));
      hotbar.appendChild(slot.el);
      this.hotbarEls.push(slot);
    }

    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none;' +
      'flex-direction:column;gap:10px;padding:14px;background:rgba(15,15,15,0.92);' +
      'border-radius:8px;z-index:20;';
    const mainGrid = document.createElement('div');
    mainGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,auto);gap:4px;';
    const hotGrid = document.createElement('div');
    hotGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,auto);gap:4px;margin-top:4px;';
    this.panel.appendChild(mainGrid);
    this.panel.appendChild(hotGrid);
    document.body.appendChild(this.panel);
    for (let i = 9; i < 36; i++) {
      const slot = makeSlotEl(i);
      const idx = i;
      slot.el.addEventListener('click', () => this.clickSlot(idx));
      mainGrid.appendChild(slot.el);
      this.panelEls[idx] = slot;
    }
    for (let i = 0; i < 9; i++) {
      const slot = makeSlotEl(i);
      const idx = i;
      slot.el.addEventListener('click', () => this.clickSlot(idx));
      hotGrid.appendChild(slot.el);
      this.panelEls[idx] = slot;
    }

    this.cursorItem = document.createElement('div');
    this.cursorItem.style.cssText = 'position:fixed;pointer-events:none;z-index:30;display:none;';
    this.cursorIcon = document.createElement('canvas');
    this.cursorIcon.width = 32;
    this.cursorIcon.height = 32;
    this.cursorIcon.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
    this.cursorCount = document.createElement('span');
    this.cursorCount.style.cssText = 'font:bold 12px monospace;color:#fff;text-shadow:1px 1px 0 #000;';
    this.cursorItem.appendChild(this.cursorIcon);
    this.cursorItem.appendChild(this.cursorCount);
    document.body.appendChild(this.cursorItem);
    document.addEventListener('mousemove', (e) => {
      if (!this.held) return;
      this.cursorItem.style.left = `${e.clientX + 6}px`;
      this.cursorItem.style.top = `${e.clientY + 6}px`;
    });

    this.debugEl = document.createElement('div');
    this.debugEl.style.cssText =
      'position:fixed;top:8px;left:8px;font:12px monospace;color:#fff;' +
      'background:rgba(0,0,0,0.4);padding:6px 8px;border-radius:4px;white-space:pre;z-index:10;';
    document.body.appendChild(this.debugEl);

    this.breakBar = document.createElement('div');
    this.breakBar.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,64px);width:60px;height:6px;' +
      'background:rgba(0,0,0,0.5);border-radius:3px;display:none;z-index:10;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:0;background:#e8e8e8;border-radius:3px;';
    this.breakBar.appendChild(fill);
    document.body.appendChild(this.breakBar);

    document.addEventListener('wheel', (e) => {
      if (this.panelOpen) return;
      this.select((this.inventory.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9);
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.togglePanel();
        return;
      }
      if (this.panelOpen) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) this.select(n - 1);
    });
  }

  get isPanelOpen(): boolean {
    return this.panelOpen;
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.panel.style.display = this.panelOpen ? 'flex' : 'none';
    if (!this.panelOpen && this.held) {
      // Closing with an item on the cursor: return it to the first free slot.
      this.inventory.add(this.held.block, this.held.count);
      this.held = null;
      this.cursorItem.style.display = 'none';
    }
    this.onPanelToggle(this.panelOpen);
    this.refresh();
  }

  select(index: number): void {
    this.inventory.selected = index;
    this.refresh();
  }

  /** Click-to-pick / click-to-place / same-item merge between panel slots. */
  private clickSlot(index: number): void {
    const slot = this.inventory.slots[index];
    if (this.held) {
      if (!slot) {
        this.inventory.slots[index] = this.held;
        this.held = null;
      } else if (slot.block === this.held.block) {
        const total = slot.count + this.held.count;
        slot.count = Math.min(64, total);
        const leftover = total - slot.count;
        if (leftover > 0) this.held.count = leftover;
        else this.held = null;
      } else {
        this.inventory.slots[index] = this.held;
        this.held = slot;
      }
    } else if (slot) {
      this.held = slot;
      this.inventory.slots[index] = null;
    }
    this.cursorItem.style.display = this.held ? 'block' : 'none';
    if (this.held) {
      drawIcon(this.cursorIcon, this.atlas.canvas, this.held.block);
      this.cursorCount.textContent = this.held.count > 1 ? String(this.held.count) : '';
    }
    this.refresh();
  }

  private refreshSlot(el: { el: HTMLDivElement; count: HTMLSpanElement; icon: HTMLCanvasElement }, stack: ItemStack | null, selected: boolean): void {
    el.el.style.borderColor = selected ? '#fff' : '#555';
    el.count.textContent = stack && stack.count > 1 ? String(stack.count) : '';
    if (stack) drawIcon(el.icon, this.atlas.canvas, stack.block);
    else {
      const ctx = el.icon.getContext('2d')!;
      ctx.clearRect(0, 0, el.icon.width, el.icon.height);
    }
  }

  private refresh(): void {
    for (let i = 0; i < 9; i++) {
      this.refreshSlot(this.hotbarEls[i], this.inventory.slots[i], i === this.inventory.selected && !this.panelOpen);
    }
    for (let i = 0; i < 36; i++) {
      if (this.panelEls[i]) this.refreshSlot(this.panelEls[i], this.inventory.slots[i], i === this.inventory.selected);
    }
  }

  setBreakProgress(frac: number): void {
    this.breakBar.style.display = frac > 0 ? 'block' : 'none';
    (this.breakBar.firstChild as HTMLElement).style.width = `${Math.min(frac, 1) * 100}%`;
  }

  update(): void {
    this.refresh();
    this.fpsSamples.push(performance.now());
    while (this.fpsSamples.length > 30) this.fpsSamples.shift();
    const span = (this.fpsSamples[this.fpsSamples.length - 1] - this.fpsSamples[0]) / 1000;
    const fps = this.fpsSamples.length > 1 ? (this.fpsSamples.length - 1) / Math.max(span, 0.001) : 0;
    const info = this.getDebugInfo();
    this.debugEl.textContent = `fps ${fps.toFixed(0)}\n` +
      Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
}
