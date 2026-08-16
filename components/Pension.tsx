'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { money, moneyCompact } from '@/lib/format';
import { fetchPrice } from '@/lib/marketClient';
import { HAPTIC } from '@/lib/haptics';
import type { Pot } from '@/lib/types';
import { PensionChart } from './PensionChart';
import { Coins, Plus, TrendUp } from './icons';

// GBP-priced London-listed trackers (Yahoo), so the estimate carries no USD/GBP
// drift. Default is MSCI ACWI — the index PensionBee's Global Leaders Plan and
// most global-equity pensions follow (developed + emerging large caps).
const PROXIES = [
  { symbol: 'SSAC.L', label: 'Global (MSCI ACWI)' },
  { symbol: 'IWRD.L', label: 'Developed (World)' },
  { symbol: 'VUSA.L', label: 'US (S&P 500)' },
];
const proxyLabel = (sym: string) => PROXIES.find((p) => p.symbol === sym)?.label ?? 'the market';

/** How long since this pot was last anchored to a real figure. The proxy only
 *  approximates the fund, so the estimate drifts further the older this gets. */
function staleDays(date: string): number {
  const then = new Date(date + 'T00:00:00').getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function prettyDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y) return '';
  return `${d} ${MON[(m || 1) - 1]} ${y}`;
}
const today = () => new Date().toISOString().slice(0, 10);

export function Pension() {
  const { pots, addPot, updatePot, removePot } = useStore();
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  // undefined = closed, null = adding, string = editing that pot id
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [val, setVal] = useState('');
  const [sym, setSym] = useState(PROXIES[0].symbol);

  const symbolsKey = [...new Set(pots.map((p) => p.symbol))].sort().join(',');
  useEffect(() => {
    let live = true;
    for (const s of new Set(pots.map((p) => p.symbol))) {
      void fetchPrice(s).then((pr) => live && setPrices((prev) => ({ ...prev, [s]: pr })));
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const estimateOf = (p: Pot) => {
    const pr = prices[p.symbol];
    return p.baseLevel && pr ? p.value * (pr / p.baseLevel) : p.value;
  };
  const total = pots.reduce((s, p) => s + estimateOf(p), 0);

  const openAdd = () => {
    HAPTIC.light();
    setName('');
    setVal('');
    setSym(PROXIES[0].symbol);
    setEditing(null);
  };
  const openEdit = (p: Pot) => {
    HAPTIC.light();
    setName(p.name);
    setVal(String(p.value));
    setSym(p.symbol);
    setEditing(p.id);
  };

  const save = async () => {
    const v = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(v) || v < 0) return setEditing(undefined);
    const nm = name.trim().slice(0, 30) || 'Pot';
    const existing = typeof editing === 'string' ? pots.find((p) => p.id === editing) : undefined;
    const valChanged = !existing || Math.abs(existing.value - v) > 0.005;
    const symChanged = !existing || existing.symbol !== sym;

    if (existing && !valChanged && !symChanged) {
      updatePot(existing.id, { name: nm }); // rename only — keep the anchor
    } else {
      // Anchor to the proxy price now, so the estimate moves from here.
      const base = await fetchPrice(sym);
      setPrices((prev) => ({ ...prev, [sym]: base ?? prev[sym] ?? null }));
      const patch = { name: nm, value: Math.round(v * 100) / 100, symbol: sym, baseLevel: base, date: today() };
      if (existing) updatePot(existing.id, patch);
      else addPot(patch);
    }
    HAPTIC.success();
    setEditing(undefined);
  };

  /* ---------- editor ---------- */
  if (editing !== undefined) {
    return (
      <div className="pension-new">
        <label className="pension-field">
          <span>Name</span>
          <input
            className="in"
            placeholder="Provider name"
            value={name}
            autoFocus={editing === null}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="pension-field">
          <span>Current value (from your provider)</span>
          <input
            className="in n"
            inputMode="decimal"
            placeholder="£ e.g. 59,564"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
        </label>
        <div className="pension-field">
          <span>Track it with</span>
          <div className="pension-proxies">
            {PROXIES.map((p) => (
              <button key={p.symbol} data-on={sym === p.symbol} onClick={() => setSym(p.symbol)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pension-acts">
          {typeof editing === 'string' && (
            <button
              className="pension-remove"
              onClick={() => {
                HAPTIC.light();
                removePot(editing);
                setEditing(undefined);
              }}
            >
              Remove
            </button>
          )}
          <button
            className="goal-cancel"
            style={{ marginLeft: typeof editing === 'string' ? 0 : 'auto' }}
            onClick={() => setEditing(undefined)}
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

  /* ---------- empty ---------- */
  if (!pots.length) {
    return (
      <button className="pension-cta" onClick={openAdd}>
        <Coins size={16} /> Add a pension or investment
      </button>
    );
  }

  /* ---------- overview ---------- */
  return (
    <>
      <div className="pension">
        <div className="pension-top">
          <span className="pension-lab">Total · estimated</span>
          <span className="pension-proxy-tag">{pots.length} pot{pots.length === 1 ? '' : 's'}</span>
        </div>
        <div className="pension-fig n">≈ {money(Math.round(total))}</div>
        {pots.length > 0 && <PensionChart pots={pots} />}
      </div>

      <div className="pots">
        {pots.map((p) => {
          const est = estimateOf(p);
          const delta = est - p.value;
          const moved = p.baseLevel != null && prices[p.symbol] != null;
          const up = delta >= 0;
          return (
            <button className="pot" key={p.id} onClick={() => openEdit(p)}>
              <div className="pot-main">
                <div className="pot-name">{p.name}</div>
                <div className="pot-meta">
                  {proxyLabel(p.symbol)} · set {prettyDate(p.date)}
                </div>
                {staleDays(p.date) >= 7 && (
                  <div className="pot-stale">
                    {staleDays(p.date)} days old · tap to update from your provider
                  </div>
                )}
              </div>
              <div className="pot-right">
                <div className="pot-val n">≈ {money(Math.round(est))}</div>
                {moved && Math.abs(delta) >= 0.5 && (
                  <div className={`pot-delta n ${up ? 'up' : 'down'}`}>
                    <TrendUp size={11} style={{ transform: up ? 'none' : 'scaleY(-1)' }} />
                    {up ? '+' : '−'}
                    {moneyCompact(Math.abs(delta))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button className="pot-add" onClick={openAdd}>
        <Plus size={15} /> Add another pot
      </button>
    </>
  );
}
