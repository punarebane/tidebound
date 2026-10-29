import { expect, test } from '@playwright/test';

/** Greedy play through the app's own placement path until the island ends. */
async function playIsland(page: import('@playwright/test').Page, maxSteps = 80): Promise<string> {
  return page.evaluate((maxSteps) => {
    const app = window.tidebound!;
    const g = app.game;
    for (let i = 0; i < maxSteps; i++) {
      while (g.state.status === 'choosing') app.choose(0);
      if (g.state.status !== 'playing') break;
      let best: { t: string; x: number; z: number; s: number } | null = null;
      const h = g.world.data.halfSize - 2;
      for (const t of Object.keys(g.state.hand)) {
        for (let z = -h; z <= h; z += 1.5) for (let x = -h; x <= h; x += 1.5) {
          const p = g.preview(t as never, x, z);
          if (p.validity.ok && (!best || p.score.total > best.s)) best = { t, x, z, s: p.score.total };
        }
      }
      if (!best) {
        g.endIsland();
        break;
      }
      app.placeAt(best.t as never, best.x, best.z);
    }
    return g.state.status;
  }, maxSteps);
}

test('tide rises, an island ends, and the voyage or summary screen appears', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?test&seed=voyage');
  await page.waitForFunction(() => !!window.tidebound);

  const status = await playIsland(page);
  const state = await page.evaluate(() => window.tidebound!.game.state);
  expect(state.tideStep).toBeGreaterThanOrEqual(1);
  expect(['voyage', 'gameover']).toContain(status);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'test-results/10-island-end.png' });

  if (status === 'voyage') {
    await page.getByRole('button', { name: /Set sail/ }).click();
    await expect(page.locator('.island-label')).toHaveText('Island 2');
    await expect(page.locator('.tide-text')).toHaveText(/Rises in 6 placements/);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/11-island-2.png' });
    // Give up the new island's hand: below its voyage threshold this is game over.
    await page.getByRole('button', { name: 'End island' }).click();
  }
  const final = await page.evaluate(() => window.tidebound!.game.state.status);
  if (final === 'gameover') {
    await expect(page.locator('.summary')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: /Set sail/ })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/12-summary.png' });
  expect(errors).toEqual([]);
});

test('a run resumes after reload', async ({ page }) => {
  await page.goto('/?seed=resume');
  await page.waitForFunction(() => !!window.tidebound);
  await page.evaluate(() => {
    const app = window.tidebound!;
    const g = app.game;
    const h = g.world.data.halfSize - 2;
    for (let z = -h; z <= h; z += 1) for (let x = -h; x <= h; x += 1) {
      if (g.preview('house', x, z).validity.ok) { app.placeAt('house', x, z); return; }
    }
  });
  const before = await page.evaluate(() => JSON.stringify(window.tidebound!.game.state));
  // Reload without ?seed so the saved run is picked up.
  await page.goto('/');
  await page.waitForFunction(() => !!window.tidebound);
  const after = await page.evaluate(() => JSON.stringify(window.tidebound!.game.state));
  expect(after).toBe(before);
});
