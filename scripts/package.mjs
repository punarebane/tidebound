// Zip dist/ for itch.io (index.html at the zip root): node scripts/package.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';

const zip = 'tidebound-itch.zip';
if (!existsSync('dist/index.html')) throw new Error('Run npm run build first');
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', `../${zip}`, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`${zip}: ${(statSync(zip).size / 1024).toFixed(0)} kB`);
