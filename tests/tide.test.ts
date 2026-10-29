import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { riseTide, seaLevelAt, placementsUntilTide, tideDueAfter } from '../src/core/tide';
import { validatePlacement } from '../src/core/placement';
import { BUILDINGS } from '../src/data/buildings';
import { TIDE } from '../src/data/economy';
import { fakeWorld } from './helpers';

/** Gentle ramp: height = 0.1 * (10 - x) inside the disc, so the shore moves inland as the sea rises. */
const ramp = (x: number, z: number): number => (Math.hypot(x, z) <= 15 ? 0.1 * (12 - x) : -2);

function add(w: ReturnType<typeof fakeWorld>, id: number, type: 'house' | 'seawall', x: number, z: number, guardStep?: number) {
  const b = { id, type, x, z, r: 0.8, rot: 0, score: 0, order: 0, guardStep };
  w.addBuilding(b);
  return b;
}

describe('tide', () => {
  it('rises every 6 placements, 5 steps per island', () => {
    expect(TIDE.every).toBe(6);
    expect(TIDE.maxSteps).toBe(5);
    expect(tideDueAfter(5, 0)).toBe(false);
    expect(tideDueAfter(6, 0)).toBe(true);
    expect(tideDueAfter(12, 1)).toBe(true);
    expect(tideDueAfter(36, 5)).toBe(false);
    expect(placementsUntilTide(0, 0)).toBe(6);
    expect(placementsUntilTide(4, 0)).toBe(2);
    expect(placementsUntilTide(30, 5)).toBeNull();
  });

  it('sinks buildings below the new level and charges their penalty', () => {
    const w = fakeWorld({ height: ramp });
    // Ground at x=8.5 is 0.35; at x=2 it is 1.0.
    const low = add(w, 1, 'house', 8.6, 0);
    add(w, 2, 'house', 2, 0);
    const res = riseTide(w, 1);
    expect(res.seaLevel).toBeCloseTo(seaLevelAt(1));
    expect(res.sunk.map((b) => b.id)).toEqual([low.id]);
    expect(res.penalty).toBe(BUILDINGS.house.sinkPenalty);
    expect(w.buildings.size).toBe(1);
    expect(w.seaLevel).toBeCloseTo(TIDE.stepHeight);
  });

  it('drowns trees and blocks placement on flooded ground', () => {
    const w = fakeWorld({ height: ramp, trees: [[9, 3], [0, 3]] });
    expect(validatePlacement(w, 'house', 9, -3).ok).toBe(true);
    const res = riseTide(w, 1);
    expect(res.treesFlooded).toHaveLength(1);
    expect(w.trees.size).toBe(1);
    expect(validatePlacement(w, 'house', 9, -3)).toEqual({ ok: false, reason: 'water' });
  });

  it('a Seawall makes buildings in its radius immune to the next rise only', () => {
    const w = fakeWorld({ height: ramp });
    add(w, 1, 'house', 8.6, 0);
    add(w, 2, 'seawall', 4.5, 0, 1);
    const r1 = riseTide(w, 1);
    expect(r1.sunk).toEqual([]);
    expect(r1.guarded.map((b) => b.id)).toEqual([1]);
    const r2 = riseTide(w, 2);
    expect(r2.sunk.map((b) => b.id)).toEqual([1]);
  });

  it('runs inside the game: the 6th placement raises the sea and updates score and state', () => {
    const g = Game.newRun('tidebound');
    // Give a big hand of houses and stay below thresholds so no choice interrupts.
    g.state.hand = { house: 12 };
    g.state.islandThresholds = 50;
    const h = g.world.data.halfSize - 2;
    let placed = 0;
    let tideSeen = false;
    // Place houses on the lowest valid ground so some of them sink.
    const spots: Array<[number, number, number]> = [];
    for (let z = -h; z <= h; z += 1.5) for (let x = -h; x <= h; x += 1.5) {
      if (g.preview('house', x, z).validity.ok) spots.push([g.world.terrain.heightAt(x, z), x, z]);
    }
    spots.sort((a, b) => a[0] - b[0]);
    for (const [, x, z] of spots) {
      const before = g.state.score;
      const r = g.place('house', x, z);
      if (!r) continue;
      placed++;
      if (placed === 6) {
        expect(r.tide).not.toBeNull();
        tideSeen = true;
        expect(g.state.tideStep).toBe(1);
        expect(r.tide!.sunk.length).toBeGreaterThan(0);
        expect(g.state.score).toBe(before + r.score.total - r.tide!.penalty);
        expect(g.state.buildings.length).toBe(6 - r.tide!.sunk.length);
        expect(g.world.seaLevel).toBeCloseTo(TIDE.stepHeight);
        break;
      } else {
        expect(r.tide).toBeNull();
      }
    }
    expect(tideSeen).toBe(true);
    // Reloading reproduces the flooded world.
    const again = new Game(JSON.parse(JSON.stringify(g.state)));
    expect(again.world.seaLevel).toBeCloseTo(g.world.seaLevel);
    expect(again.world.trees.size).toBe(g.world.trees.size);
    expect(again.world.buildings.size).toBe(g.world.buildings.size);
  });
});
