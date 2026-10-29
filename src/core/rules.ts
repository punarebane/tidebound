/**
 * Scoring rules: one pure function per building, reading only the world's
 * spatial hashes and the params in src/data/buildings.ts.
 */
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../data/buildings';
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

  market(w, x, z) {
    const def = BUILDINGS.market;
    const out: Contribution[] = w.buildingsNear(x, z, def.influence, 'house').map((h) => ({ value: def.params.perHouse, label: 'House', x: h.x, z: h.z }));
    const rival = byDistance(x, z, w.buildingsNear(x, z, def.influence, 'market'))[0];
    if (rival) out.push({ value: def.params.rivalPenalty, label: 'Rival market', x: rival.x, z: rival.z });
    return out;
  },

  lighthouse(w, x, z) {
    const def = BUILDINGS.lighthouse;
    return w.buildingsNear(x, z, def.influence).map((b) => ({ value: def.params.perBuilding, label: BUILDINGS[b.type].name, x: b.x, z: b.z }));
  },

  shrine(w, x, z) {
    const p = BUILDINGS.shrine.params;
    const high = w.terrain.heightAt(x, z) >= w.data.shrineHeight;
    return [{ value: high ? p.topBonus : p.baseBonus, label: high ? 'High ground' : 'Low ground', x, z }];
  },

  farm(w, x, z) {
    const def = BUILDINGS.farm;
    const out: Contribution[] = [];
    for (const pt of w.patches.query(x, z, def.influence, true)) {
      if (w.terrain.heightAt(pt.x, pt.z) <= w.seaLevel) continue;
      if (w.buildings.query(pt.x, pt.z, 0).length) continue;
      out.push({ value: def.params.perPatch, label: 'Grass', x: pt.x, z: pt.z });
    }
    if (w.terrain.coastDistance(x, z, w.seaLevel) <= def.influence) out.push({ value: def.params.coastPenalty, label: 'Salt air', x, z });
    return out;
  },

  seawall(w, x, z) {
    const def = BUILDINGS.seawall;
    return w.buildingsNear(x, z, def.influence).map((b) => ({ value: 0, label: 'Guarded', text: '🛡', x: b.x, z: b.z }));
  },

  monument(w, x, z) {
    const def = BUILDINGS.monument;
    const p = def.params;
    const near = byDistance(x, z, w.buildingsNear(x, z, def.influence));
    const out: Contribution[] = [];
    for (const type of BUILDING_IDS) {
      const b = near.find((n) => n.type === type);
      if (b) out.push({ value: p.perType, label: BUILDINGS[type].name, x: b.x, z: b.z });
    }
    if (out.length >= p.bonusTypes) {
      const base = out.reduce((a, c) => a + c.value, 0);
      out.push({ value: base * (p.bonusMultiplier - 1), label: `x${p.bonusMultiplier} variety`, text: `x${p.bonusMultiplier}`, x, z });
    }
    return out;
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
