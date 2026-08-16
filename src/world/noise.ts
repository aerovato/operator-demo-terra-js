/** Seeded 2D gradient (Perlin-style) noise with fBm. Deterministic per seed. */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD_X = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const GRAD_Y = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, -1, 1];

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export class Noise2D {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const gradIndex = (ix: number, iy: number): number => this.perm[this.perm[ix & 255] + (iy & 255)] % 12;

    const dot = (ix: number, iy: number, dx: number, dy: number): number => {
      const g = gradIndex(ix, iy);
      return GRAD_X[g] * dx + GRAD_Y[g] * dy;
    };

    const u = smoothstep(xf);
    const v = smoothstep(yf);
    const n00 = dot(xi, yi, xf, yf);
    const n10 = dot(xi + 1, yi, xf - 1, yf);
    const n01 = dot(xi, yi + 1, xf, yf - 1);
    const n11 = dot(xi + 1, yi + 1, xf - 1, yf - 1);
    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0);
  }

  /** Fractal Brownian motion; returns roughly [-1, 1]. */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let sum = 0;
    let amplitude = 1;
    let frequency = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / norm;
  }
}

/** Deterministic hash of grid coordinates to [0, 1); used for tree placement. */
export function hash2(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
