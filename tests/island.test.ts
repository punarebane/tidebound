import { describe, expect, it } from 'vitest';
import { generateIsland, hashIsland } from '../src/world/islandGen';
import { Terrain } from '../src/world/terrain';
import { IslandWorld } from '../src/core/world';

describe('island generation', () => {
  it('is deterministic: the same seed gives the same island', () => {
    for (const seed of ['tidebound', 'abc', '12345']) {
      for (const idx of [0, 1, 3]) {
        expect(hashIsland(generateIsland(seed, idx))).toBe(hashIsland(generateIsland(seed, idx)));
      }
    }
  });

  it('matches the recorded hash for a fixed seed', () => {
    // If generation or src/data/world.ts changes on purpose, update this value.
    expect(hashIsland(generateIsland('tidebound', 0))).toBe('8c34406b');
  });

  it('gives different islands for different seeds and indices', () => {
    const a = hashIsland(generateIsland('alpha', 0));
    expect(hashIsland(generateIsland('beta', 0))).not.toBe(a);
    expect(hashIsland(generateIsland('alpha', 1))).not.toBe(a);
  });

  it('produces a playable island: land, coast, trees, rocks, shoals', () => {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const d = generateIsland(seed, 0);
      const land = d.heights.filter((h) => h > 0).length;
      expect(land).toBeGreaterThan(d.heights.length * 0.15);
      expect(land).toBeLessThan(d.heights.length * 0.75);
      // Edges are sea.
      expect(d.heights[0]).toBeLessThan(0);
      expect(d.trees.length).toBeGreaterThan(40);
      expect(d.rocks.length).toBeGreaterThan(3);
      expect(d.shoals.length).toBeGreaterThan(3);
      const t = new Terrain(d);
      const w = new IslandWorld(d);
      expect(w.shoals.size).toBeGreaterThan(3);
      for (const s of w.shoals.all()) expect(t.heightAt(s.x, s.z)).toBeLessThan(0);
      for (const tr of d.trees) expect(t.heightAt(tr.x, tr.z)).toBeGreaterThan(0);
    }
  });

  it('terraces into a handful of height bands', () => {
    const d = generateIsland('tidebound', 1);
    const flats = new Set<number>();
    for (const h of d.heights) if (h > 1.5) flats.add(Math.round(h * 2) / 2);
    // Flat terrace tops dominate: most land vertices sit on few distinct levels.
    expect(flats.size).toBeLessThan(40);
  });
});

describe('terrain queries', () => {
  const d = generateIsland('tidebound', 0);
  const t = new Terrain(d);

  it('interpolates exactly through grid vertices', () => {
    const w = d.res + 1;
    for (const [i, j] of [[10, 10], [30, 34], [40, 20]]) {
      const x = -d.halfSize + i * d.cell;
      const z = -d.halfSize + j * d.cell;
      expect(t.heightAt(x, z)).toBeCloseTo(d.heights[j * w + i], 5);
    }
  });

  it('reports zero coast distance in water and grows inland', () => {
    expect(t.coastDistance(-d.halfSize + 0.5, -d.halfSize + 0.5, 0)).toBe(0);
    let maxD = 0;
    for (let x = -20; x <= 20; x += 2) for (let z = -20; z <= 20; z += 2) maxD = Math.max(maxD, t.coastDistance(x, z, 0));
    expect(maxD).toBeGreaterThan(5);
  });

  it('coast distance shrinks as the sea rises', () => {
    let a = 0;
    let b = 0;
    for (let x = -20; x <= 20; x += 2) for (let z = -20; z <= 20; z += 2) {
      a += t.coastDistance(x, z, 0);
      b += t.coastDistance(x, z, 1.2);
    }
    expect(b).toBeLessThan(a);
  });
});
