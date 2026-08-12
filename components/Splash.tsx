'use client';

import { useEffect, useState } from 'react';
import { Logo } from './Logo';

/**
 * Native-app-style launch screen: shows the logo + wordmark briefly on a
 * cold start, then fades into the app. Only mounts once per fresh load.
 */
export function Splash() {
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setHide(true), 850);
    const t2 = window.setTimeout(() => setGone(true), 850 + 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`splash${hide ? ' hide' : ''}`} aria-hidden="true">
      <div className="splash-mark">
        <Logo size={78} />
        <b>MoneyFlow</b>
      </div>
    </div>
  );
}
