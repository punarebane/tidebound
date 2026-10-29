# PROJECT: Tidebound

You are building a complete, shippable 3D browser game in this empty folder. FIRST ACTION: save this entire prompt verbatim as SPEC.md.

## Pitch
A calm island-building score chaser. Place buildings freely on a procedurally generated low-poly island; each scores from what's nearby. The tide rises every few placements, flooding the coast. Hit score thresholds to earn new building packs; when you run out, sail to a fresh island and keep your score.

## Core loop
1. A new island is generated from a seed: heightmap, coastline, forests, rocks and fish shoals.
2. You hold a pack of buildings (e.g. 3 Houses + 1 Fisher). Select one; a translucent ghost follows the cursor over the terrain.
3. While hovering, floating +/- labels show each contribution and the total score delta. Placement is free (not grid-based) but blocked by overlaps, steep slopes and water.
4. Each time score crosses the next threshold, choose 1 of 2 offered packs.
5. TIDE: every 6 placements the sea level rises one step (5 steps per island). Buildings below the new level sink and score their "lost" penalty. A tide gauge UI shows the placements left until the next rise; tiles about to flood shimmer.
6. When your pack is empty and you're below the threshold, the island run ends. If you reached the island's "voyage" threshold, you sail to a new, larger island and keep your total score. Otherwise the game ends.

## Buildings (data-driven in src/data/buildings.ts; start with these 10)
Each has a footprint radius, an influence radius, scoring rules and a sink penalty.
- House: +1 per House nearby (max +4), -2 per Sawmill nearby.
- Fisher: +2 per fish shoal in range, must be within 2 units of the coast.
- Lumber camp: +1 per tree in range; consumes (removes) those trees on placement.
- Sawmill: +3 per Lumber camp in range.
- Market: +2 per House in range, -5 if another Market is in range.
- Lighthouse: +1 per building of any type in its large radius; must be on a coastal cliff.
- Shrine: +8 if placed on the island's highest 10% of terrain, else +1.
- Farm: +2 per flat grass patch in range; -3 if within range of the coast.
- Seawall: no score; buildings in its radius are immune to the next tide rise.
- Monument: +1 per distinct building type in range, x2 if there are 6+ types.
Packs are defined in data with weights and unlock thresholds. Balance through simulation (below), not by guessing.

## Tech
- Vite + TypeScript (strict) + Three.js. Vitest; Playwright for smoke tests.
- Island generation (src/world): seeded simplex noise with a radial falloff mask, then terraced into ~6 height bands for a flat-shaded low-poly look. One merged mesh with vertex colours by band (sand / grass / rock / snow). Poisson-disk sampling for trees and rocks. Fish shoals are points in shallow water.
- Water: a plane with a simple animated vertex/fragment shader (gentle waves, shore foam where the depth texture is shallow). The tide raises the plane over a 1.5s tween; affected tiles shimmer.
- Rendering: InstancedMesh for trees and rocks. Buildings are composed primitives (box + cone roofs, cylinders) generated in code. Target under 150 draw calls, 60fps.
- Placement: raycast onto the terrain; validate slope (surface normal), overlap (circle-vs-circle against a uniform spatial hash), and water. Each building's rules are pure functions that query the spatial hash.
- Camera: orbit with clamped pitch, zoom, and edge-pan or WASD; smooth damping. Rotate with Q/E.
- src/core holds pure logic (scoring, placement validity, tide, pack economy) with no Three.js imports, so it runs in Node.
- Save run state to localStorage (wrapped in try/catch); resume on reload.

## Placeholder art & audio
Soft pastel palette defined in src/data/palette.ts. Gentle fog, a warm hemisphere light plus a directional sun with soft shadows (one shadow map only). Ambient sea loop and placement "plinks" synthesized via the Web Audio API. Score labels pop with an easing curve. Calm, readable, cozy.

## Balance simulation (required)
scripts/sim.ts runs headless in Node:
- A greedy bot samples 200 candidate positions per placement and picks the best score delta. A random bot picks random valid positions.
- Run 500 seeded games of each bot. Report: islands reached (median / p90), score per island, which packs are taken, building usage, and how often the tide sinks buildings.
- Targets: the greedy bot reaches a median of 3 islands and a p90 of 5 or more; the random bot reaches a median of 1; no single building accounts for more than 30% of the greedy bot's points. Tune thresholds and pack weights in data until these hold. Record the final numbers in PROGRESS.md.

## Milestones
Session 1
- M1 Seeded island generation + water + camera; the same seed always gives the same island (hash test).
- M2 Placement ghost, validity, 4 buildings with live score labels, pack flow.
Session 2
- M3 All 10 buildings, thresholds and pack choice, tide system, voyage to the next island, game over / summary screen.
- M4 Balance sim and tuning to the targets.
Session 3
- M5 Juice and polish: placement animations, tide cinematic, ambient audio, main menu, seed entry, daily-seed mode, photo mode (hide UI + free camera).
- M6 Ship: production build, itch.io zip, ITCH.md store copy, screenshots.
Session 4 (buffer): bugs, performance, feel.

## Acceptance checks
- Vitest: scoring rules (one test per building rule), placement validity, tide sinking, island determinism.
- Balance sim targets met (above).
- Playwright: start a run on a fixed seed, place 5 buildings at scripted positions, assert the score matches the expected total; zero console errors; screenshots.
- Performance: 60fps with 150 buildings placed (log the frame-time average and p95 from a ?bench URL flag).

## Out of scope
Multiplayer, accounts, a building editor, mobile touch (desktop first; keep input abstracted).

## Working protocol
- Work autonomously. Don't stop to ask; when something is ambiguous, choose the simplest option that fits this spec and log it in DECISIONS.md.
- Start of every session: read SPEC.md, PROGRESS.md and DECISIONS.md; continue from "Next up".
- Commit after each milestone. Keep main runnable at all times.
- A milestone is done only when its acceptance checks pass.
- End of session, or when context runs long: update PROGRESS.md (done / state / known bugs / next up) and commit.
- All tuning values go in src/data/; all colours go in src/data/palette.ts.
