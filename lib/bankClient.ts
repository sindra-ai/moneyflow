'use client';

/** Client-side manager for the bank connection. Tokens are kept in
 *  localStorage on this device only (never synced to the cloud). */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export interface BankAccount {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  provider?: string;
  sortLast4?: string;
}
export interface Txn {
  id: string;
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category?: string;
  accountId: string;
}
export interface BankConn {
  tokens: Tokens;
  accounts: BankAccount[];
  selected: string[];
  connectedAt: number;
}

const KEY = 'moneyflow:bank';

export function getConn(): BankConn | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BankConn) : null;
  } catch {
    return null;
  }
}
export function saveConn(c: BankConn) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
export function clearConn() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

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
  sessionStorage.setItem('mf-bank-pending', '1');
  location.href = r.link;
  return {};
}

export function hasPendingConnect(): boolean {
  try {
    return sessionStorage.getItem('mf-bank-pending') === '1';
  } catch {
    return false;
  }
}
export function clearPending() {
  try {
    sessionStorage.removeItem('mf-bank-pending');
  } catch {
    /* ignore */
  }
}

/** Exchange the returned code, load accounts, and store the connection. */
export async function completeConnect(code: string): Promise<BankConn> {
  const tokens = await post<Tokens & { error?: string }>('/api/bank/token', {
    code,
    redirect: redirectUri(),
  });
  if (!tokens.accessToken) throw new Error(tokens.error || 'Token exchange failed');
  const a = await post<{ accounts?: BankAccount[]; error?: string }>('/api/bank/accounts', {
    accessToken: tokens.accessToken,
  });
  const accounts = a.accounts ?? [];
  const conn: BankConn = {
    tokens,
    accounts,
    selected: accounts.map((x) => x.id),
    connectedAt: Date.now(),
  };
  saveConn(conn);
  clearPending();
  return conn;
}

async function ensureFresh(conn: BankConn): Promise<BankConn> {
  if (Date.now() < conn.tokens.expiresAt - 60_000) return conn;
  const t = await post<Tokens & { error?: string }>('/api/bank/refresh', {
    refreshToken: conn.tokens.refreshToken,
  });
  if (!t.accessToken) throw new Error('Session expired — reconnect your bank.');
  const next = { ...conn, tokens: t };
  saveConn(next);
  return next;
}

export async function loadTransactions(conn: BankConn): Promise<Txn[]> {
  const fresh = await ensureFresh(conn);
  const r = await post<{ transactions?: Txn[]; error?: string }>('/api/bank/transactions', {
    accessToken: fresh.tokens.accessToken,
    accountIds: fresh.selected,
  });
  if (r.error) throw new Error(r.error);
  return r.transactions ?? [];
}
