/** Trace one greedy game: npx tsx scripts/trace.ts <seed> [--set ...] */
import { applyOverrides } from './overrides';
const args = process.argv.slice(2);
applyOverrides(args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : [])));
const { Game } = await import('../src/core/game');
const { playGame } = await import('./bots');
const seed = args[0] ?? 'sim-0';
// Monkey-patch to log placements.
const proto = Game.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
const place = proto.place;
proto.place = function (this: InstanceType<typeof Game>, ...a: unknown[]) {
  const r = place.apply(this, a) as { score: { total: number }; tide: { sunk: unknown[]; penalty: number } | null } | null;
  const s = this.state;
  if (r) console.log(`  i${s.island} #${s.placements} ${String(a[0]).padEnd(10)} +${r.score.total}  score ${s.score} next ${this.nextThreshold} voyage ${this.voyageThreshold}${r.tide ? ` TIDE sunk ${r.tide.sunk.length} -${r.tide.penalty}` : ''}`);
  return r;
};
const choose = proto.choose;
proto.choose = function (this: InstanceType<typeof Game>, ...a: unknown[]) {
  const offer = this.state.offer;
  const ok = choose.apply(this, a);
  console.log(`  pack: ${offer?.join(' | ')} -> ${offer?.[a[0] as number]}`);
  return ok;
};
const r = playGame(seed, (args.includes('--random') ? 'random' : 'greedy'));
console.log(JSON.stringify({ islands: r.islands, score: r.score, islandScores: r.islandScores }));
