/**
 * The run: one seed, a sequence of islands, a hand of buildings, score and
 * thresholds. Pure and serialisable so the browser, tests and the sim share it.
 */
import { buildingDef, type BuildingId } from '../data/buildings';
import { STARTER_PACK } from '../data/packs';
import { TIDE } from '../data/economy';
import { generateIsland } from '../world/islandGen';
import { addToHand, handCount, offerPacks, packById, thresholdRel, voyageRel } from './economy';
import { validatePlacement } from './placement';
import { scoreAt, treesConsumed } from './rules';
import { placementsUntilTide, riseTide, seaLevelAt, tideDueAfter, type TideResult } from './tide';
import type { PlacedBuilding, ScoreResult, Validity } from './types';
import { IslandWorld } from './world';

export type RunStatus = 'playing' | 'choosing' | 'voyage' | 'gameover';

export interface RunState {
  version: 2;
  seed: string;
  island: number;
  score: number;
  islandStartScore: number;
  hand: Partial<Record<BuildingId, number>>;
  buildings: PlacedBuilding[];
  removedTrees: number[];
  nextId: number;
  /** Placements on the current island. */
  placements: number;
  /** Thresholds crossed on this island / in the whole run. */
  islandThresholds: number;
  totalThresholds: number;
  /** Offers still owed to the player (one per threshold crossed). */
  pendingOffers: number;
  offer: string[] | null;
  offerCounter: number;
  status: RunStatus;
  /** Tide rises so far on this island (0..TIDE.maxSteps). */
  tideStep: number;
  /** Score gained on each finished island. */
  islandScores: number[];
  packsTaken: string[];
  stats: RunStats;
}

export interface RunStats {
  placed: Partial<Record<BuildingId, number>>;
  /** Points earned at placement, by type (before sink penalties). */
  points: Partial<Record<BuildingId, number>>;
  sunk: Partial<Record<BuildingId, number>>;
  sinkPenalty: number;
  guarded: number;
}

export interface Preview {
  validity: Validity;
  score: ScoreResult;
}

export interface PlaceResult {
  building: PlacedBuilding;
  score: ScoreResult;
  treesRemoved: number[];
  thresholdsCrossed: number;
  /** Set when this placement made the tide rise. */
  tide: TideResult | null;
}

export function newRunState(seed: string): RunState {
  const s: RunState = {
    version: 2,
    seed,
    island: 0,
    score: 0,
    islandStartScore: 0,
    hand: {},
    buildings: [],
    removedTrees: [],
    nextId: 1,
    placements: 0,
    islandThresholds: 0,
    totalThresholds: 0,
    pendingOffers: 0,
    offer: null,
    offerCounter: 0,
    status: 'playing',
    tideStep: 0,
    islandScores: [],
    packsTaken: [],
    stats: { placed: {}, points: {}, sunk: {}, sinkPenalty: 0, guarded: 0 },
  };
  addToHand(s.hand, STARTER_PACK.contents);
  return s;
}

export class Game {
  world: IslandWorld;

  constructor(public state: RunState) {
    this.world = Game.buildWorld(state);
  }

  static newRun(seed: string): Game {
    return new Game(newRunState(seed));
  }

  private static buildWorld(s: RunState): IslandWorld {
    const w = new IslandWorld(generateIsland(s.seed, s.island), s.removedTrees, seaLevelAt(s.tideStep));
    for (const b of s.buildings) w.addBuilding(b);
    return w;
  }

  /** Absolute score needed for the next threshold on this island. */
  get nextThreshold(): number {
    return this.state.islandStartScore + thresholdRel(this.state.island, this.state.islandThresholds);
  }

  /** Absolute score of the previous threshold (or the island start). */
  get prevThreshold(): number {
    const s = this.state;
    return s.islandThresholds === 0 ? s.islandStartScore : s.islandStartScore + thresholdRel(s.island, s.islandThresholds - 1);
  }

  get voyageThreshold(): number {
    return this.state.islandStartScore + voyageRel(this.state.island);
  }

  /** Placements left before the sea rises again (null once it has peaked). */
  get placementsUntilTide(): number | null {
    return placementsUntilTide(this.state.placements, this.state.tideStep);
  }

  /** Sea level after the next rise (equal to now once peaked). */
  get nextSeaLevel(): number {
    return seaLevelAt(Math.min(this.state.tideStep + 1, TIDE.maxSteps));
  }

