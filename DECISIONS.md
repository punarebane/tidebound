# Decisions

Ambiguities in SPEC.md and how they were resolved (simplest option that fits).

## Session 1

- **Island generation lives in `src/world/islandGen.ts` but is pure.** The spec puts generation in `src/world` and pure logic in `src/core`; the sim needs generation in Node. So `islandGen.ts` and `terrain.ts` have no Three.js imports; only `islandMesh.ts`, `water.ts`, `props.ts`, `shoals.ts` touch Three.js.
- **Own simplex noise and RNG.** A ~60-line seeded simplex (`src/core/noise.ts`) and mulberry32 (`src/core/rng.ts`) instead of a dependency, so determinism is fully under our control.
- **Heightmap grid of 1 unit cells; the mesh and `Terrain.heightAt` use the same triangle split** (diagonal (i,j)-(i+1,j+1)) so raycasts, placement and visuals agree exactly.
- **Terracing keeps the beach smooth.** Heights below ~1.3 are not terraced, so the rising tide eats the beach gradually instead of whole terraces at once. Terrace flats are at multiples of 1.6.
- **Determinism hash** = FNV-1a over heights and prop positions quantised to 1e-4 (`hashIsland`). The recorded hash for seed `tidebound` island 0 is pinned in `tests/island.test.ts`; update it when world generation is changed on purpose.
- **"Depth texture" for water foam is the heightmap packed into an 8-bit texture**, not a GPU depth pre-pass. Cheaper, deterministic, and enough for depth tint + foam.
- **Raycast against the heightfield by ray marching + bisection** (pure, `src/world/raycast.ts`) rather than Three.js mesh raycasting over ~10k triangles every mouse move.
- **Only the placed building scores**, from what is already nearby (Islanders-style). Existing buildings don't gain points retroactively. Score only goes down later through sink penalties.
- **"Nearby"/"in range" = the other thing's centre is within the placed building's influence radius.**
- **House max +4** caps the House bonus (the four nearest Houses count); Sawmill penalties are not capped.
- **Trees and rocks block placement** (circle overlap), like buildings. Lumber camps clear trees in their influence radius.
- **Fisher's coast rule** uses a per-sea-level Euclidean distance field to the nearest water vertex, minus half a cell. "Within 2 units" means that distance is <= 2.
- **Placement validity** samples the centre plus 8 points on the footprint ring: all must be dry (0.05 above sea), normal.y >= 0.9 everywhere and height spread <= 0.5.
- **Thresholds are relative to the score at the island's start.** Increments grow linearly per threshold and scale by 1.3x per island. The voyage threshold is a separate per-island target (30 x 1.3^i). Placeholder values until the M4 sim tunes them.
- **One offer per threshold crossed.** A placement that crosses two thresholds queues two pack choices.
- **Every island starts with the same starter pack** (3 House, 1 Fisher, 1 Lumber camp).
- **"End island" button** lets the player give up their remaining hand if nowhere is left to build, so a run can't soft-lock.
- **Building rotation is visual only** (R rotates the ghost 45°).
- **Buildings are one merged, vertex-coloured geometry per type**, drawn with one InstancedMesh per type, so draw calls don't grow with building count.
- **Labels are DOM elements** projected from world space each frame (crisp text, CSS easing for the pop).
- **Test hooks:** `?test` disables edge panning, ignores the saved run and exposes `window.tidebound`; `?seed=xyz` starts a fresh run on that seed.
- **Playwright uses software WebGL** (SwiftShader flags in `playwright.config.ts`) so it runs headless in CI-like containers.

## Session 2

- **Lighthouse "coastal cliff"** = ground at least 1.2 above the current sea and within 4 units of the coast.
- **Shrine "highest 10%"** = at or above the 90th percentile of land vertex heights (computed at generation, at sea level 0).
- **Farm patches** are lattice points (2 units apart) on flat grass, generated with the island. A patch counts if it is dry and no building footprint covers it. "Within range of the coast" = coast distance from the farm centre <= its influence radius.
- **Market rival penalty is a flat -5** however many other Markets are in range.
- **Monument** counts distinct types among buildings in range (another Monument counts as a type). With 6+ types the whole sum doubles, shown as an extra "x2" label.
- **Seawall** guards the rise right after it is placed (`guardStep = tideStep + 1`), including itself. After that rise its protection is spent.
- **Sinking test is the ground at the building's centre** being at or below the new sea level. Tide steps are 0.35 so terrace flats (multiples of 1.6) never sit exactly on a step; the first terrace floods on the 5th rise.
- **Trees drown** when the sea covers them (no score change). They are re-derived from the sea level on load, so saves don't store them.
- **Order on the 6th placement:** score, thresholds, then the tide. Thresholds already crossed stay crossed even if a sink penalty drops the score below them.
- **Placements count per island** (tide resets to 0 on a new island); the tide stops after 5 rises.
- **Greedy bot details:** 200 positions sampled uniformly from land cells; every type in hand is tried at each; best immediate score wins, ties go to the spot nearest the last building (so 0-point Houses still cluster). It picks the offered pack whose contents have the best sampled scores. It ends an island when no sampled spot is valid. Runs are capped at 12 islands.
- **Random bot:** random type from the hand at the first valid of 200 random positions, random pack.
- **"Islands reached"** = islands started (1 = never sailed).
- **Points share** for the 30% target uses points earned at placement (sink penalties are reported separately).
- **Sim overrides** (`--set ECONOMY.voyageGrowth=1.1`) mutate the data objects inside sim workers only; the shipped numbers live in `src/data/`.

## Session 3

- **Menu shows on a plain visit only.** `?test`, `?bench` and `?seed=` links skip it, so shared seed links drop straight onto the island. The run behind the menu is the saved one (or a fresh random seed); "New run" on the game-over screen opens the menu.
- **Daily seed is `daily-YYYY-MM-DD` in UTC**, so everyone shares the island regardless of time zone.
- **Seed entry is normalised** (trimmed, lower-case, spaces to dashes, max 32 chars) so "Drift Wood" and "drift wood" are the same island.
- **Audio starts on the first pointer or key press** (browser autoplay rules); mute state persists in localStorage.
- **Tide cinematic is a camera envelope**, not a cutscene: input still works and the camera returns by itself.
- **Photo mode** hides the HUD and labels with a CSS class, disables placement, and loosens camera limits; leaving it clamps back.
- **Bench uses island index 4 of seed `bench`** (bigger island) and inserts buildings directly (no scoring, no tide, trees cleared where needed) so it always reaches 150. It reports main-thread time per frame alongside raw frame time, because headless runs use software WebGL.
- **The Playwright bench test asserts building count, draw calls < 150 and main-thread time < 16.7 ms**, and only logs frame times (not meaningful without a GPU).
- **Screenshots are committed** in `screenshots/` for the store page; regenerate with `npm run screenshots` against a running server.

## Playtest fixes (Sander's first playtest)

- **Fishers are stilt huts** (`stilts: true` in data): placement checks only the centre (dry, normal.y >= 0.8), and the tide never sinks them. This departs from "buildings below the new level sink" for Fishers only, because a coastal building that always drowns was pointless in play.
- **Fish shoals follow the sea.** Generation makes shoal *sites* over every depth the shallows will reach (sea floor from -2.2 up to the top tide level minus 0.3). A site is active while the water above it is 0.3-2.2 deep, so shoals creep inland with the tide.
- **Seawalls must be on the shore** (coast distance <= 2, new reason "notShore"). They still guard only the next rise, as the spec says.
- **Fishers and Seawalls auto-face the sea** using the coast-distance gradient (visual only).
