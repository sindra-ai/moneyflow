/**
 * Server-only helper for the TrueLayer Data API (Open Banking / AIS).
 * Never import from client code — it uses the client secret.
 *
 * Sandbox vs live is inferred from the client id ("sandbox-…" = sandbox), so
 * swapping to a live app is just an env-var change.
 */

export function haveKeys(): boolean {
  return !!(process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET);
}

function isSandbox(): boolean {
  return (process.env.TRUELAYER_CLIENT_ID || '').startsWith('sandbox-');
}
function authBase(): string {
  return isSandbox() ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com';
}
function apiBase(): string {
  return isSandbox() ? 'https://api.truelayer-sandbox.com' : 'https://api.truelayer.com';
}
function providers(): string {
  // The mock bank is only available in sandbox.
  return isSandbox() ? 'uk-cs-mock uk-ob-all uk-oauth-all' : 'uk-ob-all uk-oauth-all';
}

/** The URL the user opens to pick their bank and authorise access. */
export function buildAuthUrl(redirect: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRUELAYER_CLIENT_ID as string,
    scope: 'info accounts balance transactions offline_access',
    redirect_uri: redirect,
    providers: providers(),
  });
  return `${authBase()}/?${p.toString()}`;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${authBase()}/connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TRUELAYER_CLIENT_ID as string,
      client_secret: process.env.TRUELAYER_CLIENT_SECRET as string,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = await res.json();
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: nowMs() + (Number(d.expires_in) || 3600) * 1000,
  };
}

// Date.now() is fine in a serverless route (only workflow scripts forbid it).
function nowMs(): number {
  return Date.now();
}

export function exchangeCode(code: string, redirect: string): Promise<Tokens> {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirect });
}

export function refreshTokens(refreshToken: string): Promise<Tokens> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function apiGet(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`api ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export interface BankAccount {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  provider?: string;
  providerLogo?: string;
  sortLast4?: string;
}

export async function getAccounts(accessToken: string): Promise<BankAccount[]> {
  const d = await apiGet('/data/v1/accounts', accessToken);
  return (d.results ?? []).map((a: any) => ({
    id: a.account_id,
    name: a.display_name || a.account_type || 'Account',
    type: a.account_type,
    currency: a.currency,
    provider: a.provider?.display_name,
    providerLogo: a.provider?.logo_uri,
    sortLast4: a.account_number?.number?.slice?.(-4) || a.account_number?.sort_code?.slice?.(-4),
  }));
}

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // negative = money out
  currency: string;
  merchant: string;
  category?: string;
  accountId: string;
}

export async function getTransactions(accessToken: string, accountId: string): Promise<Txn[]> {
  // Ask for as much history as the bank will give (up to ~24 months). Banks
  // return the full range on the first (attended) call after connecting;
  // later background calls may only return ~90 days — which is why the client
  // merges results into a cache rather than replacing it.
  const to = new Date();
  const from = new Date(to.getFullYear() - 2, to.getMonth(), to.getDate());
  const qs = `?from=${from.toISOString()}&to=${to.toISOString()}`;
  const d = await apiGet(`/data/v1/accounts/${accountId}/transactions${qs}`, accessToken);
  return (d.results ?? []).map((t: any) => {
    const magnitude = Math.abs(Number(t.amount ?? 0));
    const out = (t.transaction_type || '').toUpperCase() === 'DEBIT';
    return {
      id: t.transaction_id || `${t.timestamp}-${t.amount}-${t.description}`,
      date: (t.timestamp || '').slice(0, 10),
      amount: out ? -magnitude : magnitude,
      currency: t.currency || 'GBP',
      merchant: t.merchant_name || t.description || 'Payment',
      category: t.transaction_category,
      accountId,
    } as Txn;
  });
}
