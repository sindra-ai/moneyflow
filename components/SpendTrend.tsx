'use client';

import { spendTrend } from '@/lib/insights';
import { moneyCompact } from '@/lib/format';
import type { Txn } from '@/lib/bankClient';

/** Money out (and in, when present) over the last six months. */
export function SpendTrend({ txns }: { txns: Txn[] }) {
  const points = spendTrend(txns, 6);
  const max = points.reduce((m, p) => Math.max(m, p.out, p.in), 0) || 1;
  const hasIncome = points.some((p) => p.in > 0);
  if (points.every((p) => p.out === 0 && p.in === 0)) return null;

  return (
    <>
      <div className="trend">
        {points.map((p) => (
          <div className="trend-col" key={p.key}>
            <div className="trend-bars">
              <i
                className="tb-out"
                style={{ height: `${Math.max(2, Math.round((p.out / max) * 100))}%` }}
                title={`Out ${moneyCompact(p.out)}`}
              />
              {hasIncome && (
                <i
                  className="tb-in"
                  style={{ height: `${Math.max(2, Math.round((p.in / max) * 100))}%` }}
                  title={`In ${moneyCompact(p.in)}`}
                />
              )}
            </div>
            <div className="trend-lab">{p.label}</div>
          </div>
        ))}
      </div>
      <div className="trend-legend">
        <span>
          <i className="dot out" /> Out
        </span>
        {hasIncome && (
          <span>
            <i className="dot in" /> In
          </span>
        )}
      </div>
    </>
  );
}
