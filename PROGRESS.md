# Progress

## Done

### Session 1
- **M1** Seeded island generation (simplex + radial falloff + terracing, Poisson-disk trees/rocks, fish shoals, flat grass patches), one merged flat-shaded terrain mesh with band vertex colours, animated water shader with depth tint and shore foam, instanced trees/rocks, shoal markers, orbit camera (clamped pitch, wheel zoom, WASD/arrow and edge pan, Q/E rotate, right-drag orbit, damping), fog, hemisphere + sun with one shadow map. Determinism hash test.
- **M2** Placement ghost with footprint and influence rings, validity (bounds, water, slope, overlap, Fisher coast rule) with a reason hint, 4 buildings (House, Fisher, Lumber camp, Sawmill) with live floating +/- labels per contribution plus total, score burst on placement, hand of buildings (click or 1-9), thresholds with a 1-of-2 pack choice, island end (voyage / game over screens), sail to the next larger island, localStorage save and resume.

### Session 2
- **M3** All 10 buildings (Market, Lighthouse, Shrine, Farm, Seawall, Monument added) with models, icons and one Vitest per rule. Tide: rises every 6 placements, 5 steps of 0.35 per island; buildings whose ground is at or under the new level sink and cost their penalty; drowned trees vanish; Seawalls make buildings in their radius immune to the next rise. 1.5 s eased water tween, sinking animation, penalty labels, shimmer on terrain between the current and next sea level (stronger as the rise nears), tide gauge with pips and countdown, rise banner, flood warning in the placement hint. Voyage screen and game over summary (per-island scores, buildings built, lost to tide, packs taken).
- **M4** `scripts/sim.ts` (+ `scripts/bots.ts`): greedy and random bots, 500 seeded games each across worker threads (~30 s total). `--set PATH=value` overrides for tuning sweeps, `--quiet` one-line summaries with sail-on rates, `scripts/trace.ts <seed>` to read one greedy game. All targets pass.

## Balance (final numbers, `npm run sim`, seeds sim-0..sim-499)

```
=== greedy bot (500 games) ===
Islands reached: median 3, p90 5  hist {"1":99,"2":80,"3":120,"4":116,"5":65,"6":17,"7":3}
Final score: median 185.5
Score per island (mean / median, games that finished it):
  #1: 63.9 / 62  (500)
  #2: 66.6 / 66  (401)
  #3: 59.1 / 56  (321)
  #4: 52.6 / 47  (201)
  #5: 48.2 / 49  (85)
  #6: 48.3 / 47.5  (20)
  #7: 30.7 / 33  (3)
Packs taken: woodcutters 1121, fields 1005, harbour 916, mill 817, timber 678, pilgrims 608, village 413, hamlet 367, grand 306, beacon 304, marketday 275, breakwater 140
Buildings placed: house 12827, lumber 7441, fisher 3994, farm 3846, sawmill 1495, shrine 608, market 581, monument 305, lighthouse 281, seawall 280
Share of points: farm 27.0%, lumber 25.3%, house 18.5%, fisher 15.1%, sawmill 6.5%, shrine 4.6%, market 1.7%, lighthouse 0.8%, monument 0.5%, seawall 0.0%
Tide: 7.76 buildings sunk per game (12.2% of placed); 44.9% of rises sink something; 496/500 games lose a building

=== random bot (500 games) ===
Islands reached: median 1, p90 1  hist {"1":498,"2":2}
Final score: median 8
Score per island (mean / median, games that finished it):
  #1: 8.1 / 8  (500)
  #2: 3 / 3  (2)
Packs taken: harbour 88, woodcutters 84, hamlet 66, fields 57, mill 45, marketday 44, beacon 12, village 10, breakwater 7, pilgrims 6, timber 1
Buildings placed: house 2192, lumber 763, fisher 681, farm 616, sawmill 46, market 44, seawall 14, lighthouse 11, shrine 6, monument 0
Share of points: farm 44.5%, fisher 32.2%, lumber 14.7%, house 6.7%, sawmill 0.8%, market 0.6%, lighthouse 0.3%, shrine 0.3%, seawall 0.0%, monument 0.0%
Tide: 0.43 buildings sunk per game (4.9% of placed); 28.1% of rises sink something; 154/500 games lose a building

Targets
  PASS  greedy median islands = 3 (got 3)
  PASS  greedy p90 islands >= 5 (got 5)
  PASS  no building > 30% of greedy points (top: farm 27.0%)
  PASS  random median islands = 1 (got 1)
```

Cross-check on a second seed set (`--seed-base alt`): greedy median 3, p90 5, top share lumber 26%.

Tuning that got there (from the Session 1 placeholders): first threshold 8 -> 6, threshold step 4 -> 2, per-island threshold scale 1.3 -> 1.1, voyage 30 x 1.3^i -> 40 x 1.12^i, starter pack gained a Farm, Lumber camp radius 3.5 -> 2.3, Farm radius 4 -> 2.3, House radius 4 -> 5, Fisher radius 7 -> 8, more fish shoals (spacing 6 -> 5, chance 0.55 -> 0.85).

## State
- `npm run dev` runs the game. `npm test` (Vitest, 48 tests), `npm run test:e2e` (Playwright: five scripted placements on seed `tidebound` whose score matches a core replay and the recorded total of 12, live labels match the preview, no console errors; a full greedy island through to the voyage / summary screen; resume after reload; screenshots in `test-results/`) and `npm run sim` all pass. `npm run build` passes.
- Draw calls at the start of a run: ~13 (buildings are one instanced draw per type).

## Known bugs / rough edges
- The greedy bot rarely gets value from Market, Lighthouse, Monument (each under 2% of its points) and never from Seawall (0 points by design). A planning human will use them more; worth a look in Session 4 if playtests agree.
- About 1 in 5 greedy runs fail the first island (sail-on rates 0.80 / 0.80 / 0.63 / 0.42 / 0.24). Fine for the targets, but a human's first run may end early; consider a gentler first voyage after playtesting.
- 12% of the greedy bot's buildings sink: it ignores the tide (it maximises immediate score). Humans get a flood warning in the hint.
- Bundle is a single 620 kB chunk (three.js); fine for now, may split for M6.
- The e2e test pins the total (12) for its script and `tests/island.test.ts` pins the island hash; update both when scoring or generation change on purpose.

## Next up (Session 3)
- **M5** Juice and polish: placement animations (pop exists; add dust/particles), tide cinematic (camera pull-back during the rise), ambient sea loop and placement plinks via Web Audio, main menu, seed entry, daily-seed mode, photo mode (hide UI + free camera).
- **M6** Ship: production build, itch.io zip, ITCH.md store copy, screenshots; `?bench` flag that places 150 buildings and logs frame-time average and p95.
