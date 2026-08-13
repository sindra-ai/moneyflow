/**
 * Reconciliation — match planned outgoings to the real payments that have
 * ALREADY LEFT the bank account. A bill is only ever considered paid here when
 * a money-OUT (debit) transaction is found that lines up by both name and
 * amount. Money coming in (salary) and the bill's due date are irrelevant — we
 * wait for the actual outgoing payment to appear before ticking anything.
 */

import type { BankTxn, Outgoing } from './types';

export interface Match {
  itemId: string;
  txnId: string;
  date: string; // ISO date the payment left the account
  merchant: string;
  amount: number; // magnitude of the payment
}

/** Lowercase, letters+digits only — for whole-string containment checks. */
function collapse(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Significant words (>=4 chars, ignoring pure numbers/refs). */
function tokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t));
}

/** Bounded Levenshtein — only used on short tokens, capped at `max`. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > max) return false; // whole row already over budget
  }
  return dp[b.length] <= max;
}

/** Do a bill's name and a bank merchant plausibly refer to the same thing? */
export function nameSimilar(billName: string, merchant: string): boolean {
  const ca = collapse(billName);
  const cb = collapse(merchant);
  if (ca.length < 3 || cb.length < 3) return false;
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const ta = tokens(billName);
  const tb = tokens(merchant);
  for (const x of ta) {
    for (const y of tb) {
      if (x === y || x.includes(y) || y.includes(x)) return true;
      // Tolerate a small typo/variant on longer words (vodaphone→vodafone is
      // distance 2). Only paired with an amount match, so this stays safe.
      const cap = Math.min(x.length, y.length) >= 6 ? 2 : 1;
      if (x.length >= 5 && y.length >= 5 && within(x, y, cap)) return true;
    }
  }
  return false;
}

/** How close in value the payment must be to count (2% or £1, whichever bigger). */
function amountClose(bill: number, paid: number): boolean {
  return Math.abs(bill - paid) <= Math.max(1, bill * 0.02);
}

/**
 * Find which of `items` have a matching money-out payment in `txns` within the
 * given month. Conservative on purpose: needs BOTH a name and an amount match,
 * each transaction is used at most once, and each bill matches its closest
 * payment. Items already reconciled (paidTxnId set) are left alone so a manual
 * un-tick sticks.
 */
export function matchBills(items: Outgoing[], txns: BankTxn[], monthKey: string): Match[] {
  const candidates = items.filter((it) => !it.paidTxnId && !it.paid && (it.amount || 0) > 0);
  if (!candidates.length) return [];

  // Only money that has actually LEFT the account, dated within this month.
  const outgoings = txns.filter((t) => t.amount < 0 && t.date.startsWith(monthKey));
  if (!outgoings.length) return [];

  // Score every plausible (bill, payment) pair, then greedily assign the best.
  const pairs: { itemId: string; txn: BankTxn; gap: number }[] = [];
  for (const it of candidates) {
    for (const t of outgoings) {
      const paid = Math.abs(t.amount);
      if (!amountClose(it.amount, paid)) continue;
      if (!nameSimilar(it.name, t.merchant)) continue;
      pairs.push({ itemId: it.id, txn: t, gap: Math.abs(it.amount - paid) });
    }
  }
  pairs.sort((a, b) => a.gap - b.gap);

  const usedItems = new Set<string>();
  const usedTxns = new Set<string>();
  const out: Match[] = [];
  for (const p of pairs) {
    if (usedItems.has(p.itemId) || usedTxns.has(p.txn.id)) continue;
    usedItems.add(p.itemId);
    usedTxns.add(p.txn.id);
    out.push({
      itemId: p.itemId,
      txnId: p.txn.id,
      date: p.txn.date,
      merchant: p.txn.merchant,
      amount: Math.abs(p.txn.amount),
    });
  }
  return out;
}
