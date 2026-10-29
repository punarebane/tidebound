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
}

/** One +/- line of a score preview, anchored at the thing that caused it. */
export interface Contribution {
  value: number;
  label: string;
  x: number;
  z: number;
}

export interface ScoreResult {
  total: number;
  parts: Contribution[];
}

export type InvalidReason = 'bounds' | 'water' | 'slope' | 'overlap' | 'notCoastal';

export type Validity = { ok: true } | { ok: false; reason: InvalidReason };
