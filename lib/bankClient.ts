'use client';

/**
 * Client-side bank helpers. The connection itself now lives in the synced
 * store (so it follows you across devices) — this module is pure network +
 * a device-local cache for the transaction list and the "seen" set (which
 * are performance/UI only, never sensitive).
 */

import type { BankAccount, BankConn, BankTokens, BankTxn } from './types';

export type { BankAccount, BankConn };
export type Txn = BankTxn;
export type Tokens = BankTokens;

const TXN_KEY = 'moneyflow:bank:txns';
const SEEN_KEY = 'moneyflow:bank:seen';

/* -------- device-local cache + unread tracking (for the "new" dot) -------- */

export function cacheTxns(txns: Txn[]) {
  try {
    localStorage.setItem(TXN_KEY, JSON.stringify({ at: Date.now(), txns }));
  } catch {
    /* ignore */
  }
}
export function getCachedTxns(): { at: number; txns: Txn[] } | null {
  try {
    const r = localStorage.getItem(TXN_KEY);
    return r ? (JSON.parse(r) as { at: number; txns: Txn[] }) : null;
  } catch {
    return null;
  }
}
export function clearCache() {
  try {
    localStorage.removeItem(TXN_KEY);
    localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}
function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
/** Record the currently-shown transactions as seen (clears the dot). */
export function markSeen(txns: Txn[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(txns.map((t) => t.id)));
  } catch {
    /* ignore */
  }
}
export function newCount(txns: Txn[]): number {
  const seen = getSeen();
  return txns.filter((t) => !seen.has(t.id)).length;
}

/* -------------------------------------------------------------- network -- */

/** Must exactly match a redirect URI whitelisted in the TrueLayer console. */
export function redirectUri(): string {
  return `${location.origin}/`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/** Kick off the bank connection — sends the user to TrueLayer. */
export async function beginConnect(): Promise<{ needsKeys?: boolean; error?: string }> {
  const r = await post<{ link?: string; needsKeys?: boolean; error?: string }>('/api/bank/connect', {
    redirect: redirectUri(),
  });
  if (r.needsKeys) return { needsKeys: true };
  if (!r.link) return { error: r.error || 'Could not start bank connection.' };
  location.href = r.link;
  return {};
}

/** Exchange the returned code, load accounts, and return the connection. */
export async function completeConnect(code: string): Promise<BankConn> {
  const tokens = await post<BankTokens & { error?: string }>('/api/bank/token', {
    code,
    redirect: redirectUri(),
  });
  if (!tokens.accessToken) throw new Error(tokens.error || 'Token exchange failed');
  const a = await post<{ accounts?: BankAccount[]; error?: string }>('/api/bank/accounts', {
    accessToken: tokens.accessToken,
  });
  const accounts = a.accounts ?? [];
  return {
    tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
    accounts,
    selected: accounts.map((x) => x.id),
    connectedAt: Date.now(),
  };
}

/** Refresh the access token if it's near expiry. Returns the (possibly new)
 *  connection — TrueLayer rotates the refresh token, so the caller MUST
 *  persist whatever comes back. */
async function ensureFresh(conn: BankConn): Promise<BankConn> {
  if (Date.now() < conn.tokens.expiresAt - 60_000) return conn;
  const t = await post<BankTokens & { error?: string }>('/api/bank/refresh', {
    refreshToken: conn.tokens.refreshToken,
  });
  if (!t.accessToken) throw new Error('Session expired — reconnect your bank.');
  return {
    ...conn,
    tokens: { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt },
  };
}

/** Load transactions. Returns the txns and the (possibly refreshed) conn. */
export async function loadTransactions(conn: BankConn): Promise<{ txns: Txn[]; conn: BankConn }> {
  const fresh = await ensureFresh(conn);
  const r = await post<{ transactions?: Txn[]; error?: string }>('/api/bank/transactions', {
    accessToken: fresh.tokens.accessToken,
    accountIds: fresh.selected,
  });
  if (r.error) throw new Error(r.error);
  return { txns: r.transactions ?? [], conn: fresh };
}

/** Quiet check (on app open / focus): new activity since last viewed?
 *  Returns whether there's new activity plus the (possibly refreshed) conn. */
export async function checkNewActivity(
  conn: BankConn | null | undefined,
): Promise<{ hasNew: boolean; conn: BankConn | null }> {
  if (!conn) return { hasNew: false, conn: null };
  try {
    const cached = getCachedTxns();
    if (cached && Date.now() - cached.at < 90_000) {
      return { hasNew: newCount(cached.txns) > 0, conn };
    }
    const { txns, conn: next } = await loadTransactions(conn);
    cacheTxns(txns);
    return { hasNew: newCount(txns) > 0, conn: next };
  } catch {
    return { hasNew: false, conn };
  }
}
