import { NextResponse } from 'next/server';
import { admin, haveAdmin } from '@/lib/supabaseAdmin';
import { havePush, sendPush } from '@/lib/pushServer';
import { ordinal } from '@/lib/format';
import type { Store } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW = 2; // days out that count as "due soon"

// Vercel Cron hits this daily (GET). Sends a push to each user's devices for
// their unpaid bills due within WINDOW days. Deploy-safe: no-ops until the
// VAPID + service-role env vars are set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  if (!haveAdmin() || !havePush()) {
    return NextResponse.json({ skipped: 'not configured' });
  }

  const db = admin();
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const today = now.getUTCDate();

  const { data: rows, error } = await db.from('user_state').select('user_id, data');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let usersNotified = 0;

  for (const row of rows ?? []) {
    const store = row.data as Store | undefined;
    const month = store?.months?.[key];
    if (!month) continue;
    const soon = month.items.filter(
      (it) => !it.paid && it.dueDay != null && it.dueDay >= today && it.dueDay <= today + WINDOW,
    );
    if (soon.length === 0) continue;

    const title = soon.length === 1 ? `${soon[0].name} due soon` : `${soon.length} bills due soon`;
    const body =
      soon.length === 1
        ? `£${soon[0].amount} · due the ${ordinal(soon[0].dueDay as number)}`
        : soon.map((i) => i.name).join(', ');

    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, sub')
      .eq('user_id', row.user_id);
    if (!subs?.length) continue;

    let notified = false;
    for (const s of subs) {
      const res = await sendPush(s.sub, { title, body, url: '/', tag: 'due-soon' });
      if (res.ok) {
        sent += 1;
        notified = true;
      } else if (res.gone) {
        await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
    if (notified) usersNotified += 1;
  }

  return NextResponse.json({ ok: true, usersNotified, sent });
}
