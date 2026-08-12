/**
 * Server-only helper for GoCardless Bank Account Data (formerly Nordigen).
 * Never import this from client code — it uses the secret keys.
 *
 * Flow: token → pick institution (Halifax) → create requisition → user
 * authenticates with their bank via the returned link → we read the accounts
 * and their transactions.
 */

const BASE = 'https://bankaccountdata.gocardless.com/api/v2';

export function haveKeys(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function accessToken(): Promise<string> {
  const res = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access as string;
}

async function gc(path: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`gc ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export interface Institution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
}

/** UK institutions whose name matches (e.g. 'halifax'). */
export async function findInstitutions(token: string, nameContains: string): Promise<Institution[]> {
  const list = (await gc(`/institutions/?country=gb`, token)) as Institution[];
  const q = nameContains.trim().toLowerCase();
  return list
    .filter((i) => i.name.toLowerCase().includes(q))
    .map((i) => ({ id: i.id, name: i.name, bic: i.bic, logo: i.logo }));
}

/** Start a bank connection; returns the link the user opens to authenticate. */
export async function createRequisition(
  token: string,
  institutionId: string,
  redirect: string,
  reference: string,
): Promise<{ id: string; link: string }> {
  const r = await gc(`/requisitions/`, token, {
    method: 'POST',
    body: JSON.stringify({
      redirect,
      institution_id: institutionId,
      reference,
      user_language: 'EN',
    }),
  });
  return { id: r.id, link: r.link };
}

export async function getRequisition(
  token: string,
  id: string,
): Promise<{ status: string; accounts: string[] }> {
  const r = await gc(`/requisitions/${id}/`, token);
  return { status: r.status, accounts: r.accounts ?? [] };
}

export interface AccountInfo {
  id: string;
  name: string;
  iban?: string;
  currency?: string;
}

export async function getAccountDetails(token: string, accountId: string): Promise<AccountInfo> {
  const d = await gc(`/accounts/${accountId}/details/`, token);
  const a = d.account ?? {};
  return {
    id: accountId,
    name: a.name || a.ownerName || a.displayName || 'Account',
    iban: a.iban,
    currency: a.currency,
  };
}

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // negative = money out
  currency: string;
  merchant: string;
  raw: string;
  pending: boolean;
}

function normalise(t: any, pending: boolean): Txn {
  const amount = Number(t.transactionAmount?.amount ?? 0);
  const merchant =
    t.creditorName ||
    t.debtorName ||
    (Array.isArray(t.remittanceInformationUnstructuredArray)
      ? t.remittanceInformationUnstructuredArray.join(' ')
      : t.remittanceInformationUnstructured) ||
    t.additionalInformation ||
    'Payment';
  return {
    id: t.internalTransactionId || t.transactionId || `${t.bookingDate}-${amount}-${merchant}`,
    date: t.bookingDate || t.valueDate || '',
    amount,
    currency: t.transactionAmount?.currency || 'GBP',
    merchant: String(merchant).trim(),
    raw: String(t.remittanceInformationUnstructured || merchant || '').trim(),
    pending,
  };
}

export async function getTransactions(token: string, accountId: string): Promise<Txn[]> {
  const d = await gc(`/accounts/${accountId}/transactions/`, token);
  const booked = (d.transactions?.booked ?? []).map((t: any) => normalise(t, false));
  const pend = (d.transactions?.pending ?? []).map((t: any) => normalise(t, true));
  return [...pend, ...booked];
}
