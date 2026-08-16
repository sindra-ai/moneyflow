import type { MonthData, Store } from "./types";

export const ACCENTS = [
  "#7c9cff", // periwinkle
  "#6ee7c7", // mint
  "#ffd166", // amber
  "#ff8fab", // pink
  "#c58bff", // violet
  "#8fd3ff", // sky
  "#ffb27a", // peach
  "#9be15d", // lime
];

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * A brand-new month starts empty. It used to ship a personal bill list as
 * "sample data", which meant every new account opened holding someone else's
 * finances - and put those figures in the public bundle.
 */
export function seedMonth(): MonthData {
  return { salary: 0, items: [] };
}

export const DEFAULT_SETTINGS: Store["settings"] = {
  theme: "system",
  payday: 25,
  savingsStart: 0,
  reminders: false,
};

export function defaultStore(currentKey: string): Store {
  return {
    version: 1,
    months: { [currentKey]: seedMonth() },
    profile: { name: "", avatar: null },
    settings: { ...DEFAULT_SETTINGS },
    bank: null,
  };
}
