import { NextResponse } from 'next/server';
import { exchangeCode, haveKeys } from '@/lib/truelayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { code, redirect } -> { accessToken, refreshToken, expiresAt }
// Called after the bank redirects back with ?code=. The redirect must match
// the one used to start the flow.
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { code?: string; redirect?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.code || !body.redirect) {
    return NextResponse.json({ error: 'Missing code or redirect' }, { status: 400 });
  }
  try {
    const tokens = await exchangeCode(body.code, body.redirect);
    return NextResponse.json(tokens);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
