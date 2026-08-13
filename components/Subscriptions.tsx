'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { detectRecurring, type Recurring } from '@/lib/insights';
import { money, moneyCompact } from '@/lib/format';
import { HAPTIC } from '@/lib/haptics';
import { ACCENTS } from '@/lib/types';
import { CAT_ACCENT, type SpendCat } from '@/lib/spend';
import type { Txn } from '@/lib/bankClient';
import { useToast } from './Toast';
import { Plus, Repeat } from './icons';

const CAD: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  irregular: 'Recurring',
};

/** Repeat-payment detector: subscriptions, memberships, standing charges. */
export function Subscriptions({ spend }: { spend: Txn[] }) {
  const { addItem } = useStore();
  const toast = useToast();
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const subs = detectRecurring(spend).slice(0, 12);
  if (subs.length < 2) return null;
  const monthly = subs.reduce((s, x) => s + x.monthly, 0);

  const addBill = (s: Recurring) => {
    HAPTIC.success();
    addItem({
      name: s.merchant.replace(/\s+/g, ' ').trim().slice(0, 40),
      amount: Math.round(s.amount * 100) / 100,
      dueDay: null,
      note: 'From bank · recurring',
      paid: false,
      accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      category: 'Subscriptions',
      recurring: true,
    });
    setAdded((a) => ({ ...a, [s.key]: true }));
    toast({ message: `Added ${s.merchant} to your bills` });
  };

  return (
    <>
      <div className="sec">
        <h3>Recurring &amp; subscriptions</h3>
        <span className="n">{moneyCompact(monthly)}/mo</span>
      </div>
      <div className="group">
        {subs.map((s) => {
          const accent = CAT_ACCENT[(s.category as SpendCat) || 'Other'] || 'var(--a1)';
          return (
            <div className="row sub-row" key={s.key}>
              <div
                className="glyph"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                  color: accent,
                }}
                aria-hidden="true"
              >
                <Repeat size={16} />
              </div>
              <div className="rbody">
                <div className="rname">{s.merchant}</div>
                <div className="rmeta">
                  {CAD[s.cadence]} · {s.count}× · last {s.lastDate}
                </div>
              </div>
              <div className="sub-right">
                <div className="ramt n">{money(s.amount)}</div>
                <button
                  className="sub-add"
                  disabled={added[s.key]}
                  onClick={() => addBill(s)}
                  aria-label={`Add ${s.merchant} as a bill`}
                >
                  {added[s.key] ? (
                    'Added'
                  ) : (
                    <>
                      <Plus size={13} /> Bill
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sub-note">Spotted from repeat payments. Add any as a tracked bill.</div>
    </>
  );
}
