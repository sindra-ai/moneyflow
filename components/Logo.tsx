import React from "react";

/** MoneyFlow brand mark (user-provided logo), shown as a rounded tile. */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="MoneyFlow" width={size} height={size} />
    </span>
  );
}
