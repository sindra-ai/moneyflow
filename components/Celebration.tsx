'use client';

import { useEffect, useState } from 'react';
import { ACCENTS } from '@/lib/types';
import { prefersReducedMotion } from '@/lib/useCountUp';

const COUNT = 22;
const LIFE = 1600;

/**
 * Fires once when the last outgoing gets ticked. Deliberately short and
 * non-blocking — it's a punctuation mark, not an interstitial.
 */
export function Celebration({ onDone }: { onDone: () => void }) {
  const [bits] = useState(() =>
    Array.from({ length: COUNT }, (_, i) => {
      // Deterministic spread: no Math.random, so it can't jitter on re-render.
      const angle = (i / COUNT) * Math.PI * 2 + (i % 3) * 0.22;
      const dist = 130 + (i % 5) * 46;
      return {
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist - 60}px`,
        rot: `${(i % 2 ? 1 : -1) * (180 + i * 26)}deg`,
        color: ACCENTS[i % ACCENTS.length],
        delay: `${(i % 6) * 28}ms`,
      };
    }),
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const t = window.setTimeout(onDone, LIFE);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (prefersReducedMotion()) return null;

  return (
    <div className="party" aria-hidden="true">
      <span className="party-halo" />
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            background: b.color,
            animationDelay: b.delay,
            ['--dx' as string]: b.dx,
            ['--dy' as string]: b.dy,
            ['--rot' as string]: b.rot,
          }}
        />
      ))}
    </div>
  );
}
