/** Uniform-grid spatial hash for circle queries. Pure. */

export interface HashItem {
  id: number;
  x: number;
  z: number;
  r: number;
}

export class SpatialHash<T extends HashItem> {
  private cells = new Map<number, T[]>();
  private items = new Map<number, T>();

  constructor(readonly cellSize: number) {}

  private key(cx: number, cz: number): number {
    // Pack two signed 16-bit cell coords into one int.
    return ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);
  }

  get size(): number {
    return this.items.size;
  }

  insert(item: T): void {
    this.items.set(item.id, item);
    const cs = this.cellSize;
    const x0 = Math.floor((item.x - item.r) / cs);
    const x1 = Math.floor((item.x + item.r) / cs);
    const z0 = Math.floor((item.z - item.r) / cs);
    const z1 = Math.floor((item.z + item.r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = []));
        cell.push(item);
      }
    }
  }

  remove(id: number): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    this.items.delete(id);
    const cs = this.cellSize;
    const x0 = Math.floor((item.x - item.r) / cs);
    const x1 = Math.floor((item.x + item.r) / cs);
    const z0 = Math.floor((item.z - item.r) / cs);
    const z1 = Math.floor((item.z + item.r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cells.get(this.key(cx, cz));
        if (!cell) continue;
        const i = cell.indexOf(item);
        if (i >= 0) cell.splice(i, 1);
      }
    }
    return true;
  }

  get(id: number): T | undefined {
    return this.items.get(id);
  }

  all(): IterableIterator<T> {
    return this.items.values();
  }

  /**
   * Items whose circle overlaps the query circle, or with `centresOnly`,
   * items whose centre lies within r. Results are sorted by id.
   */
  query(x: number, z: number, r: number, centresOnly = false): T[] {
    const cs = this.cellSize;
    const out: T[] = [];
    const seen = new Set<number>();
    // Items are filed under every cell their circle touches, so the query
    // box alone is enough to find all candidates.
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const z0 = Math.floor((z - r) / cs);
    const z1 = Math.floor((z + r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cells.get(this.key(cx, cz));
        if (!cell) continue;
        for (const it of cell) {
          if (seen.has(it.id)) continue;
          seen.add(it.id);
          const dx = it.x - x;
          const dz = it.z - z;
          const reach = centresOnly ? r : r + it.r;
          if (dx * dx + dz * dz <= reach * reach) out.push(it);
        }
      }
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }
}
