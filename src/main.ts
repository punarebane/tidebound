import './style.css';
import { App, type BenchResult } from './app';
import { Game } from './core/game';
import { randomSeed } from './core/daily';
import { loadRun, clearRun } from './save';
import { applyPaletteCss } from './ui/style';

applyPaletteCss();

const params = new URLSearchParams(location.search);
const test = params.has('test');
const bench = params.has('bench');
const seedParam = params.get('seed');

function initialGame(): Game {
  if (seedParam) {
    clearRun();
    return Game.newRun(seedParam);
  }
  const saved = test || bench ? null : loadRun();
  if (saved) {
    try {
      return new Game(saved);
    } catch {
      clearRun();
    }
  }
  return Game.newRun(randomSeed());
}

const container = document.getElementById('app')!;
const app = new App(container, initialGame(), { test: test || bench });
app.start();
// The menu greets normal visits; test, bench and shared-seed links go straight in.
if (!test && !bench && !seedParam) app.openMenu();

declare global {
  interface Window {
    tidebound?: App;
    benchResult?: BenchResult;
  }
}
if (test || bench || import.meta.env.DEV) window.tidebound = app;

if (bench) {
  const n = Number(params.get('bench')) || 150;
  void app.bench(n).then((r) => {
    window.benchResult = r;
    const box = document.createElement('pre');
    box.className = 'bench-result panel';
    box.textContent = `bench: ${r.buildings} buildings\navg ${r.avgMs} ms (${r.fps} fps)\np95 ${r.p95Ms} ms\nmain thread avg ${r.cpuAvgMs} ms, p95 ${r.cpuP95Ms} ms\ndraw calls ${r.drawCalls}`;
    container.appendChild(box);
  });
}
