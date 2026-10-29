import type { IslandData, Point, Prop } from '../src/world/islandGen';
import { IslandWorld } from '../src/core/world';

export interface FakeIslandOpts {
  half?: number;
  /** Height function; default: flat land at 2 inside radius 12, sea (-2) outside. */
  height?: (x: number, z: number) => number;
  trees?: Array<[number, number]>;
  rocks?: Array<[number, number]>;
  shoals?: Array<[number, number]>;
  patches?: Array<[number, number]>;
}

export const flatDisc = (radius = 12, land = 2) => (x: number, z: number): number => (Math.hypot(x, z) <= radius ? land : -2);

export function fakeIsland(o: FakeIslandOpts = {}): IslandData {
  const half = o.half ?? 20;
  const res = half * 2;
  const w = res + 1;
  const hf = o.height ?? flatDisc();
  const heights = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) heights[j * w + i] = hf(-half + i, -half + j);
  let id = 1000;
  const prop = ([x, z]: [number, number], r: number): Prop => ({ id: id++, x, z, r, scale: 1, rot: 0, variant: 0 });
  const pt = ([x, z]: [number, number], r: number): Point => ({ id: id++, x, z, r });
  return {
    seed: 'test',
    index: 0,
    halfSize: half,
    cell: 1,
    res,
    heights,
    trees: (o.trees ?? []).map((p) => prop(p, 0.35)),
    rocks: (o.rocks ?? []).map((p) => prop(p, 0.55)),
    // Shoal sites one unit deep at sea level 0, wherever the test puts them.
    shoals: (o.shoals ?? []).map((p) => ({ ...pt(p, 0.8), h: -1 })),
    patches: (o.patches ?? []).map((p) => pt(p, 1)),
    shrineHeight: 10,
    maxHeight: Math.max(...heights),
  };
}

export function fakeWorld(o: FakeIslandOpts = {}): IslandWorld {
  return new IslandWorld(fakeIsland(o));
}

let nextId = 1;
export function put(w: IslandWorld, type: import('../src/data/buildings').BuildingId, x: number, z: number): void {
  w.addBuilding({ id: nextId++, type, x, z, r: 0.8, rot: 0, score: 0, order: 0 });
}
