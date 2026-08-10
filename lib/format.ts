import type { Currency, Outgoing, Settings } from "./types";

const symbols: Record<Currency, string> = { GBP: "£", USD: "$" };

export function money(amount: number, currency: Currency = "GBP"): string {
  const sym = symbols[currency] ?? "";
  const rounded = Math.round(amount * 100) / 100;
  const hasPennies = Math.abs(rounded % 1) > 0.0001;
  return (
    sym +
    rounded.toLocaleString("en-GB", {
      minimumFractionDigits: hasPennies ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Convert any outgoing to its GBP value for the running totals. */
export function toGbp(item: Outgoing, settings: Settings): number {
  if (item.currency === "USD") return item.amount * settings.usdToGbp;
  return item.amount;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

const ordinals = ["th", "st", "nd", "rd"];
export function ordinal(n: number): string {
  const v = n % 100;
  return n + (ordinals[(v - 20) % 10] || ordinals[v] || ordinals[0]);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** First weekday of the month, Monday = 0 ... Sunday = 6. */
export function firstWeekdayMondayBased(key: string): number {
  const [y, m] = key.split("-").map(Number);
  const jsDay = new Date(y, m - 1, 1).getDay(); // Sun = 0
  return (jsDay + 6) % 7;
}
