import { describe, expect, it } from 'vitest';
import { dailySeed, normaliseSeed } from '../src/core/daily';
import { generateIsland, hashIsland } from '../src/world/islandGen';

describe('daily seed', () => {
  it('is the UTC date, the same all day', () => {
    expect(dailySeed(new Date('2026-10-29T00:00:01Z'))).toBe('daily-2026-10-29');
    expect(dailySeed(new Date('2026-10-29T23:59:59Z'))).toBe('daily-2026-10-29');
    expect(dailySeed(new Date('2026-10-30T00:00:00Z'))).toBe('daily-2026-10-30');
  });

  it('gives everyone the same island on a day, and a new one tomorrow', () => {
    const a = hashIsland(generateIsland(dailySeed(new Date('2026-10-29T08:00:00Z')), 0));
    const b = hashIsland(generateIsland(dailySeed(new Date('2026-10-29T20:00:00Z')), 0));
    const c = hashIsland(generateIsland(dailySeed(new Date('2026-10-30T08:00:00Z')), 0));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('seed entry', () => {
  it('normalises what the player types', () => {
    expect(normaliseSeed('  Drift Wood ')).toBe('drift-wood');
    expect(normaliseSeed('x'.repeat(50))).toHaveLength(32);
    expect(normaliseSeed('   ')).toBe('');
  });
});
