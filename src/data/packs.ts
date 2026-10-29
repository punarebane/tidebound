/** Building packs offered at score thresholds. */
import type { BuildingId } from './buildings';

export interface PackDef {
  id: string;
  name: string;
  contents: Partial<Record<BuildingId, number>>;
  /** Relative chance of being offered. */
  weight: number;
  /** Total thresholds crossed (across the whole run) before this pack can appear. */
  unlockAt: number;
}

/** Pack given at the start of every island. */
export const STARTER_PACK: PackDef = {
  id: 'starter',
  name: 'Settlers',
  contents: { house: 3, fisher: 1, lumber: 1 },
  weight: 0,
  unlockAt: 0,
};

export const PACKS: PackDef[] = [
  { id: 'hamlet', name: 'Hamlet', contents: { house: 4 }, weight: 3, unlockAt: 0 },
  { id: 'harbour', name: 'Harbour', contents: { fisher: 2, house: 1 }, weight: 3, unlockAt: 0 },
  { id: 'woodcutters', name: 'Woodcutters', contents: { lumber: 2, house: 1 }, weight: 3, unlockAt: 0 },
  { id: 'mill', name: 'Mill town', contents: { sawmill: 1, lumber: 2 }, weight: 2, unlockAt: 1 },
  { id: 'marketday', name: 'Market day', contents: { market: 1, house: 3 }, weight: 2, unlockAt: 1 },
  { id: 'fields', name: 'Fields', contents: { farm: 2, house: 1 }, weight: 2, unlockAt: 1 },
  { id: 'village', name: 'Village', contents: { house: 3, fisher: 1 }, weight: 2, unlockAt: 2 },
  { id: 'breakwater', name: 'Breakwater', contents: { seawall: 2, house: 1 }, weight: 1.5, unlockAt: 2 },
  { id: 'beacon', name: 'Beacon', contents: { lighthouse: 1, fisher: 1, house: 1 }, weight: 1.5, unlockAt: 2 },
  { id: 'pilgrims', name: 'Pilgrims', contents: { shrine: 1, house: 2 }, weight: 1.5, unlockAt: 2 },
  { id: 'timber', name: 'Timber trade', contents: { lumber: 3, sawmill: 1 }, weight: 1.5, unlockAt: 3 },
  { id: 'grand', name: 'Grand plaza', contents: { monument: 1, market: 1, farm: 1 }, weight: 1, unlockAt: 4 },
];
