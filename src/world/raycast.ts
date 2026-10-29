/** Ray vs heightfield (and sea plane) by marching then bisecting. Pure. */
import type { Terrain } from './terrain';

export interface GroundHit {
  x: number;
  y: number;
  z: number;
  /** True when the ray met the sea before the terrain. */
  water: boolean;
}

export function raycastGround(
  t: Terrain,
  seaLevel: number,
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  maxDist = 800,
): GroundHit | null {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  const surface = (s: number): number => {
    const x = ox + dx * s;
    const z = oz + dz * s;
    return Math.max(t.heightAt(x, z), seaLevel);
  };
  const above = (s: number): boolean => oy + dy * s > surface(s);
  // Skip straight to just above the highest point if the ray starts high.
  let s = 0;
  if (dy < 0) {
    const top = Math.max(t.island.maxHeight, seaLevel) + 0.5;
    if (oy > top) s = (oy - top) / -dy;
  }
  if (!above(s)) return null;
  const step = 0.25;
  let prev = s;
  for (s = s + step; s < maxDist; s += step) {
    if (!above(s)) {
      let lo = prev;
      let hi = s;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (above(mid)) lo = mid;
        else hi = mid;
      }
      const x = ox + dx * hi;
      const z = oz + dz * hi;
      const h = t.heightAt(x, z);
      return { x, y: Math.max(h, seaLevel), z, water: h <= seaLevel };
    }
    prev = s;
    if (oy + dy * s < seaLevel - 1) break;
  }
  return null;
}
