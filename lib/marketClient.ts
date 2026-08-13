'use client';

/** Client helper: fetch a market proxy's latest price, cached per symbol for a
 *  few hours (index prices only move once a day). */

const KEY = 'moneyflow:market';
const TTL = 3 * 60 * 60 * 1000; // 3 hours

type Cache = Record<string, { price: number; at: number }>;

function read(): Cache {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Cache;
  } catch {
    return {};
  }
}

export async function fetchPrice(symbol: string): Promise<number | null> {
  const cache = read();
  const hit = cache[symbol];
  if (hit && Date.now() - hit.at < TTL) return hit.price;
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
