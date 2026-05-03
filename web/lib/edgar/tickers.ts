import { edgarFetchJson } from "./client";

// SEC company-tickers master.
// Format: { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }

interface RawTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface TickerEntry {
  cik: string; // 10-digit zero-padded
  ticker: string;
  name: string;
}

let memoCache: { ts: number; tickers: TickerEntry[] } | null = null;
const TICKER_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchTickerMaster(): Promise<TickerEntry[]> {
  if (memoCache && Date.now() - memoCache.ts < TICKER_CACHE_TTL_MS) {
    return memoCache.tickers;
  }

  const url = "https://www.sec.gov/files/company_tickers.json";
  const raw = await edgarFetchJson<Record<string, RawTickerEntry>>(url, {
    cacheKey: "ticker-master",
  });

  const tickers: TickerEntry[] = [];
  for (const v of Object.values(raw)) {
    if (!v?.cik_str || !v?.ticker) continue;
    tickers.push({
      cik: String(v.cik_str).padStart(10, "0"),
      ticker: v.ticker.toUpperCase(),
      name: v.title,
    });
  }
  memoCache = { ts: Date.now(), tickers };
  return tickers;
}

export async function findCikByTicker(ticker: string): Promise<string | null> {
  const norm = ticker.toUpperCase();
  const all = await fetchTickerMaster();
  const hit = all.find((t) => t.ticker === norm);
  return hit?.cik ?? null;
}
