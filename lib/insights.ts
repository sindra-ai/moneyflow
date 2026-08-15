/**
 * Spending insights derived from cached bank transactions (client-side, no
 * secrets): recurring-payment detection, safe-to-spend, a weekly digest, and a
 * monthly trend series. All pure functions over BankTxn[].
 */

import type { BankTxn } from './types';

const DAY = 86_400_000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Group key that folds trailing reference numbers/dates off a merchant name. */
function merchantKey(m: string): string {
  return (m || 'Payment')
    .toLowerCase()
    .replace(/[0-9]{2,}/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* --------------------------------------------------- recurring / subs ---- */

export type Cadence = 'weekly' | 'monthly' | 'yearly' | 'irregular';

export interface Recurring {
  key: string;
  merchant: string; // nicest display name seen
  amount: number; // typical (median) charge
  monthly: number; // normalised to a per-month cost
  count: number;
  cadence: Cadence;
  lastDate: string;
  category?: string;
}

/**
 * A payee is "recurring" when it charges at least twice, at a steady-ish
 * amount, on a roughly regular cadence. Transfers, cash and income are ignored.
 */
export function detectRecurring(txns: BankTxn[]): Recurring[] {
  const spend = txns.filter(
    (t) => t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Cash',
  );
  const groups = new Map<string, BankTxn[]>();
  for (const t of spend) {
    const k = merchantKey(t.merchant);
    if (!k) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }

  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const amt = median(amounts);
    if (amt <= 0) continue;
    // Amounts must be reasonably consistent (subscriptions rarely swing wildly).
    const consistent = amounts.filter((a) => Math.abs(a - amt) <= Math.max(1.5, amt * 0.25));
    if (consistent.length < 2) continue;

    // Median gap between consecutive charges → cadence.
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push((Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / DAY);
    }
    const gap = median(gaps);
    let cadence: Cadence = 'irregular';
    let monthly = amt;
    if (gap >= 5 && gap <= 9) {
      cadence = 'weekly';
      monthly = amt * 4.345;
    } else if (gap >= 24 && gap <= 38) {
      cadence = 'monthly';
      monthly = amt;
    } else if (gap >= 330 && gap <= 400) {
      cadence = 'yearly';
      monthly = amt / 12;
    } else if (gap >= 12 && gap <= 20) {
      // fortnightly reads as ~twice monthly
      cadence = 'monthly';
      monthly = amt * 2;
    } else {
      // Seen more than twice but no clean rhythm — still likely recurring.
      cadence = 'irregular';
      monthly = amt;
      if (sorted.length < 3) continue; // two irregular hits isn't enough signal
    }

    // Prettiest display name: the most common raw merchant string.
    const freq = new Map<string, number>();
    for (const t of sorted) freq.set(t.merchant, (freq.get(t.merchant) ?? 0) + 1);
    const merchant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];

    out.push({
      key,
      merchant,
      amount: r2(amt),
      monthly: r2(monthly),
      count: sorted.length,
      cadence,
      lastDate: sorted[sorted.length - 1].date,
      category: sorted[sorted.length - 1].category,
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/* ------------------------------------------------------- safe to spend ---- */

export interface SafeToSpend {
  salary: number;
  bills: number; // planned outgoings total
  spent: number; // real day-to-day spend so far this month (excl. tracked bills)
  safe: number; // what's genuinely left to spend
  perDay: number | null; // safe spread over days to payday
  daysToPayday: number | null;
}

/**
 * salary − all planned bills − what you've actually spent day-to-day this
 * month (bank debits not already counted as a tracked bill, excluding
 * transfers). Reconciled bill payments are excluded so nothing double-counts.
 */
export function safeToSpend(opts: {
  salary: number;
  billsTotal: number;
  txns: BankTxn[];
  reconciledTxnIds?: Set<string>;
  daysToPayday?: number | null;
  /** extra income already RECEIVED this month (e.g. a paid contract week) */
  extraReceived?: number;
}): SafeToSpend {
  const mKey = monthKeyOf();
  const skip = opts.reconciledTxnIds ?? new Set<string>();
  const spent = opts.txns
    .filter(
      (t) =>
        t.amount < 0 &&
        t.date.startsWith(mKey) &&
        t.category !== 'Transfer' &&
        !skip.has(t.id),
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const safe = opts.salary + (opts.extraReceived ?? 0) - opts.billsTotal - spent;
  const d = opts.daysToPayday ?? null;
  return {
    salary: opts.salary,
    bills: r2(opts.billsTotal),
    spent: r2(spent),
    safe: r2(safe),
    daysToPayday: d,
    perDay: d && d > 0 && safe > 0 ? r2(safe / d) : null,
  };
}

/* ---------------------------------------------------------- weekly digest - */

export interface Digest {
  thisWeek: number;
  lastWeek: number;
  delta: number; // thisWeek − lastWeek
  count: number;
  topCategory: { name: string; amount: number } | null;
  biggest: { merchant: string; amount: number; date: string } | null;
}

function startOfWeek(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}

export function weeklyDigest(txns: BankTxn[], now = new Date()): Digest {
  const wkStart = startOfWeek(now);
  const prevStart = wkStart - 7 * DAY;
  const spend = txns.filter((t) => t.amount < 0 && t.category !== 'Transfer');
  const inWeek = spend.filter((t) => Date.parse(t.date) >= wkStart);
  const inPrev = spend.filter(
    (t) => Date.parse(t.date) >= prevStart && Date.parse(t.date) < wkStart,
  );
  const sum = (l: BankTxn[]) => l.reduce((s, t) => s + Math.abs(t.amount), 0);

  const byCat = new Map<string, number>();
  for (const t of inWeek)
    byCat.set(t.category || 'Other', (byCat.get(t.category || 'Other') ?? 0) + Math.abs(t.amount));
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  const big = [...inWeek].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  const thisWeek = sum(inWeek);
  const lastWeek = sum(inPrev);
  return {
    thisWeek: r2(thisWeek),
    lastWeek: r2(lastWeek),
    delta: r2(thisWeek - lastWeek),
    count: inWeek.length,
    topCategory: topCat ? { name: topCat[0], amount: r2(topCat[1]) } : null,
    biggest: big
      ? { merchant: big.merchant, amount: r2(Math.abs(big.amount)), date: big.date }
      : null,
  };
}

/* ------------------------------------------------------------- trend ------ */

const SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export interface TrendPoint {
  key: string; // YYYY-MM
  label: string;
  out: number; // money out
  in: number; // money in
}

/** Money out vs in for the last `n` calendar months, oldest first. */
export function spendTrend(txns: BankTxn[], n = 6, now = new Date()): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKeyOf(d);
    const rows = txns.filter((t) => t.date.startsWith(key) && t.category !== 'Transfer');
    out.push({
      key,
      label: SHORT[d.getMonth()],
      out: r2(rows.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)),
      in: r2(rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)),
    });
  }
  return out;
}

export { ymd, monthKeyOf as insightsMonthKey };
