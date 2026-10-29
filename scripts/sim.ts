/**
 * Balance simulation: N seeded games per bot, run across worker threads.
 *   npx tsx scripts/sim.ts [--games 500] [--bot greedy|random|both] [--workers 4] [--json out.json]
 */
import { Worker } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import type { BotKind, GameReport } from './bots';
import { BUILDING_IDS } from '../src/data/buildings';

interface Job { seeds: string[]; bot: BotKind; sets: string[] }

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string, def: string): string => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
  };
  const games = Number(opt('games', '500'));
  const which = opt('bot', 'both');
  const workers = Number(opt('workers', String(Math.max(1, availableParallelism()))));
  const jsonOut = opt('json', '');
  const quiet = args.includes('--quiet');
  // Tuning experiments: --set ECONOMY.thresholdFirst=6 --set BUILDINGS.farm.influence=3
  const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
  const seedBase = opt('seed-base', 'sim');
  const bots: BotKind[] = which === 'both' ? ['greedy', 'random'] : [which as BotKind];
  const seeds = Array.from({ length: games }, (_, i) => `${seedBase}-${i}`);
  const t0 = Date.now();
  const all: Record<string, GameReport[]> = {};
  for (const bot of bots) {
    all[bot] = await run(bot, seeds, workers, sets);
    process.stderr.write(`\n${bot}: ${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  }
  const summaries = Object.fromEntries(bots.map((b) => [b, summarise(all[b])]));
  if (sets.length) console.log(`Overrides: ${sets.join(' ')}`);
  for (const b of bots) (quiet ? printShort : print)(b, summaries[b]);
  const verdict = checkTargets(summaries);
  console.log('\nTargets');
  for (const v of verdict) console.log(`  ${v.ok ? 'PASS' : 'FAIL'}  ${v.text}`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ summaries, verdict }, null, 2));
  process.exitCode = verdict.every((v) => v.ok) ? 0 : 1;
}

function run(bot: BotKind, seeds: string[], n: number, sets: string[]): Promise<GameReport[]> {
  return new Promise((resolve, reject) => {
    const out: GameReport[] = [];
    const chunks: string[][] = Array.from({ length: n }, () => []);
    seeds.forEach((s, i) => chunks[i % n].push(s));
    let alive = 0;
    for (const chunk of chunks.filter((c) => c.length)) {
      alive++;
      const w = new Worker(new URL('./simWorker.mjs', import.meta.url), { workerData: { seeds: chunk, bot, sets } satisfies Job });
      w.on('message', (r: GameReport) => {
        out.push(r);
        if (out.length % 25 === 0) process.stderr.write(`\r${bot} ${out.length}/${seeds.length}`);
      });
      w.on('error', reject);
      w.on('exit', () => {
        if (--alive === 0) resolve(out.sort((a, b) => a.seed.localeCompare(b.seed, 'en', { numeric: true })));
      });
    }
  });
}

const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

export interface Summary {
  games: number;
  islandsMedian: number;
  islandsP90: number;
  islandsHist: Record<number, number>;
  scoreMedian: number;
  scorePerIsland: Array<{ island: number; games: number; mean: number; median: number }>;
  packs: Record<string, number>;
  placed: Record<string, number>;
  pointsShare: Record<string, number>;
  maxPointsShare: { type: string; share: number };
  sunkPerGame: number;
  sunkShareOfPlaced: number;
  sinkingRiseShare: number;
  gamesWithSinking: number;
}

function summarise(rs: GameReport[]): Summary {
  const islands = rs.map((r) => r.islands);
  const hist: Record<number, number> = {};
  for (const n of islands) hist[n] = (hist[n] ?? 0) + 1;
  const maxIsl = Math.max(...rs.map((r) => r.islandScores.length));
  const scorePerIsland = Array.from({ length: maxIsl }, (_, i) => {
    const v = rs.filter((r) => r.islandScores.length > i).map((r) => r.islandScores[i]);
    return { island: i + 1, games: v.length, mean: +mean(v).toFixed(1), median: median(v) };
  });
  const packs: Record<string, number> = {};
  for (const r of rs) for (const p of r.packs) packs[p] = (packs[p] ?? 0) + 1;
  const placed: Record<string, number> = {};
  const points: Record<string, number> = {};
  for (const r of rs) {
    for (const id of BUILDING_IDS) {
      placed[id] = (placed[id] ?? 0) + (r.placed[id] ?? 0);
      points[id] = (points[id] ?? 0) + (r.points[id] ?? 0);
    }
  }
  const totalPts = Object.values(points).reduce((a, b) => a + Math.max(b, 0), 0) || 1;
  const pointsShare = Object.fromEntries(BUILDING_IDS.map((id) => [id, +(Math.max(points[id], 0) / totalPts).toFixed(3)]));
  const top = Object.entries(pointsShare).sort((a, b) => b[1] - a[1])[0];
  const totalPlaced = Object.values(placed).reduce((a, b) => a + b, 0) || 1;
  const sunk = rs.reduce((a, r) => a + r.sunk, 0);
  const rises = rs.reduce((a, r) => a + r.tideRises, 0) || 1;
  return {
    games: rs.length,
    islandsMedian: median(islands),
    islandsP90: quantile(islands, 0.9),
    islandsHist: hist,
    scoreMedian: median(rs.map((r) => r.score)),
    scorePerIsland,
    packs,
    placed,
    pointsShare,
    maxPointsShare: { type: top[0], share: top[1] },
    sunkPerGame: +(sunk / rs.length).toFixed(2),
    sunkShareOfPlaced: +(sunk / totalPlaced).toFixed(3),
    sinkingRiseShare: +(rs.reduce((a, r) => a + r.sinkingRises, 0) / rises).toFixed(3),
    gamesWithSinking: rs.filter((r) => r.sunk > 0).length,
  };
}

function print(bot: string, s: Summary): void {
  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
  console.log(`\n=== ${bot} bot (${s.games} games) ===`);
  console.log(`Islands reached: median ${s.islandsMedian}, p90 ${s.islandsP90}  hist ${JSON.stringify(s.islandsHist)}`);
  console.log(`Final score: median ${s.scoreMedian}`);
  console.log('Score per island (mean / median, games that finished it):');
  for (const r of s.scorePerIsland) console.log(`  #${r.island}: ${r.mean} / ${r.median}  (${r.games})`);
  console.log(`Packs taken: ${Object.entries(s.packs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`Buildings placed: ${Object.entries(s.placed).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`Share of points: ${Object.entries(s.pointsShare).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(', ')}`);
  console.log(`Tide: ${s.sunkPerGame} buildings sunk per game (${pct(s.sunkShareOfPlaced)} of placed); ${pct(s.sinkingRiseShare)} of rises sink something; ${s.gamesWithSinking}/${s.games} games lose a building`);
}

function printShort(bot: string, s: Summary): void {
  const top = Object.entries(s.pointsShare).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' ');
  const per = s.scorePerIsland.slice(0, 5).map((r) => r.mean).join('/');
  // Chance of sailing on from island k, given you reached it.
  const reach = (k: number): number => Object.entries(s.islandsHist).reduce((a, [n, c]) => a + (Number(n) >= k ? c : 0), 0);
  const surv = [1, 2, 3, 4, 5].map((k) => (reach(k) ? (reach(k + 1) / reach(k)).toFixed(2) : '-')).join(' ');
  console.log(`${bot.padEnd(6)} isl med ${s.islandsMedian} p90 ${s.islandsP90} hist ${JSON.stringify(s.islandsHist)} | sail-on ${surv} | per-island ${per} | ${top} | sunk/game ${s.sunkPerGame}`);
}

function checkTargets(s: Record<string, Summary>): Array<{ ok: boolean; text: string }> {
  const out: Array<{ ok: boolean; text: string }> = [];
  if (s.greedy) {
    out.push({ ok: s.greedy.islandsMedian === 3, text: `greedy median islands = 3 (got ${s.greedy.islandsMedian})` });
    out.push({ ok: s.greedy.islandsP90 >= 5, text: `greedy p90 islands >= 5 (got ${s.greedy.islandsP90})` });
    out.push({ ok: s.greedy.maxPointsShare.share <= 0.3, text: `no building > 30% of greedy points (top: ${s.greedy.maxPointsShare.type} ${(s.greedy.maxPointsShare.share * 100).toFixed(1)}%)` });
  }
  if (s.random) out.push({ ok: s.random.islandsMedian === 1, text: `random median islands = 1 (got ${s.random.islandsMedian})` });
  return out;
}

await main();
