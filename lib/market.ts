/**
 * Server-only market price helper. Uses Yahoo Finance's public chart endpoint
 * (no API key required) to fetch the latest price for a symbol. Only used to
 * move a pension estimate with the market — never for trading or advice.
 */

/** Latest price for a ticker (e.g. 'URTH', 'SPY'), or null if unavailable. */
export async function getPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      // Prices move once a day; let the platform cache briefly.
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const price = Number(data?.chart?.result?.[0]?.meta?.regularMarketPrice);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export interface Series {
  price: number | null;
  /** [epoch-ms, close] daily points, oldest first */
  closes: [number, number][];
}

/** Daily close history for a ticker over `range` (e.g. '6mo', '1y'). */
export async function getSeries(symbol: string, range: string): Promise<Series> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=${encodeURIComponent(range)}`;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { price: null, closes: [] };
    const data = (await res.json()) as {
      chart?: {
        result?: {
          meta?: { regularMarketPrice?: number };
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const r = data?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const cl = r?.indicators?.quote?.[0]?.close ?? [];
    const closes: [number, number][] = [];
    for (let i = 0; i < ts.length; i += 1) {
      const c = cl[i];
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) closes.push([ts[i] * 1000, c]);
    }
    const price = Number(r?.meta?.regularMarketPrice);
    return { price: Number.isFinite(price) && price > 0 ? price : null, closes };
  } catch {
    return { price: null, closes: [] };
  }
}
