/**
 * Server-side notification engine. Given a user's store, their bank
 * transactions and a small persisted "notify state" (for dedup), it returns the
 * push notifications to send now and the updated state. Pure + testable — the
 * cron does the I/O.
 */

import type { BankTxn, Store } from './types';
import { detectRecurring } from './insights';

export interface Note {
  title: string;
  body: string;
  tag: string;
}

export interface NotifyState {
  notifiedTxns?: string[]; // txn ids already alerted (big payment / income)
  knownSubs?: string[]; // recurring merchant keys seen (undefined = not seeded)
  subAmounts?: Record<string, number>; // last charge per recurring key
  overBudget?: Record<string, string[]>; // monthKey -> categories already alerted
  lastWeeklyRecap?: string; // ISO date of the Monday last sent
  lastMonthlyRecap?: string; // monthKey last sent
  lastLowWarn?: string; // dedup marker for the cashflow warning
}

const DAY = 86_400_000;
const BIG_PAYMENT = 150; // a single debit at/above this is "large"
const INCOME_IN = 500; // a credit at/above this looks like pay/income
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const monthKeyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function topCategory(txns: BankTxn[]): { name: string; amount: number } | null {
  const by: Record<string, number> = {};
  for (const t of txns) by[t.category || 'Other'] = (by[t.category || 'Other'] ?? 0) + Math.abs(t.amount);
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return top ? { name: top[0], amount: top[1] } : null;
}

