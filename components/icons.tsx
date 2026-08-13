import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Plus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const Check = (p: P) => (
  <Base strokeWidth={3} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const CheckAll = (p: P) => (
  <Base {...p}>
    <path d="m2 12 5 5L18 6" />
    <path d="m13 17 1 1L22 10" />
  </Base>
);

export const Calendar = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="17" rx="4" />
    <path d="M3 10h18M8 2.5v4M16 2.5v4" />
  </Base>
);

export const Rotate = (p: P) => (
  <Base {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Base>
);

export const ChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="m15 5-7 7 7 7" />
  </Base>
);

export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const ChevronUp = (p: P) => (
  <Base {...p}>
    <path d="m6 15 6-6 6 6" />
  </Base>
);

export const Home = (p: P) => (
  <Base {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
  </Base>
);

export const User = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Base>
);

export const Sun = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Base>
);

export const Moon = (p: P) => (
  <Base {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
  </Base>
);

export const Wallet = (p: P) => (
  <Base {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
    <path d="M3 9h18" />
    <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
  </Base>
);

export const Pencil = (p: P) => (
  <Base {...p}>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
  </Base>
);

export const Camera = (p: P) => (
  <Base {...p}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2L9 4h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
    <circle cx="12" cy="12.8" r="3.4" />
  </Base>
);

export const Close = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const Trash = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" />
  </Base>
);

// Filled, symmetric 4-point star centred on (12,12) so it sits dead-centre.
export const Sparkle = ({ size = 20, ...rest }: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...rest}
  >
    <path d="M12 3.5c.9 5.6 2.9 7.6 8.5 8.5-5.6.9-7.6 2.9-8.5 8.5-.9-5.6-2.9-7.6-8.5-8.5 5.6-.9 7.6-2.9 8.5-8.5Z" />
  </svg>
);

export const Send = (p: P) => (
  <Base {...p}>
    <path d="M4 12 20 4l-4 16-4-7-8-1Z" />
  </Base>
);

export const Mic = (p: P) => (
  <Base {...p}>
    <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </Base>
);

export const Repeat = (p: P) => (
  <Base {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Base>
);

export const Target = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Base>
);

export const TrendUp = (p: P) => (
  <Base {...p}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Base>
);

export const Bolt = (p: P) => (
  <Base {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Base>
);

export const Coins = (p: P) => (
  <Base {...p}>
    <ellipse cx="9" cy="6" rx="6" ry="3" />
    <path d="M3 6v6c0 1.66 2.69 3 6 3s6-1.34 6-3V6" />
    <path d="M15 12.5c1.8-.3 3-1 3-1.9" />
    <ellipse cx="15" cy="15" rx="6" ry="3" />
    <path d="M9 15.9v2.1c0 1.66 2.69 3 6 3s6-1.34 6-3v-6" />
  </Base>
);
