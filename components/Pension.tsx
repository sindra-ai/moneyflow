'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { money, moneyCompact } from '@/lib/format';
import { fetchPrice } from '@/lib/marketClient';
import { HAPTIC } from '@/lib/haptics';
import { Coins, TrendUp } from './icons';

// GBP-priced London-listed trackers (Yahoo), so the estimate carries no USD/GBP
// drift. Default is MSCI ACWI — the index PensionBee's Global Leaders Plan and
// most global-equity pensions follow (developed + emerging large caps).
const PROXIES = [
  { symbol: 'SSAC.L', label: 'Global (MSCI ACWI)' },
  { symbol: 'IWRD.L', label: 'Developed (World)' },
  { symbol: 'VUSA.L', label: 'US (S&P 500)' },
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function prettyDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y) return '';
  return `${d} ${MON[(m || 1) - 1]} ${y}`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
const proxyLabel = (sym: string) => PROXIES.find((p) => p.symbol === sym)?.label ?? 'the market';

export function Pension() {
  const { pension, setPension } = useStore();
  const [price, setPrice] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftVal, setDraftVal] = useState('');
  const [draftSym, setDraftSym] = useState(pension?.symbol ?? PROXIES[0].symbol);

  const symbol = pension?.symbol ?? PROXIES[0].symbol;

  // Refresh the proxy price on open and whenever the tracked symbol changes.
  useEffect(() => {
    let live = true;
    void fetchPrice(symbol).then((p) => {
      if (live) setPrice(p);
    });
    return () => {
      live = false;
    };
  }, [symbol]);

  const startAdd = () => {
    HAPTIC.light();
    setDraftVal('');
    setDraftSym(PROXIES[0].symbol);
    setEditing(true);
  };
  const startUpdate = () => {
    HAPTIC.light();
    setDraftVal(pension ? String(pension.value) : '');
    setDraftSym(symbol);
    setEditing(true);
  };

  const save = async () => {
    const v = parseFloat(draftVal.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(v) || v < 0) {
      setEditing(false);
      return;
    }
    // Anchor to the proxy's price right now, so future opens move from here.
    const base = await fetchPrice(draftSym);
    setPension({ value: Math.round(v * 100) / 100, date: today(), symbol: draftSym, baseLevel: base });
    setPrice(base);
    HAPTIC.success();
    setEditing(false);
  };

  const remove = () => {
    HAPTIC.light();
    setPension(null);
    setEditing(false);
  };

  /* ---- editor (add or update) ---- */
  if (editing || !pension) {
    if (!editing) {
      return (
        <button className="pension-cta" onClick={startAdd}>
          <Coins size={16} /> Add your pension
        </button>
      );
    }
    return (
      <div className="pension-new">
        <label className="pension-field">
          <span>Current value (from your pension app)</span>
          <input
            className="in n"
            inputMode="decimal"
            placeholder="£ e.g. 24,500"
            value={draftVal}
            autoFocus
            onChange={(e) => setDraftVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
        </label>
        <div className="pension-field">
          <span>Track it with</span>
          <div className="pension-proxies">
            {PROXIES.map((p) => (
              <button
                key={p.symbol}
                data-on={draftSym === p.symbol}
                onClick={() => setDraftSym(p.symbol)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pension-acts">
          {pension && (
            <button className="pension-remove" onClick={remove}>
              Remove
            </button>
          )}
          <button
            className="goal-cancel"
            onClick={() => setEditing(false)}
            style={{ marginLeft: pension ? 0 : 'auto' }}
          >
            Cancel
          </button>
          <button className="goal-save" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    );
  }

  /* ---- estimate view ---- */
  const moved = pension.baseLevel != null && price != null && pension.baseLevel > 0;
  const estimate = moved ? pension.value * (price! / pension.baseLevel!) : pension.value;
  const delta = estimate - pension.value;
  const pct = pension.value > 0 ? (delta / pension.value) * 100 : 0;
  const up = delta >= 0;

  return (
    <div className="pension">
      <div className="pension-top">
        <span className="pension-lab">Pension · estimated</span>
        <span className="pension-proxy-tag">{proxyLabel(symbol)}</span>
      </div>
      <div className="pension-fig n">≈ {money(estimate)}</div>
      {moved && Math.abs(delta) >= 0.5 && (
        <div className={`pension-delta n ${up ? 'up' : 'down'}`}>
          <TrendUp size={13} style={{ transform: up ? 'none' : 'scaleY(-1)' }} />
          {up ? '+' : '−'}
          {moneyCompact(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}%) since you set it
        </div>
      )}
      <div className="pension-anchor">
        You set <b>{money(pension.value)}</b> on {prettyDate(pension.date)}
        {!moved && price == null ? ' · markets unavailable' : ''}
      </div>
      <div className="pension-acts">
        <button className="pension-update" onClick={startUpdate}>
          Update value
        </button>
      </div>
    </div>
  );
}
