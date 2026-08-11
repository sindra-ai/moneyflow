import type { Category, MonthData, Outgoing, Store } from "./types";

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

type SeedItem = Omit<Outgoing, "id" | "accent"> & { accent?: string };

const S = (
  name: string,
  amount: number,
  category: Category,
  dueDay: number | null = null,
  note = "",
): SeedItem => ({ name, amount, category, dueDay, note, paid: false, recurring: true });

const SEED_ITEMS: SeedItem[] = [
  S("CC", 300, "Loans", null, "Full £3,650 · £300 min"),
  S("Dad", 500, "Family"),
  S("HMRC Corporate Tax", 156, "Bills", null, "Due 1st July"),
  S("Everyday Loans", 360, "Loans", 1),
  S("David Lloyds", 142, "Subscriptions", 1),
  S("Three", 32, "Bills", 3),
  S("Vodaphone Airtime", 40, "Bills", 3),
  S("Vodaphone Device", 32, "Bills", 1),
  S("Pave", 9, "Loans", 1),
  S("Figma + Webflow", 56, "Subscriptions"),
  S("CreditSpring", 234, "Loans", null, "June"),
  S("Bumper", 85.55, "Loans"),
  S("Cashasap", 20, "Loans"),
  S("Loans2Go", 156.44, "Loans", 28),
  S("The Money Platform", 500, "Loans"),
  S("Geeth", 266, "Family"),
];

export function seedMonth(): MonthData {
  return {
    salary: 5230,
    items: SEED_ITEMS.map((it, i) => ({
      ...it,
      id: newId(),
      accent: it.accent ?? ACCENTS[i % ACCENTS.length],
    })),
  };
}

export const DEFAULT_SETTINGS: Store["settings"] = {
  theme: "system",
  payday: 25,
  savingsStart: 0,
  lockEnabled: false,
  lockPin: null,
  biometric: false,
  reminders: false,
};

export function defaultStore(currentKey: string): Store {
  return {
    version: 1,
    months: { [currentKey]: seedMonth() },
    profile: { name: "", avatar: null },
    settings: { ...DEFAULT_SETTINGS },
  };
}
