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
