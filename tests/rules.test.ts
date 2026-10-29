import { describe, expect, it } from 'vitest';
import { scoreAt, treesConsumed } from '../src/core/rules';
import { BUILDINGS } from '../src/data/buildings';
import { fakeWorld, put } from './helpers';

describe('House', () => {
  const p = BUILDINGS.house.params;
  it('scores per nearby House, capped', () => {
    const w = fakeWorld();
    expect(scoreAt(w, 'house', 0, 0).total).toBe(0);
    put(w, 'house', 2, 0);
    put(w, 'house', -2, 0);
    expect(scoreAt(w, 'house', 0, 0).total).toBe(2 * p.perHouse);
    for (let i = 0; i < 6; i++) put(w, 'house', Math.cos(i) * 3, Math.sin(i) * 3);
    expect(scoreAt(w, 'house', 0, 0).total).toBe(p.maxHouses * p.perHouse);
  });
  it('ignores Houses out of range', () => {
    const w = fakeWorld();
    put(w, 'house', BUILDINGS.house.influence + 0.5, 0);
    expect(scoreAt(w, 'house', 0, 0).total).toBe(0);
  });
  it('loses points per nearby Sawmill', () => {
    const w = fakeWorld();
    put(w, 'sawmill', 2, 0);
    put(w, 'house', -2, 0);
    expect(scoreAt(w, 'house', 0, 0).total).toBe(p.perHouse + p.perSawmill);
  });
});

describe('Fisher', () => {
  it('scores per fish shoal in range', () => {
    const r = BUILDINGS.fisher.influence;
    const w = fakeWorld({ shoals: [[r - 1, 0], [0, r - 1], [r + 2, 0]] });
    const s = scoreAt(w, 'fisher', 0, 0);
    expect(s.total).toBe(2 * BUILDINGS.fisher.params.perShoal);
    expect(s.parts).toHaveLength(2);
  });
});

describe('Lumber camp', () => {
  it('scores per tree in range and lists them for removal', () => {
    const r = BUILDINGS.lumber.influence;
    const w = fakeWorld({ trees: [[1, 1], [-1, 2], [0, r - 0.2], [r + 1, 0]] });
    expect(scoreAt(w, 'lumber', 0, 0).total).toBe(3 * BUILDINGS.lumber.params.perTree);
    expect(treesConsumed(w, 0, 0)).toHaveLength(3);
  });
});

describe('Sawmill', () => {
  it('scores per Lumber camp in range', () => {
    const w = fakeWorld();
    put(w, 'lumber', 3, 0);
    put(w, 'lumber', -3, 0);
    put(w, 'house', 0, 2);
    put(w, 'lumber', BUILDINGS.sawmill.influence + 1, 0);
    expect(scoreAt(w, 'sawmill', 0, 0).total).toBe(2 * BUILDINGS.sawmill.params.perLumber);
  });
});

describe('Market', () => {
  const p = BUILDINGS.market.params;
  it('scores per House in range', () => {
    const w = fakeWorld();
    put(w, 'house', 2, 0);
    put(w, 'house', 0, 2);
    put(w, 'house', BUILDINGS.market.influence + 1, 0);
    expect(scoreAt(w, 'market', 0, 0).total).toBe(2 * p.perHouse);
  });
  it('loses 5 once if another Market is in range', () => {
    const w = fakeWorld();
    put(w, 'house', 2, 0);
    put(w, 'market', -3, 0);
    put(w, 'market', 0, -3);
    expect(scoreAt(w, 'market', 0, 0).total).toBe(p.perHouse + p.rivalPenalty);
  });
});

describe('Lighthouse', () => {
  it('scores per building of any type in its large radius', () => {
    const w = fakeWorld();
    put(w, 'house', 3, 0);
    put(w, 'sawmill', -6, 0);
    put(w, 'fisher', 0, 9);
    put(w, 'market', 0, -BUILDINGS.lighthouse.influence - 1);
    expect(scoreAt(w, 'lighthouse', 0, 0).total).toBe(3 * BUILDINGS.lighthouse.params.perBuilding);
  });
});

describe('Shrine', () => {
  const p = BUILDINGS.shrine.params;
  it('+8 on the highest ground, +1 elsewhere', () => {
    // A hill: 6 high at the centre, 2 elsewhere; shrine threshold 5.
    const w = fakeWorld({ height: (x, z) => (Math.hypot(x, z) <= 3 ? 6 : Math.hypot(x, z) <= 12 ? 2 : -2) });
    (w.data as { shrineHeight: number }).shrineHeight = 5;
    expect(scoreAt(w, 'shrine', 0, 0).total).toBe(p.topBonus);
    expect(scoreAt(w, 'shrine', 8, 0).total).toBe(p.baseBonus);
  });
});

describe('Farm', () => {
  const p = BUILDINGS.farm.params;
  it('+2 per free flat grass patch in range', () => {
    const w = fakeWorld({ patches: [[2, 0], [-2, 0], [0, 2], [0, BUILDINGS.farm.influence + 1]] });
    expect(scoreAt(w, 'farm', 0, 0).total).toBe(3 * p.perPatch);
    // A building on a patch takes it.
    put(w, 'house', 2, 0);
    expect(scoreAt(w, 'farm', 0, 0).total).toBe(2 * p.perPatch);
  });
  it('-3 when the coast is within range', () => {
    const w = fakeWorld({ patches: [[9, 0]] });
    expect(scoreAt(w, 'farm', 9.5, 0).total).toBe(p.perPatch + p.coastPenalty);
  });
});

describe('Seawall', () => {
  it('scores nothing but marks the buildings it guards', () => {
    const w = fakeWorld();
    put(w, 'house', 2, 0);
    put(w, 'house', 30, 0);
    const s = scoreAt(w, 'seawall', 0, 0);
    expect(s.total).toBe(0);
    expect(s.parts).toHaveLength(1);
  });
});

describe('Monument', () => {
  const p = BUILDINGS.monument.params;
  it('+1 per distinct type in range', () => {
    const w = fakeWorld();
    put(w, 'house', 2, 0);
    put(w, 'house', -2, 0);
    put(w, 'fisher', 0, 2);
    put(w, 'farm', 0, -3);
    expect(scoreAt(w, 'monument', 0, 0).total).toBe(3 * p.perType);
  });
  it('doubles with 6+ types', () => {
    const w = fakeWorld();
    const types = ['house', 'fisher', 'lumber', 'sawmill', 'market', 'farm'] as const;
    types.forEach((t, i) => put(w, t, Math.cos(i) * 4, Math.sin(i) * 4));
    expect(scoreAt(w, 'monument', 0, 0).total).toBe(6 * p.perType * p.bonusMultiplier);
  });
});
