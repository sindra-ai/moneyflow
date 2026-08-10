"use client";

import React from "react";
import { motion } from "framer-motion";
import { Calendar, Home, User } from "./icons";

export type Tab = "home" | "calendar" | "profile";

const items: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "calendar", label: "Calendar", Icon: Calendar },
  { key: "profile", label: "Profile", Icon: User },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="nav" aria-label="Primary">
      {items.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            className={active ? "active" : ""}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(key)}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="pillbg"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
          </button>
        );
      })}
    </nav>
  );
}
