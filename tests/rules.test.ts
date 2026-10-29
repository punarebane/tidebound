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
