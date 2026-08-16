import * as THREE from 'three';
import { BLOCKS, Block } from './blocks';
import type { Inventory } from './inventory';
import { dropFor } from './items';
import type { Player } from './player';
import type { World } from './world/world';

const REACH = 5;

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  /** Face normal of the hit. */
  nx: number;
  ny: number;
  nz: number;
  block: Block;
}

/** Voxel DDA raycast through world blocks from the camera. */
export function raycast(world: World, origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): RaycastHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;
  const distToBound = (o: number, s: number): number => (s > 0 ? Math.floor(o) + 1 - o : o - Math.floor(o));
  let tMaxX = stepX !== 0 ? distToBound(origin.x, stepX) * tDeltaX : Infinity;
  let tMaxY = stepY !== 0 ? distToBound(origin.y, stepY) * tDeltaY : Infinity;
  let tMaxZ = stepZ !== 0 ? distToBound(origin.z, stepZ) * tDeltaZ : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < 128; i++) {
    const block = world.getBlock(x, y, z);
    if (block !== Block.Air && block !== Block.Water) {
      return { x, y, z, nx, ny, nz, block };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      x += stepX;
      tMaxX += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      if (tMaxZ > maxDist) break;
      z += stepZ;
      tMaxZ += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

/** Break/place handling with hold-to-break progress and a highlight outline. */
export class Interaction {
  readonly highlight: THREE.LineSegments;
  readonly breakOverlay: THREE.Mesh;
  private breakTarget: string | null = null;
  private breakProgress = 0;
  private breaking = false;
  private readonly onBreakProgress: (frac: number) => void;
  private readonly world: World;
  private readonly player: Player;
  private readonly inventory: Inventory;

  constructor(world: World, player: Player, inventory: Inventory, onBreakProgress: (frac: number) => void) {
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.onBreakProgress = onBreakProgress;
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 }),
    );
    box.dispose();
    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }),
    );
    this.highlight.visible = false;
    this.breakOverlay.visible = false;
  }

  /** Called with current mouse-button state each frame; performs break/place. */
  update(dt: number, camera: THREE.PerspectiveCamera, breakHeld: boolean, placeClicked: boolean): void {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const hit = raycast(this.world, camera.position, direction, REACH);

    if (!hit) {
      this.highlight.visible = false;
      this.breakOverlay.visible = false;
      this.breakTarget = null;
      this.breakProgress = 0;
      this.onBreakProgress(0);
      return;
    }

    this.highlight.visible = true;
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    const key = `${hit.x},${hit.y},${hit.z}`;
    if (breakHeld) {
      if (this.breakTarget !== key) {
        this.breakTarget = key;
        this.breakProgress = 0;
      }
      const breakTime = BLOCKS[hit.block].breakTime;
      this.breakProgress += dt / Math.max(breakTime, 0.05);
      this.breaking = true;
      if (this.breakProgress >= 1) {
        this.world.setBlock(hit.x, hit.y, hit.z, Block.Air);
        const drop = dropFor(hit.block);
        if (drop !== null) this.inventory.add(drop, 1);
        this.breakTarget = null;
        this.breakProgress = 0;
        this.onBreakProgress(0);
      } else {
        this.onBreakProgress(this.breakProgress);
      }
    } else {
      this.breakTarget = null;
      this.breakProgress = 0;
      this.breaking = false;
      this.onBreakProgress(0);
    }

    this.breakOverlay.visible = this.breaking && this.breakProgress > 0;
    (this.breakOverlay.material as THREE.MeshBasicMaterial).opacity = this.breakProgress * 0.45;
    this.breakOverlay.position.copy(this.highlight.position);

    const selectedStack = this.inventory.selectedItem();
    if (placeClicked && selectedStack && this.canPlaceAt(hit, selectedStack.block)) {
      this.world.setBlock(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz, selectedStack.block);
      this.inventory.consumeSelected();
    }
  }

  private canPlaceAt(hit: RaycastHit, selected: Block): boolean {
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    const target = this.world.getBlock(px, py, pz);
    if (target !== Block.Air && target !== Block.Water) return false;
    if (!BLOCKS[selected].solid) return true;
    // Reject placement intersecting the player AABB.
    const half = 0.3;
    const p = this.player.position;
    const overlap =
      px + 1 > p.x - half && px < p.x + half &&
      pz + 1 > p.z - half && pz < p.z + half &&
      py + 1 > p.y && py < p.y + 1.8;
    return !overlap;
  }
}
