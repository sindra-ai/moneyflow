import React from "react";

type P = { size?: number; strokeWidth?: number } & React.SVGProps<SVGSVGElement>;

function base({ size = 22, strokeWidth = 2, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const Check = (p: P) => (
  <svg {...base({ ...p, strokeWidth: p.strokeWidth ?? 3 })}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const Plus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Home = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const Calendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="17" rx="3" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);

export const User = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

export const ChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const Wallet = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M16 12h.01M3 9h13" />
  </svg>
);

export const Camera = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8a2 2 0 0 1 2-2h1l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </svg>
);

export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" />
  </svg>
);

export const Sun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 4 4M20 20l-1-1M19 5l1-1M4 20l1-1" />
  </svg>
);

export const Moon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8" />
  </svg>
);

export const Edit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);

export const Refresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4" />
  </svg>
);

export const Grip = ({ size = 20, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
