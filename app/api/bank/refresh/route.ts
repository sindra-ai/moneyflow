import { NextResponse } from 'next/server';
import { haveKeys, refreshTokens } from '@/lib/truelayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { refreshToken } -> fresh { accessToken, refreshToken, expiresAt }
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.refreshToken) return NextResponse.json({ error: 'Missing refreshToken' }, { status: 400 });
  try {
    return NextResponse.json(await refreshTokens(body.refreshToken));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
