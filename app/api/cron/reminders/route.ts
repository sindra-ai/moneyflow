import { NextResponse } from 'next/server';
import { admin, haveAdmin } from '@/lib/supabaseAdmin';
import { havePush, sendPush } from '@/lib/pushServer';
import { evaluateNotifications, type NotifyState } from '@/lib/notifications';
import type { BankTxn, Store } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron hits this daily (GET). For each user it evaluates every alert
// (bills due, large payments, income, new/pricier subscriptions, over-budget,
// weekly/monthly recaps, cashflow) and pushes to their devices. Deploy-safe:
// no-ops until the VAPID + service-role env vars are set.
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

  const { data: rows, error } = await db
    .from('user_state')
    .select('user_id, data, bank_txns, notify_state');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let usersNotified = 0;

  for (const row of rows ?? []) {
    const store = row.data as Store | undefined;
    if (!store?.months) continue;
    const txns = (row.bank_txns as BankTxn[] | null) ?? [];
    const state = (row.notify_state as NotifyState | null) ?? {};

    const { notifications, state: nextState } = evaluateNotifications({ store, txns, state, now });

    // Persist state (seeds subscription baseline, dedup) even with no sends.
    await db.from('user_state').update({ notify_state: nextState }).eq('user_id', row.user_id);
    if (!notifications.length) continue;

    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, sub')
      .eq('user_id', row.user_id);
    if (!subs?.length) continue;

    let notified = false;
    for (const n of notifications) {
      for (const s of subs) {
        const res = await sendPush(s.sub, { title: n.title, body: n.body, url: '/', tag: n.tag });
        if (res.ok) {
          sent += 1;
          notified = true;
        } else if (res.gone) {
          await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }
    if (notified) usersNotified += 1;
  }

  return NextResponse.json({ ok: true, usersNotified, sent });
}
