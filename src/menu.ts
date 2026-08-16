import { createWorld, deleteWorld, listWorlds, type WorldRecord } from './save';

export interface MenuResult {
  record: WorldRecord | null;
  /** True when the player wants a brand-new world (record already created). */
}

/**
 * Title screen with world list, creation (name + optional seed), deletion.
 * Resolves with the chosen world record, or null for quick-play (?seed URL).
 */
export function showMenu(): Promise<WorldRecord | null> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;inset:0;background:linear-gradient(#2a3b55,#101820);display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:100;' +
      'font-family:monospace;color:#eee;';
    document.body.appendChild(root);

    const title = document.createElement('h1');
    title.textContent = 'terra-js';
    title.style.cssText = 'font-size:42px;margin:0;letter-spacing:4px;color:#9fd06a;text-shadow:2px 2px 0 #1a2410;';
    root.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'a voxel sandbox';
    subtitle.style.cssText = 'color:#8fa3b8;margin-top:-12px;';
    root.appendChild(subtitle);

    const list = document.createElement('div');
    list.style.cssText =
      'display:flex;flex-direction:column;gap:6px;min-width:380px;max-height:40vh;overflow-y:auto;margin-top:8px;';
    root.appendChild(list);

    const renderList = (): void => {
      list.innerHTML = '';
      const worlds = listWorlds();
      if (worlds.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'no worlds yet — create one below';
        empty.style.cssText = 'color:#8fa3b8;text-align:center;padding:12px;';
        list.appendChild(empty);
        return;
      }
      for (const world of worlds) {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;' +
          'background:rgba(255,255,255,0.06);border-radius:6px;cursor:pointer;';
        row.addEventListener('mouseenter', () => (row.style.background = 'rgba(255,255,255,0.14)'));
        row.addEventListener('mouseleave', () => (row.style.background = 'rgba(255,255,255,0.06)'));
        row.addEventListener('click', () => finish(world));

        const info = document.createElement('div');
        const date = new Date(world.lastPlayed).toLocaleString();
        info.innerHTML = `<div style="font-weight:bold">${escapeHtml(world.name)}</div>` +
          `<div style="font-size:11px;color:#8fa3b8">seed ${world.seed} · ${escapeHtml(date)}</div>`;
        row.appendChild(info);

        const del = document.createElement('button');
        del.textContent = '✕';
        del.title = 'delete world';
        del.style.cssText =
          'background:none;border:1px solid #666;border-radius:4px;color:#c66;cursor:pointer;' +
          'font-size:13px;padding:2px 8px;';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteWorld(world.id);
          renderList();
        });
        row.appendChild(del);
        list.appendChild(row);
      }
    };

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'world name';
    nameInput.style.cssText = INPUT_STYLE;
    const seedInput = document.createElement('input');
    seedInput.placeholder = 'seed (blank = random)';
    seedInput.style.cssText = INPUT_STYLE;
    seedInput.style.width = '170px';
    const createBtn = document.createElement('button');
    createBtn.textContent = 'create';
    createBtn.style.cssText = BUTTON_STYLE;
    createBtn.addEventListener('click', () => {
      const seedText = seedInput.value.trim();
      let seed: number;
      if (seedText === '') {
        seed = Math.floor(Math.random() * 2 ** 31);
      } else if (/^-?\d+$/.test(seedText)) {
        seed = Math.abs(Number(seedText)) % 2 ** 31;
      } else {
        // Text seeds hash to a 31-bit integer, deterministic.
        let h = 0;
        for (const ch of seedText) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
        seed = Math.abs(h) % 2 ** 31;
      }
      finish(createWorld(nameInput.value, seed));
    });
    form.appendChild(nameInput);
    form.appendChild(seedInput);
    form.appendChild(createBtn);
    root.appendChild(form);

    const quick = document.createElement('button');
    quick.textContent = 'quick play (no saving)';
    quick.style.cssText = `${BUTTON_STYLE};color:#8fa3b8;margin-top:4px;`;
    quick.addEventListener('click', () => finish(null));
    root.appendChild(quick);

    const finish = (record: WorldRecord | null): void => {
      root.remove();
      resolve(record);
    };

    renderList();
    nameInput.focus();
  });
}

/**
 * Esc pause menu overlay: resume or save-and-quit (reload to title screen).
 * `onResume` fires for resume; quit is handled by page reload after saving.
 */
export function showPauseMenu(saveAndQuit: () => void): { close: () => void; on_resume: (cb: () => void) => void } {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;inset:0;background:rgba(10,14,18,0.7);display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:10px;z-index:90;font-family:monospace;color:#eee;';
  document.body.appendChild(root);

  const heading = document.createElement('div');
  heading.textContent = 'paused';
  heading.style.cssText = 'font-size:22px;margin-bottom:10px;color:#9fd06a;letter-spacing:2px;';
  root.appendChild(heading);

  let resumeCb: () => void = () => undefined;
  const btn = (text: string, action: () => void, accent: boolean): void => {
    const el = document.createElement('button');
    el.textContent = text;
    el.style.cssText =
      `min-width:220px;padding:10px 14px;cursor:pointer;font-family:monospace;font-size:14px;` +
      `background:${accent ? '#4a7a3a' : 'rgba(255,255,255,0.08)'};color:#fff;` +
      `border:1px solid ${accent ? '#6a9a5a' : '#555'};border-radius:6px;`;
    el.addEventListener('mouseenter', () => (el.style.background = accent ? '#5a8a4a' : 'rgba(255,255,255,0.16)'));
    el.addEventListener('mouseleave', () => (el.style.background = accent ? '#4a7a3a' : 'rgba(255,255,255,0.08)'));
    el.addEventListener('click', action);
    root.appendChild(el);
  };

  const state = {
    close(): void {
      root.remove();
      resumeCb();
      const canvas = document.getElementById('game') as HTMLCanvasElement | null;
      canvas?.requestPointerLock();
    },
    on_resume(cb: () => void): void {
      resumeCb = cb;
    },
  };

  btn('resume', () => state.close(), true);
  btn('save & quit to title', () => {
    saveAndQuit();
    location.reload();
  }, false);
  return state;
}

const INPUT_STYLE =
  'background:rgba(0,0,0,0.4);border:1px solid #555;border-radius:4px;color:#eee;' +
  'padding:7px 10px;font-family:monospace;font-size:13px;outline:none;';

const BUTTON_STYLE =
  'background:#4a7a3a;border:1px solid #6a9a5a;border-radius:4px;color:#fff;cursor:pointer;' +
  'padding:7px 14px;font-family:monospace;font-size:13px;';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
