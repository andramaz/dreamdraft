/**
 * The scatter tables, generated once from a seeded LCG — the same draws, in
 * the same order, as the design was authored with, so the piece looks
 * identical on every machine.
 */

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const CONFETTI_COLORS = [
  '#e8eef6',
  '#9fb6cf',
  '#f2d089',
  '#cfa64b',
  '#63b9ff',
  '#ffffff',
];

export interface ConfettiPiece {
  /** Percent across the stage. */
  x: number;
  size: number;
  ratio: number;
  color: string;
  delay: number;
  duration: number;
  /** Half the horizontal travel, in px. */
  sway: number;
  /** 0..1 — offsets where in its swing the piece starts. */
  swayPhase: number;
  /** Degrees over one fall, signed. */
  spin: number;
  round: boolean;
}

export const CONFETTI: ConfettiPiece[] = (() => {
  const random = rng(7);
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: random() * 100,
      size: 8 + random() * 16,
      ratio: 0.3 + random() * 0.9,
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)]!,
      delay: random() * 6.5,
      duration: 3.4 + random() * 3.2,
      sway: 40 + random() * 190,
      swayPhase: random(),
      spin: (random() < 0.5 ? -1 : 1) * (320 + random() * 900),
      round: random() < 0.28,
    });
  }
  return pieces;
})();

export interface Streamer {
  x: number;
  length: number;
  delay: number;
  color: string;
}

export const STREAMERS: Streamer[] = (() => {
  const random = rng(21);
  const streamers: Streamer[] = [];
  for (let i = 0; i < 14; i++) {
    streamers.push({
      x: 6 + random() * 88,
      length: 90 + random() * 200,
      delay: random() * 1.4,
      color: random() < 0.5 ? '#f2d089' : '#8fc7ff',
    });
  }
  return streamers;
})();

export interface Burst {
  /** Seconds after the fireworks start. */
  at: number;
  x: number;
  y: number;
  color: string;
}

export const BURSTS: Burst[] = [
  { at: 0.4, x: 22, y: 26, color: '#ffe6a8' },
  { at: 1.3, x: 79, y: 20, color: '#a8d8ff' },
  { at: 2.3, x: 36, y: 15, color: '#ffffff' },
  { at: 3.1, x: 66, y: 32, color: '#ffe6a8' },
];

export const BURST_DOTS = 26;
export const BURST_LIFE = 1.7;
