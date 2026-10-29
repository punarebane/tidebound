import type { BuildingId } from '../data/buildings';

export interface PlacedBuilding {
  id: number;
  type: BuildingId;
  x: number;
  z: number;
  /** Footprint radius (copied from data so the hash can do circle tests). */
  r: number;
  rot: number;
  /** Points it scored when placed. */
  score: number;
  /** Placement number on its island (0-based). */
  order: number;
  /** Seawalls only: the tide step this wall guards against. */
  guardStep?: number;
}

/** One +/- line of a score preview, anchored at the thing that caused it. */
export interface Contribution {
  value: number;
  label: string;
  /** Display override for the floating label (e.g. a shield for Seawalls). */
  text?: string;
  x: number;
  z: number;
}

export interface ScoreResult {
  total: number;
  parts: Contribution[];
}

export type InvalidReason = 'bounds' | 'water' | 'slope' | 'overlap' | 'notCoastal' | 'notShore' | 'notCliff';

export type Validity = { ok: true } | { ok: false; reason: InvalidReason };
