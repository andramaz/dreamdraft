/**
 * The four Penner curves the celebration was authored against, plus the one
 * tween helper everything is keyed through. Kept local to the celebration:
 * the rest of the app animates with CSS.
 */

export const Easing = {
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeOutQuart: (t: number) => 1 - (1 - t) ** 4,
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} as const;

export type Ease = (t: number) => number;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

interface TweenArgs {
  from: number;
  to: number;
  start: number;
  end: number;
  ease: Ease;
}

/** Holds `from` before `start` and `to` after `end`, so it is safe to sum. */
export function tween({ from, to, start, end, ease }: TweenArgs) {
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

/** The three motion helpers the whole piece is written with. */
export const MOTION = {
  enter: (from: number, to: number, start: number, end: number) =>
    tween({ from, to, start, end, ease: Easing.easeOutCubic }),
  pop: (from: number, to: number, start: number, end: number) =>
    tween({ from, to, start, end, ease: Easing.easeOutBack }),
  drift: (from: number, to: number, start: number, end: number) =>
    tween({ from, to, start, end, ease: Easing.easeInOutSine }),
};
