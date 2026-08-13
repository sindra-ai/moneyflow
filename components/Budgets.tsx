'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { money, moneyCompact } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { CAT_ACCENT, type SpendCat } from '@/lib/spend';
import type { Txn } from '@/lib/bankClient';
import { Target } from './icons';

/** This-month spend per category, each with an optional monthly budget cap. */
export function Budgets({ monthSpend }: { monthSpend: Txn[] }) {
  const { store, setSettings } = useStore();
  const budgets = store.settings.budgets ?? {};
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const byCat = new Map<string, number>();
  for (const t of monthSpend)
    byCat.set(t.category || 'Other', (byCat.get(t.category || 'Other') ?? 0) + Math.abs(t.amount));
  // Keep budgeted categories visible even before anything is spent on them.
  for (const k of Object.keys(budgets)) if (!byCat.has(k)) byCat.set(k, 0);

  const rows = [...byCat.entries()]
    .map(([k, v]) => ({ k, v, budget: budgets[k] }))
    .sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || b.v - a.v);
  if (!rows.length) return null;
  // Without a budget, a bar shows the category's share of this month's spend
  // (so nothing reads as a misleading "full" bar just for being the biggest).
  const totalV = rows.reduce((s, r) => s + r.v, 0) || 1;

  const commit = (cat: string) => {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ''));
    const next = { ...budgets };
    if (Number.isFinite(v) && v > 0) next[cat] = Math.round(v);
    else delete next[cat];
    setSettings({ budgets: next });
    setEditing(null);
  };

  return (
    <div className="bd">
      {rows.map((c) => {
        const accent = CAT_ACCENT[c.k as SpendCat] || 'var(--a1)';
        const over = c.budget != null && c.v > c.budget;
        const pct = c.budget ? Math.min(100, (c.v / c.budget) * 100) : (c.v / totalV) * 100;
        return (
          <div className="bd-row" key={c.k}>
            <div className="bd-top">
              <span className="bd-k">{c.k}</span>
              {editing === c.k ? (
                <input
                  className="bud-in n"
                  inputMode="decimal"
                  autoFocus
                  value={draft}
                  placeholder="Monthly cap"
                  aria-label={`Budget for ${c.k}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(c.k)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  className="bud-v n"
                  onClick={() => {
                    HAPTIC.light();
                    setEditing(c.k);
                    setDraft(c.budget ? String(c.budget) : '');
                  }}
                >
                  <span className={over ? 'down' : ''}>{money(c.v)}</span>
                  {c.budget ? (
                    <span className="bud-cap"> / {moneyCompact(c.budget)}</span>
                  ) : (
                    <span className="bud-set">
                      <Target size={12} /> Budget
                    </span>
                  )}
                </button>
              )}
            </div>
            <div className="bd-bar">
              <i
                style={{
                  width: `${Math.max(3, Math.round(pct))}%`,
                  background: over ? 'var(--bad)' : accent,
                  opacity: c.budget ? 1 : 0.8,
                }}
              />
            </div>
            {over && (
              <div className="bd-over n">Over by {money(c.v - (c.budget as number))}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
