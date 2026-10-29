/**
 * Building definitions. Rules live in src/core/rules.ts as pure functions;
 * every number they use comes from the params here.
 */

export type BuildingId = 'house' | 'fisher' | 'lumber' | 'sawmill' | 'market' | 'lighthouse' | 'shrine' | 'farm' | 'seawall' | 'monument';

export interface RuleParams {
  house: { perHouse: number; maxHouses: number; perSawmill: number };
  fisher: { perShoal: number; maxCoastDistance: number };
  lumber: { perTree: number };
  sawmill: { perLumber: number };
  market: { perHouse: number; rivalPenalty: number };
  /** Coastal cliff: within maxCoastDistance of the sea and at least minHeightAboveSea above it. */
  lighthouse: { perBuilding: number; maxCoastDistance: number; minHeightAboveSea: number };
  shrine: { topBonus: number; baseBonus: number };
  /** Patches count when flat grass, dry and not under a building. */
  farm: { perPatch: number; coastPenalty: number };
  /** Must stand within maxCoastDistance of the sea. */
  seawall: { maxCoastDistance: number };
  monument: { perType: number; bonusTypes: number; bonusMultiplier: number };
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
  /**
   * Built on stilts: only its centre needs dry, gentle ground (the edge may
   * hang over water or a slope), and the tide never sinks it.
   */
  stilts?: boolean;
  params: RuleParams[K];
}

export const BUILDINGS: { [K in BuildingId]: BuildingDef<K> } = {
  house: {
    id: 'house',
    name: 'House',
    blurb: '+1 per nearby House (max +4), -2 per nearby Sawmill',
    footprint: 0.75,
    influence: 5,
    sinkPenalty: 2,
    params: { perHouse: 1, maxHouses: 4, perSawmill: -2 },
  },
  fisher: {
    id: 'fisher',
    name: 'Fisher',
    blurb: '+2 per fish shoal in range. Built on stilts at the shore; the tide never sinks it',
    footprint: 0.8,
    influence: 6,
    sinkPenalty: 3,
    stilts: true,
    params: { perShoal: 2, maxCoastDistance: 2 },
  },
  lumber: {
    id: 'lumber',
    name: 'Lumber camp',
    blurb: '+1 per tree in range, then clears those trees',
    footprint: 0.85,
    influence: 2.3,
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
  market: {
    id: 'market',
    name: 'Market',
    blurb: '+2 per House in range, -5 if another Market is in range',
    footprint: 1.0,
    influence: 5,
    sinkPenalty: 4,
    params: { perHouse: 2, rivalPenalty: -5 },
  },
  lighthouse: {
    id: 'lighthouse',
    name: 'Lighthouse',
    blurb: '+1 per building in its large radius. Must stand on a coastal cliff',
    footprint: 0.7,
    influence: 10,
    sinkPenalty: 5,
    params: { perBuilding: 1, maxCoastDistance: 4, minHeightAboveSea: 1.2 },
  },
  shrine: {
    id: 'shrine',
    name: 'Shrine',
    blurb: "+8 on the island's highest ground, else +1",
    footprint: 0.8,
    influence: 1.5,
    sinkPenalty: 6,
    params: { topBonus: 8, baseBonus: 1 },
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    blurb: '+2 per flat grass patch in range, -3 if the coast is in range',
    footprint: 1.1,
    influence: 2.3,
    sinkPenalty: 3,
    params: { perPatch: 2, coastPenalty: -3 },
  },
  seawall: {
    id: 'seawall',
    name: 'Seawall',
    blurb: 'No points. Build it on the shore: buildings in its radius survive the next tide rise',
    footprint: 0.9,
    influence: 5,
    sinkPenalty: 2,
    params: { maxCoastDistance: 2 },
  },
  monument: {
    id: 'monument',
    name: 'Monument',
    blurb: '+1 per distinct building type in range, x2 with 6+ types',
    footprint: 1.2,
    influence: 7,
    sinkPenalty: 8,
    params: { perType: 1, bonusTypes: 6, bonusMultiplier: 2 },
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export function buildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id] as BuildingDef;
}
