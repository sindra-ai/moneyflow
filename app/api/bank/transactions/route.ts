import { NextResponse } from 'next/server';
import { accessToken, getTransactions, haveKeys, type Txn } from '@/lib/gocardless';
import { categorise } from '@/lib/spend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { accountIds: string[] } -> { transactions: [...] } categorised, newest first.
// Free tier is rate-limited (~a few pulls/day per account), so the client
// should call this sparingly (on open / manual refresh), not on a timer.
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { accountIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const ids = (body.accountIds ?? []).filter(Boolean).slice(0, 5);
  if (ids.length === 0) return NextResponse.json({ error: 'No accountIds' }, { status: 400 });

  try {
    const token = await accessToken();
    const perAccount = await Promise.all(
      ids.map(async (id) => {
        try {
          const txns = await getTransactions(token, id);
          return txns.map((t: Txn) => ({ ...t, accountId: id }));
        } catch (e) {
          return { accountId: id, error: (e as Error).message };
        }
      }),
    );

    const rateLimited = perAccount.find(
      (r) => !Array.isArray(r) && /429|rate/i.test((r as { error: string }).error || ''),
    );
    const all = perAccount.flatMap((r) => (Array.isArray(r) ? r : []));
    const transactions = all
      .map((t) => ({ ...t, category: categorise(t.merchant, t.amount) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return NextResponse.json({
      transactions,
      rateLimited: !!rateLimited,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
