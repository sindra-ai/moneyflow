import { NextResponse } from 'next/server';
import { getBalance, haveKeys, type AccountBalance } from '@/lib/truelayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { accessToken, accountIds } -> { balances: [{accountId, available, current, currency}] }
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
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getBalance(body.accessToken as string, id);
        } catch {
          return null;
        }
      }),
    );
    const balances = results.filter((b): b is AccountBalance => b !== null);
    return NextResponse.json({ balances });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
