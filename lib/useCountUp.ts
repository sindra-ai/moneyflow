"use client";

import { useEffect, useRef, useState } from "react";

/** Smoothly animates a number toward `value` (easeOutCubic). */
export function useCountUp(value: number, duration = 550): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    const target = value;
    if (Math.abs(start - target) < 0.005) {
      from.current = target;
      setDisplay(target);
      return;
    }
    let raf = 0;
    let startTime: number | null = null;
    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * eased;
      from.current = current;
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        from.current = target;
        setDisplay(target);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
