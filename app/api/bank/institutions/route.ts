import { NextResponse } from 'next/server';
import { accessToken, findInstitutions, haveKeys } from '@/lib/gocardless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bank/institutions?q=halifax  -> matching UK banks to pick from
export async function GET(req: Request) {
  if (!haveKeys()) return NextResponse.json({ needsKeys: true });
  const q = new URL(req.url).searchParams.get('q') || 'halifax';
  try {
    const token = await accessToken();
    const institutions = await findInstitutions(token, q);
    return NextResponse.json({ institutions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
