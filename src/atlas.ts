import * as THREE from 'three';

const TILE = 16;
const GRID = 16;

type RGBA = [number, number, number, number];

function fill(ctx: CanvasRenderingContext2D, tile: number, base: RGBA, noise: number, rand: () => number): void {
  const tx = (tile % GRID) * TILE;
  const ty = Math.floor(tile / GRID) * TILE;
  const img = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    const v = 1 - noise * rand();
    img.data[i * 4] = Math.min(255, base[0] * v);
    img.data[i * 4 + 1] = Math.min(255, base[1] * v);
    img.data[i * 4 + 2] = Math.min(255, base[2] * v);
    img.data[i * 4 + 3] = base[3];
  }
  ctx.putImageData(img, tx, ty);
}

/** Top face detail drawn over the base fill (e.g. log rings). */
function overlay(ctx: CanvasRenderingContext2D, tile: number, draw: (c: CanvasRenderingContext2D, ox: number, oy: number) => void): void {
  const ox = (tile % GRID) * TILE;
  const oy = Math.floor(tile / GRID) * TILE;
  draw(ctx, ox, oy);
}

export interface Atlas {
  texture: THREE.CanvasTexture;
  /** Source canvas; UI uses it to crop block icons for the hotbar. */
  canvas: HTMLCanvasElement;
}

/** Tile names at their fixed atlas indices; packs map these names to image files. */
export const TILE_NAMES = [
  'grass_top', 'dirt', 'grass_side', 'stone', 'sand', 'water',
  'oak_log_top', 'oak_log_side', 'birch_log_top', 'birch_log_side', 'spruce_log_top', 'spruce_log_side',
  'leaves', 'planks', 'glass', 'brick',
] as const;

export type TileName = (typeof TILE_NAMES)[number];

interface PackManifest {
  name: string;
  /** tile name -> image file inside the pack folder (16x16 pngs). */
  tiles: Partial<Record<TileName, string>>;
}

/**
 * Loads a texture pack from `public/textures/<pack>/manifest.json` and composes the
 * atlas canvas from its tile images. Missing tiles fall back to procedural. Falls
 * back to the fully procedural atlas when the pack can't be loaded.
 */
export async function loadAtlas(packName: string | null): Promise<Atlas> {
  if (packName && packName !== 'none') {
    try {
      const res = await fetch(`textures/${packName}/manifest.json`);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const manifest: PackManifest = await res.json();
      const atlas = buildAtlas();
      const ctx = atlas.canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      await Promise.all(TILE_NAMES.map(async (name, index) => {
        const file = manifest.tiles[name];
        if (!file) return;
        const img = new Image();
        img.src = `textures/${packName}/${file}`;
        await img.decode();
        const tx = (index % GRID) * TILE;
        const ty = Math.floor(index / GRID) * TILE;
        ctx.clearRect(tx, ty, TILE, TILE);
        ctx.drawImage(img, tx, ty, TILE, TILE);
      }));
      atlas.texture.needsUpdate = true;
      console.log(`texture pack loaded: ${manifest.name ?? packName}`);
      return atlas;
    } catch (e) {
      console.warn(`texture pack "${packName}" failed, using procedural atlas`, e);
    }
  }
  return buildAtlas();
}

/**
 * Builds the block texture atlas as a 256x256 canvas texture.
 * Tile indices match `BlockDef.tiles` in blocks.ts:
 * 0 grass top, 1 dirt, 2 grass side, 3 stone, 4 sand, 5 water,
 * 6/7 oak top/side, 8/9 birch top/side, 10/11 spruce top/side,
 * 12 leaves, 13 planks, 14 glass, 15 brick.
 * Procedural stand-in for a CC0 16x16 pack; swap by replacing this canvas source.
 */
export function buildAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * GRID;
  canvas.height = TILE * GRID;
  const ctx = canvas.getContext('2d')!;
  let s = 12345;
  const rand = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  fill(ctx, 0, [96, 160, 58, 255], 0.25, rand);        // grass top
  fill(ctx, 1, [134, 96, 67, 255], 0.25, rand);        // dirt
  fill(ctx, 2, [134, 96, 67, 255], 0.2, rand);         // grass side base
  overlay(ctx, 2, (c, ox, oy) => {
    c.fillStyle = 'rgb(96,160,58)';
    c.fillRect(ox, oy, TILE, 4);
    c.fillStyle = 'rgb(86,144,52)';
    for (let x = 0; x < TILE; x += 2) c.fillRect(ox + x, oy + 4, 1, 1 + Math.floor(rand() * 2));
  });
  fill(ctx, 3, [136, 136, 136, 255], 0.3, rand);       // stone
  fill(ctx, 4, [219, 207, 142, 255], 0.15, rand);      // sand
  fill(ctx, 5, [52, 110, 170, 255], 0.1, rand);        // water

  const log = (top: number, side: number, topC: string, sideC: string, barkC: string): void => {
    fill(ctx, top, hexRgb(sideC), 0.15, rand);
    overlay(ctx, top, (c, ox, oy) => {
      c.strokeStyle = topC;
      for (let r = 2; r <= 6; r += 2) {
        c.strokeRect(ox + 8 - r, oy + 8 - r, r * 2, r * 2);
      }
    });
    fill(ctx, side, hexRgb(barkC), 0.2, rand);
    overlay(ctx, side, (c, ox, oy) => {
      c.strokeStyle = sideC;
      for (let x = 1; x < TILE; x += 3) {
        c.beginPath();
        c.moveTo(ox + x, oy);
        c.lineTo(ox + x, oy + TILE);
        c.stroke();
      }
    });
  };
  log(6, 7, '#b08a4f', '#d2a86a', '#6b4a2a');   // oak
  log(8, 9, '#c8b98f', '#e8e2d4', '#d9d2c5');   // birch
  log(10, 11, '#7a5a34', '#8a6a40', '#4a3520'); // spruce

  fill(ctx, 12, [58, 122, 42, 255], 0.35, rand);       // leaves
  fill(ctx, 13, [176, 138, 79, 255], 0.12, rand);      // planks
  overlay(ctx, 13, (c, ox, oy) => {
    c.strokeStyle = 'rgba(80,55,25,0.8)';
    for (let y = 0; y < TILE; y += 4) {
      c.beginPath(); c.moveTo(ox, oy + y); c.lineTo(ox + TILE, oy + y); c.stroke();
    }
  });
  fill(ctx, 14, [0, 0, 0, 0], 0, rand);                // glass (clear)
  overlay(ctx, 14, (c, ox, oy) => {
    c.strokeStyle = 'rgba(220,240,245,0.9)';
    c.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
    c.fillStyle = 'rgba(220,240,245,0.5)';
    c.fillRect(ox + 2, oy + 2, 3, 3);
  });
  fill(ctx, 15, [150, 74, 46, 255], 0.15, rand);       // brick
  overlay(ctx, 15, (c, ox, oy) => {
    c.fillStyle = 'rgb(200,196,190)';
    for (let y = 0; y < TILE; y += 4) c.fillRect(ox, oy + y, TILE, 1);
    for (let y = 0; y < TILE; y += 8) {
      c.fillRect(ox + 4, oy + y, 1, 4);
      c.fillRect(ox + 12, oy + y, 1, 4);
    }
    for (let y = 4; y < TILE; y += 8) {
      c.fillRect(ox + 8, oy + y, 1, 4);
      c.fillRect(ox, oy + y, 1, 4);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}

function hexRgb(hex: string): RGBA {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
