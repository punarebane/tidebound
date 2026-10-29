import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../src/core/spatialHash';
import { mulberry32 } from '../src/core/rng';

describe('SpatialHash', () => {
  it('matches brute force for overlap and centre queries', () => {
    const rng = mulberry32(7);
    const h = new SpatialHash<{ id: number; x: number; z: number; r: number }>(4);
    const items = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, x: rng() * 80 - 40, z: rng() * 80 - 40, r: rng() * 2 }));
    items.forEach((it) => h.insert(it));
    for (let q = 0; q < 50; q++) {
      const x = rng() * 80 - 40;
      const z = rng() * 80 - 40;
      const r = rng() * 8;
      const overlap = items.filter((it) => Math.hypot(it.x - x, it.z - z) <= r + it.r).map((it) => it.id);
      const centre = items.filter((it) => Math.hypot(it.x - x, it.z - z) <= r).map((it) => it.id);
      expect(h.query(x, z, r).map((it) => it.id)).toEqual(overlap);
      expect(h.query(x, z, r, true).map((it) => it.id)).toEqual(centre);
    }
  });

  it('removes items', () => {
    const h = new SpatialHash<{ id: number; x: number; z: number; r: number }>(4);
    h.insert({ id: 1, x: 0, z: 0, r: 5 });
    expect(h.query(3, 3, 1)).toHaveLength(1);
    h.remove(1);
    expect(h.query(3, 3, 1)).toHaveLength(0);
    expect(h.size).toBe(0);
  });
});
