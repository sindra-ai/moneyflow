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
