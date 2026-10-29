# Tidebound: itch.io page

## Title
Tidebound

## Short description (tagline)
A calm island-building score chaser. Build a cosy town, then watch the tide come in.

## Genre / tags
Genre: Strategy (puzzle / city builder)
Tags: city-builder, cozy, low-poly, relaxing, score-attack, procedural-generation, 3D, short, singleplayer, browser

## Description

**Build a little island town before the tide comes in.**

Every voyage starts on a fresh, procedurally generated low-poly island: sandy beaches, terraced hills, pine forests, rocks and shoals of fish glinting offshore. You hold a small pack of buildings. Pick one, and a ghost of it follows your cursor. Floating +/- labels show exactly what every neighbour adds or takes away before you commit.

- **Houses** like company. **Markets** love Houses, but hate rival Markets.
- **Lumber camps** clear the forest for points; **Sawmills** want camps nearby, and Houses don't want Sawmills.
- **Fishers** cluster at the shore near shoals. **Farms** need flat meadows and dislike salt air.
- **Lighthouses** stand on coastal cliffs and count every building in sight. **Shrines** want the highest ground. **Monuments** reward variety.

Cross a score threshold and choose one of two new building packs. Reach the voyage mark and, when your hand runs out, set sail for a bigger island, keeping your score.

**But the sea is rising.** Every six placements the tide climbs a step. Ground that will flood next shimmers, and anything caught below the waterline sinks and costs you points. Build high, gamble on the beach, or raise a **Seawall** to hold back the next rise.

### Features
- Endless seeded islands, plus a **daily island** that is the same for everyone each day
- Type any word to play its island and share seeds with friends
- 10 buildings, 12 packs, 5 tide rises per island
- Gentle synthesised soundscape: rolling surf, soft plinks, the hush of the tide
- **Photo mode**: hide the UI and frame your town
- Runs in the browser, saves automatically: close the tab and carry on later

### Controls
- **Click** a card or press **1-9** to pick a building, **click** the island to place it
- **R** turn the building, **Esc** deselect
- **WASD / arrows / screen edges** pan, **Q / E** or **right-drag** rotate, **mouse wheel** zoom
- **P** photo mode (**H** hides its hint), **M** mute

Desktop browser with mouse and keyboard recommended.

## Upload settings
- Kind of project: HTML
- Upload `tidebound-itch.zip` (made by `npm run package`), tick "This file will be played in the browser"
- Viewport: 1280 x 720, tick "Fullscreen button"; "Mobile friendly" off
- Screenshots: `screenshots/1-title.png` to `screenshots/5-summary.png` (made by `npm run screenshots` against a running dev or preview server)
- Cover image suggestion: crop of `screenshots/4-photo.png` (630 x 500)

## Credits
Made with Three.js, TypeScript and Vite. All art and sound are generated in code.
