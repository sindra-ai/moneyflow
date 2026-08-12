import { NextResponse } from 'next/server';
import { accessToken, getAccountDetails, getRequisition, haveKeys } from '@/lib/gocardless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { requisitionId } -> { status, accounts: [{id,name,iban,currency}] }
// Call after the user returns from the bank. status 'LN' = linked/ready.
export async function POST(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  let body: { requisitionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!body.requisitionId) {
    return NextResponse.json({ error: 'Missing requisitionId' }, { status: 400 });
  }
  try {
    const token = await accessToken();
    const req0 = await getRequisition(token, body.requisitionId);
    const accounts = await Promise.all(
      req0.accounts.map(async (id) => {
        try {
          return await getAccountDetails(token, id);
        } catch {
          return { id, name: 'Account' };
        }
      }),
    );
    return NextResponse.json({ status: req0.status, accounts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
