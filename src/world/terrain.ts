/**
 * Pure heightfield queries shared by the renderer, placement and the sim.
 * No Three.js imports.
 */
import type { IslandData } from './islandGen';

export class Terrain {
  readonly res: number;
  readonly half: number;
  readonly cell: number;
  readonly heights: Float32Array;
  private coastCache = new Map<number, Float32Array>();

  constructor(readonly island: IslandData) {
    this.res = island.res;
    this.half = island.halfSize;
    this.cell = island.cell;
    this.heights = island.heights;
  }

  /** Vertex height, clamped to the grid. */
  vh(i: number, j: number): number {
    const n = this.res;
    const ii = i < 0 ? 0 : i > n ? n : i;
    const jj = j < 0 ? 0 : j > n ? n : j;
    return this.heights[jj * (n + 1) + ii];
  }

  inBounds(x: number, z: number): boolean {
    return x > -this.half && x < this.half && z > -this.half && z < this.half;
  }

  /**
   * Height at a world point, interpolated on the same triangles the mesh
   * uses (each cell split along its (i,j)-(i+1,j+1) diagonal).
   */
  heightAt(x: number, z: number): number {
    const gx = (x + this.half) / this.cell;
    const gz = (z + this.half) / this.cell;
    let i = Math.floor(gx);
    let j = Math.floor(gz);
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) {
      i = Math.min(Math.max(i, 0), this.res - 1);
      j = Math.min(Math.max(j, 0), this.res - 1);
    }
    const u = Math.min(Math.max(gx - i, 0), 1);
    const v = Math.min(Math.max(gz - j, 0), 1);
    const h00 = this.vh(i, j);
    const h10 = this.vh(i + 1, j);
    const h01 = this.vh(i, j + 1);
    const h11 = this.vh(i + 1, j + 1);
    if (u >= v) return h00 + u * (h10 - h00) + v * (h11 - h10);
    return h00 + v * (h01 - h00) + u * (h11 - h01);
  }

  /** Unit surface normal of the triangle under (x, z). */
  normalAt(x: number, z: number): [number, number, number] {
    const gx = (x + this.half) / this.cell;
    const gz = (z + this.half) / this.cell;
    const i = Math.min(Math.max(Math.floor(gx), 0), this.res - 1);
    const j = Math.min(Math.max(Math.floor(gz), 0), this.res - 1);
    const u = gx - i;
    const v = gz - j;
    const h00 = this.vh(i, j);
    const h10 = this.vh(i + 1, j);
    const h01 = this.vh(i, j + 1);
    const h11 = this.vh(i + 1, j + 1);
    let dx: number;
    let dz: number;
    if (u >= v) {
      dx = h10 - h00;
      dz = h11 - h10;
    } else {
      dz = h01 - h00;
      dx = h11 - h01;
    }
    // Gradient per world unit -> normal (-dh/dx, 1, -dh/dz) normalised.
    const nx = -dx / this.cell;
    const nz = -dz / this.cell;
    const len = Math.hypot(nx, 1, nz);
    return [nx / len, 1 / len, nz / len];
  }

  normalYAt(x: number, z: number): number {
    return this.normalAt(x, z)[1];
  }

  isLand(x: number, z: number, seaLevel: number): boolean {
    return this.inBounds(x, z) && this.heightAt(x, z) > seaLevel;
  }

  /**
   * Distance from (x, z) to the nearest water at this sea level,
   * bilinearly interpolated from a per-vertex Euclidean distance field.
   * Returns 0 in water.
   */
  coastDistance(x: number, z: number, seaLevel: number): number {
    if (!this.isLand(x, z, seaLevel)) return 0;
    const field = this.coastField(seaLevel);
    const n = this.res;
    const gx = Math.min(Math.max((x + this.half) / this.cell, 0), n);
    const gz = Math.min(Math.max((z + this.half) / this.cell, 0), n);
    const i = Math.min(Math.floor(gx), n - 1);
    const j = Math.min(Math.floor(gz), n - 1);
    const u = gx - i;
    const v = gz - j;
    const w = n + 1;
    const a = field[j * w + i];
    const b = field[j * w + i + 1];
    const c = field[(j + 1) * w + i];
    const d = field[(j + 1) * w + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /** Per-vertex distance to water (world units), cached per sea level. */
  coastField(seaLevel: number): Float32Array {
    const key = Math.round(seaLevel * 1000);
    const cached = this.coastCache.get(key);
    if (cached) return cached;
    const w = this.res + 1;
    const INF = 1e12;
    const f = new Float64Array(w * w);
    for (let k = 0; k < f.length; k++) f[k] = this.heights[k] > seaLevel ? INF : 0;
    edt2d(f, w);
    // The true shoreline lies between a water vertex and its land
    // neighbour, so take off half a cell.
    const out = new Float32Array(w * w);
    for (let k = 0; k < f.length; k++) {
      out[k] = f[k] === 0 ? 0 : Math.max(Math.sqrt(f[k]) * this.cell - this.cell * 0.5, 0);
    }
    this.coastCache.set(key, out);
    return out;
  }
}

/** In-place squared Euclidean distance transform (Felzenszwalb & Huttenlocher). */
function edt2d(grid: Float64Array, w: number): void {
  const f = new Float64Array(w);
  const d = new Float64Array(w);
  const v = new Int32Array(w);
  const z = new Float64Array(w + 1);
  const pass = (get: (k: number) => number, set: (k: number, val: number) => void): void => {
    for (let q = 0; q < w; q++) f[q] = get(q);
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < w; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < w; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
    for (let q = 0; q < w; q++) set(q, d[q]);
  };
  for (let row = 0; row < w; row++) {
    const base = row * w;
    pass((q) => grid[base + q], (q, val) => { grid[base + q] = val; });
  }
  for (let col = 0; col < w; col++) {
    pass((q) => grid[q * w + col], (q, val) => { grid[q * w + col] = val; });
  }
}
