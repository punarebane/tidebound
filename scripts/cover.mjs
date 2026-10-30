// itch.io cover image (630x500, rendered at 2x): node scripts/cover.mjs [baseUrl] [out]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? 'screenshots/cover.png';
const seed = process.argv[4] ?? 'harbourlight';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
await page.goto(`${base}/?test&seed=${seed}`);
await page.waitForFunction(() => !!window.tidebound);
// Build a little harbour town around one sunny spot near the coast, then frame it with the sea behind.
const centre = await page.evaluate(() => {
  const app = window.tidebound;
  const g = app.game;
  const w = g.world;
  const t = w.terrain;
  // Anchor: flat grass 4-7 units from the sea, as central as possible.
  let anchor = null;
  const h = g.world.data.halfSize - 4;
  for (let z = -h; z <= h; z += 1) for (let x = -h; x <= h; x += 1) {
    const d = t.coastDistance(x, z, w.seaLevel);
    if (d < 4 || d > 7 || t.heightAt(x, z) < 1.5 || t.normalYAt(x, z) < 0.97) continue;
    if (!anchor || Math.hypot(x, z) < Math.hypot(anchor.x, anchor.z)) anchor = { x, z };
  }
  g.state.hand = { house: 9, market: 1, fisher: 3, farm: 2, lighthouse: 1, shrine: 1, sawmill: 1, lumber: 2 };
  g.state.islandThresholds = 99; // no pack choices while staging
  const order = ['lumber', 'lumber', 'sawmill', 'house', 'house', 'house', 'house', 'market', 'house', 'house', 'house', 'house', 'house', 'farm', 'farm', 'fisher', 'fisher', 'fisher', 'lighthouse', 'shrine'];
  for (const type of order) {
    let best = null;
    for (let z = anchor.z - 9; z <= anchor.z + 9; z += 0.5) for (let x = anchor.x - 9; x <= anchor.x + 9; x += 0.5) {
      const p = g.preview(type, x, z);
      if (!p.validity.ok) continue;
      const v = p.score.total - Math.hypot(x - anchor.x, z - anchor.z) * 0.15;
      if (!best || v > best.v) best = { x, z, v };
    }
    if (best) app.placeAt(type, best.x, best.z);
  }
  const e = 0.75;
  const gx = t.coastDistance(anchor.x + e, anchor.z, 0) - t.coastDistance(anchor.x - e, anchor.z, 0);
  const gz = t.coastDistance(anchor.x, anchor.z + e, 0) - t.coastDistance(anchor.x, anchor.z - e, 0);
  // Sea lies along -grad; put the camera on the land side looking out to sea.
  const seaYaw = Math.atan2(-gx, -gz);
  return { ...anchor, yaw: seaYaw + Math.PI };
});
await page.waitForTimeout(3000);
await page.evaluate(({ x, z, yaw }) => {
  const app = window.tidebound;
  app.setPhoto(true);
  document.querySelector('.photo-hint')?.classList.add('hidden');
  app.rig.focus(x, z, 22);
  app.rig.orbit(yaw, 0.62);
  app.rig.settle();
  // Title card for the cover.
  const t = document.createElement('div');
  t.textContent = 'Tidebound';
  Object.assign(t.style, {
    position: 'absolute', left: '0', right: '0', top: '26px', textAlign: 'center', zIndex: '30',
    font: '800 64px Nunito, "Trebuchet MS", system-ui, sans-serif', color: 'var(--accent-strong)',
    textShadow: '0 2px 0 var(--glow), 0 0 18px var(--glow), 0 0 30px var(--glow)', letterSpacing: '0.02em',
  });
  const s = document.createElement('div');
  s.textContent = 'build before the tide comes in';
  Object.assign(s.style, {
    position: 'absolute', left: '0', right: '0', top: '104px', textAlign: 'center', zIndex: '30',
    font: '700 20px Nunito, "Trebuchet MS", system-ui, sans-serif', color: 'var(--text)',
    textShadow: '0 0 10px var(--glow), 0 0 18px var(--glow)',
  });
  document.body.append(t, s);
}, centre);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
