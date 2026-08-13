import { NextResponse } from 'next/server';
import { getPrice, getSeries } from '@/lib/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANGES = new Set(['1mo', '3mo', '6mo', '1y', '2y', '5y']);

// POST { symbol, range? } -> { price } or, with range, { price, closes } (Yahoo).
export async function POST(req: Request) {
  let body: { symbol?: string; range?: string };
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
  if (body.range && RANGES.has(body.range)) {
    const s = await getSeries(symbol, body.range);
    if (s.price == null && s.closes.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 502 });
    }
    return NextResponse.json(s);
  }
  const price = await getPrice(symbol);
  if (price == null) return NextResponse.json({ error: 'No price available' }, { status: 502 });
  return NextResponse.json({ price });
}
