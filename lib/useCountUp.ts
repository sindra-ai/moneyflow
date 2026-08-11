'use client';

import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -9 * t));

/**
 * Animates towards `value` on every change, including the first paint (which
 * counts up from zero). Returns the number to render.
 */
export function useCountUp(value: number, duration = 750): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    // rAF is paused in a background tab, which would strand the figure on a
    // stale number, so snap instead of animating.
    if (prefersReducedMotion() || document.hidden) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (value - from) * easeOutExpo(t);
      fromRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}
