import React from "react";

/** The MoneyFlow mark — gradient rounded square with a 3-bar cashflow glyph. */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MoneyFlow"
    >
      <defs>
        <linearGradient id="mf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c9cff" />
          <stop offset="1" stopColor="#c58bff" />
        </linearGradient>
      </defs>
      <rect x="43" y="43" width="426" height="426" rx="123" fill="url(#mf-logo)" />
      <g fill="#ffffff" fillOpacity="0.95">
        <rect x="150" y="256" width="61" height="102" rx="23" />
        <rect x="242" y="205" width="61" height="153" rx="23" />
        <rect x="334" y="154" width="61" height="204" rx="23" />
      </g>
    </svg>
  );
}
