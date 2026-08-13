import { NextResponse } from 'next/server';
import { getPrice } from '@/lib/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { symbol } -> { price } — latest close for a market proxy (Stooq).
export async function POST(req: Request) {
  let body: { symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const symbol = (body.symbol || '').trim();
  // Tight allowlist of characters — this value is put into an outbound URL.
  if (!symbol || !/^[A-Za-z0-9.^=-]{1,16}$/.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }
  const price = await getPrice(symbol);
  if (price == null) return NextResponse.json({ error: 'No price available' }, { status: 502 });
  return NextResponse.json({ price });
}
