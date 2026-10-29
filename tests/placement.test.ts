import { describe, expect, it } from 'vitest';
import { validatePlacement } from '../src/core/placement';
import { fakeWorld, put } from './helpers';

describe('placement validity', () => {
  it('accepts flat dry land', () => {
    expect(validatePlacement(fakeWorld(), 'house', 0, 0)).toEqual({ ok: true });
  });

  it('rejects water', () => {
    expect(validatePlacement(fakeWorld(), 'house', 16, 0)).toEqual({ ok: false, reason: 'water' });
  });

  it('rejects a footprint that hangs over the water', () => {
    // Disc radius 12: centre on land but the footprint edge is in the sea.
    expect(validatePlacement(fakeWorld(), 'house', 11.6, 0)).toMatchObject({ ok: false });
  });

  it('rejects the world edge', () => {
    expect(validatePlacement(fakeWorld(), 'house', 19.9, 0)).toEqual({ ok: false, reason: 'bounds' });
  });

  it('rejects steep slopes', () => {
    const w = fakeWorld({ height: (x) => 2 + x * 0.8 });
    expect(validatePlacement(w, 'house', 0, 0)).toEqual({ ok: false, reason: 'slope' });
    const gentle = fakeWorld({ height: (x) => 2 + x * 0.1 });
    expect(validatePlacement(gentle, 'house', 0, 0)).toEqual({ ok: true });
  });

  it('rejects overlaps with buildings, trees and rocks', () => {
    const w = fakeWorld({ trees: [[5, 0]], rocks: [[-5, 0]] });
    put(w, 'house', 0, 5);
    expect(validatePlacement(w, 'house', 0, 4.5)).toEqual({ ok: false, reason: 'overlap' });
    expect(validatePlacement(w, 'house', 5.5, 0)).toEqual({ ok: false, reason: 'overlap' });
    expect(validatePlacement(w, 'house', -5.5, 0)).toEqual({ ok: false, reason: 'overlap' });
    expect(validatePlacement(w, 'house', 0, 2)).toEqual({ ok: true });
  });

  it('requires a Fisher to be within 2 units of the coast', () => {
    const w = fakeWorld();
    expect(validatePlacement(w, 'fisher', 0, 0)).toEqual({ ok: false, reason: 'notCoastal' });
    expect(validatePlacement(w, 'fisher', 10, 0)).toEqual({ ok: true });
  });

  it('respects the sea level', () => {
    const w = fakeWorld();
    w.seaLevel = 2.5;
    expect(validatePlacement(w, 'house', 0, 0)).toEqual({ ok: false, reason: 'water' });
  });
});
