// Quick screenshot helper: node scripts/shot.mjs <url> <out.png> [waitMs]
import { chromium } from '@playwright/test';
const [url = 'http://127.0.0.1:5173/?test&seed=tidebound', out = 'shot.png', wait = '2500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(Number(wait));
await page.mouse.move(640, 420);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(logs.join('\n'));
const info = await page.evaluate(() => window.tidebound ? { calls: window.tidebound.drawCalls } : null);
console.log(JSON.stringify(info));
await browser.close();
