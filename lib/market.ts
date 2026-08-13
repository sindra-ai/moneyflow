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
