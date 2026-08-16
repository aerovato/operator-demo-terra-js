import type { Inventory } from './inventory';

export interface WorldRecord {
  id: string;
  name: string;
  seed: number;
  createdAt: number;
  lastPlayed: number;
}

export interface WorldSave {
  seed: number;
  player: { x: number; y: number; z: number; flying: boolean };
  /** Sparse block edits keyed "x,y,z" -> block id. */
  edits: Record<string, number>;
  inventory: ({ block: number; count: number } | null)[];
  savedAt: number;
}

const WORLDS_KEY = 'terrajs:worlds';

function worldKey(id: string): string {
  return `terrajs:world:${id}`;
}

export function listWorlds(): WorldRecord[] {
  const raw = localStorage.getItem(WORLDS_KEY);
  const worlds: WorldRecord[] = raw ? JSON.parse(raw) : [];
  return worlds.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function writeWorlds(worlds: WorldRecord[]): void {
  localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
}

export function createWorld(name: string, seed: number): WorldRecord {
  const record: WorldRecord = {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim() || `World ${listWorlds().length + 1}`,
    seed,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
  };
  writeWorlds([...listWorlds(), record]);
  return record;
}

export function deleteWorld(id: string): void {
  writeWorlds(listWorlds().filter((w) => w.id !== id));
  localStorage.removeItem(worldKey(id));
}

export function touchWorld(id: string): void {
  writeWorlds(listWorlds().map((w) => (w.id === id ? { ...w, lastPlayed: Date.now() } : w)));
}

export function loadSave(id: string): WorldSave | null {
  const raw = localStorage.getItem(worldKey(id));
  return raw ? (JSON.parse(raw) as WorldSave) : null;
}

export function writeSave(id: string, save: WorldSave): void {
  try {
    localStorage.setItem(worldKey(id), JSON.stringify(save));
  } catch (e) {
    console.warn('save failed (storage full?)', e);
  }
}

/** Collects a save snapshot from live game state. */
export function snapshotSave(
  seed: number,
  edits: Map<string, number>,
  player: { position: { x: number; y: number; z: number }; flying: boolean },
  inventory: Inventory,
): WorldSave {
  const editsRecord: Record<string, number> = {};
  for (const [key, block] of edits) editsRecord[key] = block;
  return {
    seed,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      flying: player.flying,
    },
    edits: editsRecord,
    inventory: inventory.slots.map((slot) => (slot ? { block: slot.block, count: slot.count } : null)),
    savedAt: Date.now(),
  };
}
