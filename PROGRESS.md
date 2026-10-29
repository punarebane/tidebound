# Progress

## Done

### Session 1
- **M1** Seeded island generation (simplex + radial falloff + terracing, Poisson-disk trees/rocks, fish shoals, flat grass patches), one merged flat-shaded terrain mesh with band vertex colours, animated water shader with depth tint and shore foam, instanced trees/rocks, shoal markers, orbit camera (clamped pitch, wheel zoom, WASD/arrow and edge pan, Q/E rotate, right-drag orbit, damping), fog, hemisphere + sun with one shadow map. Determinism hash test.
- **M2** Placement ghost with footprint and influence rings, validity (bounds, water, slope, overlap, Fisher coast rule) with a reason hint, 4 buildings (House, Fisher, Lumber camp, Sawmill) with live floating +/- labels per contribution plus total, score burst on placement, hand of buildings (click or 1-9), thresholds with a 1-of-2 pack choice, island end (voyage / game over screens), sail to the next larger island, localStorage save and resume.

## State
- `npm run dev` runs the game. `npm test` (Vitest, 32 tests) and `npm run test:e2e` (Playwright smoke: five scripted placements on seed `tidebound`, score matches a core replay and the recorded total of 15, live labels match, no console errors, screenshots in `test-results/`) both pass. `npm run build` passes.
- Draw calls at the start of a run: ~13.
- Economy numbers (thresholds, voyage, packs) are placeholders; M4 tunes them.

## Known bugs / rough edges
- Tide is not implemented yet (data exists in `src/data/economy.ts`): sea level is fixed at 0.
- Lumber camps are strong in dense forest (13 points from one camp seen on seed `tidebound`); to be balanced in M4.
- Bundle is a single 620 kB chunk (three.js); fine for now, may split for M6.
- The e2e test pins the total (15) for its script; it must be updated when scoring, packs or generation change on purpose.

## Next up (Session 2)
- **M3**: the remaining 6 buildings (Market, Lighthouse, Shrine, Farm, Seawall, Monument) with one Vitest per rule; tide system (rise every 6 placements, 5 steps, 1.5 s tween, shimmer on soon-to-flood terrain, sink + penalty, Seawall immunity); tide gauge UI; richer game over / summary screen.
- **M4**: `scripts/sim.ts` greedy and random bots, 500 seeds each, tune data to targets, record numbers here.
