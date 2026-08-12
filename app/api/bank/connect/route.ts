import { NextResponse } from 'next/server';
import { buildAuthUrl, haveKeys } from '@/lib/truelayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { redirect } -> { link }  (open `link`, pick bank, authorise)
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { redirect?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.redirect) return NextResponse.json({ error: 'Missing redirect' }, { status: 400 });
  return NextResponse.json({ link: buildAuthUrl(body.redirect) });
}
