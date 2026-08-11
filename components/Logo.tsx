'use client';

/**
 * The brand mark. Sourced from public/brand/logo.png (generated from the
 * supplied artwork by scripts/genicons.py) — drop a replacement at that path
 * and it swaps in everywhere.
 */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/brand/logo.png"
      width={size}
      height={size}
      alt="MoneyFlow"
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}
