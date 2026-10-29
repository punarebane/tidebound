// Place some buildings via real clicks then screenshot while hovering.
import { chromium } from '@playwright/test';
const [out = 'shot.png'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:5173/?test&seed=tidebound');
await page.waitForTimeout(2500);
// Find candidate spots with the core preview.
const find = (type) => page.evaluate((type) => {
  const app = window.tidebound;
  const g = app.game;
  let best = null;
  for (let z = -20; z <= 20; z += 0.5) for (let x = -20; x <= 20; x += 0.5) {
    const p = g.preview(type, x, z);
    if (!p.validity.ok) continue;
    if (!best || p.score.total > best.s) best = { x, z, s: p.score.total };
  }
  return best;
}, type);
for (const type of ['lumber', 'house', 'house', 'fisher']) {
  await page.evaluate((t) => window.tidebound.select(t), type);
  const spot = await find(type);
  console.log(type, JSON.stringify(spot));
  if (!spot) continue;
  const sc = await page.evaluate(({ x, z }) => window.tidebound.worldToScreen(x, z), spot);
  await page.mouse.move(sc.x, sc.y);
  await page.waitForTimeout(300);
  await page.mouse.click(sc.x, sc.y);
  await page.waitForTimeout(300);
  if (await page.locator('.offer').count()) {
    await page.locator('.offer').first().click();
    await page.waitForTimeout(300);
  }
}
await page.evaluate(() => window.tidebound.select('house'));
const spot = await find('house');
const sc = await page.evaluate(({ x, z }) => window.tidebound.worldToScreen(x, z), spot);
await page.mouse.move(sc.x, sc.y);
await page.waitForTimeout(700);
console.log('score', await page.evaluate(() => window.tidebound.game.state.score), 'status', await page.evaluate(() => window.tidebound.game.state.status));
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
