import * as THREE from 'three';
import type { Atlas } from './atlas';
import { Interaction } from './interaction';
import { Inventory } from './inventory';
import { BLOCKS, Block } from './blocks';
import { Player } from './player';
import { UI } from './ui';
import { CHUNK_SIZE, Chunk } from './world/chunk';
import { World } from './world/world';
import { meshChunk } from './world/mesher';

import { showPauseMenu } from './menu';
import type { WorldSave } from './save';
import { snapshotSave, touchWorld, writeSave } from './save';

const RENDER_DISTANCE = 10; // chunks
const MESH_CACHE_RADIUS = RENDER_DISTANCE + 2;
const AUTOSAVE_INTERVAL = 5; // seconds
const SKY_COLOR = new THREE.Color(0x87ceeb);
const UNDERWATER_COLOR = new THREE.Color(0x2a5a8a);
const FOG_NEAR = 80;

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly world: World;
  readonly player: Player;
  private readonly chunkMeshes = new Map<string, { opaque?: THREE.Mesh; transparent?: THREE.Mesh }>();
  private readonly opaqueMaterial: THREE.MeshLambertMaterial;
  private readonly transparentMaterial: THREE.MeshLambertMaterial;
  private readonly interaction: Interaction;
  private readonly ui: UI;
  readonly inventory = new Inventory();
  private breakHeld = false;
  private placeQueued = false;
  private spawned = false;
  private paused = false;
  private autosaveTimer = 0;
  private pauseMenu: { close: () => void } | null = null;
  private readonly worldId: string | null;
  private readonly save: WorldSave | null;

  private readonly fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, RENDER_DISTANCE * CHUNK_SIZE * 0.9);

  constructor(canvas: HTMLCanvasElement, seed: number, atlas: Atlas, save: WorldSave | null, worldId: string | null) {
    this.worldId = worldId;
    this.save = save;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 600);

    this.scene.background = SKY_COLOR;
    this.scene.fog = this.fog;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    // Atlas materials (procedural 16x16 tiles or texture pack; see src/atlas.ts).
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });

    this.world = new World(seed, (chunk) => this.onChunkLoaded(chunk));
    // Restore saved edits before any chunk streams in (they overlay generation).
    if (save) {
      for (const [key, block] of Object.entries(save.edits)) this.world.edits.set(key, block);
      for (let i = 0; i < save.inventory.length && i < this.inventory.slots.length; i++) {
        const slot = save.inventory[i];
        this.inventory.slots[i] = slot ? { block: slot.block as Block, count: slot.count } : null;
      }
    }
    this.player = new Player(canvas, this.world, this.camera);

    this.interaction = new Interaction(this.world, this.player, this.inventory, (frac) => this.ui.setBreakProgress(frac));
    this.scene.add(this.interaction.highlight);
    this.scene.add(this.interaction.breakOverlay);

    this.ui = new UI(atlas, this.inventory, () => {
      const stack = this.inventory.selectedItem();
      return {
        pos: `${this.camera.position.x.toFixed(1)} ${this.camera.position.y.toFixed(1)} ${this.camera.position.z.toFixed(1)}`,
        chunk: `${Math.floor(this.camera.position.x / CHUNK_SIZE)},${Math.floor(this.camera.position.z / CHUNK_SIZE)}`,
        seed: String(seed),
        mode: this.player.flying ? 'fly' : this.player.inWater ? 'swim' : 'walk',
        item: stack ? `${BLOCKS[stack.block].name} x${stack.count}` : 'empty',
      };
    }, (open) => {
      this.paused = open;
      if (open) {
        document.exitPointerLock();
      } else {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || this.ui.isPanelOpen) return;
      if (this.pauseMenu) {
        this.pauseMenu.close();
        this.pauseMenu = null;
        this.paused = false;
        canvas.requestPointerLock();
      }
    });
    // Browsers exit pointer lock on Esc without delivering keydown; treat that as pause.
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas || this.ui.isPanelOpen || this.pauseMenu) return;
      this.paused = true;
      this.pauseMenu = showPauseMenu(() => this.saveNow());
    });

    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) return;
      if (e.button === 0) this.breakHeld = true;
      if (e.button === 2) this.placeQueued = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.breakHeld = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.camera.position.set(0, 60, 0);
  }

  private hasNeighbors(chunk: Chunk): boolean {
    return Boolean(
      this.world.chunkAt(chunk.cx + 1, chunk.cz) && this.world.chunkAt(chunk.cx - 1, chunk.cz) &&
      this.world.chunkAt(chunk.cx, chunk.cz + 1) && this.world.chunkAt(chunk.cx, chunk.cz - 1),
    );
  }

  private onChunkLoaded(chunk: Chunk): void {
    const ccx = Math.floor(this.camera.position.x / CHUNK_SIZE);
    const ccz = Math.floor(this.camera.position.z / CHUNK_SIZE);
    const withinMeshRange =
      Math.abs(chunk.cx - ccx) <= MESH_CACHE_RADIUS && Math.abs(chunk.cz - ccz) <= MESH_CACHE_RADIUS;
    // Never mesh before all 4 neighbors exist: missing chunks read as Air and
    // leak water/side faces at borders (dirty flag drives the re-mesh once they arrive).
    if (withinMeshRange) {
      if (this.hasNeighbors(chunk)) this.buildChunkMesh(chunk);
      else chunk.dirty = true;
    }
    if (!this.spawned) {
      if (this.save?.player) {
        // Saved position: chunk under the player streams in around the camera we place now.
        this.spawned = true;
        this.player.position.set(this.save.player.x, this.save.player.y, this.save.player.z);
        this.player.flying = this.save.player.flying;
        this.camera.position.set(this.save.player.x, this.save.player.y + 1.62, this.save.player.z);
      } else if (!this.spawned) {
        // Spawn search uses seeded terrain height directly, so the first attempt succeeds.
        if (this.player.spawn(0.5, 0.5)) {
          this.spawned = true;
          // Move the camera now so chunk streaming re-centers on the spawn point.
          this.camera.position.set(this.player.position.x, this.player.position.y + 1.62, this.player.position.z);
        }
      }
    }
  }

  private buildChunkMesh(chunk: Chunk): void {
    const key = `${chunk.cx},${chunk.cz}`;
    this.disposeChunkMesh(key);
    const { opaque, transparent } = meshChunk(this.world, chunk);
    const entry: { opaque?: THREE.Mesh; transparent?: THREE.Mesh } = {};
    if (opaque) {
      entry.opaque = new THREE.Mesh(opaque, this.opaqueMaterial);
      this.scene.add(entry.opaque);
    }
    if (transparent) {
      entry.transparent = new THREE.Mesh(transparent, this.transparentMaterial);
      this.scene.add(entry.transparent);
    }
    this.chunkMeshes.set(key, entry);
    chunk.dirty = false;
  }

  private disposeChunkMesh(key: string): void {
    const entry = this.chunkMeshes.get(key);
    if (!entry) return;
    for (const mesh of [entry.opaque, entry.transparent]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunkMeshes.delete(key);
  }

  /** Streams chunks around the camera and re-meshes chunks whose neighbors arrived. */
  update(dt: number): void {
    // Underwater ambiance: blue tint + short fog when the camera is submerged.
    const cameraBlock = this.world.getBlock(
      Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z),
    );
    if (cameraBlock === Block.Water) {
      this.scene.background = UNDERWATER_COLOR;
      this.fog.color = UNDERWATER_COLOR;
      this.fog.near = 2;
      this.fog.far = 24;
    } else {
      this.scene.background = SKY_COLOR;
      this.fog.color = SKY_COLOR;
      this.fog.near = FOG_NEAR;
      this.fog.far = RENDER_DISTANCE * CHUNK_SIZE * 0.9;
    }
    this.autosaveTimer += dt;
    if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
      this.autosaveTimer = 0;
      this.saveNow();
    }
    if (!this.paused) {
      this.player.update(dt);
      this.interaction.update(dt, this.camera, this.breakHeld, this.placeQueued);
    }
    this.placeQueued = false;
    this.ui.update();
    const ccx = Math.floor(this.camera.position.x / CHUNK_SIZE);
    const ccz = Math.floor(this.camera.position.z / CHUNK_SIZE);

    const wanted: { cx: number; cz: number; d: number }[] = [];
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        wanted.push({ cx: ccx + dx, cz: ccz + dz, d: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    for (const { cx, cz } of wanted) this.world.requestChunk(cx, cz);

    // Dispose far meshes.
    for (const key of this.chunkMeshes.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - ccx) > MESH_CACHE_RADIUS || Math.abs(cz - ccz) > MESH_CACHE_RADIUS) {
        this.disposeChunkMesh(key);
      }
    }

    // Re-mesh chunks whose neighbors have since arrived (fixes chunk-border walls).
    for (const chunk of this.world.chunks.values()) {
      if (!chunk.dirty) continue;
      if (Math.abs(chunk.cx - ccx) > MESH_CACHE_RADIUS || Math.abs(chunk.cz - ccz) > MESH_CACHE_RADIUS) continue;
      if (this.hasNeighbors(chunk)) this.buildChunkMesh(chunk);
    }
  }

  /** Persists the world now (autosave + beforeunload). No-op in quick play. */
  saveNow(): void {
    if (!this.worldId) return;
    writeSave(this.worldId, snapshotSave(this.world.seed, this.world.edits, this.player, this.inventory));
    touchWorld(this.worldId);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
