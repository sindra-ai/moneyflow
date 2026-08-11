'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { initial, money, monthLabel } from '@/lib/format';
import { history, savingsSoFar } from '@/lib/derive';
import { HAPTIC } from '@/lib/haptics';
import {
  biometricAvailable,
  clearBiometric,
  getBiometricCredId,
  registerBiometric,
} from '@/lib/lock';
import type { ThemeMode } from '@/lib/types';
import { LockScreen } from './LockScreen';
import { Sparkline } from './Sparkline';
import { Camera } from './icons';

const AVATAR_PX = 256;

/** Centre-crops to a square and downsizes, so the store stays small. */
function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_PX;
        canvas.height = AVATAR_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no 2d context'));
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_PX,
          AVATAR_PX,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileView({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement> }) {
  const { store, month, monthKey, setProfile, setSettings, resetToSample } = useStore();
  const { user, signOut } = useAuth();
  const totals = computeTotals(month);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const savings = savingsSoFar(store, monthKey);
  const [payday, setPayday] = useState(String(store.settings.payday ?? 25));
  const [savingsStart, setSavingsStart] = useState(String(store.settings.savingsStart ?? 0));

  // App lock
  const lockOn = store.settings.lockEnabled && !!store.settings.lockPin;
  const [setup, setSetup] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setBioAvail);
    setBioOn(!!getBiometricCredId());
  }, []);

  const toggleLock = () => {
    HAPTIC.light();
    if (lockOn) {
      clearBiometric();
      setBioOn(false);
      setSettings({ lockEnabled: false, lockPin: null, biometric: false });
    } else {
      setSetup(true);
    }
  };

  const toggleBiometric = async () => {
    HAPTIC.light();
    if (bioOn) {
      clearBiometric();
      setBioOn(false);
      setSettings({ biometric: false });
    } else {
      const ok = await registerBiometric(store.profile.name || user?.email || 'MoneyFlow');
      setBioOn(ok);
      setSettings({ biometric: ok });
      if (ok) HAPTIC.success();
    }
  };

  // Spend per category for the breakdown bars, largest first.
  const breakdown = (() => {
    const by = new Map<string, number>();
    for (const it of month.items) by.set(it.category, (by.get(it.category) ?? 0) + it.amount);
    const rows = [...by.entries()].map(([name, value]) => ({ name, value }));
    rows.sort((a, b) => b.value - a.value);
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
    return { rows, max };
  })();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setProfile({ avatar: await cropToSquare(file) });
      HAPTIC.success();
    } catch {
      /* unreadable image — keep the existing avatar */
    }
  };

  const themes: { key: ThemeMode; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <>
      {setup && (
        <LockScreen
          mode="set"
          onCancel={() => setSetup(false)}
          onDone={(hash) => {
            setSettings({ lockEnabled: true, lockPin: hash ?? null });
            setSetup(false);
            HAPTIC.success();
          }}
        />
      )}
      <div className="scroll view" ref={scrollerRef}>
      <div className="me">
        <div className="face-wrap">
          <div className="face">
            {store.profile.avatar ? (
              <img src={store.profile.avatar} alt="" draggable={false} />
            ) : (
              initial(store.profile.name || 'M')
            )}
          </div>
          <button className="face-edit" onClick={() => fileRef.current?.click()} aria-label="Change photo">
            <Camera size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <input
          value={store.profile.name}
          placeholder="Your name"
          onChange={(e) => setProfile({ name: e.target.value })}
          aria-label="Display name"
        />
      </div>

      <div className="sec">
        <h3>{monthLabel(monthKey).label}</h3>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="duo-k">Total out</div>
          <div className="duo-v n">{money(totals.total)}</div>
        </div>
        <div className="tile">
          <div className="duo-k">Paid so far</div>
          <div className="duo-v n">{money(totals.paid)}</div>
        </div>
        <div className="tile">
          <div className="duo-k">Left to pay</div>
          <div className="duo-v n">{money(totals.left)}</div>
        </div>
        <div className="tile">
          <div className="duo-k">Left over</div>
          <div className={`duo-v n ${totals.leftOver >= 0 ? 'up' : 'down'}`}>
            {money(totals.leftOver)}
          </div>
        </div>
      </div>

      <div className="sec">
        <h3>Last 6 months</h3>
      </div>
      <Sparkline points={history(store, monthKey)} />

      <div className="sec">
        <h3>Appearance</h3>
      </div>
      <div className="list">
        <div className="li stack">
          <div>
            <div className="li-k">Theme</div>
            <div className="li-s">Follows your device when set to System</div>
          </div>
          <div className="seg">
            {themes.map((t) => (
              <button
                key={t.key}
                data-on={store.settings.theme === t.key}
                onClick={() => {
                  HAPTIC.light();
                  setSettings({ theme: t.key });
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {breakdown.rows.length > 0 && (
        <>
          <div className="sec">
            <h3>Breakdown</h3>
          </div>
          <div className="bd">
            {breakdown.rows.map((r) => (
              <div className="bd-row" key={r.name}>
                <div className="bd-top">
                  <span className="bd-k">{r.name}</span>
                  <span className="bd-v n">{money(r.value)}</span>
                </div>
                <div className="bd-bar">
                  <i style={{ width: `${Math.round((r.value / breakdown.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec">
        <h3>Savings</h3>
      </div>
      <div className="save-card">
        <div className="save-k">Saved so far</div>
        <div className={`save-v n ${savings >= 0 ? 'up' : 'down'}`}>{money(savings)}</div>
        <div className="save-s">Starting balance plus every past month&apos;s left over</div>
      </div>
      <div className="list">
        <div className="li">
          <div>
            <div className="li-k">Payday</div>
            <div className="li-s">Day of the month your salary lands</div>
          </div>
          <input
            className="rate n"
            inputMode="numeric"
            value={payday}
            onChange={(e) => setPayday(e.target.value)}
            onBlur={() => {
              const v = Math.round(parseFloat(payday.replace(/[^0-9]/g, '')));
              const next = Number.isFinite(v) ? Math.min(28, Math.max(1, v)) : 25;
              setSettings({ payday: next });
              setPayday(String(next));
            }}
            aria-label="Payday day of month"
          />
        </div>
        <div className="li">
          <div>
            <div className="li-k">Starting savings</div>
            <div className="li-s">What you had put aside before tracking</div>
          </div>
          <input
            className="rate n"
            inputMode="decimal"
            value={savingsStart}
            onChange={(e) => setSavingsStart(e.target.value)}
            onBlur={() => {
              const v = parseFloat(savingsStart.replace(/[^0-9.]/g, ''));
              const next = Number.isFinite(v) ? v : 0;
              setSettings({ savingsStart: next });
              setSavingsStart(String(next));
            }}
            aria-label="Starting savings balance"
          />
        </div>
      </div>

      <div className="sec">
        <h3>Security</h3>
      </div>
      <div className="list">
        <button className="li" onClick={toggleLock}>
          <div>
            <div className="li-k">App lock</div>
            <div className="li-s">Require a PIN each time you open MoneyFlow</div>
          </div>
          <span className="switch" data-on={lockOn} aria-hidden="true">
            <i />
          </span>
        </button>
        {lockOn && bioAvail && (
          <button className="li" onClick={() => void toggleBiometric()}>
            <div>
              <div className="li-k">Face ID / Touch ID</div>
              <div className="li-s">Unlock with your device biometrics</div>
            </div>
            <span className="switch" data-on={bioOn} aria-hidden="true">
              <i />
            </span>
          </button>
        )}
      </div>

      <div className="sec">
        <h3>Account</h3>
      </div>
      <div className="list">
        <div className="li">
          <div>
            <div className="li-k">Signed in</div>
            <div className="li-s">{user?.email}</div>
          </div>
        </div>
        <button className="li" onClick={() => void signOut()}>
          <div>
            <div className="li-k warn">Sign out</div>
          </div>
        </button>
      </div>

      <div className="sec">
        <h3>Data</h3>
      </div>
      <div className="list">
        <div className="li">
          <div>
            <div className="li-k">Storage</div>
            <div className="li-s">
              Synced to your account. Available on every device you sign in on.
            </div>
          </div>
        </div>
        <button
          className="li"
          onClick={() => {
            if (!confirm) {
              setConfirm(true);
              HAPTIC.light();
              return;
            }
            HAPTIC.success();
            resetToSample();
            setConfirm(false);
          }}
        >
          <div>
            <div className="li-k warn">
              {confirm ? 'Tap again to confirm' : 'Reset to sample data'}
            </div>
            <div className="li-s">Replaces every month with the starter list</div>
          </div>
          <div className="li-v warn">Reset</div>
        </button>
      </div>
      </div>
    </>
  );
}
