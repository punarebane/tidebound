import { describe, expect, it } from 'vitest';
import { Game, newRunState } from '../src/core/game';
import { thresholdRel, voyageRel, offerPacks } from '../src/core/economy';
import { STARTER_PACK, PACKS } from '../src/data/packs';
import type { BuildingId } from '../src/data/buildings';

/** Best-scoring valid spot for a type on the current island (coarse scan). */
function bestSpot(g: Game, type: BuildingId): { x: number; z: number; s: number } | null {
  let best: { x: number; z: number; s: number } | null = null;
  const h = g.world.data.halfSize - 2;
  for (let z = -h; z <= h; z += 1) {
    for (let x = -h; x <= h; x += 1) {
      const p = g.preview(type, x, z);
      if (p.validity.ok && (!best || p.score.total > best.s)) best = { x, z, s: p.score.total };
    }
  }
  return best;
}

describe('run state and pack flow', () => {
  it('starts with the starter pack', () => {
    const s = newRunState('x');
    expect(s.hand).toEqual(STARTER_PACK.contents);
    expect(s.status).toBe('playing');
  });

  it('thresholds increase and voyages grow per island', () => {
    expect(thresholdRel(0, 1)).toBeGreaterThan(thresholdRel(0, 0));
    expect(thresholdRel(1, 0)).toBeGreaterThan(thresholdRel(0, 0));
    expect(voyageRel(1)).toBeGreaterThan(voyageRel(0));
  });

  it('offers distinct unlocked packs deterministically', () => {
    const a = offerPacks('seed', 3, 0);
    expect(a).toEqual(offerPacks('seed', 3, 0));
    expect(new Set(a).size).toBe(a.length);
    for (const id of a) expect(PACKS.find((p) => p.id === id)!.unlockAt).toBe(0);
  });

  it('placing spends the hand, scores, and rejects invalid spots', () => {
    const g = Game.newRun('tidebound');
    const spot = bestSpot(g, 'lumber')!;
    expect(g.place('lumber', 999, 999)).toBeNull();
    const res = g.place('lumber', spot.x, spot.z)!;
    expect(res.score.total).toBe(spot.s);
    expect(g.state.score).toBe(spot.s);
    expect(g.state.hand.lumber).toBeUndefined();
    expect(g.state.removedTrees.length).toBe(spot.s);
    // Cannot place what you don't hold.
    expect(g.place('lumber', spot.x + 5, spot.z)).toBeNull();
  });

  it('crossing a threshold offers a choice that adds the pack to the hand', () => {
    const g = Game.newRun('tidebound');
    // Force a score just below the first threshold, then place anything that scores.
    g.state.score = g.nextThreshold - 1;
    const spot = bestSpot(g, 'lumber')!;
    expect(spot.s).toBeGreaterThan(0);
    g.place('lumber', spot.x, spot.z);
    expect(g.state.status).toBe('choosing');
    expect(g.state.offer).toHaveLength(2);
    // Can't place while choosing.
    expect(g.canPlace('house')).toBe(false);
    const before = g.state.hand.house ?? 0;
    const pack = PACKS.find((p) => p.id === g.state.offer![0])!;
    const owed = g.state.pendingOffers;
    expect(g.choose(0)).toBe(true);
    // A big placement can cross several thresholds: one offer each.
    expect(g.state.status).toBe(owed > 1 ? 'choosing' : 'playing');
    expect(g.state.pendingOffers).toBe(owed - 1);
    expect(g.state.hand.house ?? 0).toBe(before + (pack.contents.house ?? 0));
    expect(g.state.packsTaken).toEqual([pack.id]);
  });

  it('ends the island when the hand is empty: game over below the voyage threshold', () => {
    const g = Game.newRun('tidebound');
    g.endIsland();
    expect(g.state.status).toBe('gameover');
  });

  it('sails to a larger island and keeps the score when the voyage threshold is met', () => {
    const g = Game.newRun('tidebound');
    const half0 = g.world.data.halfSize;
    g.state.score = g.voyageThreshold;
    // Skip owed threshold offers: we only test the voyage here.
    g.state.islandThresholds = 99;
    g.endIsland();
    expect(g.state.status).toBe('voyage');
    expect(g.sail()).toBe(true);
    expect(g.state.island).toBe(1);
    expect(g.state.score).toBe(g.state.islandStartScore);
    expect(g.world.data.halfSize).toBeGreaterThan(half0);
    expect(g.state.hand).toEqual(STARTER_PACK.contents);
    expect(g.state.buildings).toEqual([]);
  });

  it('round-trips through JSON (save/resume) to the same world', () => {
    const g = Game.newRun('tidebound');
    const spot = bestSpot(g, 'lumber')!;
    g.place('lumber', spot.x, spot.z);
    while (g.state.status === 'choosing') g.choose(0);
    const h = bestSpot(g, 'house')!;
    g.place('house', h.x, h.z);
    const restored = new Game(JSON.parse(JSON.stringify(g.state)));
    expect(restored.state).toEqual(g.state);
    expect(restored.world.trees.size).toBe(g.world.trees.size);
    expect(restored.world.buildings.size).toBe(2);
    const probe = bestSpot(g, 'house')!;
    expect(restored.preview('house', probe.x, probe.z)).toEqual(g.preview('house', probe.x, probe.z));
  });
});
