import { loadAtlas } from './atlas';
import { Game } from './game';
import { showMenu } from './menu';
import { loadSave, touchWorld } from './save';

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  // Menu flow (skipped with ?seed= quick start).
  let worldId: string | null = null;
  let seed: number;
  let saved = null;
  if (params.has('seed')) {
    const seedFromUrl = Number(params.get('seed'));
    seed = Number.isFinite(seedFromUrl) && seedFromUrl !== 0
      ? Math.abs(Math.floor(seedFromUrl))
      : Math.floor(Math.random() * 2 ** 31);
  } else {
    const record = await showMenu();
    if (!record) {
      seed = Math.floor(Math.random() * 2 ** 31);
    } else {
      worldId = record.id;
      seed = record.seed;
      saved = loadSave(record.id);
      touchWorld(record.id);
    }
  }
  console.log(`world seed: ${seed}`);

  // Default texture pack; loads procedurally if missing. Override/disable with ?pack=<name> / ?pack=none.
  const atlas = await loadAtlas(params.get('pack') ?? 'baunilha');
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas, seed, atlas, saved, worldId);

  window.addEventListener('beforeunload', () => game.saveNow());

  function onResize(): void {
    game.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);
  onResize();

  let lastTime = performance.now();

  function loop(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

void main();
