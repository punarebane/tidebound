# Progress

## Done

### Session 1
- **M1** Seeded island generation (simplex + radial falloff + terracing, Poisson-disk trees/rocks, fish shoals, flat grass patches), one merged flat-shaded terrain mesh with band vertex colours, animated water shader with depth tint and shore foam, instanced trees/rocks, shoal markers, orbit camera (clamped pitch, wheel zoom, WASD/arrow and edge pan, Q/E rotate, right-drag orbit, damping), fog, hemisphere + sun with one shadow map. Determinism hash test.
- **M2** Placement ghost with footprint and influence rings, validity (bounds, water, slope, overlap, Fisher coast rule) with a reason hint, 4 buildings (House, Fisher, Lumber camp, Sawmill) with live floating +/- labels per contribution plus total, score burst on placement, hand of buildings (click or 1-9), thresholds with a 1-of-2 pack choice, island end (voyage / game over screens), sail to the next larger island, localStorage save and resume.

### Session 2
- **M3** All 10 buildings (Market, Lighthouse, Shrine, Farm, Seawall, Monument added) with models, icons and one Vitest per rule. Tide: rises every 6 placements, 5 steps of 0.35 per island; buildings whose ground is at or under the new level sink and cost their penalty; drowned trees vanish; Seawalls make buildings in their radius immune to the next rise. 1.5 s eased water tween, sinking animation, penalty labels, shimmer on terrain between the current and next sea level (stronger as the rise nears), tide gauge with pips and countdown, rise banner, flood warning in the placement hint. Voyage screen and game over summary (per-island scores, buildings built, lost to tide, packs taken).
- **M4** `scripts/sim.ts` (+ `scripts/bots.ts`): greedy and random bots, 500 seeded games each across worker threads (~30 s total). `--set PATH=value` overrides for tuning sweeps, `--quiet` one-line summaries with sail-on rates, `scripts/trace.ts <seed>` to read one greedy game. All targets pass.

### Session 3
- **M5** Placement pop plus dust puffs; sinking buildings tip, slide under and splash; the camera pulls back, tilts and drifts during each rise. Web Audio soundscape, all synthesised: rolling sea loop (two noise layers on slow LFOs), placement plinks pitched by score (low and soft for negatives), threshold chime, tide swell, sinking glugs, UI ticks; mute with M or the toolbar (remembered). Main menu (Continue, New voyage, Daily island, seed entry, how to play, sound). Daily seed = `daily-YYYY-MM-DD` (UTC). Photo mode (P): hides all UI, looser camera (pitch 4-85°, zoom to 160, wider pan), H hides the hint, P/Esc returns. Toolbar: Menu, Photo, Sound.
- **M6** `?bench` (or `?bench=N`): fills island 5 of seed `bench` with 150 buildings of every type, orbits the camera, and logs frame-time avg / p95, main-thread time, draw calls and triangles (console `[bench]`, `window.benchResult`, on-screen box). `npm run package` builds and zips `dist/` into `tidebound-itch.zip` (168 kB). `npm run screenshots` writes `screenshots/1-5`. Store copy and upload settings in `ITCH.md`.

### Playtest fixes (after Session 3, from Sander's first playtest)
- **Fishers were pointless**: hard to place, rarely near fish, drowned by the tide, and stranded as the coast moved. Now they are stilt huts: only the centre needs dry ground (sloped beaches and an edge over the water are fine), the tide never sinks them, they turn to face the sea, and fish shoals follow the shallows inland as the sea rises. Fisher radius 8 -> 6 so they don't dominate (21% of greedy points, was 15%).
- **Seawalls inland made no sense**: they must now be built on the shore (within 2 of the water) and face the sea.
- Re-tuned to keep the targets: threshold step 2 -> 2.5, voyage base 40 -> 50. The greedy bot now loses ~1 building per game to the tide (was ~7.8), mostly because Fishers no longer sink.

## Performance (`?bench`, 150 buildings)
- Draw calls: 28 (target < 150). Triangles: ~133k.
- Main thread per frame: 1.2 ms avg, 2.6 ms p95 (production build), well inside a 16.7 ms budget.
- Frame time in this container: ~155 ms avg because it only has headless software WebGL (SwiftShader, no GPU); that number says nothing about real hardware. **The 60 fps target still needs one check on a real GPU:** open `/?bench` in a desktop browser and read the box in the corner.

## Balance (final numbers after the playtest fixes, `npm run sim`, seeds sim-0..sim-499)

