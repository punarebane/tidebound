/** The live, queryable state of one island: terrain plus spatial hashes. Pure. */
import { buildingDef, type BuildingId } from '../data/buildings';
import { WORLD } from '../data/world';
import type { IslandData, Point, Prop, ShoalSite } from '../world/islandGen';
import { Terrain } from '../world/terrain';
import { SpatialHash } from './spatialHash';
import type { PlacedBuilding } from './types';

export class IslandWorld {
  readonly terrain: Terrain;
  readonly buildings = new SpatialHash<PlacedBuilding>(4);
  readonly trees = new SpatialHash<Prop>(4);
  readonly rocks = new SpatialHash<Prop>(4);
  readonly shoals = new SpatialHash<ShoalSite>(8);
  readonly patches = new SpatialHash<Point>(4);
  private _seaLevel = 0;

  constructor(readonly data: IslandData, removedTrees: Iterable<number> = [], seaLevel = 0) {
    this.terrain = new Terrain(data);
    this._seaLevel = seaLevel;
    const removed = new Set(removedTrees);
    for (const t of data.trees) {
      // Trees the tide has already drowned are gone too.
      if (!removed.has(t.id) && this.terrain.heightAt(t.x, t.z) > seaLevel) this.trees.insert(t);
    }
    for (const r of data.rocks) this.rocks.insert(r);
    this.placeShoals();
    for (const p of data.patches) this.patches.insert(p);
  }

  get seaLevel(): number {
    return this._seaLevel;
  }

  /** Raise (or set) the sea; the fish move to the new shallows. */
  set seaLevel(v: number) {
    this.setSeaLevel(v);
  }

  setSeaLevel(v: number): void {
    this._seaLevel = v;
    this.placeShoals();
  }

  /** Shoals are the sites whose water is currently within the shoal depth band. */
  private placeShoals(): void {
    for (const s of [...this.shoals.all()]) this.shoals.remove(s.id);
    for (const s of this.data.shoals) {
      const depth = this._seaLevel - s.h;
      if (depth >= WORLD.shoalMinDepth && depth <= WORLD.shoalMaxDepth) this.shoals.insert(s);
    }
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
