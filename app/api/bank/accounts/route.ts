import { NextResponse } from 'next/server';
import { getAccounts, haveKeys } from '@/lib/truelayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { accessToken } -> { accounts: [{id,name,type,currency,provider,sortLast4}] }
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.accessToken) return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
  try {
    return NextResponse.json({ accounts: await getAccounts(body.accessToken) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