```
=== greedy bot (500 games) ===
Islands reached: median 3, p90 5  hist {"1":44,"2":89,"3":151,"4":149,"5":62,"6":5}
Final score: median 235.5
Score per island (mean / median, games that finished it):
  #1: 78.9 / 81  (500)
  #2: 75 / 76  (456)
  #3: 68.4 / 65  (367)
  #4: 60.3 / 61  (216)
  #5: 54 / 53  (67)
  #6: 52.8 / 55  (5)
Packs taken: harbour 1413, fields 1085, woodcutters 1054, mill 780, timber 690, pilgrims 623, village 554, beacon 393, hamlet 317, grand 311, marketday 239, breakwater 102
Buildings placed: house 13773, lumber 7349, fisher 5384, farm 4087, sawmill 1469, shrine 623, market 550, lighthouse 336, monument 309, seawall 141
Share of points: farm 25.8%, lumber 22.7%, fisher 20.7%, house 18.1%, sawmill 5.6%, shrine 4.2%, market 1.5%, lighthouse 0.9%, monument 0.5%, seawall 0.0%
Tide: 1 buildings sunk per game (1.5% of placed); 4.8% of rises sink something; 201/500 games lose a building

=== random bot (500 games) ===
Islands reached: median 1, p90 1  hist {"1":500}
Final score: median 6
Score per island (mean / median, games that finished it):
  #1: 7.8 / 6  (500)
Packs taken: harbour 71, woodcutters 66, hamlet 56, fields 53, mill 38, marketday 24, village 8, pilgrims 6, beacon 6, breakwater 2
Buildings placed: house 2030, lumber 708, fisher 656, farm 606, sawmill 38, market 24, shrine 6, lighthouse 5, seawall 3, monument 0
Share of points: farm 46.5%, fisher 28.2%, lumber 16.3%, house 6.9%, sawmill 1.0%, market 0.6%, lighthouse 0.3%, shrine 0.1%, seawall 0.0%, monument 0.0%
Tide: 0.18 buildings sunk per game (2.2% of placed); 14.6% of rises sink something; 80/500 games lose a building

Targets
  PASS  greedy median islands = 3 (got 3)
  PASS  greedy p90 islands >= 5 (got 5)
  PASS  no building > 30% of greedy points (top: farm 25.8%)
  PASS  random median islands = 1 (got 1)
```

Cross-check on a second seed set (`--seed-base alt`): greedy median 3, p90 5, top share farm 26%, Fisher 21%.

Tuning that got there (from the Session 1 placeholders): first threshold 8 -> 6, threshold step 4 -> 2.5, per-island threshold scale 1.3 -> 1.1, voyage 30 x 1.3^i -> 50 x 1.12^i, starter pack gained a Farm, Lumber camp radius 3.5 -> 2.3, Farm radius 4 -> 2.3, House radius 4 -> 5, Fisher radius 7 -> 6, more and shallower fish shoals (spacing 6 -> 4.5, chance 0.55 -> 0.85, depth 0.3-2.2).

## State
- `npm run dev` runs the game. `npm test` (Vitest, 51 tests), `npm run test:e2e` (Playwright, 5 tests: five scripted placements on seed `tidebound` whose score matches a core replay and the recorded total of 12, live labels match the preview, no console errors; a full greedy island through to the voyage / summary screen; resume after reload; menu, daily seed, seed entry and photo mode; `?bench` with 150 buildings; screenshots in `test-results/`) and `npm run sim` all pass. `npm run build` and `npm run package` pass.
- Draw calls at the start of a run: ~13 (buildings are one instanced draw per type).

## Known bugs / rough edges
- The greedy bot rarely gets value from Market, Lighthouse, Monument (each under 2% of its points) and never from Seawall (0 points by design). A planning human will use them more; worth a look in Session 4 if playtests agree.
- About 1 in 11 greedy runs fail the first island (sail-on rates 0.91 / 0.80 / 0.59 / 0.31 / 0.07). Fine for the targets, but a human's first run may end early; consider a gentler first voyage after playtesting.
- The tide now sinks only ~1 greedy building per game. If it feels toothless in play, raise `TIDE.stepHeight` or Market/House sink penalties.
- Bundle is a single ~650 kB chunk (165 kB gzipped, mostly three.js). Fine for itch; could be split later.
- 60 fps on real hardware is unverified (no GPU here); see Performance.
- Audio has only been checked for errors headless, not listened to. Levels in `src/data/audio.ts` may need a pass by ear.
- The Market card icon uses the House shape (different colour).
- The e2e test pins the total (12) for its script and `tests/island.test.ts` pins the island hash; update both when scoring or generation change on purpose.

## Next up (Session 4, buffer)
- Check `/?bench` on a real GPU; if it misses 60 fps, try shadow map 1024 and pixel ratio 1.5 first.
- Listen to the audio and adjust levels.
- Playtest feel: first-island difficulty (greedy fails it 20% of the time), Market / Lighthouse / Monument value, tide readability.
- Upload to itch.io using ITCH.md (needs the owner's itch account).
