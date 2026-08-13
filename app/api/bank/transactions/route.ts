import { NextResponse } from 'next/server';
import { getTransactions, haveKeys, type Txn } from '@/lib/truelayer';
import { categorise, type SpendCat } from '@/lib/spend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { accessToken, accountIds } -> { transactions } categorised, newest first.
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { accessToken?: string; accountIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const ids = (body.accountIds ?? []).filter(Boolean).slice(0, 5);
  if (!body.accessToken || ids.length === 0) {
    return NextResponse.json({ error: 'Missing accessToken or accountIds' }, { status: 400 });
  }

  try {
    let failures = 0;
    let authFail = false;
    const perAccount = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getTransactions(body.accessToken as string, id);
        } catch (e) {
          failures += 1;
          // Only a genuine auth rejection (401/403) means the session is dead.
          // Rate limits / 5xx / network blips are transient — don't cry wolf.
          const msg = (e as Error).message || '';
          if (/\b40[13]\b/.test(msg) || /invalid_token|unauthori[sz]ed|invalid_grant/i.test(msg)) {
            authFail = true;
          }
          return [] as Txn[];
        }
      }),
    );
    // Every account failed. Distinguish a truly expired session (reconnect) from
    // a transient hiccup (just try again) so we don't send people to reconnect
    // when their connection is actually fine.
    if (failures === ids.length) {
      return NextResponse.json(
        {
          error: authFail
            ? 'Your bank session has expired — tap Disconnect, then reconnect your bank.'
            : 'Couldn’t reach your bank just now — wait a moment and tap refresh again.',
        },
        { status: 502 },
      );
    }
    const transactions = perAccount
      .flat()
      .map((t) => ({
        ...t,
        // Prefer TrueLayer's own category when it's meaningful, else derive it.
        category: mapCategory(t.category) ?? categorise(t.merchant, t.amount),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ transactions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// Fold TrueLayer's transaction_category values into our spend buckets.
function mapCategory(c?: string): SpendCat | null {
  if (!c) return null;
  const s = c.toUpperCase();
  const map: Record<string, SpendCat> = {
    PURCHASE: 'Shopping',
    ATM: 'Cash',
    CASH: 'Cash',
    TRANSFER: 'Transfer',
    DIRECT_DEBIT: 'Bills',
    STANDING_ORDER: 'Bills',
    DEBIT: 'Other',
    CREDIT: 'Income',
    BILL_PAYMENT: 'Bills',
    INTEREST: 'Income',
    FEE_CHARGE: 'Bills',
  };
  return map[s] ?? null;
}
