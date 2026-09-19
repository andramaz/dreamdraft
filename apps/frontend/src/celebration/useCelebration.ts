import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Authored stage size — every value in the piece is written in these pixels. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/** Section starts on the authored timeline, in seconds. */
export const CUES = {
  arrival: 0,
  shine: 4,
  crowning: 7.5,
  celebration: 13,
} as const;

export const AUTHORED_TOTAL = 18;

export interface CelebrationClock {
  /** Choreography time: runs to AUTHORED_TOTAL, then holds. */
  t: number;
  /** Never stops — keeps the cup breathing and the sheen travelling. */
  ambient: number;
}

/**
 * The design loops for video; on a page the camera should not sink and rise
 * every 18 seconds, so the choreography plays once and settles while the
 * ambient loops carry on.
 */
export function useCelebrationClock(): CelebrationClock {
  const [clock, setClock] = useState<CelebrationClock>({ t: 0, ambient: 0 });

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;
      setClock({ t: Math.min(elapsed, AUTHORED_TOTAL), ambient: elapsed });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return clock;
}

/**
 * The composition is authored at 1920x1080 and scaled to whatever width it
 * gets, so every offset, font size and shadow from the design survives intact.
 */
export function useStageScale<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / STAGE_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
}
