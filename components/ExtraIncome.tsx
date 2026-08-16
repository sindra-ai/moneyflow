'use client';

import { useEffect, useRef, useState } from 'react';
import { computeTotals, useStore } from '@/lib/store';
import { money, moneyCompact } from '@/lib/format';
import { fetchPrice } from '@/lib/marketClient';
import { HAPTIC } from '@/lib/haptics';
import { Check, Coins, Trash } from './icons';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FALLBACK_FX = 1.3; // GBP/USD if the live rate can't load

function mondayKey(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function payDate(key: string): Date {
  const d = keyToDate(key);
  d.setDate(d.getDate() + 9); // work this week → the following Wednesday
  return d;
}
const fmt = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
const hrLabel = (n: number) => `${n} hr${n === 1 ? '' : 's'}`;
/** Pay Wednesdays in the current month — how many payouts can land this month. */
function payWeeksThisMonth(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = new Date(y, m, 1);
  let c = 0;
  while (d.getMonth() === m) {
    if (d.getDay() === 3) c += 1;
    d.setDate(d.getDate() + 1);
  }
  return c;
}

export function ExtraIncome() {
  const { extraIncome: ei, setExtraIncome, month } = useStore();
  const [fx, setFx] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dName, setDName] = useState('');
  const [dRate, setDRate] = useState('80');
  const [dCur, setDCur] = useState<'USD' | 'GBP'>('USD');
  const [dCap, setDCap] = useState('40');
  const [hrs, setHrs] = useState('');

  // Swipe-to-delete a logged week.
  const [sw, setSw] = useState<{ key: string; dx: number } | null>(null);
  const swStart = useRef(0);
  const swKey = useRef<string | null>(null);
  const swBlock = useRef(false);

  useEffect(() => {
    void fetchPrice('GBPUSD=X').then(setFx);
  }, []);

  const toGBP = (amt: number, cur: 'USD' | 'GBP') => (cur === 'GBP' ? amt : amt / (fx ?? FALLBACK_FX));

  const openSetup = () => {
    if (ei) {
      setDName(ei.name);
      setDRate(String(ei.rate));
      setDCur(ei.currency);
      setDCap(String(ei.capHours));
    }
    HAPTIC.light();
    setEditing(true);
  };
  const saveSetup = () => {
    const rate = parseFloat(dRate.replace(/[^0-9.]/g, ''));
    const cap = parseInt(dCap.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(rate) || rate <= 0) return setEditing(false);
    setExtraIncome({
      name: dName.trim() || 'Contract',
      rate,
      currency: dCur,
      capHours: Number.isFinite(cap) && cap > 0 ? cap : 40,
    });
    HAPTIC.success();
    setEditing(false);
  };

  /* ---------- empty / setup ---------- */
  if (!ei && !editing) {
    return (
      <button className="pension-cta" onClick={openSetup}>
        <Coins size={16} /> Track contract / extra income
      </button>
    );
  }
  if (editing) {
    return (
      <div className="pension-new">
        <label className="pension-field">
          <span>Name</span>
          <input className="in" value={dName} onChange={(e) => setDName(e.target.value)} placeholder="Client or company" />
        </label>
        <div className="xi-row">
          <label className="pension-field" style={{ flex: 1 }}>
            <span>Pay per hour</span>
            <input className="in n" inputMode="decimal" value={dRate} onChange={(e) => setDRate(e.target.value)} placeholder="80" />
          </label>
          <label className="pension-field" style={{ width: 92 }}>
            <span>Currency</span>
            <div className="pension-proxies">
              <button data-on={dCur === 'USD'} onClick={() => setDCur('USD')}>$</button>
              <button data-on={dCur === 'GBP'} onClick={() => setDCur('GBP')}>£</button>
            </div>
          </label>
          <label className="pension-field" style={{ width: 78 }}>
            <span>Hr cap</span>
            <input className="in n" inputMode="numeric" value={dCap} onChange={(e) => setDCap(e.target.value)} placeholder="40" />
          </label>
        </div>
        <div className="pension-acts">
          {ei && (
            <button
              className="pension-remove"
              onClick={() => {
                HAPTIC.light();
                setExtraIncome(null);
                setEditing(false);
              }}
            >
              Remove
            </button>
          )}
          <button className="goal-cancel" style={{ marginLeft: ei ? 0 : 'auto' }} onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button className="goal-save" onClick={saveSetup}>
            Save
          </button>
        </div>
      </div>
    );
  }

  /* ---------- main card ---------- */
  const weeks = [...ei!.weeks].sort((a, b) => (a.key < b.key ? 1 : -1));
  const now = new Date();
  const weekGBP = (hours: number) => toGBP(hours * ei!.rate, ei!.currency);

  // Forecast is the TARGET at full hours (what you're aiming to earn), so you
  // can see the projection of what you'll have if you max your weekly cap.
  const weeklyCapGBP = toGBP(ei!.capHours * ei!.rate, ei!.currency);
  const monthlyPotential = weeklyCapGBP * payWeeksThisMonth(now);
  const loggedExpected = weeks.filter((w) => !w.received).reduce((s, w) => s + weekGBP(w.hours), 0);
  const receivedTotal = weeks.filter((w) => w.received).reduce((s, w) => s + weekGBP(w.hours), 0);
  const leftOver = computeTotals(month).leftOver;
  const projected = leftOver + monthlyPotential;

  const curKey = mondayKey();
  const curWeek = ei!.weeks.find((w) => w.key === curKey);
  const previewHours = parseFloat(hrs.replace(/[^0-9.]/g, ''));
  const previewGBP =
    Number.isFinite(previewHours) && previewHours > 0
      ? weekGBP(Math.min(previewHours, ei!.capHours))
      : weekGBP(curWeek?.hours ?? ei!.capHours);

  const logWeek = () => {
    const h = parseFloat(hrs.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(h) || h < 0) return;
    const capped = Math.min(h, ei!.capHours);
    const next = ei!.weeks.some((w) => w.key === curKey)
      ? ei!.weeks.map((w) => (w.key === curKey ? { ...w, hours: capped } : w))
      : [...ei!.weeks, { key: curKey, hours: capped, received: false }];
    setExtraIncome({ weeks: next });
    HAPTIC.success();
    setHrs('');
  };
  const toggleReceived = (key: string) => {
    HAPTIC.select();
    setExtraIncome({ weeks: ei!.weeks.map((w) => (w.key === key ? { ...w, received: !w.received } : w)) });
  };
  const deleteWeek = (key: string) => {
    HAPTIC.success();
    setExtraIncome({ weeks: ei!.weeks.filter((w) => w.key !== key) });
  };

  return (
    <>
      <div className="xi">
        <div className="xi-top">
          <button className="xi-name" onClick={openSetup}>
            {ei!.name} · {ei!.currency === 'USD' ? '$' : '£'}
            {ei!.rate}/hr
          </button>
          <span className="xi-tag">forecast · full hrs</span>
        </div>
        <div className="xi-fig n">
          {money(weeklyCapGBP)}
          <span className="xi-per"> /wk</span>
        </div>
        <div className="xi-sub n">
          {money(monthlyPotential)} this month · projected left over{' '}
          <b className={projected >= 0 ? 'up' : 'down'}>{moneyCompact(projected)}</b>
        </div>

        <div className="xi-log">
          <input
            className="in n"
            inputMode="decimal"
            value={hrs}
            placeholder={curWeek ? `${hrLabel(curWeek.hours)} logged` : `Hours this week (max ${ei!.capHours})`}
            onChange={(e) => setHrs(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') logWeek();
            }}
          />
          <button className="xi-log-btn" onClick={logWeek}>
            {curWeek ? 'Update' : 'Log'}
          </button>
        </div>
        <div className="xi-log-note n">
          this week ≈ {money(previewGBP)} · logged {money(loggedExpected)} · received {money(receivedTotal)}
        </div>
      </div>

      {weeks.length > 0 && (
        <div className="xi-weeks">
          {weeks.slice(0, 10).map((w) => {
            const dx = sw?.key === w.key ? sw.dx : 0;
            return (
              <div className="xi-week-wrap" key={w.key}>
                {dx !== 0 && (
                  <div className="xi-week-del">
                    <Trash size={15} /> Delete
                  </div>
                )}
                <button
                  className="xi-week"
                  data-received={!!w.received}
                  style={{
                    transform: dx ? `translateX(${dx}px)` : undefined,
                    transition: dx ? 'none' : undefined,
                    background: dx ? 'var(--raised)' : undefined,
                  }}
                  onTouchStart={(e) => {
                    swStart.current = e.touches[0].clientX;
                    swKey.current = w.key;
                  }}
                  onTouchMove={(e) => {
                    if (swKey.current !== w.key) return;
                    const d = e.touches[0].clientX - swStart.current;
                    setSw(d < 0 ? { key: w.key, dx: Math.max(d, -104) } : null);
                  }}
                  onTouchEnd={() => {
                    const d = sw?.key === w.key ? sw.dx : 0;
                    if (d < -64) {
                      swBlock.current = true;
                      deleteWeek(w.key);
                    }
                    setSw(null);
                    swKey.current = null;
                  }}
                  onClick={() => {
                    if (swBlock.current) {
                      swBlock.current = false;
                      return;
                    }
                    toggleReceived(w.key);
                  }}
                >
                  <span className="xi-week-tick" data-on={!!w.received}>
                    {w.received && <Check size={11} />}
                  </span>
                  <div className="xi-week-body">
                    <div className="xi-week-main">
                      Week of {fmt(keyToDate(w.key))} · {hrLabel(w.hours)}
                    </div>
                    <div className="xi-week-meta">{w.received ? 'Received' : `Due ${fmt(payDate(w.key))}`}</div>
                  </div>
                  <span className="xi-week-amt n">{money(weekGBP(w.hours))}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="xi-remove"
        onClick={() => {
          if (!confirmRemove) {
            setConfirmRemove(true);
            HAPTIC.light();
            return;
          }
          HAPTIC.success();
          setExtraIncome(null);
          setConfirmRemove(false);
        }}
      >
        {confirmRemove ? 'Tap to confirm — remove tracker' : 'Contract ended? Remove'}
      </button>
    </>
  );
}
