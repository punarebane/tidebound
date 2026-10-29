/**
 * Seeded island generation. Pure data (no Three.js) so the sim and tests can
 * run it in Node; the renderer turns it into meshes in islandMesh.ts.
 */
import { WORLD } from '../data/world';
import { TIDE } from '../data/economy';
import { fbm, createNoise2D } from '../core/noise';
import { mulberry32, seedFrom, type Rng } from '../core/rng';

export interface Prop {
  id: number;
  x: number;
  z: number;
  r: number;
  /** Visual-only variation. */
  scale: number;
  rot: number;
  variant: number;
}

export interface Point {
  id: number;
  x: number;
  z: number;
  r: number;
}

/** A spot where fish gather whenever the water above it is shallow enough. */
export interface ShoalSite extends Point {
  /** Sea-floor height at the spot. */
  h: number;
}

export interface IslandData {
  seed: string;
  index: number;
  halfSize: number;
  cell: number;
  /** Cells per side; the height grid has (res + 1)^2 vertices. */
  res: number;
  heights: Float32Array;
  trees: Prop[];
  rocks: Prop[];
  /** Candidate shoal sites; which are active depends on the sea level. */
  shoals: ShoalSite[];
  patches: Point[];
  /** Height above which the Shrine gets its bonus (top 10% of land). */
  shrineHeight: number;
  maxHeight: number;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function islandHalfSize(index: number): number {
  return Math.min(WORLD.baseHalfSize + WORLD.halfSizeGrowth * index, WORLD.maxHalfSize);
}

/** Terrace a raw height into flat bands with short risers; the beach stays smooth. */
export function terrace(h: number): number {
  const step = WORLD.terraceStep;
  const level = h / step;
  const fl = Math.floor(level);
  const f = level - fl;
  const t = smoothstep(1 - WORLD.terraceRiser, 1, f);
  const q = (fl + t) * step;
  const k = smoothstep(WORLD.beachSmoothTop * 0.6, WORLD.beachSmoothTop, h);
  return h + (q - h) * k;
}

export function generateIsland(seed: string, index: number): IslandData {
  const rng = mulberry32(seedFrom(seed, index, 1));
  const terrainNoise = createNoise2D(rng);
  const coastNoise = createNoise2D(rng);
  const forestNoise = createNoise2D(rng);
  const halfSize = islandHalfSize(index);
  const cell = WORLD.cell;
  const res = Math.round((halfSize * 2) / cell);
  const w = res + 1;
  const heights = new Float32Array(w * w);
  const radius = halfSize * WORLD.islandRadius;
  // Offsets so different islands from the same seed sample different noise.
  const ox = rng() * 1000;
  const oz = rng() * 1000;

  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const x = -halfSize + i * cell;
      const z = -halfSize + j * cell;
      const dist = Math.hypot(x, z);
      const ang = Math.atan2(z, x);
      const wobble = fbm(coastNoise, Math.cos(ang) * WORLD.coastWobbleFreq + ox, Math.sin(ang) * WORLD.coastWobbleFreq + oz, 3);
      const d = dist / (radius * (1 + WORLD.coastWobble * wobble));
      const falloff = 1 - smoothstep(WORLD.falloffInner, WORLD.falloffOuter, d);
      const n = fbm(terrainNoise, x * WORLD.noiseFreq + ox, z * WORLD.noiseFreq + oz, WORLD.noiseOctaves) * 0.5 + 0.5;
      let h = Math.pow(falloff, WORLD.falloffPow) * (WORLD.landBase + WORLD.landRelief * n) * WORLD.maxHeight - WORLD.seaDrop;
      h -= WORLD.deepDrop * smoothstep(0.85, 1.3, d);
      heights[j * w + i] = terrace(h);
    }
  }

  // Shrine threshold: top fraction of land vertex heights.
  const land: number[] = [];
  let maxHeight = -Infinity;
  for (const h of heights) {
    if (h > 0) land.push(h);
    if (h > maxHeight) maxHeight = h;
  }
  land.sort((a, b) => a - b);
  const shrineHeight = land.length
    ? land[Math.min(land.length - 1, Math.floor(land.length * (1 - WORLD.shrineTopFraction)))]
    : Infinity;

  const sampleH = (x: number, z: number): number => sampleHeight(heights, res, halfSize, cell, x, z);
  const sampleNY = (x: number, z: number): number => {
    const e = 0.35;
    const dx = (sampleH(x + e, z) - sampleH(x - e, z)) / (2 * e);
    const dz = (sampleH(x, z + e) - sampleH(x, z - e)) / (2 * e);
    return 1 / Math.hypot(dx, 1, dz);
  };

  let nextId = 1;
  const trees: Prop[] = [];
  for (const [x, z] of poissonDisk(rng, halfSize * 0.98, WORLD.treeSpacing)) {
    const h = sampleH(x, z);
    if (h < WORLD.treeMinHeight || h > WORLD.treeMaxHeight) continue;
    if (sampleNY(x, z) < 0.8) continue;
    const forest = fbm(forestNoise, x * WORLD.forestFreq + 50, z * WORLD.forestFreq + 50, 3);
    const p = smoothstep(WORLD.forestThreshold - 0.15, WORLD.forestThreshold + 0.2, forest);
    if (rng() > p) continue;
    trees.push({ id: nextId++, x, z, r: WORLD.treeRadius, scale: 0.8 + rng() * 0.5, rot: rng() * Math.PI * 2, variant: rng() < 0.5 ? 0 : 1 });
  }

  const rocks: Prop[] = [];
  for (const [x, z] of poissonDisk(rng, halfSize * 0.98, WORLD.rockSpacing)) {
    const h = sampleH(x, z);
    if (h < 0.2) continue;
    const high = smoothstep(3, 7, h);
    if (rng() > WORLD.rockChance + high * 0.25) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + WORLD.rockRadius) ** 2)) continue;
    rocks.push({ id: nextId++, x, z, r: WORLD.rockRadius, scale: 0.6 + rng() * 0.8, rot: rng() * Math.PI * 2, variant: Math.floor(rng() * 3) });
  }

  // Sites cover every depth the shallows will reach as the tide rises, so
  // fish follow the coast inland.
  const shoals: ShoalSite[] = [];
  const topSea = TIDE.maxSteps * TIDE.stepHeight;
  for (const [x, z] of poissonDisk(rng, halfSize * 0.98, WORLD.shoalSpacing)) {
    const h = sampleH(x, z);
    if (h > topSea - WORLD.shoalMinDepth || h < -WORLD.shoalMaxDepth) continue;
    if (rng() > WORLD.shoalChance) continue;
    shoals.push({ id: nextId++, x, z, r: 0.8, h });
  }

  const patches: Point[] = [];
  const ps = WORLD.patchSpacing;
  for (let z = -halfSize + ps; z < halfSize; z += ps) {
    for (let x = -halfSize + ps; x < halfSize; x += ps) {
      const h = sampleH(x, z);
      if (h < WORLD.patchMinHeight || h > WORLD.patchMaxHeight) continue;
      if (sampleNY(x, z) < WORLD.patchNormalY) continue;
      if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (ps * 0.5) ** 2)) continue;
      patches.push({ id: nextId++, x, z, r: ps * 0.5 });
    }
  }

  return { seed, index, halfSize, cell, res, heights, trees, rocks, shoals, patches, shrineHeight, maxHeight };
}