  canPlace(type: BuildingId): boolean {
    return this.state.status === 'playing' && (this.state.hand[type] ?? 0) > 0;
  }

  preview(type: BuildingId, x: number, z: number): Preview {
    return { validity: validatePlacement(this.world, type, x, z), score: scoreAt(this.world, type, x, z) };
  }

  /** Place a building; returns null if not allowed. */
  place(type: BuildingId, x: number, z: number, rot = 0): PlaceResult | null {
    const s = this.state;
    if (!this.canPlace(type)) return null;
    if (!validatePlacement(this.world, type, x, z).ok) return null;
    const score = scoreAt(this.world, type, x, z);
    const treesRemoved = type === 'lumber' ? treesConsumed(this.world, x, z) : [];
    for (const id of treesRemoved) this.world.trees.remove(id);
    s.removedTrees.push(...treesRemoved);

    const building: PlacedBuilding = { id: s.nextId++, type, x, z, r: buildingDef(type).footprint, rot, score: score.total, order: s.placements };
    if (type === 'seawall') building.guardStep = s.tideStep + 1;
    s.buildings.push(building);
    s.stats.placed[type] = (s.stats.placed[type] ?? 0) + 1;
    s.stats.points[type] = (s.stats.points[type] ?? 0) + score.total;
    this.world.addBuilding(building);
    s.hand[type] = (s.hand[type] ?? 0) - 1;
    if (!s.hand[type]) delete s.hand[type];
    s.placements++;
    s.score += score.total;

    let crossed = 0;
    while (s.score >= this.nextThreshold) {
      s.islandThresholds++;
      s.totalThresholds++;
      crossed++;
    }
    s.pendingOffers += crossed;

    let tide: TideResult | null = null;
    if (tideDueAfter(s.placements, s.tideStep)) tide = this.rise();
    this.advance();
    return { building, score, treesRemoved, thresholdsCrossed: crossed, tide };
  }

  private rise(): TideResult {
    const s = this.state;
    s.tideStep++;
    const res = riseTide(this.world, s.tideStep);
    const gone = new Set(res.sunk.map((b) => b.id));
    s.buildings = s.buildings.filter((b) => !gone.has(b.id));
    for (const b of res.sunk) s.stats.sunk[b.type] = (s.stats.sunk[b.type] ?? 0) + 1;
    s.stats.sinkPenalty += res.penalty;
    s.stats.guarded += res.guarded.length;
    s.score -= res.penalty;
    // Drowned trees are re-derived from the sea level on load; no need to store them.
    return res;
  }

  /** Pick one of the offered packs (by index). */
  choose(index: number): boolean {
    const s = this.state;
    if (s.status !== 'choosing' || !s.offer || !s.offer[index]) return false;
    const pack = packById(s.offer[index]);
    addToHand(s.hand, pack.contents);
    s.packsTaken.push(pack.id);
    s.offer = null;
    s.pendingOffers--;
    s.status = 'playing';
    this.advance();
    return true;
  }

  /** Give up on the rest of the hand (e.g. nowhere left to build). */
  endIsland(): void {
    if (this.state.status !== 'playing') return;
    this.state.hand = {};
    this.advance();
  }

  /** Sail to the next island (only after reaching the voyage threshold). */
  sail(): boolean {
    const s = this.state;
    if (s.status !== 'voyage') return false;
    s.island++;
    s.islandStartScore = s.score;
    s.buildings = [];
    s.removedTrees = [];
    s.placements = 0;
    s.islandThresholds = 0;
    s.tideStep = 0;
    s.hand = {};
    addToHand(s.hand, STARTER_PACK.contents);
    s.status = 'playing';
    this.world = Game.buildWorld(s);
    return true;
  }

  /** Move the state machine on: show owed offers, or end the island. */
  private advance(): void {
    const s = this.state;
    if (s.status !== 'playing') return;
    if (s.pendingOffers > 0) {
      s.offer = offerPacks(s.seed, s.offerCounter++, s.totalThresholds);
      s.status = 'choosing';
      return;
    }
    if (handCount(s.hand) === 0) {
      s.islandScores.push(s.score - s.islandStartScore);
      s.status = s.score >= this.voyageThreshold ? 'voyage' : 'gameover';
    }
  }
}
