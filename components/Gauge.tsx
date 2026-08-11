'use client';

/**
 * The one hero moment on Home: a 240° arc holding the remaining balance.
 * It retracts on a spring as bills get ticked off, so paying something has a
 * visible physical consequence rather than just a number change.
 */
interface Props {
  /** 0–1 remaining */
  remaining: number;
  children: React.ReactNode;
}

const SIZE = 260;
const H = 178;
const STROKE = 11;
const SWEEP = 240; // degrees of arc; the 120° gap sits at the bottom
const R = 104;
const CX = SIZE / 2;
const CY = 118;

/** 0° = top, increasing clockwise. */
function polar(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

// Centre the gap on 180° (bottom) so the arc reads as a gauge.
const START = 180 + (360 - SWEEP) / 2; // 240°
const END = START + SWEEP;

function arcPath() {
  const a = polar(START);
  const b = polar(END);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 1 1 ${b.x} ${b.y}`;
}

export function Gauge({ remaining, children }: Props) {
  const clamped = Math.max(0, Math.min(1, remaining));
  const len = (SWEEP / 360) * 2 * Math.PI * R;
  // The dot rides a rotating group rather than animated cx/cy, which can't be
  // transitioned — that mismatch made it teleport while the arc swept.
  const angle = START + SWEEP * clamped;
  const empty = clamped <= 0.001;

  return (
    <div className="gauge">
      <svg width={SIZE} height={H} viewBox={`0 0 ${SIZE} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--a1)" />
            <stop offset="100%" stopColor="var(--a2)" />
          </linearGradient>
        </defs>

        <path
          className="gauge-track"
          d={arcPath()}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          className="gauge-bar"
          d={arcPath()}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - clamped)}
          style={{ opacity: empty ? 0 : 1 }}
        />
        <g
          className="gauge-cap-g"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            opacity: empty ? 0 : 1,
          }}
        >
          {/* At 0° this sits at the top of the arc; the group rotates it round. */}
          <circle className="gauge-cap" cx={CX} cy={CY - R} r={STROKE / 2 - 2.5} />
        </g>
      </svg>

      <div className="gauge-mid">{children}</div>
    </div>
  );
}
