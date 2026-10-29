import { expect, test } from '@playwright/test';

test('?bench places 150 buildings and reports frame times', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?bench');
  const r = await page.waitForFunction(() => window.benchResult, null, { timeout: 90_000 }).then((h) => h.jsonValue());
  console.log(`[bench] ${JSON.stringify(r)}`);
  expect(r!.buildings).toBe(150);
  expect(r!.drawCalls).toBeLessThan(150);
  expect(r!.frames).toBeGreaterThan(0);
  // Main-thread work per frame must fit a 60 fps budget even here; GPU time
  // under headless software GL is not representative, so it is only logged.
  expect(r!.cpuAvgMs).toBeLessThan(16.7);
  await expect(page.locator('.bench-result')).toBeVisible();
  await page.screenshot({ path: 'test-results/30-bench.png' });
  expect(errors).toEqual([]);
});