function sampleHeight(heights: Float32Array, res: number, half: number, cell: number, x: number, z: number): number {
  const gx = Math.min(Math.max((x + half) / cell, 0), res - 1e-6);
  const gz = Math.min(Math.max((z + half) / cell, 0), res - 1e-6);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const u = gx - i;
  const v = gz - j;
  const w = res + 1;
  const h00 = heights[j * w + i];
  const h10 = heights[j * w + i + 1];
  const h01 = heights[(j + 1) * w + i];
  const h11 = heights[(j + 1) * w + i + 1];
  if (u >= v) return h00 + u * (h10 - h00) + v * (h11 - h10);
  return h00 + v * (h01 - h00) + u * (h11 - h01);
}

/** Bridson Poisson-disk sampling over the square [-half, half]^2. */
export function poissonDisk(rng: Rng, half: number, minDist: number, tries = 20): Array<[number, number]> {
  const size = half * 2;
  const cs = minDist / Math.SQRT2;
  const gw = Math.ceil(size / cs);
  const grid = new Int32Array(gw * gw).fill(-1);
  const pts: Array<[number, number]> = [];
  const active: number[] = [];
  const add = (x: number, z: number): void => {
    pts.push([x, z]);
    active.push(pts.length - 1);
    grid[Math.floor((z + half) / cs) * gw + Math.floor((x + half) / cs)] = pts.length - 1;
  };
  add((rng() - 0.5) * size * 0.2, (rng() - 0.5) * size * 0.2);
  const md2 = minDist * minDist;
  while (active.length) {
    const ai = Math.floor(rng() * active.length);
    const [px, pz] = pts[active[ai]];
    let found = false;
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2;
      const r = minDist * (1 + rng());
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      if (x <= -half || x >= half || z <= -half || z >= half) continue;
      const gx = Math.floor((x + half) / cs);
      const gz = Math.floor((z + half) / cs);
      let ok = true;
      for (let jz = Math.max(gz - 2, 0); ok && jz <= Math.min(gz + 2, gw - 1); jz++) {
        for (let jx = Math.max(gx - 2, 0); jx <= Math.min(gx + 2, gw - 1); jx++) {
          const k = grid[jz * gw + jx];
          if (k >= 0) {
            const dx = pts[k][0] - x;
            const dz = pts[k][1] - z;
            if (dx * dx + dz * dz < md2) { ok = false; break; }
          }
        }
      }
      if (ok) { add(x, z); found = true; break; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}

/** Stable FNV-1a hash over everything generated, for determinism tests. */
export function hashIsland(d: IslandData): string {
  let h = 0x811c9dc5;
  const mix = (n: number): void => {
    // Quantise so the hash is about content, not float noise.
    const q = Math.round(n * 1e4) | 0;
    for (let s = 0; s < 32; s += 8) {
      h ^= (q >>> s) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  };
  mix(d.res);
  for (const v of d.heights) mix(v);
  for (const list of [d.trees, d.rocks, d.shoals, d.patches]) {
    mix(list.length);
    for (const p of list) { mix(p.x); mix(p.z); mix(p.r); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
