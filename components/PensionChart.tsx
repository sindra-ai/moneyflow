'use client';

import { useEffect, useState } from 'react';
import { fetchSeries } from '@/lib/marketClient';
import type { Pot } from '@/lib/types';

const W = 300;
const H = 92;
const PAD = 6;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};

/** Last close on or before a date (series is oldest-first). */
function closeAt(series: [number, number][], atMs: number): number {
  let v = series[0][1];
  for (const [t, c] of series) {
    if (t <= atMs) v = c;
    else break;
  }
  return v;
}

/**
 * Estimated total value of all pots over the last 6 months, built from each
 * pot's proxy history scaled so it passes through the value the user anchored.
 * All proxies are LSE-listed, so their trading days align by index.
 */
export function PensionChart({ pots }: { pots: Pot[] }) {
  const [series, setSeries] = useState<Record<string, [number, number][]>>({});
  const symbolsKey = [...new Set(pots.map((p) => p.symbol))].sort().join(',');

  useEffect(() => {
    let live = true;
    const syms = [...new Set(pots.map((p) => p.symbol))];
    Promise.all(syms.map((s) => fetchSeries(s, '6mo').then((cl) => [s, cl] as const))).then((rs) => {
      if (live) setSeries(Object.fromEntries(rs));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const usable = pots.filter((p) => p.value > 0 && (series[p.symbol]?.length ?? 0) >= 2);
  if (!usable.length) return null;
  const minLen = Math.min(...usable.map((p) => series[p.symbol].length));
  if (minLen < 2) return null;

  const axis = series[usable[0].symbol].slice(-minLen).map(([t]) => t);
  const totals = new Array(minLen).fill(0) as number[];
  for (const p of usable) {
    const full = series[p.symbol];
    const base = closeAt(full, Date.parse(p.date));
    const factor = base > 0 ? p.value / base : 0;
    const tail = full.slice(-minLen);
    for (let i = 0; i < minLen; i += 1) totals[i] += tail[i][1] * factor;
  }

  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const span = max - min || 1;
  const x = (i: number) => (i / (minLen - 1)) * (W - PAD * 2) + PAD;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const line = totals.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(minLen - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;

  const change = totals[0] > 0 ? (totals[minLen - 1] - totals[0]) / totals[0] : 0;
  const up = change >= 0;

  return (
    <div className="pchart">
      <div className="pchart-head">
        {/* This line is the tracker index, not the pot. Say so: the pot may be
            months old while the index chart always runs a full six. */}
        <span className="pchart-lab">Index, last 6 months</span>
        <span className={`pchart-pct n ${up ? 'up' : 'down'}`}>
          {up ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
        </span>
      </div>
      <svg className="pchart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="pchartLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--a1)" />
            <stop offset="100%" stopColor="var(--a2)" />
          </linearGradient>
          <linearGradient id="pchartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--a2)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--a2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pchartFill)" />
        <path d={line} fill="none" stroke="url(#pchartLine)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="pchart-x">
        <span>{label(axis[0])}</span>
        <span>{label(axis[minLen - 1])}</span>
      </div>
    </div>
  );
}
