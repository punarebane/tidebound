import { expect, test, type Page } from '@playwright/test';
import { Game } from '../src/core/game';
import type { BuildingId } from '../src/data/buildings';

const SEED = 'tidebound';

type Spot = { x: number; z: number; s: number };

/**
 * Best spot that is on screen (clear of the HUD) and whose score and validity
 * don't change when nudged, so pixel rounding can't matter.
 */
async function stableBest(page: Page, g: Game, type: BuildingId): Promise<Spot> {
  const reach = g.world.data.halfSize - 2;
  const cands: Spot[] = [];
  for (let z = -reach; z <= reach; z += 0.5) {
    for (let x = -reach; x <= reach; x += 0.5) {
      const p = g.preview(type, x, z);
      if (!p.validity.ok) continue;
      const stable = [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].every(([dx, dz]) => {
        const q = g.preview(type, x + dx, z + dz);
        return q.validity.ok && q.score.total === p.score.total;
      });
      if (stable) cands.push({ x, z, s: p.score.total });
    }
  }
  cands.sort((a, b) => b.s - a.s || Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const screen = await page.evaluate((list) => list.map(([x, z]) => window.tidebound!.worldToScreen(x, z)), cands.map((c) => [c.x, c.z]));
  const i = screen.findIndex((p) => p.x > 60 && p.x < 1220 && p.y > 130 && p.y < 640);
  if (i < 0) throw new Error(`no on-screen spot for ${type}`);
  return cands[i];
}

async function clickWorld(page: Page, x: number, z: number): Promise<void> {
  const p = await page.evaluate(([wx, wz]) => window.tidebound!.worldToScreen(wx, wz), [x, z] as const);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.waitForTimeout(150);
  await page.mouse.click(p.x, p.y);
}

test('place five buildings on a fixed seed and match the expected score', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`/?test&seed=${SEED}`);
  await page.waitForFunction(() => !!window.tidebound);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.tidebound!.rig.settle());
  await page.screenshot({ path: 'test-results/01-start.png' });

  // Script: the order we place in; positions come from the core, as a player would see them.
  const plan: BuildingId[] = ['lumber', 'house', 'house', 'house', 'fisher'];
  const mirror = Game.newRun(SEED);
  for (const type of plan) {
    const spot = await stableBest(page, mirror, type);
    // Select via the hand UI, then click the terrain.
    await page.locator(`.card[data-type="${type}"]`).click();
    await clickWorld(page, spot.x, spot.z);
    await page.waitForTimeout(150);
    const r = mirror.place(type, spot.x, spot.z);
    expect(r, `mirror placement of ${type}`).not.toBeNull();
    while (mirror.state.status === 'choosing') {
      await expect(page.locator('.offer').first()).toBeVisible();
      await page.locator('.offer').first().click();
      mirror.choose(0);
      await page.waitForTimeout(100);
    }
  }

  const state = await page.evaluate(() => window.tidebound!.game.state);
  expect(state.buildings.map((b) => b.type)).toEqual(plan);
  // Replaying the exact positions the browser used must give the same total.
  const replay = Game.newRun(SEED);
  for (const b of state.buildings) {
    expect(replay.place(b.type, b.x, b.z)).not.toBeNull();
    while (replay.state.status === 'choosing') replay.choose(0);
  }
  expect(state.score).toBe(replay.state.score);
  expect(state.score).toBe(mirror.state.score);
  await expect(page.locator('.score-value')).toHaveText(String(mirror.state.score));
  // Recorded total for this seed and script; update if scoring or generation changes on purpose.
  expect(state.score).toBe(EXPECTED_TOTAL);

  await page.screenshot({ path: 'test-results/02-placed.png' });

  // Live preview: hovering shows one label per contributing thing plus the total.
  await page.locator('.card[data-type="house"]').click();
  const hover = await stableBest(page, mirror, 'house');
  const p = await page.evaluate(([wx, wz]) => window.tidebound!.worldToScreen(wx, wz), [hover.x, hover.z] as const);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.waitForTimeout(500);
  const pv = mirror.preview('house', hover.x, hover.z);
  const sign = (v: number): string => (v > 0 ? `+${v}` : `${v}`);
  await expect(page.locator('.label.total')).toHaveText(sign(pv.score.total));
  await expect(page.locator('.label.part')).toHaveCount(pv.score.parts.length);
  await page.screenshot({ path: 'test-results/03-hover.png' });

  expect(errors).toEqual([]);
});

const EXPECTED_TOTAL = 15;
