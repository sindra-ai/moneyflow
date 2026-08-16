import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { admin, haveAdmin } from '@/lib/supabaseAdmin';
import { OWNER_EMAIL } from '@/lib/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner-only. Lists pending access requests and approves or declines them.
// Approving creates the Supabase account and returns a one-time password for
// the owner to pass on, since there is no outbound email configured.

const ownerEmail = (process.env.OWNER_EMAIL || OWNER_EMAIL).toLowerCase();

/** Verify the caller's Supabase session belongs to the owner. */
async function guard(req: Request) {
  if (!haveAdmin()) return { err: NextResponse.json({ error: 'Not configured.' }, { status: 503 }) };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { err: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return { err: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  }
  if ((data.user.email || '').toLowerCase() !== ownerEmail) {
    return { err: NextResponse.json({ error: 'Not allowed.' }, { status: 403 }) };
  }
  return { db };
}

export async function GET(req: Request) {
  const { db, err } = await guard(req);
  if (err) return err;

  const { data, error } = await db!
    .from('access_requests')
    .select('id, created_at, name, email, reason, status')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

/** Readable but unguessable: 96 bits, grouped so it can be read down a phone. */
function makePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789'; // no l, 0, 1
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    if (i && i % 4 === 0) out += '-';
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function POST(req: Request) {
  const { db, err } = await guard(req);
  if (err) return err;

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const { id, action } = body;
  if (!id || (action !== 'approve' && action !== 'decline')) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const { data: row } = await db!
    .from('access_requests')
    .select('id, name, email, status')
    .eq('id', id)
    .single();

  if (!row) return NextResponse.json({ error: 'That request is gone.' }, { status: 404 });
  if (row.status !== 'new') return NextResponse.json({ error: 'Already handled.' }, { status: 409 });

  if (action === 'decline') {
    await db!.from('access_requests').update({ status: 'declined' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  const password = makePassword();
  const { error: createErr } = await db!.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true, // no confirmation mail is configured, so pre-confirm
  });

  if (createErr) {
    const already = /already|exists|registered/i.test(createErr.message);
    if (!already) return NextResponse.json({ error: createErr.message }, { status: 500 });
    // The account exists already, so the request is simply resolved.
    await db!.from('access_requests').update({ status: 'approved' }).eq('id', id);
    return NextResponse.json({ ok: true, existed: true });
  }

  await db!.from('access_requests').update({ status: 'approved' }).eq('id', id);
  return NextResponse.json({ ok: true, email: row.email, password });
}
