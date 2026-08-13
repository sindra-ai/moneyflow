'use client';

/** Client helper: fetch a market proxy's latest price, cached per symbol for a
 *  few hours (index prices only move once a day). */

const KEY = 'moneyflow:market';
const TTL = 3 * 60 * 60 * 1000; // 3 hours

type Cache = Record<string, { at: number; price?: number; closes?: [number, number][] }>;

function read(): Cache {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Cache;
  } catch {
    return {};
  }
}

/** Daily close history for a symbol, cached per symbol+range for a few hours. */
export async function fetchSeries(
  symbol: string,
  range = '6mo',
): Promise<[number, number][]> {
  const ck = `series:${symbol}:${range}`;
  const cache = read();
  const hit = cache[ck];
  if (hit?.closes && Date.now() - hit.at < TTL) return hit.closes;
  try {
    const res = await fetch('/api/market', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol, range }),
    });
    const data = (await res.json()) as { closes?: [number, number][] };
    if (Array.isArray(data.closes)) {
      cache[ck] = { closes: data.closes, at: Date.now() };
      try {
        localStorage.setItem(KEY, JSON.stringify(cache));
      } catch {
        /* ignore */
      }
      return data.closes;
    }
    return hit?.closes ?? [];
  } catch {
    return hit?.closes ?? [];
  }
}

export async function fetchPrice(symbol: string): Promise<number | null> {
  const cache = read();
  const hit = cache[symbol];
  if (hit?.price != null && Date.now() - hit.at < TTL) return hit.price;
  try {
    const res = await fetch('/api/market', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    const data = (await res.json()) as { price?: number };
    if (typeof data.price === 'number') {
      cache[symbol] = { price: data.price, at: Date.now() };
      try {
        localStorage.setItem(KEY, JSON.stringify(cache));
      } catch {
        /* ignore */
      }
      return data.price;
    }
    return hit?.price ?? null; // fall back to a stale price if the fetch failed
  } catch {
    return hit?.price ?? null;
  }
}
