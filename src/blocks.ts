export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Water: 5,
  OakLog: 6,
  BirchLog: 7,
  SpruceLog: 8,
  Leaves: 9,
  Planks: 10,
  Glass: 11,
  Brick: 12,
} as const;

export type Block = (typeof Block)[keyof typeof Block];

export interface BlockDef {
  id: Block;
  name: string;
  solid: boolean;
  transparent: boolean;
  /** seconds to break; 0 = instant */
  breakTime: number;
  /** texture tile indices per face: [px, nx, py, ny, pz, nz] */
  tiles: [number, number, number, number, number, number];
}

/** Tile indices into the 16x16-tile atlas; assigned when the atlas is built (Day 5). */
export const BLOCKS: Record<Block, BlockDef> = {
  [Block.Air]: { id: Block.Air, name: 'air', solid: false, transparent: true, breakTime: 0, tiles: [0, 0, 0, 0, 0, 0] },
  [Block.Grass]: { id: Block.Grass, name: 'grass', solid: true, transparent: false, breakTime: 0.4, tiles: [2, 2, 0, 1, 2, 2] },
  [Block.Dirt]: { id: Block.Dirt, name: 'dirt', solid: true, transparent: false, breakTime: 0.4, tiles: [1, 1, 1, 1, 1, 1] },
  [Block.Stone]: { id: Block.Stone, name: 'stone', solid: true, transparent: false, breakTime: 1.0, tiles: [3, 3, 3, 3, 3, 3] },
  [Block.Sand]: { id: Block.Sand, name: 'sand', solid: true, transparent: false, breakTime: 0.3, tiles: [4, 4, 4, 4, 4, 4] },
  [Block.Water]: { id: Block.Water, name: 'water', solid: false, transparent: true, breakTime: 0, tiles: [5, 5, 5, 5, 5, 5] },
  [Block.OakLog]: { id: Block.OakLog, name: 'oak_log', solid: true, transparent: false, breakTime: 0.6, tiles: [7, 7, 6, 6, 7, 7] },
  [Block.BirchLog]: { id: Block.BirchLog, name: 'birch_log', solid: true, transparent: false, breakTime: 0.6, tiles: [9, 9, 8, 8, 9, 9] },
  [Block.SpruceLog]: { id: Block.SpruceLog, name: 'spruce_log', solid: true, transparent: false, breakTime: 0.6, tiles: [11, 11, 10, 10, 11, 11] },
  [Block.Leaves]: { id: Block.Leaves, name: 'leaves', solid: true, transparent: true, breakTime: 0.2, tiles: [12, 12, 12, 12, 12, 12] },
  [Block.Planks]: { id: Block.Planks, name: 'planks', solid: true, transparent: false, breakTime: 0.6, tiles: [13, 13, 13, 13, 13, 13] },
  [Block.Glass]: { id: Block.Glass, name: 'glass', solid: true, transparent: true, breakTime: 0.3, tiles: [14, 14, 14, 14, 14, 14] },
  [Block.Brick]: { id: Block.Brick, name: 'brick', solid: true, transparent: false, breakTime: 1.0, tiles: [15, 15, 15, 15, 15, 15] },
};

export function isSolid(block: Block): boolean {
  return BLOCKS[block].solid;
}
