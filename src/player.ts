import * as THREE from 'three';
import { BLOCKS, Block } from './blocks';
import { World } from './world/world';
import { SEA_LEVEL, terrainHeight } from './world/worldgen';

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;

const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.5;
const FLY_SPEED = 12;
const FLY_SPRINT_SPEED = 25;
const GRAVITY = 28;
const JUMP_VELOCITY = 9;
const SWIM_GRAVITY = 6;
const SWIM_MAX_SINK = 3;
const SWIM_UP = 4;
const WATER_DRAG = 0.85;

/** Player physics/input state: pointer-lock FPS camera, AABB collision, walk/jump/swim/fly. */
export class Player {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  onGround = false;
  inWater = false;
  flying = false;
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private readonly world: World;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement, world: World, camera: THREE.PerspectiveCamera) {
    this.world = world;
    this.camera = camera;
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) this.keys.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && document.pointerLockElement === canvas) this.toggleFly();
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private toggleFly(): void {
    this.flying = !this.flying;
    this.velocity.set(0, 0, 0);
  }

  spawn(x: number, z: number): boolean {
    const found = this.findLandColumn(x, z);
    if (!found) return false;
    this.position.set(found.x, 0, found.z);
    this.position.y = terrainHeight(this.world.seed, Math.floor(found.x), Math.floor(found.z)) + 1;
    this.velocity.set(0, 0, 0);
    return true;
  }

  /**
   * Finds a spawnable dry-land column by spiraling out from (x, z), sampling the
   * seeded terrain height directly (no chunk loading needed). A column is
   * spawnable when its surface sits above sea level. Returns the origin only as
   * a last resort when no dry land exists within the search radius.
   */
  private findLandColumn(x: number, z: number): { x: number; z: number } | null {
    const minSurface = SEA_LEVEL + 1; // dry land only
    const isLand = (wx: number, wz: number): boolean =>
      terrainHeight(this.world.seed, Math.floor(wx), Math.floor(wz)) >= minSurface;

    if (isLand(x, z)) return { x: x + 0.5, z: z + 0.5 };

    // Square rings expanding by STEP blocks; test every column on the ring edge.
    const STEP = 8;
    const MAX_RADIUS = 512;
    for (let ring = 1; ring * STEP <= MAX_RADIUS; ring++) {
      const r = ring * STEP;
      for (let i = 0; i <= ring * 8; i++) {
        // Interleave edges: cycle through the 4 sides, walking each ring edge in ring*2 steps.
        const side = i & 3;
        const t = Math.floor(i / 4);
        const tMax = ring * 2;
        if (t > tMax) break;
        const off = -r + Math.floor((t / tMax) * r * 2);
        let wx = x;
        let wz = z;
        if (side === 0) { wx += r; wz += off; }
        else if (side === 1) { wx -= r; wz += off; }
        else if (side === 2) { wx += off; wz += r; }
        else { wx += off; wz -= r; }
        if (isLand(wx, wz)) return { x: Math.floor(wx) + 0.5, z: Math.floor(wz) + 0.5 };
      }
    }
    return { x: x + 0.5, z: z + 0.5 };
  }

  private blockAt(x: number, y: number, z: number): Block {
    return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  /** True if the player's AABB at `position` intersects any solid block. */
  private collides(): boolean {
    const half = WIDTH / 2;
    const minX = Math.floor(this.position.x - half);
    const maxX = Math.floor(this.position.x + half);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + HEIGHT);
    const minZ = Math.floor(this.position.z - half);
    const maxZ = Math.floor(this.position.z + half);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.getBlock(x, y, z) !== Block.Air && BLOCKS[this.world.getBlock(x, y, z)].solid) return true;
        }
      }
    }
    return false;
  }

  /** Axis-separated movement: move each axis, revert on collision. */
  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): void {
    if (amount === 0) return;
    const before = this.position[axis];
    this.position[axis] += amount;
    if (this.collides()) {
      this.position[axis] = before;
      if (axis === 'y') {
        if (amount < 0) this.onGround = true;
        this.velocity.y = 0;
      } else {
        this.hitWall = true;
      }
    }
  }

  update(dt: number): void {
    this.onGround = false;
    this.hitWall = false;
    this.inWater = this.blockAt(this.position.x, this.position.y + EYE * 0.5, this.position.z) === Block.Water;
    const atSurface = this.inWater && this.blockAt(this.position.x, this.position.y + EYE + 0.2, this.position.z) === Block.Air;

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this.flying ? (sprint ? FLY_SPRINT_SPEED : FLY_SPEED) : this.inWater ? WALK_SPEED * 0.6 : sprint ? SPRINT_SPEED : WALK_SPEED;

    // Horizontal wish direction from keys, rotated by yaw.
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW')) forward += 1;
    if (this.keys.has('KeyS')) forward -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (this.keys.has('KeyA')) strafe -= 1;
    const len = Math.hypot(forward, strafe);
    let wishX = 0;
    let wishZ = 0;
    if (len > 0) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      wishX = ((-sin * forward + cos * strafe) / len) * speed;
      wishZ = ((-cos * forward - sin * strafe) / len) * speed;
    }

    if (this.flying) {
      this.velocity.x = wishX;
      this.velocity.z = wishZ;
      this.velocity.y = 0;
      if (this.keys.has('Space')) this.velocity.y = speed;
      if (this.keys.has('ControlLeft')) this.velocity.y = -speed;
    } else if (this.inWater) {
      this.velocity.x = wishX;
      this.velocity.z = wishZ;
      this.velocity.y -= SWIM_GRAVITY * dt;
      if (this.velocity.y < -SWIM_MAX_SINK) this.velocity.y = -SWIM_MAX_SINK;
      if (this.keys.has('Space')) {
        this.velocity.y = SWIM_UP;
        // Hop out: pressing up against a block edge (or at the surface) boosts into a real jump.
        if (this.hitWallLastFrame || (atSurface && (wishX !== 0 || wishZ !== 0))) {
          this.velocity.y = JUMP_VELOCITY;
        }
      }
      this.velocity.multiplyScalar(WATER_DRAG);
    } else {
      // Ground horizontal control is immediate; air keeps momentum for simplicity.
      this.velocity.x = wishX;
      this.velocity.z = wishZ;
      this.velocity.y -= GRAVITY * dt;
      if (this.keys.has('Space') && this.groundedLastFrame) this.velocity.y = JUMP_VELOCITY;
    }

    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.moveAxis('y', this.velocity.y * dt);
    this.groundedLastFrame = this.onGround;
    this.hitWallLastFrame = this.hitWall;

    // Safety: never fall out of the world.
    if (this.position.y < -10) {
      this.spawn(this.position.x, this.position.z);
      this.velocity.set(0, 0, 0);
    }

    this.camera.position.set(this.position.x, this.position.y + EYE, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private groundedLastFrame = false;
  private hitWall = false;
  private hitWallLastFrame = false;
}
