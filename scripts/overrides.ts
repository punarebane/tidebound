/** Apply "--set PATH=value" tuning overrides to the data modules (sim only). */
import { BUILDINGS } from '../src/data/buildings';
import { ECONOMY, TIDE } from '../src/data/economy';
import { PACKS, STARTER_PACK } from '../src/data/packs';

const ROOTS: Record<string, unknown> = { BUILDINGS, ECONOMY, TIDE, PACKS, STARTER_PACK };

export function applyOverrides(sets: string[]): void {
  for (const s of sets) {
    const [path, raw] = s.split('=');
    const keys = path.split('.');
    let obj = ROOTS[keys.shift()!] as Record<string, unknown>;
    if (Array.isArray(obj)) {
      // PACKS.<id>.<field>...
      const id = keys.shift();
      obj = (obj as Array<{ id: string }>).find((p) => p.id === id) as unknown as Record<string, unknown>;
    }
    if (!obj) throw new Error(`Bad override root in ${s}`);
    while (keys.length > 1) {
      const k = keys.shift()!;
      obj[k] ??= {};
      obj = obj[k] as Record<string, unknown>;
    }
    obj[keys[0]] = raw === 'undefined' ? undefined : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
}
