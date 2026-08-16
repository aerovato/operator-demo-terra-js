import { Block } from '../blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './chunk';
import { hash2, Noise2D } from './noise';

export const SEA_LEVEL = 28;
/** World is WORLD_SIZE x WORLD_SIZE blocks (2048), centered on origin. */
export const WORLD_SIZE = 2048;
export const HALF_WORLD = WORLD_SIZE / 2;

export interface Biome {
  name: 'ocean' | 'beach' | 'plains' | 'forest' | 'desert' | 'taiga';
}

class WorldGenerator {
  private readonly continent: Noise2D;
  private readonly mountains: Noise2D;
  private readonly roughness: Noise2D;
  private readonly temperature: Noise2D;
  private readonly moisture: Noise2D;
  private readonly rivers: Noise2D;

  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.continent = new Noise2D(seed + 1);
    this.mountains = new Noise2D(seed + 2);
    this.roughness = new Noise2D(seed + 3);
    this.temperature = new Noise2D(seed + 4);
    this.moisture = new Noise2D(seed + 5);
    this.rivers = new Noise2D(seed + 6);
  }

  /** Terrain height in blocks for a column; may be below SEA_LEVEL (water fills above). */
  heightAt(x: number, z: number): number {
    const s = 0.0022;
    const continentN = this.continent.fbm(x * s, z * s, 4);
    // Push toward coasts: below ~-0.08 is ocean basin, above ~0.35 inland plateau.
    const land = Math.max(0, continentN + 0.08);
    let h = SEA_LEVEL + land * land * 52 - 6;

    // Mountains only inland, modulated by roughness noise.
    const inland = Math.max(0, continentN - 0.1);
    const mountainN = this.mountains.fbm(x * 0.004, z * 0.004, 4);
    if (mountainN > 0.15 && inland > 0) {
      const m = (mountainN - 0.15) / 0.85;
      h += m * m * 26 * inland * 2;
    }

    h += this.roughness.fbm(x * 0.02, z * 0.02, 3) * 3;

    // Rivers: ridged noise valleys carved down to just below sea level.
    const riverN = Math.abs(this.rivers.fbm(x * 0.0016, z * 0.0016, 3));
    if (riverN < 0.035 && h > SEA_LEVEL - 2 && h < SEA_LEVEL + 26) {
      const carve = 1 - riverN / 0.035; // 1 at river center
      h = Math.min(h, h * (1 - carve) + (SEA_LEVEL - 2) * carve);
    }

    return h;
  }

  biomeAt(x: number, z: number, height: number): Biome['name'] {
    if (height < SEA_LEVEL - 2) return 'ocean';
    if (height <= SEA_LEVEL + 1) return 'beach';
    const temp = this.temperature.fbm(x * 0.0012, z * 0.0012, 3);
    const moist = this.moisture.fbm(x * 0.0015 + 500, z * 0.0015 + 500, 3);
    if (temp < -0.25) return 'taiga';
    if (temp > 0.25 && moist < 0) return 'desert';
    if (moist > 0.1) return 'forest';
    return 'plains';
  }

  /**
   * Generates one chunk's blocks. Trees are decided per-column via a deterministic
   * hash, and neighbor columns out to +-2 blocks are consulted so trees span chunk
   * borders consistently.
   */
  generateChunk(cx: number, cz: number): Uint8Array {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const setLocal = (x: number, y: number, z: number, block: Block): void => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = block;
    };
    const getLocal = (x: number, y: number, z: number): Block => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
      return blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] as Block;
    };

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const height = Math.floor(this.heightAt(wx, wz));
        const biome = this.biomeAt(wx, wz, height);

        for (let y = 0; y <= Math.max(height, SEA_LEVEL); y++) {
          let block: Block = Block.Air;
          if (y <= height) {
            if (y === height) {
              if (biome === 'desert' || biome === 'beach') block = Block.Sand;
              else if (biome === 'ocean') block = height < SEA_LEVEL - 6 ? Block.Stone : Block.Sand;
              else block = Block.Grass;
            } else if (y >= height - 3) {
              block = biome === 'desert' || biome === 'beach' ? Block.Sand : Block.Dirt;
            } else {
              block = Block.Stone;
            }
          } else if (y <= SEA_LEVEL) {
            block = Block.Water;
          }
          if (block !== Block.Air) setLocal(x, y, z, block);
        }
      }
    }

    // Trees: sample columns in [-2, CHUNK_SIZE+2) so canopies crossing borders appear in both chunks.
    for (let x = -2; x < CHUNK_SIZE + 2; x++) {
      for (let z = -2; z < CHUNK_SIZE + 2; z++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const r = hash2(wx, wz, this.seed);
        const height = Math.floor(this.heightAt(wx, wz));
        const biome = this.biomeAt(wx, wz, height);
        const density = biome === 'forest' ? 0.03 : biome === 'plains' ? 0.004 : biome === 'taiga' ? 0.02 : 0;
        if (r >= density || height <= SEA_LEVEL + 1 || height > CHUNK_HEIGHT - 10) continue;

        const isTaiga = biome === 'taiga';
        const trunk = isTaiga ? Block.SpruceLog : r * 1000 % 1 < 0.25 ? Block.BirchLog : Block.OakLog;
        const trunkH = isTaiga ? 6 + Math.floor(r * 100) % 3 : 4 + Math.floor(r * 100) % 2;

        for (let y = 1; y <= trunkH; y++) setLocal(x, height + y, z, trunk);
        if (isTaiga) {
          // Conical canopy.
          for (let dy = 2; dy <= trunkH + 1; dy++) {
            const radius = dy === trunkH + 1 ? 0 : Math.max(0, Math.floor((trunkH + 1 - dy) / 2));
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (dx === 0 && dz === 0 && dy <= trunkH) continue;
                if (getLocal(x + dx, height + dy, z + dz) === Block.Air) setLocal(x + dx, height + dy, z + dz, Block.Leaves);
              }
            }
          }
        } else {
          // Blob canopy.
          for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
            const radius = dy >= trunkH ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy >= trunkH) continue;
                if (dx === 0 && dz === 0 && dy <= trunkH) continue;
                if (getLocal(x + dx, height + dy, z + dz) === Block.Air) setLocal(x + dx, height + dy, z + dz, Block.Leaves);
              }
            }
          }
        }
      }
    }

    return blocks;
  }
}

const generators = new Map<number, WorldGenerator>();

export function generateChunk(seed: number, cx: number, cz: number): Uint8Array {
  let gen = generators.get(seed);
  if (!gen) {
    gen = new WorldGenerator(seed);
    generators.set(seed, gen);
  }
  return gen.generateChunk(cx, cz);
}
