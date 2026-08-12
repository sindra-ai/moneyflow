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
    const perAccount = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getTransactions(body.accessToken as string, id);
        } catch {
          return [] as Txn[];
        }
      }),
    );
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
