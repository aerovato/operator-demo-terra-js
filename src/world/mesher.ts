import * as THREE from 'three';
import { BLOCKS, Block } from '../blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './chunk';
import { World } from './world';

// Face order: +x, -x, +y, -y, +z, -z. Tile index in BlockDef.tiles matches this order.
// Corner windings must be CCW seen from outside; indices pattern 0,1,2 / 2,1,3.
interface Corner {
  pos: [number, number, number];
  uv: [number, number];
}

interface FaceDef {
  dir: [number, number, number];
  corners: Corner[];
}

const FACES: FaceDef[] = [
  {
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
];

const ATLAS_TILES = 16; // 16x16 tile grid
const UV_INSET = 0.02; // avoid tile bleeding

interface Buffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

function emptyBuffers(): Buffers {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

export interface ChunkGeometry {
  opaque: THREE.BufferGeometry | null;
  transparent: THREE.BufferGeometry | null;
}

function toGeometry(b: Buffers): THREE.BufferGeometry | null {
  if (b.indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  geo.setIndex(b.indices);
  return geo;
}

/** Builds face-culled geometry for one chunk. Neighboring chunks are consulted so chunk borders cull correctly. */
export function meshChunk(world: World, chunk: Chunk): ChunkGeometry {
  const opaque = emptyBuffers();
  const transparent = emptyBuffers();
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const block = chunk.get(x, y, z);
        if (block === Block.Air) continue;
        const def = BLOCKS[block];
        const buffers = def.transparent ? transparent : opaque;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const neighbor = world.getBlock(baseX + x + face.dir[0], y + face.dir[1], baseZ + z + face.dir[2]);
          if (neighbor !== Block.Air) {
            const neighborDef = BLOCKS[neighbor];
            // Cull faces between two identical transparent blocks (e.g. water interior); show opaque behind transparent.
            if (!neighborDef.transparent || neighbor === block) continue;
          }
          const tile = def.tiles[f];
          const tileU = tile % ATLAS_TILES;
          const tileV = Math.floor(tile / ATLAS_TILES);
          const base = buffers.positions.length / 3;
          for (const corner of face.corners) {
            buffers.positions.push(baseX + x + corner.pos[0], y + corner.pos[1], baseZ + z + corner.pos[2]);
            buffers.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const u = (tileU + UV_INSET + corner.uv[0] * (1 - 2 * UV_INSET)) / ATLAS_TILES;
            const v = 1 - (tileV + UV_INSET + (1 - corner.uv[1]) * (1 - 2 * UV_INSET)) / ATLAS_TILES;
            buffers.uvs.push(u, v);
          }
          buffers.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }

  return { opaque: toGeometry(opaque), transparent: toGeometry(transparent) };
}
