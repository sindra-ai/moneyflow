import { NextResponse } from 'next/server';
import { admin, haveAdmin } from '@/lib/supabaseAdmin';
import { havePush, sendPush } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Someone asking for an account, from either the marketing site or the login
// screen. The request is filed in Supabase and pushed straight to the owner's
// devices, so it arrives on the phone rather than sitting in a table unread.

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'info@sindra.ai';

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';

/** Find the owner's user id so we know whose devices to push to. */
async function ownerId(db: ReturnType<typeof admin>): Promise<string | null> {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const me = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
  return me?.id ?? null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const reason = clean(body.reason, 600);
  const source = clean(body.source, 24) || 'site';

  if (name.length < 2) return NextResponse.json({ error: 'Please add your name.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'That email address looks wrong.' }, { status: 400 });
  }
  // Honeypot: real people leave this hidden field empty.
  if (clean(body.company, 40)) return NextResponse.json({ ok: true });

  if (!haveAdmin()) {
    return NextResponse.json({ error: 'Requests are not set up yet.' }, { status: 503 });
  }
  const db = admin();

  // One pending request per address, so a double tap doesn't file twice.
  const { data: existing } = await db
    .from('access_requests')
    .select('id')
    .eq('email', email)
    .eq('status', 'new')
    .limit(1);

  if (existing?.length) return NextResponse.json({ ok: true, duplicate: true });

  const { error } = await db.from('access_requests').insert({ name, email, reason, source });
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });

  // Best effort: a failed push must not fail the request the visitor just made.
  let pushed = 0;
  if (havePush()) {
    try {
      const id = await ownerId(db);
      if (id) {
        const { data: subs } = await db
          .from('push_subscriptions')
          .select('endpoint, sub')
          .eq('user_id', id);
        for (const s of subs ?? []) {
          const res = await sendPush(s.sub, {
            title: 'Access request',
            body: `${name} (${email}) asked for access.`,
            url: '/',
            tag: 'access-request',
          });
          if (res.ok) pushed += 1;
          else if (res.gone) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    } catch {
      /* the request is filed either way */
    }
  }

  return NextResponse.json({ ok: true, pushed });
}
