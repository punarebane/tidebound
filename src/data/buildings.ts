/**
 * Building definitions. Rules live in src/core/rules.ts as pure functions;
 * every number they use comes from the params here.
 */

export type BuildingId = 'house' | 'fisher' | 'lumber' | 'sawmill';

export interface RuleParams {
  house: { perHouse: number; maxHouses: number; perSawmill: number };
  fisher: { perShoal: number; maxCoastDistance: number };
  lumber: { perTree: number };
  sawmill: { perLumber: number };
}

export interface BuildingDef<K extends BuildingId = BuildingId> {
  id: K;
  name: string;
  /** One-line rule summary for the UI. */
  blurb: string;
  /** Collision radius. */
  footprint: number;
  /** Radius within which the rule looks for things. */
  influence: number;
  /** Points lost when the tide sinks it. */
  sinkPenalty: number;
  params: RuleParams[K];
}

export const BUILDINGS: { [K in BuildingId]: BuildingDef<K> } = {
  house: {
    id: 'house',
    name: 'House',
    blurb: '+1 per nearby House (max +4), -2 per nearby Sawmill',
    footprint: 0.75,
    influence: 4,
    sinkPenalty: 2,
    params: { perHouse: 1, maxHouses: 4, perSawmill: -2 },
  },
  fisher: {
    id: 'fisher',
    name: 'Fisher',
    blurb: '+2 per fish shoal in range. Must be within 2 of the coast',
    footprint: 0.8,
    influence: 7,
    sinkPenalty: 3,
    params: { perShoal: 2, maxCoastDistance: 2 },
  },
  lumber: {
    id: 'lumber',
    name: 'Lumber camp',
    blurb: '+1 per tree in range, then clears those trees',
    footprint: 0.85,
    influence: 3.5,
    sinkPenalty: 3,
    params: { perTree: 1 },
  },
  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    blurb: '+3 per Lumber camp in range',
    footprint: 1.0,
    influence: 6,
    sinkPenalty: 4,
    params: { perLumber: 3 },
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export function buildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id] as BuildingDef;
}