export function evaluateNotifications(opts: {
  store: Store;
  txns: BankTxn[];
  state: NotifyState;
  now: Date;
}): { notifications: Note[]; state: NotifyState } {
  const { store, now } = opts;
  const out: Note[] = [];
  const state: NotifyState = { ...opts.state };

  const mKey = monthKeyOf(now);
  const today = now.getUTCDate();
  const dow = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const month = store.months[mKey];

  // Only the selected accounts count, mirroring the app.
  const sel = store.bank?.selected;
  const txns = sel && sel.length ? opts.txns.filter((t) => sel.includes(t.accountId)) : opts.txns;
  const spend = (t: BankTxn) => t.amount < 0 && t.category !== 'Transfer';
  const recent = (t: BankTxn) => Date.parse(t.date) >= now.getTime() - 3 * DAY;

  /* 1 ─ Bill due-date reminders (daily nudge, not deduped). */
  if (month) {
    const soon = month.items.filter(
      (it) => !it.paid && it.dueDay != null && it.dueDay >= today && it.dueDay <= today + 2,
    );
    if (soon.length) {
      out.push({
        title: soon.length === 1 ? `${soon[0].name} due soon` : `${soon.length} bills due soon`,
        body:
          soon.length === 1
            ? `${gbp(soon[0].amount)} · due the ${soon[0].dueDay}${ordinal(soon[0].dueDay as number)}`
            : soon.map((i) => i.name).join(', '),
        tag: 'due-soon',
      });
    }
  }

  const notified = new Set(state.notifiedTxns ?? []);

  /* 2 ─ Large payments out. */
  const bigs = txns
    .filter((t) => spend(t) && Math.abs(t.amount) >= BIG_PAYMENT && recent(t) && !notified.has(t.id))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 3);
  for (const t of bigs) {
    out.push({ title: 'Large payment 💳', body: `${gbp(Math.abs(t.amount))} to ${t.merchant}`, tag: 'big' });
    notified.add(t.id);
  }

  /* 6 ─ Money in / payday. */
  const ins = txns
    .filter((t) => t.amount >= INCOME_IN && t.category !== 'Transfer' && recent(t) && !notified.has(t.id))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2);
  for (const t of ins) {
    out.push({ title: 'Money in 💰', body: `${gbp(t.amount)} from ${t.merchant}`, tag: 'in' });
    notified.add(t.id);
  }
  state.notifiedTxns = [...notified].slice(-800);

  /* 3 & 4 ─ New subscriptions + price rises. First run just seeds a baseline. */
  const subs = detectRecurring(txns);
  const seeded = state.knownSubs !== undefined;
  const known = new Set(state.knownSubs ?? []);
  const amounts = { ...(state.subAmounts ?? {}) };
  for (const s of subs) {
    if (!known.has(s.key)) {
      if (seeded) out.push({ title: 'New recurring payment 🔁', body: `${s.merchant} · ~${gbp(s.monthly)}/mo`, tag: 'sub-new' });
      known.add(s.key);
    }
    const prev = amounts[s.key];
    if (seeded && prev != null && s.amount > prev + Math.max(0.5, prev * 0.05)) {
      out.push({ title: 'Subscription went up 📈', body: `${s.merchant}: ${gbp(prev)} → ${gbp(s.amount)}`, tag: 'sub-up' });
    }
    amounts[s.key] = s.amount;
  }
  state.knownSubs = [...known];
  state.subAmounts = amounts;

  /* 5 ─ Category over budget (once per category per month). */
  const budgets = store.settings.budgets ?? {};
  const overState = { ...(state.overBudget ?? {}) };
  if (Object.keys(budgets).length) {
    const already = new Set(overState[mKey] ?? []);
    const byCat: Record<string, number> = {};
    for (const t of txns) if (spend(t) && t.date.startsWith(mKey)) byCat[t.category || 'Other'] = (byCat[t.category || 'Other'] ?? 0) + Math.abs(t.amount);
    for (const [cat, cap] of Object.entries(budgets)) {
      const spent = byCat[cat] ?? 0;
      if (cap > 0 && spent > cap && !already.has(cat)) {
        out.push({ title: 'Over budget 🎯', body: `${cat}: ${gbp(spent)} of ${gbp0(cap)} budget`, tag: 'budget' });
        already.add(cat);
      }
    }
    overState[mKey] = [...already];
    state.overBudget = overState;
  }

  /* 7a ─ Weekly recap (Mondays, on the prior 7 days). */
  const mondayId = isoDate(now);
  if (dow === 1 && state.lastWeeklyRecap !== mondayId) {
    const wk = txns.filter((t) => spend(t) && Date.parse(t.date) >= now.getTime() - 7 * DAY);
    const total = wk.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (total > 0) {
      const top = topCategory(wk);
      out.push({ title: 'Your week in money 🗓️', body: `Spent ${gbp(total)}${top ? `, most on ${top.name}` : ''}`, tag: 'recap-wk' });
    }
    state.lastWeeklyRecap = mondayId;
  }

  /* 7b ─ Monthly recap (1st of the month, on the month just ended). */
  if (today === 1) {
    const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const prevKey = monthKeyOf(prev);
    if (state.lastMonthlyRecap !== prevKey) {
      const rows = txns.filter((t) => spend(t) && t.date.startsWith(prevKey));
      const total = rows.reduce((s, t) => s + Math.abs(t.amount), 0);
      if (total > 0) {
        const top = topCategory(rows);
        out.push({
          title: `${MONTHS[prev.getUTCMonth()]} recap 🗓️`,
          body: `Spent ${gbp(total)}${top ? ` · most on ${top.name} (${gbp(top.amount)})` : ''}`,
          tag: 'recap-mo',
        });
      }
      state.lastMonthlyRecap = prevKey;
    }
  }

  /* 8 ─ Cashflow heads-up: bills due within 3 days vs money likely left. */
  if (month && store.bank) {
    const salary = month.salary || 0;
    const spentMonth = txns.filter((t) => spend(t) && t.date.startsWith(mKey)).reduce((s, t) => s + Math.abs(t.amount), 0);
    const upcoming = month.items
      .filter((it) => !it.paid && it.dueDay != null && it.dueDay >= today && it.dueDay <= today + 3)
      .reduce((s, it) => s + (it.amount || 0), 0);
    const available = salary - spentMonth;
    const warnId = `${mKey}-${Math.floor(today / 3)}`; // at most ~once per 3 days
    if (salary > 0 && upcoming > 0 && available < upcoming && state.lastLowWarn !== warnId) {
      out.push({
        title: 'Cashflow heads-up ⚠️',
        body: `${gbp0(upcoming)} of bills due soon — about ${gbp0(Math.max(0, available))} spare (est.)`,
        tag: 'cashflow',
      });
      state.lastLowWarn = warnId;
    }
  }

  return { notifications: out.slice(0, 8), state };
}

function ordinal(d: number): string {
  const r = d % 100;
  if (r >= 11 && r <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
}
