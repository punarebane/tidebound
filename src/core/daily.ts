/** Daily seed: the same island for everyone on a given UTC day. */
export function dailySeed(date = new Date()): string {
  return `daily-${date.toISOString().slice(0, 10)}`;
}

/** Turn whatever the player typed into a seed (trimmed, lower-case, max 32 chars). */
export function normaliseSeed(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32);
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}
