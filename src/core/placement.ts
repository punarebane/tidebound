/** Placement validity: bounds, water, slope, overlap, and per-building site rules. Pure. */
import { BUILDINGS, buildingDef, type BuildingId } from '../data/buildings';
import { PLACEMENT } from '../data/economy';
import type { Validity } from './types';
import type { IslandWorld } from './world';

export function validatePlacement(w: IslandWorld, type: BuildingId, x: number, z: number): Validity {
  const t = w.terrain;
  const def = buildingDef(type);
  const r = def.footprint;
  if (!t.inBounds(x - r, z - r) || !t.inBounds(x + r, z + r)) return { ok: false, reason: 'bounds' };

  if (def.stilts) {
    // Stilt huts only need their centre on dry, not-too-steep ground.
    if (t.heightAt(x, z) < w.seaLevel + PLACEMENT.minFreeboard) return { ok: false, reason: 'water' };
    if (t.normalYAt(x, z) < PLACEMENT.stiltMinNormalY) return { ok: false, reason: 'slope' };
  } else {
    // Sample the centre and a ring at the footprint edge.
    let minH = Infinity;
    let maxH = -Infinity;
    let minNY = Infinity;
    const n = PLACEMENT.ringSamples;
    for (let k = -1; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const sx = k < 0 ? x : x + Math.cos(a) * r;
      const sz = k < 0 ? z : z + Math.sin(a) * r;
      const h = t.heightAt(sx, sz);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      const ny = t.normalYAt(sx, sz);
      if (ny < minNY) minNY = ny;
    }
    if (minH < w.seaLevel + PLACEMENT.minFreeboard) return { ok: false, reason: 'water' };
    if (minNY < PLACEMENT.minNormalY || maxH - minH > PLACEMENT.maxHeightSpread) return { ok: false, reason: 'slope' };
  }

  if (w.buildings.query(x, z, r).length) return { ok: false, reason: 'overlap' };
  if (w.trees.query(x, z, r).length) return { ok: false, reason: 'overlap' };
  if (w.rocks.query(x, z, r).length) return { ok: false, reason: 'overlap' };

  if (type === 'fisher' && t.coastDistance(x, z, w.seaLevel) > BUILDINGS.fisher.params.maxCoastDistance) {
    return { ok: false, reason: 'notCoastal' };
  }
  if (type === 'seawall' && t.coastDistance(x, z, w.seaLevel) > BUILDINGS.seawall.params.maxCoastDistance) {
    return { ok: false, reason: 'notShore' };
  }
  if (type === 'lighthouse' && !isCoastalCliff(w, x, z)) return { ok: false, reason: 'notCliff' };
  return { ok: true };
}

/**
 * Yaw that turns a building's front (+z) to face the nearest sea, from the
 * slope of the coast-distance field. Null when there is no clear direction.
 */
export function seaFacingYaw(w: IslandWorld, x: number, z: number): number | null {
  const t = w.terrain;
  const e = 0.75;
  const gx = t.coastDistance(x + e, z, w.seaLevel) - t.coastDistance(x - e, z, w.seaLevel);
  const gz = t.coastDistance(x, z + e, w.seaLevel) - t.coastDistance(x, z - e, w.seaLevel);
  if (Math.hypot(gx, gz) < 1e-3) return null;
  return Math.atan2(-gx, -gz);
}

/** Lighthouse site: close to the sea but standing well above it. */
export function isCoastalCliff(w: IslandWorld, x: number, z: number): boolean {
  const p = BUILDINGS.lighthouse.params;
  return w.terrain.heightAt(x, z) - w.seaLevel >= p.minHeightAboveSea && w.terrain.coastDistance(x, z, w.seaLevel) <= p.maxCoastDistance;
}

export const REASON_TEXT: Record<string, string> = {
  bounds: 'Too close to the edge of the world',
  water: 'Needs dry land',
  slope: 'Too steep',
  overlap: 'Something is in the way',
  notCoastal: 'Must be at the shore, within 2 of the water',
  notShore: 'Seawalls go on the shore, within 2 of the water',
  notCliff: 'Needs a coastal cliff: high ground right by the sea',
};
