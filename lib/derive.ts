import type { MonthData, Outgoing, Store } from './types';
import { daysInMonth, deriveMonth, monthKeyOf, shiftMonth } from './store';

/* ------------------------------------------------------------- grouping */

export interface Group {
  key: string;
  title: string;
  items: Outgoing[];
}

const byDay = (a: Outgoing, b: Outgoing) => (a.dueDay ?? 99) - (b.dueDay ?? 99);

/**
 * Buckets for the "Due date" view. Only the current month can have things
 * overdue or imminent, so other months collapse to scheduled/undated.
 */
export function groupByDue(items: Outgoing[], monthKey: string): Group[] {
  const dated = items.filter((i) => i.dueDay != null).sort(byDay);
  const undated = items.filter((i) => i.dueDay == null);

  const out: Group[] = [];
  const push = (key: string, title: string, list: Outgoing[]) => {
    if (list.length) out.push({ key, title, items: list });
  };

  if (monthKey === monthKeyOf()) {
    const today = new Date().getDate();
    push(
      'overdue',
      'Overdue',
      dated.filter((i) => i.dueDay! < today && !i.paid),
    );
    push(
      'soon',
      'Next 7 days',
      dated.filter((i) => i.dueDay! >= today && i.dueDay! <= today + 7),
    );
    push(
      'later',
      'Later this month',
      dated.filter((i) => i.dueDay! > today + 7 || (i.dueDay! < today && i.paid)),
    );
  } else {
    push('sched', 'Scheduled', dated);
  }

  push('none', 'No date set', undated);
  return out;
}

/* -------------------------------------------------------------- pacing */

export interface Pacing {
  daysLeft: number;
  perDay: number;
}

/** How much still has to go out, spread over the days left in the month. */
export function pacing(monthKey: string, left: number): Pacing | null {
  if (monthKey !== monthKeyOf() || left <= 0) return null;
  const total = daysInMonth(monthKey);
  const daysLeft = Math.max(1, total - new Date().getDate() + 1);
  return { daysLeft, perDay: left / daysLeft };
}

/* ------------------------------------------------------------- history */

export interface Point {
  key: string;
  label: string;
  total: number;
}

const SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function totalOf(m: MonthData): number {
  return m.items.reduce((sum, it) => sum + (it.amount || 0), 0);
}

/* -------------------------------------------------------------- payday */

/** Whole days from today to the next occurrence of `payday` (day of month). */
export function daysUntilPayday(payday: number): number {
  const now = new Date();
  const day = now.getDate();
  const target = Math.min(payday, daysInMonth(monthKeyOf(now)));
  if (day <= target) return target - day;
  // Rolled past this month's payday — count to next month's.
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextTarget = Math.min(payday, daysInMonth(monthKeyOf(next)));
  return daysInMonth(monthKeyOf(now)) - day + nextTarget;
}

/* ------------------------------------------------------------ savings */

/**
 * Starting balance plus every already-finished month's left-over
 * (salary − outgoings). The current and future months don't count yet.
 */
export function savingsSoFar(store: Store, currentKey: string): number {
  let sum = store.settings.savingsStart || 0;
  for (const key of Object.keys(store.months)) {
    if (key >= currentKey) continue;
    const m = store.months[key];
    const total = m.items.reduce((s, it) => s + (it.amount || 0), 0);
    sum += m.salary - total;
  }
  return sum;
}

/** Totals for the n months ending at `monthKey`, oldest first. */
export function history(store: Store, monthKey: string, n = 6): Point[] {
  const out: Point[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const key = shiftMonth(monthKey, -i);
    const m = store.months[key] ?? deriveMonth(store.months, key);
    out.push({
      key,
      label: SHORT[Number(key.split('-')[1]) - 1],
      total: totalOf(m),
    });
  }
  return out;
}
