import type { MonthData, Outgoing, Store } from "./types";

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

const SEED_ITEMS: SeedItem[] = [
  { name: "CC", amount: 300, currency: "GBP", dueDay: null, note: "Full £3,650 · £300 min", paid: false },
  { name: "Dad", amount: 500, currency: "GBP", dueDay: null, note: "", paid: false },
  { name: "HMRC Corporate Tax", amount: 156, currency: "GBP", dueDay: null, note: "Due 1st July", paid: false },
  { name: "Everyday Loans", amount: 360, currency: "GBP", dueDay: 1, note: "", paid: false },
  { name: "David Lloyds", amount: 142, currency: "GBP", dueDay: 1, note: "", paid: false },
  { name: "Three", amount: 32, currency: "GBP", dueDay: 3, note: "", paid: false },
  { name: "Vodaphone Airtime", amount: 40, currency: "GBP", dueDay: 3, note: "", paid: false },
  { name: "Vodaphone Device", amount: 32, currency: "GBP", dueDay: 1, note: "", paid: false },
  { name: "Pave", amount: 9, currency: "GBP", dueDay: 1, note: "", paid: false },
  { name: "Figma + Webflow", amount: 56, currency: "GBP", dueDay: null, note: "", paid: false },
  { name: "CreditSpring", amount: 234, currency: "GBP", dueDay: null, note: "June", paid: false },
  { name: "Bumper", amount: 85.55, currency: "GBP", dueDay: null, note: "", paid: false },
  { name: "Cashasap", amount: 20, currency: "GBP", dueDay: null, note: "Cleared", paid: true },
  { name: "Loans2Go", amount: 156.44, currency: "GBP", dueDay: 28, note: "", paid: false },
  { name: "The Money Platform", amount: 500, currency: "GBP", dueDay: null, note: "", paid: false },
  { name: "Geeth", amount: 266, currency: "GBP", dueDay: null, note: "$350", paid: false },
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

export function defaultStore(currentKey: string): Store {
  return {
    version: 1,
    months: { [currentKey]: seedMonth() },
    profile: { name: "", avatar: null },
    settings: { theme: "system", usdToGbp: 0.79 },
  };
}
