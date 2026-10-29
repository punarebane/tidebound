/** Thresholds and pack offers. Pure. */
import { ECONOMY } from '../data/economy';
import { PACKS, type PackDef } from '../data/packs';
import type { BuildingId } from '../data/buildings';
import { mulberry32, seedFrom, weightedIndex } from './rng';

/** Score (relative to the island's start) needed for threshold k (0-based) on island i. */
export function thresholdRel(island: number, k: number): number {
  const scale = Math.pow(ECONOMY.islandScale, island);
  let sum = 0;
  for (let m = 0; m <= k; m++) sum += (ECONOMY.thresholdFirst + ECONOMY.thresholdStep * m) * scale;
  return Math.round(sum);
}

/** Score (relative to the island's start) needed to sail on from island i. */
export function voyageRel(island: number): number {
  return Math.round(ECONOMY.voyageBase * Math.pow(ECONOMY.voyageGrowth, island));
}

export function packById(id: string): PackDef {
  const p = PACKS.find((pk) => pk.id === id);
  if (!p) throw new Error(`Unknown pack ${id}`);
  return p;
}

/** Offer distinct packs, weighted, from those unlocked. Deterministic per (seed, counter). */
export function offerPacks(seed: string, counter: number, thresholdsCrossedTotal: number, count = ECONOMY.offerCount): string[] {
  const rng = mulberry32(seedFrom(seed, 0x5eed, counter));
  const pool = PACKS.filter((p) => p.unlockAt <= thresholdsCrossedTotal && p.weight > 0);
  const out: string[] = [];
  while (out.length < count && pool.length) {
    const i = weightedIndex(rng, pool.map((p) => p.weight));
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}

export function addToHand(hand: Partial<Record<BuildingId, number>>, contents: Partial<Record<BuildingId, number>>): void {
  for (const [k, v] of Object.entries(contents) as Array<[BuildingId, number]>) hand[k] = (hand[k] ?? 0) + v;
}

export function handCount(hand: Partial<Record<BuildingId, number>>): number {
  let n = 0;
  for (const v of Object.values(hand)) n += v ?? 0;
  return n;
}
