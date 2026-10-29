/** The live, queryable state of one island: terrain plus spatial hashes. Pure. */
import { buildingDef, type BuildingId } from '../data/buildings';
import type { IslandData, Point, Prop } from '../world/islandGen';
import { Terrain } from '../world/terrain';
import { SpatialHash } from './spatialHash';
import type { PlacedBuilding } from './types';

export class IslandWorld {
  readonly terrain: Terrain;
  readonly buildings = new SpatialHash<PlacedBuilding>(4);
  readonly trees = new SpatialHash<Prop>(4);
  readonly rocks = new SpatialHash<Prop>(4);
  readonly shoals = new SpatialHash<Point>(8);
  readonly patches = new SpatialHash<Point>(4);
  seaLevel = 0;

  constructor(readonly data: IslandData, removedTrees: Iterable<number> = []) {
    this.terrain = new Terrain(data);
    const removed = new Set(removedTrees);
    for (const t of data.trees) if (!removed.has(t.id)) this.trees.insert(t);
    for (const r of data.rocks) this.rocks.insert(r);
    for (const s of data.shoals) this.shoals.insert(s);
    for (const p of data.patches) this.patches.insert(p);
  }

  /** Buildings whose centre is within r of (x, z), optionally of one type. */
  buildingsNear(x: number, z: number, r: number, type?: BuildingId): PlacedBuilding[] {
    const found = this.buildings.query(x, z, r, true);
    return type ? found.filter((b) => b.type === type) : found;
  }

  addBuilding(b: PlacedBuilding): void {
    this.buildings.insert(b);
  }

  removeBuilding(id: number): void {
    this.buildings.remove(id);
  }

  footprintOf(type: BuildingId): number {
    return buildingDef(type).footprint;
  }
}
