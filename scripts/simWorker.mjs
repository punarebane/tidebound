// Worker entry for scripts/sim.ts: register tsx in this thread, then run the TS worker body.
import { register } from 'tsx/esm/api';
register();
await import('./simWorkerBody.ts');
