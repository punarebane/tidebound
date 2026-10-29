/** The tide: sea level per step, who sinks, who a Seawall saves. Pure. */
import { BUILDINGS } from '../data/buildings';
import { TIDE } from '../data/economy';
import type { PlacedBuilding } from './types';
import type { IslandWorld } from './world';

export function seaLevelAt(step: number): number {
  return step * TIDE.stepHeight;
}

/** Does this placement count trigger a rise? (1-based count of placements on the island) */
export function tideDueAfter(placements: number, step: number): boolean {
  return placements > 0 && placements % TIDE.every === 0 && step < TIDE.maxSteps;
}

/** Placements left until the next rise, or null when the tide has peaked. */
export function placementsUntilTide(placements: number, step: number): number | null {
  if (step >= TIDE.maxSteps) return null;
  return TIDE.every - (placements % TIDE.every);
}

/** A building floods when the ground at its centre is at or below the sea. */
export function isFlooded(w: IslandWorld, b: { x: number; z: number }, seaLevel: number): boolean {
  return w.terrain.heightAt(b.x, b.z) <= seaLevel;
}

/** Seawalls placed before this rise that cover the building. */
export function isGuarded(w: IslandWorld, b: PlacedBuilding, step: number): boolean {
  const r = BUILDINGS.seawall.influence;
  return w.buildingsNear(b.x, b.z, r, 'seawall').some((s) => s.guardStep === step);
}

export interface TideResult {
  step: number;
  from: number;
  seaLevel: number;
  sunk: PlacedBuilding[];
  guarded: PlacedBuilding[];
  treesFlooded: number[];
  penalty: number;
}

/**
 * Raise the sea one step on this world. Sunk buildings leave the world;
 * the caller removes them from the run state and applies the penalty.
 */
export function riseTide(w: IslandWorld, newStep: number): TideResult {
  const from = w.seaLevel;
  const sea = seaLevelAt(newStep);
  const sunk: PlacedBuilding[] = [];
  const guarded: PlacedBuilding[] = [];
  const all = [...w.buildings.all()].sort((a, b) => a.id - b.id);
  for (const b of all) {
    if (!isFlooded(w, b, sea)) continue;
    if (isGuarded(w, b, newStep)) guarded.push(b);
    else sunk.push(b);
  }
  for (const b of sunk) w.removeBuilding(b.id);
  const treesFlooded: number[] = [];
  for (const t of [...w.trees.all()]) {
    if (w.terrain.heightAt(t.x, t.z) <= sea) treesFlooded.push(t.id);
  }
  treesFlooded.sort((a, b) => a - b);
  for (const id of treesFlooded) w.trees.remove(id);
  w.seaLevel = sea;
  const penalty = sunk.reduce((a, b) => a + BUILDINGS[b.type].sinkPenalty, 0);
  return { step: newStep, from, seaLevel: sea, sunk, guarded, treesFlooded, penalty };
}
