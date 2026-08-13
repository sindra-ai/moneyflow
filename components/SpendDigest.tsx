'use client';

import { weeklyDigest } from '@/lib/insights';
import { money, moneyCompact } from '@/lib/format';
import type { Txn } from '@/lib/bankClient';

/** A plain-English summary of this week's spending vs last week. */
export function SpendDigest({ spend }: { spend: Txn[] }) {
  const d = weeklyDigest(spend);
  if (d.count === 0 && d.lastWeek === 0) return null;
  const up = d.delta > 0;
  const diff = Math.abs(d.delta);

  return (
    <div className="digest">
      <div className="digest-head">
        <span className="digest-lab">This week</span>
        <span className="digest-sum n">{money(d.thisWeek)}</span>
      </div>
      <p className="digest-line">
        {d.lastWeek === 0 ? (
          <>
            Your first week of tracked spending — {d.count} payment{d.count === 1 ? '' : 's'} so far.
          </>
        ) : diff < 1 ? (
          <>About the same as last week.</>
        ) : (
          <>
            <b className={up ? 'down' : 'up'}>
              {moneyCompact(diff)} {up ? 'more' : 'less'}
            </b>{' '}
            than last week.
          </>
        )}
        {d.topCategory && (
          <>
            {' '}
            Most went on <b>{d.topCategory.name}</b> ({moneyCompact(d.topCategory.amount)}).
          </>
        )}
      </p>
      {d.biggest && (
        <div className="digest-big">
          <span>Biggest: {d.biggest.merchant}</span>
          <span className="n">{money(d.biggest.amount)}</span>
        </div>
      )}
    </div>
  );
}
