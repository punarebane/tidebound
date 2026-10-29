// Play greedily through the view (placeAt) and screenshot the tide.
import { chromium } from '@playwright/test';
const [out = 'shot', n = '12', seed = 'tidebound'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:5173/?test&seed=${seed}`);
await page.waitForTimeout(2000);
for (let i = 0; i < Number(n); i++) {
  const r = await page.evaluate(() => {
    const app = window.tidebound;
    const g = app.game;
    while (g.state.status === 'choosing') app.choose(0);
    if (g.state.status !== 'playing') return g.state.status;
    const types = Object.keys(g.state.hand);
    let best = null;
    const h = g.world.data.halfSize - 2;
    for (const t of types) for (let z = -h; z <= h; z += 1) for (let x = -h; x <= h; x += 1) {
      const p = g.preview(t, x, z);
      if (p.validity.ok && (!best || p.score.total > best.s)) best = { t, x, z, s: p.score.total };
    }
    if (!best) return 'stuck';
    app.placeAt(best.t, best.x, best.z);
    return `${best.t} +${best.s} score=${g.state.score} tide=${g.state.tideStep}`;
  });
  console.log(i, r);
  if (i === 5) { await page.waitForTimeout(700); await page.screenshot({ path: `${out}-tide-mid.png` }); }
}
await page.waitForTimeout(2500);
await page.mouse.move(640, 400);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}-end.png` });
console.log(logs.join('\n'));
await browser.close();
