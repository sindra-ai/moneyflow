import { NextResponse } from 'next/server';
import { havePush, sendPush } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { subscription } -> sends a one-off test push to that subscription.
export async function POST(req: Request) {
  if (!havePush()) {
    return NextResponse.json({ error: 'Push is not configured on the server yet.' }, { status: 503 });
  }
  let body: { subscription?: { endpoint?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint) return NextResponse.json({ error: 'No subscription' }, { status: 400 });

  const res = await sendPush(sub as never, {
    title: 'MoneyFlow',
    body: '✅ Push notifications are working.',
    url: '/',
    tag: 'test',
  });
  if (!res.ok) return NextResponse.json({ error: 'Send failed', gone: res.gone }, { status: 502 });
  return NextResponse.json({ ok: true });
}
