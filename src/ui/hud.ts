/** DOM HUD: score and threshold bar, hand of buildings, hints, pack choice and end screens. */
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../data/buildings';
import { packById } from '../core/economy';
import type { Game } from '../core/game';

export interface HudHandlers {
  select(type: BuildingId): void;
  choose(index: number): void;
  sail(): void;
  restart(): void;
  endIsland(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function packContentsText(contents: Partial<Record<BuildingId, number>>): string {
  return (Object.entries(contents) as Array<[BuildingId, number]>).map(([id, n]) => `${n} × ${BUILDINGS[id].name}`).join(', ');
}

export class Hud {
  readonly root: HTMLDivElement;
  private score = el('div', 'score-value', '0');
  private island = el('div', 'island-label');
  private barFill = el('div', 'bar-fill');
  private barVoyage = el('div', 'bar-voyage');
  private barText = el('div', 'bar-text');
  private hand = el('div', 'hand');
  private hint = el('div', 'hint');
  private modal = el('div', 'modal hidden');
  private endBtn = el('button', 'end-island', 'End island');
  private lastHandKey = '';
  private lastModalKey = '';

  constructor(parent: HTMLElement, private h: HudHandlers) {
    this.root = el('div', 'hud');
    const top = el('div', 'panel top');
    const scoreBox = el('div', 'score-box');
    scoreBox.append(el('div', 'score-label', 'Score'), this.score);
    const bar = el('div', 'bar');
    bar.append(this.barFill, this.barVoyage);
    const barBox = el('div', 'bar-box');
    barBox.append(this.island, bar, this.barText);
    top.append(scoreBox, barBox);
    this.endBtn.title = 'Give up the buildings left in your hand and finish this island';
    this.endBtn.addEventListener('click', () => this.h.endIsland());
    const bottom = el('div', 'bottom');
    bottom.append(this.hint, this.hand, this.endBtn);
    this.root.append(top, bottom, this.modal);
    parent.appendChild(this.root);

    this.hand.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
      if (card) this.h.select(card.dataset.type as BuildingId);
    });
    this.modal.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!t) return;
      const a = t.dataset.action;
      if (a === 'choose') this.h.choose(Number(t.dataset.index));
      if (a === 'sail') this.h.sail();
      if (a === 'restart') this.h.restart();
    });
  }

  setHint(text: string): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  render(game: Game, selected: BuildingId | null): void {
    const s = game.state;
    this.score.textContent = String(s.score);
    this.island.textContent = `Island ${s.island + 1}`;
    const lo = game.prevThreshold;
    const hi = game.nextThreshold;
    const frac = Math.min(Math.max((s.score - lo) / Math.max(hi - lo, 1), 0), 1);
    this.barFill.style.width = `${(frac * 100).toFixed(1)}%`;
    const voyageFrac = (game.voyageThreshold - lo) / Math.max(hi - lo, 1);
    this.barVoyage.style.display = voyageFrac >= 0 && voyageFrac <= 1 ? '' : 'none';
    this.barVoyage.style.left = `${(voyageFrac * 100).toFixed(1)}%`;
    const voyageLeft = game.voyageThreshold - s.score;
    this.barText.textContent = `${hi - s.score} to next pack · ${voyageLeft > 0 ? `voyage at ${game.voyageThreshold}` : 'voyage ready ⛵'}`;

    const handKey = JSON.stringify([s.hand, selected, s.status]);
    if (handKey !== this.lastHandKey) {
      this.lastHandKey = handKey;
      this.hand.replaceChildren();
      let n = 0;
      for (const id of BUILDING_IDS) {
        const count = s.hand[id] ?? 0;
        if (!count) continue;
        n++;
        const card = el('button', `card${id === selected ? ' selected' : ''}`);
        card.dataset.type = id;
        card.title = BUILDINGS[id].blurb;
        card.append(el('span', 'key', String(n)), el('span', `icon icon-${id}`), el('span', 'name', BUILDINGS[id].name), el('span', 'count', `×${count}`));
        this.hand.appendChild(card);
      }
    }
    this.endBtn.style.display = s.status === 'playing' ? '' : 'none';

    const modalKey = JSON.stringify([s.status, s.offer, s.island]);
    if (modalKey !== this.lastModalKey) {
      this.lastModalKey = modalKey;
      this.renderModal(game);
    }
  }

  /** Type for hotkey n (1-based) in the current hand order. */
  handTypeAt(game: Game, n: number): BuildingId | null {
    const ids = BUILDING_IDS.filter((id) => (game.state.hand[id] ?? 0) > 0);
    return ids[n - 1] ?? null;
  }

  private renderModal(game: Game): void {
    const s = game.state;
    this.modal.replaceChildren();
    if (s.status === 'choosing' && s.offer) {
      const box = el('div', 'panel dialog');
      box.append(el('h2', '', 'Choose a pack'), el('p', 'soft', 'You crossed a threshold. Pick one to add to your hand.'));
      const row = el('div', 'offers');
      s.offer.forEach((id, i) => {
        const p = packById(id);
        const b = el('button', 'offer');
        b.dataset.action = 'choose';
        b.dataset.index = String(i);
        b.append(el('div', 'offer-name', p.name), el('div', 'offer-contents', packContentsText(p.contents)));
        row.appendChild(b);
      });
      box.appendChild(row);
      this.modal.appendChild(box);
      this.modal.classList.remove('hidden');
    } else if (s.status === 'voyage' || s.status === 'gameover') {
      const box = el('div', 'panel dialog');
      const gained = s.islandScores[s.islandScores.length - 1] ?? 0;
      if (s.status === 'voyage') {
        box.append(
          el('h2', '', 'Island complete'),
          el('p', '', `You earned ${gained} points here. The wind is fair: sail on to a larger island and keep your score of ${s.score}.`),
        );
        const b = el('button', 'primary', 'Set sail ⛵');
        b.dataset.action = 'sail';
        box.appendChild(b);
      } else {
        box.append(
          el('h2', '', 'The voyage ends'),
          el('p', '', `Final score ${s.score} across ${s.island + 1} island${s.island ? 's' : ''}.`),
        );
        const b = el('button', 'primary', 'New run');
        b.dataset.action = 'restart';
        box.appendChild(b);
      }
      this.modal.appendChild(box);
      this.modal.classList.remove('hidden');
    } else {
      this.modal.classList.add('hidden');
    }
  }
}
