/** Main menu: continue, new voyage, daily island, seed entry. */
import { dailySeed, normaliseSeed, randomSeed } from '../core/daily';

export interface MenuHandlers {
  continueRun(): void;
  start(seed: string): void;
  toggleMute(): boolean;
}

export class Menu {
  readonly root: HTMLDivElement;
  private continueBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private seedInput: HTMLInputElement;

  constructor(parent: HTMLElement, private h: MenuHandlers, muted: boolean) {
    this.root = document.createElement('div');
    this.root.className = 'menu hidden';
    const today = dailySeed().slice(6);
    this.root.innerHTML = `
      <div class="menu-card panel">
        <h1 class="title">Tidebound</h1>
        <p class="tagline">Build a calm little island town before the tide comes in.</p>
        <div class="menu-buttons">
          <button class="primary" data-act="continue">Continue voyage</button>
          <button class="primary" data-act="new">New voyage</button>
          <button class="secondary" data-act="daily">Daily island <span class="soft">${today}</span></button>
        </div>
        <form class="seed-row" data-act="seed">
          <input class="seed-input" maxlength="32" placeholder="Island seed, e.g. driftwood" aria-label="Island seed" />
          <button class="secondary" type="submit">Sail</button>
        </form>
        <details class="howto">
          <summary>How to play</summary>
          <ul>
            <li>Pick a building from your hand (click or 1-9), then click the island to place it.</li>
            <li>Floating labels show what each neighbour adds or takes away.</li>
            <li>Cross a score threshold to choose a new pack. Reach the voyage mark to sail on.</li>
            <li>Every 6 placements the tide rises. Shimmering ground floods next.</li>
            <li>Camera: WASD or screen edges to pan, Q/E or right-drag to rotate, wheel to zoom. R turns the building. P for photo mode.</li>
          </ul>
        </details>
        <div class="menu-foot"><button class="link" data-act="mute"></button></div>
      </div>`;
    parent.appendChild(this.root);
    this.continueBtn = this.root.querySelector('[data-act="continue"]')!;
    this.muteBtn = this.root.querySelector('[data-act="mute"]')!;
    this.seedInput = this.root.querySelector('.seed-input')!;
    this.setMuted(muted);
    this.root.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!t || t.tagName === 'FORM') return;
      const act = t.dataset.act;
      if (act === 'continue') this.h.continueRun();
      if (act === 'new') this.h.start(randomSeed());
      if (act === 'daily') this.h.start(dailySeed());
      if (act === 'mute') this.setMuted(this.h.toggleMute());
    });
    this.root.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const seed = normaliseSeed(this.seedInput.value);
      if (seed) this.h.start(seed);
      else this.seedInput.focus();
    });
  }

  setMuted(m: boolean): void {
    this.muteBtn.textContent = m ? 'Sound: off' : 'Sound: on';
  }

  show(canContinue: boolean, seedLabel?: string): void {
    this.continueBtn.style.display = canContinue ? '' : 'none';
    if (seedLabel) this.continueBtn.title = `Seed: ${seedLabel}`;
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }
}
