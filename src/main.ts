import './style.css';
import { App } from './app';
import { Game } from './core/game';
import { loadRun, clearRun } from './save';
import { applyPaletteCss } from './ui/style';

applyPaletteCss();

const params = new URLSearchParams(location.search);
const test = params.has('test');
const seedParam = params.get('seed');

function initialGame(): Game {
  if (seedParam) {
    clearRun();
    return Game.newRun(seedParam);
  }
  const saved = test ? null : loadRun();
  if (saved) {
    try {
      return new Game(saved);
    } catch {
      clearRun();
    }
  }
  return Game.newRun(Math.random().toString(36).slice(2, 8));
}

const container = document.getElementById('app')!;
const app = new App(container, initialGame(), { test });
app.start();

declare global {
  interface Window {
    tidebound?: App;
  }
}
if (test || import.meta.env.DEV) window.tidebound = app;
