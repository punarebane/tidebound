import { expect, test } from '@playwright/test';

test('menu: daily island, seed entry and photo mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('.menu .title')).toHaveText('Tidebound');
  // Nothing saved yet: no Continue.
  await expect(page.getByRole('button', { name: 'Continue voyage' })).toBeHidden();
  await page.screenshot({ path: 'test-results/20-menu.png' });

  await page.getByRole('button', { name: /Daily island/ }).click();
  await expect(page.locator('.menu')).toBeHidden();
  const today = new Date().toISOString().slice(0, 10);
  expect(await page.evaluate(() => window.tidebound!.game.state.seed)).toBe(`daily-${today}`);

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Continue voyage' })).toBeVisible();
  await page.locator('.seed-input').fill('Drift Wood');
  await page.getByRole('button', { name: 'Sail' }).click();
  await expect(page.locator('.menu')).toBeHidden();
  expect(await page.evaluate(() => window.tidebound!.game.state.seed)).toBe('drift-wood');

  // Photo mode hides every bit of UI; P brings it back.
  await page.keyboard.press('KeyP');
  await expect(page.locator('.hud')).toBeHidden();
  await expect(page.locator('.photo-hint')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(page.locator('.photo-hint')).toBeHidden();
  await page.keyboard.press('KeyP');
  await expect(page.locator('.hud')).toBeVisible();
  expect(errors).toEqual([]);
});
