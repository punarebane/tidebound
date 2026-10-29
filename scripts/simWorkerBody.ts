import { parentPort, workerData } from 'node:worker_threads';
import { playGame, type BotKind } from './bots';
import { applyOverrides } from './overrides';

const job = workerData as { seeds: string[]; bot: BotKind; sets: string[] };
applyOverrides(job.sets);
for (const seed of job.seeds) parentPort!.postMessage(playGame(seed, job.bot));
