import React from "react";

/**
 * MoneyFlow mark — a coin carrying an upward arrow: money moving / flowing up.
 * Clean geometric monogram that reads at any size.
 */
export default function Logo({ size = 40, id = "mf" }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MoneyFlow"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c9cff" />
          <stop offset="1" stopColor="#b98bff" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-arrow`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7c9cff" />
          <stop offset="1" stopColor="#a173ff" />
        </linearGradient>
      </defs>

      {/* app tile */}
      <rect x="36" y="36" width="440" height="440" rx="140" fill={`url(#${id}-bg)`} />
      <rect x="36" y="36" width="440" height="440" rx="140" fill={`url(#${id}-sheen)`} />

      {/* coin */}
      <circle cx="256" cy="256" r="150" fill="#ffffff" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#000000" strokeOpacity="0.04" strokeWidth="2" />

      {/* upward arrow */}
      <g stroke={`url(#${id}-arrow)`} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M256 336 V208" />
        <path d="M196 268 L256 188 L316 268" />
      </g>
    </svg>
  );
}
