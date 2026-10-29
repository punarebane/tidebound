/** Run persistence in localStorage. Every access is guarded: storage can be missing or throw. */
import type { RunState } from './core/game';

const KEY = 'tidebound.run.v2';

export function saveRun(state: RunState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or quota: the run just won't resume.
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RunState;
    if (s && s.version === 2 && typeof s.seed === 'string') return s;
  } catch {
    // Corrupt or unavailable.
  }
  return null;
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
