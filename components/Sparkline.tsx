'use client';

import { useMemo } from 'react';
import type { Point } from '@/lib/derive';
import { moneyCompact } from '@/lib/format';

const W = 300;
const H = 62;
const PAD = 6;

export function Sparkline({ points }: { points: Point[] }) {
  const { line, area, last, len, flat } = useMemo(() => {
    const vals = points.map((p) => p.total);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min;
    // Every month carries the same recurring bills until one is edited, so a
    // flat series is the honest first-run state — centre it and drop the fill,
    // which would otherwise read as a solid block rather than a chart.
    const isFlat = span < 0.01;

    const x = (i: number) => (i / Math.max(1, points.length - 1)) * (W - PAD * 2) + PAD;
    const y = (v: number) => (isFlat ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));

    const pts = points.map((p, i) => [x(i), y(p.total)] as const);
    const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'} ${px} ${py}`).join(' ');

    return {
      line: d,
      area: `${d} L ${W - PAD} ${H} L ${PAD} ${H} Z`,
      last: pts[pts.length - 1],
      flat: isFlat,
      // Rough path length is enough to drive the draw-on animation.
      len: pts.reduce(
        (acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0),
        0,
      ),
    };
  }, [points]);

  const now = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = prev && prev.total > 0 ? (now.total - prev.total) / prev.total : 0;

  return (
    <div className="trend">
      <div className="trend-top">
        <div>
          <div className="trend-k">Going out this month</div>
          <div className="trend-v n">{moneyCompact(now.total)}</div>
        </div>
        {Math.abs(delta) > 0.005 && (
          <div className={`trend-k n ${delta > 0 ? 'down' : 'up'}`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(Math.round(delta * 100))}% vs {prev.label}
          </div>
        )}
      </div>

      <svg
        className="spark"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--a1)" />
            <stop offset="100%" stopColor="var(--a2)" />
          </linearGradient>
          <linearGradient id="sparkFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--a2)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--a2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!flat && <path className="spark-fill" d={area} />}
        <path
          className="spark-line"
          d={line}
          style={{ ['--len' as string]: len, opacity: flat ? 0.45 : 1 }}
        />
        <circle className="spark-dot" cx={last[0]} cy={last[1]} r="3.5" />
      </svg>

      <div className="spark-x">
        {points.map((p, i) => (
          <span key={p.key} data-now={i === points.length - 1}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
