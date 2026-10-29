/** Headless bots for the balance sim. Pure: only src/core, src/world and src/data. */
import { Game } from '../src/core/game';
import { packById } from '../src/core/economy';
import { mulberry32, seedFrom, type Rng } from '../src/core/rng';
import { BUILDING_IDS, type BuildingId } from '../src/data/buildings';

export type BotKind = 'greedy' | 'random';

export interface GameReport {
  seed: string;
  bot: BotKind;
  islands: number;
  score: number;
  islandScores: number[];
  packs: string[];
  placed: Partial<Record<BuildingId, number>>;
  points: Partial<Record<BuildingId, number>>;
  sunk: number;
  sinkPenalty: number;
  placements: number;
  tideRises: number;
  /** Tide rises that sank at least one building. */
  sinkingRises: number;
}

export const SAMPLES = 200;
export const MAX_ISLANDS = 12;

/** Land cells of the current island, for uniform sampling. */
function landCells(g: Game): Array<[number, number]> {
  const d = g.world.data;
  const out: Array<[number, number]> = [];
  const w = d.res + 1;
  for (let j = 1; j < d.res - 1; j++) {
    for (let i = 1; i < d.res - 1; i++) {
      if (d.heights[j * w + i] > g.world.seaLevel) out.push([-d.halfSize + i * d.cell, -d.halfSize + j * d.cell]);
    }
  }
  return out;
}

function sample(rng: Rng, cells: Array<[number, number]>, cell: number): [number, number] {
  const [x, z] = cells[Math.floor(rng() * cells.length)];
  return [x + rng() * cell, z + rng() * cell];
}

function handTypes(g: Game): BuildingId[] {
  return BUILDING_IDS.filter((id) => (g.state.hand[id] ?? 0) > 0);
}

interface Move { type: BuildingId; x: number; z: number; score: number }

/**
 * Greedy: 200 sampled positions, every type in hand at each, best immediate
 * score delta. Ties go to the spot closest to the last building placed, so a
 * zero-point House still starts a cluster instead of landing anywhere.
 */
function greedyMove(g: Game, rng: Rng, cells: Array<[number, number]>): Move | null {
  const types = handTypes(g);
  const last = g.state.buildings[g.state.buildings.length - 1];
  const dist = (x: number, z: number): number => (last ? Math.hypot(x - last.x, z - last.z) : 0);
  let best: (Move & { d: number }) | null = null;
  for (let k = 0; k < SAMPLES; k++) {
    const [x, z] = sample(rng, cells, g.world.data.cell);
    for (const type of types) {
      const p = g.preview(type, x, z);
      if (!p.validity.ok) continue;
      const d = dist(x, z);
      if (!best || p.score.total > best.score || (p.score.total === best.score && d < best.d)) best = { type, x, z, score: p.score.total, d };
    }
  }
  return best;
}

/** Random: a random type from the hand at the first valid of up to 200 random positions. */
function randomMove(g: Game, rng: Rng, cells: Array<[number, number]>): Move | null {
  const types = handTypes(g);
  for (let k = 0; k < SAMPLES; k++) {
    const type = types[Math.floor(rng() * types.length)];
    const [x, z] = sample(rng, cells, g.world.data.cell);
    const p = g.preview(type, x, z);
    if (p.validity.ok) return { type, x, z, score: p.score.total };
  }
  // Fall back to any type that fits anywhere.
  return greedyMove(g, rng, cells);
}

/** Greedy pack pick: the pack whose buildings have the best sampled scores right now. */
function greedyPack(g: Game, rng: Rng, cells: Array<[number, number]>): number {
  const offer = g.state.offer!;
  const bestFor = new Map<BuildingId, number>();
  for (const id of new Set(offer.flatMap((o) => Object.keys(packById(o).contents) as BuildingId[]))) {
    let b = 0;
    for (let k = 0; k < SAMPLES / 2; k++) {
      const [x, z] = sample(rng, cells, g.world.data.cell);
      const p = g.preview(id, x, z);
      if (p.validity.ok) b = Math.max(b, p.score.total);
    }
    bestFor.set(id, b);
  }
  let bestI = 0;
  let bestV = -Infinity;
  offer.forEach((o, i) => {
    let v = 0;
    for (const [id, n] of Object.entries(packById(o).contents) as Array<[BuildingId, number]>) v += (bestFor.get(id) ?? 0) * n;
    if (v > bestV) { bestV = v; bestI = i; }
  });
  return bestI;
}

export function playGame(seed: string, bot: BotKind): GameReport {
  const g = Game.newRun(seed);
  const rng = mulberry32(seedFrom(seed, bot === 'greedy' ? 1 : 2, 0xb07));
  let cells = landCells(g);
  let cellsKey = `${g.state.island}:${g.state.tideStep}`;
  let tideRises = 0;
  let sinkingRises = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const s = g.state;
    const key = `${s.island}:${s.tideStep}`;
    if (key !== cellsKey) { cells = landCells(g); cellsKey = key; }
    if (s.status === 'choosing') {
      g.choose(bot === 'greedy' ? greedyPack(g, rng, cells) : Math.floor(rng() * s.offer!.length));
      continue;
    }
    if (s.status === 'voyage') {
      if (s.island + 1 >= MAX_ISLANDS) break;
      g.sail();
      continue;
    }
    if (s.status === 'gameover') break;
    const mv = cells.length ? (bot === 'greedy' ? greedyMove(g, rng, cells) : randomMove(g, rng, cells)) : null;
    if (!mv) { g.endIsland(); continue; }
    const r = g.place(mv.type, mv.x, mv.z);
    if (!r) { g.endIsland(); continue; }
    if (r.tide) {
      tideRises++;
      if (r.tide.sunk.length) sinkingRises++;
    }
  }
  const s = g.state;
  const sunk = Object.values(s.stats.sunk).reduce((a, b) => a + (b ?? 0), 0);
  const placements = Object.values(s.stats.placed).reduce((a, b) => a + (b ?? 0), 0);
  return {
    seed, bot, islands: s.island + 1, score: s.score, islandScores: s.islandScores, packs: s.packsTaken,
    placed: s.stats.placed, points: s.stats.points, sunk, sinkPenalty: s.stats.sinkPenalty, placements, tideRises, sinkingRises,
  };
}
