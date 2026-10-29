import { describe, expect, it } from 'vitest';
import { playGame } from '../scripts/bots';

describe('balance sim bots', () => {
  it('are deterministic per seed', () => {
    expect(playGame('sim-test', 'greedy')).toEqual(playGame('sim-test', 'greedy'));
    expect(playGame('sim-test', 'random')).toEqual(playGame('sim-test', 'random'));
  });

  it('greedy outscores random', () => {
    let g = 0;
    let r = 0;
    for (let i = 0; i < 6; i++) {
      g += playGame(`cmp-${i}`, 'greedy').score;
      r += playGame(`cmp-${i}`, 'random').score;
    }
    expect(g).toBeGreaterThan(r * 2);
  });
});
