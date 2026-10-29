// Store screenshots for itch.io: node scripts/screenshots.mjs [baseUrl] [outDir]
// Needs a running server (npm run dev or npm run preview).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

/** Greedy move through the app (same idea as the sim bot), n times. */
const play = (n) => page.evaluate((n) => {
  const app = window.tidebound;
  const g = app.game;
  for (let i = 0; i < n; i++) {
    while (g.state.status === 'choosing') app.choose(0);
    if (g.state.status !== 'playing') return;
    let best = null;
    const h = g.world.data.halfSize - 2;
    for (const t of Object.keys(g.state.hand)) for (let z = -h; z <= h; z += 1) for (let x = -h; x <= h; x += 1) {
      const p = g.preview(t, x, z);
      if (p.validity.ok && (!best || p.score.total > best.s)) best = { t, x, z, s: p.score.total };
    }
    if (!best) return;
    app.placeAt(best.t, best.x, best.z);
  }
  while (g.state.status === 'choosing') app.choose(0);
}, n);

// 1. Title.
await page.goto(`${base}/`);
await page.evaluate(() => localStorage.clear());
await page.goto(`${base}/`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/1-title.png` });

// 2. A town in progress with live score labels.
await page.goto(`${base}/?test&seed=harbourlight`);
await page.waitForFunction(() => !!window.tidebound);
await play(5);
await page.waitForTimeout(2500);
// Hover the best move near the middle so several +/- labels show.
const spot = await page.evaluate(() => {
  const app = window.tidebound;
  const g = app.game;
  let best = null;
  for (const t of Object.keys(g.state.hand)) for (let z = -12; z <= 12; z += 0.5) for (let x = -12; x <= 12; x += 0.5) {
    const p = g.preview(t, x, z);
    if (p.validity.ok && (!best || p.score.parts.length > best.n)) best = { t, x, z, n: p.score.parts.length };
  }
  if (!best) return null;
  app.select(best.t);
  return app.worldToScreen(best.x, best.z);
});
if (spot) await page.mouse.move(spot.x, spot.y, { steps: 5 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/2-placing.png` });

// 3. The tide coming in.
await page.mouse.move(640, 360);
await play(1);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/3-tide.png` });

// 4. Photo mode, a little lower and closer.
await page.waitForTimeout(2000);
await page.keyboard.press('KeyP');
await page.keyboard.press('KeyH');
await page.mouse.move(640, 360);
await page.mouse.wheel(0, -400);
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
await page.mouse.move(560, 320, { steps: 8 });
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/4-photo.png` });
await page.keyboard.press('KeyP');

// 5. End of a voyage.
await play(60);
await page.evaluate(() => { const g = window.tidebound.game; if (g.state.status === 'playing') g.endIsland(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/5-summary.png` });

await browser.close();
console.log(`screenshots in ${out}/`);
