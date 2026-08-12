import { NextResponse } from 'next/server';
import { accessToken, createRequisition, haveKeys } from '@/lib/gocardless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { institutionId, redirect } -> { requisitionId, link }
// The user opens `link`, authenticates with their bank, and is sent back to
// `redirect`. We then read the accounts via /api/bank/accounts.
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { institutionId?: string; redirect?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.institutionId || !body.redirect) {
    return NextResponse.json({ error: 'Missing institutionId or redirect' }, { status: 400 });
  }
  try {
    const token = await accessToken();
    const reference = `mf-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const { id, link } = await createRequisition(
      token,
      body.institutionId,
      body.redirect,
      reference,
    );
    return NextResponse.json({ requisitionId: id, link });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
