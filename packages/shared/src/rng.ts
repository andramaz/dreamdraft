/** Seeded RNG so a draw can be replayed / verified from its seed. */
export type Rng = () => number;

/** mulberry32 — small, fast, good enough for draws. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function randomInt(
  rng: Rng,
  minInclusive: number,
  maxInclusive: number,
): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function pickRandom<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) {
    throw new Error('pickRandom: empty list');
  }
  return items[Math.floor(rng() * items.length)]!;
}

/** Fisher-Yates, returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
