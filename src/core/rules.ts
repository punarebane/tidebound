/**
 * Scoring rules: one pure function per building, reading only the world's
 * spatial hashes and the params in src/data/buildings.ts.
 */
import { BUILDINGS, type BuildingId } from '../data/buildings';
import type { Contribution, ScoreResult } from './types';
import type { IslandWorld } from './world';

type Rule = (w: IslandWorld, x: number, z: number) => Contribution[];

const byDistance = <T extends { x: number; z: number; id: number }>(x: number, z: number, list: T[]): T[] =>
  list
    .map((it) => ({ it, d: (it.x - x) ** 2 + (it.z - z) ** 2 }))
    .sort((a, b) => a.d - b.d || a.it.id - b.it.id)
    .map((e) => e.it);

export const RULES: Record<BuildingId, Rule> = {
  house(w, x, z) {
    const def = BUILDINGS.house;
    const p = def.params;
    const out: Contribution[] = [];
    const houses = byDistance(x, z, w.buildingsNear(x, z, def.influence, 'house')).slice(0, p.maxHouses);
    for (const h of houses) out.push({ value: p.perHouse, label: 'House', x: h.x, z: h.z });
    for (const s of w.buildingsNear(x, z, def.influence, 'sawmill')) out.push({ value: p.perSawmill, label: 'Sawmill', x: s.x, z: s.z });
    return out;
  },

  fisher(w, x, z) {
    const def = BUILDINGS.fisher;
    return w.shoals.query(x, z, def.influence, true).map((s) => ({ value: def.params.perShoal, label: 'Shoal', x: s.x, z: s.z }));
  },

  lumber(w, x, z) {
    const def = BUILDINGS.lumber;
    return w.trees.query(x, z, def.influence, true).map((t) => ({ value: def.params.perTree, label: 'Tree', x: t.x, z: t.z }));
  },

  sawmill(w, x, z) {
    const def = BUILDINGS.sawmill;
    return w.buildingsNear(x, z, def.influence, 'lumber').map((l) => ({ value: def.params.perLumber, label: 'Lumber camp', x: l.x, z: l.z }));
  },
};

export function scoreAt(w: IslandWorld, type: BuildingId, x: number, z: number): ScoreResult {
  const parts = RULES[type](w, x, z);
  let total = 0;
  for (const p of parts) total += p.value;
  return { total, parts };
}

/** Trees a Lumber camp at (x, z) would clear. */
export function treesConsumed(w: IslandWorld, x: number, z: number): number[] {
  return w.trees.query(x, z, BUILDINGS.lumber.influence, true).map((t) => t.id);
}
