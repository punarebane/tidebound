// Run the ?bench page headless and print the result: node scripts/bench.mjs [url]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:5173/?bench';
const gpu = process.env.BENCH_GPU === '1';
const args = gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[bench]')) console.log(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.benchResult, null, { timeout: 120000 });
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
console.log(JSON.stringify(await page.evaluate(() => window.benchResult)));
if (errors.length) console.log('errors:', errors);
await browser.close();
