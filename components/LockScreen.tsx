'use client';

import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { HAPTIC } from '@/lib/haptics';
import { getBiometricCredId, sha256, verifyBiometric } from '@/lib/lock';

const LEN = 4;

interface Props {
  mode: 'unlock' | 'set';
  expectedHash?: string | null;
  /** set-mode only: cancel the setup */
  onCancel?: () => void;
  /** unlock: called with no arg; set: called with the new PIN's hash */
  onDone: (hash?: string) => void;
}

export function LockScreen({ mode, expectedHash, onCancel, onDone }: Props) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null); // set-mode: first entry
  const [err, setErr] = useState(false);
  const hasBiometric = mode === 'unlock' && !!getBiometricCredId();

  const title =
    mode === 'set' ? (first === null ? 'Create a PIN' : 'Confirm your PIN') : 'Enter your PIN';

  const runBiometric = async () => {
    if (await verifyBiometric()) {
      HAPTIC.success();
      onDone();
    } else {
      HAPTIC.light();
    }
  };

  // Offer Face ID immediately on an unlock screen that has it set up.
  useEffect(() => {
    if (hasBiometric) void runBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = () => {
    setErr(true);
    HAPTIC.light();
    setTimeout(() => {
      setPin('');
      setErr(false);
    }, 440);
  };

  const commit = async (value: string) => {
    if (mode === 'set') {
      if (first === null) {
        setFirst(value);
        setPin('');
        HAPTIC.select();
      } else if (value === first) {
        HAPTIC.success();
        onDone(await sha256(value));
      } else {
        setFirst(null);
        fail();
      }
      return;
    }
    // unlock
    if ((await sha256(value)) === expectedHash) {
      HAPTIC.success();
      onDone();
    } else {
      fail();
    }
  };

  const press = (d: string) => {
    if (pin.length >= LEN) return;
    HAPTIC.select();
    const next = pin + d;
    setPin(next);
    setErr(false);
    if (next.length === LEN) void commit(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="lock">
      <div className="lock-head">
        <Logo size={44} />
        <div className="lock-title">{title}</div>
      </div>

      <div className={`lock-dots${err ? ' shake' : ''}`}>
        {Array.from({ length: LEN }, (_, i) => (
          <span key={i} className="lock-dot" data-on={i < pin.length} />
        ))}
      </div>

      <div className="keypad">
        {keys.map((k) => (
          <button key={k} className="key-btn n" onClick={() => press(k)}>
            {k}
          </button>
        ))}

        {mode === 'unlock' && hasBiometric ? (
          <button className="key-btn ghost" onClick={runBiometric} aria-label="Use Face ID">
            {/* face-id glyph */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
              <path d="M9 10v1M15 10v1M12 9v4l-1 1M9 15c1.5 1 4.5 1 6 0" />
            </svg>
          </button>
        ) : mode === 'set' && onCancel ? (
          <button className="key-btn ghost sm" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <span className="key-btn empty" />
        )}

        <button className="key-btn n" onClick={() => press('0')}>
          0
        </button>

        <button
          className="key-btn ghost"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Delete"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6H9l-5 6 5 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z" />
            <path d="m15 10-4 4M11 10l4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
