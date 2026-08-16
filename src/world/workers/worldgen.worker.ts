import { generateChunk } from '../worldgen';

export interface WorldgenRequest {
  cx: number;
  cz: number;
  seed: number;
}

export interface WorldgenResponse {
  cx: number;
  cz: number;
  blocks: ArrayBuffer;
}

// The DOM lib types `self` as Window; cast to a minimal postMessage-capable shape.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorldgenRequest>) => void) | null;
  postMessage(message: WorldgenResponse, transfer: ArrayBuffer[]): void;
};

ctx.onmessage = (e) => {
  const { cx, cz, seed } = e.data;
  const blocks = generateChunk(seed, cx, cz);
  const buffer = blocks.buffer as ArrayBuffer;
  ctx.postMessage({ cx, cz, blocks: buffer }, [buffer]);
};
