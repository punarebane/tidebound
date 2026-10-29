import { generateIsland, hashIsland } from '../src/world/islandGen';
import { Terrain } from '../src/world/terrain';
const seed = process.argv[2] ?? 'tidebound';
for (let i = 0; i < 3; i++) {
  const t0 = performance.now();
  const d = generateIsland(seed, i);
  const ms = performance.now() - t0;
  const t = new Terrain(d);
  let land = 0;
  const bins = new Map<number, number>();
  for (const h of d.heights) { if (h > 0) land++; const b = Math.floor(h); bins.set(b, (bins.get(b) ?? 0) + 1); }
  console.log(`island ${i} res=${d.res} ms=${ms.toFixed(0)} land=${land} max=${d.maxHeight.toFixed(2)} shrine=${d.shrineHeight.toFixed(2)} trees=${d.trees.length} rocks=${d.rocks.length} shoals=${d.shoals.length} patches=${d.patches.length} hash=${hashIsland(d)}`);
  console.log('  height bins', [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
  for (const sea of [0, 0.4, 0.8, 1.2, 1.6, 2.0]) {
    let c = 0; for (const h of d.heights) if (h > sea) c++;
    console.log(`  sea ${sea}: land ${c}`);
  }
  // ascii map
  if (i === 0) {
    const rows: string[] = [];
    for (let z = -d.halfSize; z < d.halfSize; z += 1.5) {
      let row = '';
      for (let x = -d.halfSize; x < d.halfSize; x += 0.75) {
        const h = t.heightAt(x, z);
        row += h < -1 ? ' ' : h < 0 ? '.' : h < 0.75 ? ':' : h < 3.6 ? '-' : h < 5.4 ? '=' : h < 7.3 ? '#' : '@';
      }
      rows.push(row);
    }
    console.log(rows.join('\n'));
  }
}
