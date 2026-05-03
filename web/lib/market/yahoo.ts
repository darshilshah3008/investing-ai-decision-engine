// Server-side Yahoo Finance quote fetch.
//
// Uses the public unofficial chart endpoint, which returns the latest
// trade price and market cap without an API key. Server-side only —
// Yahoo blocks CORS from browsers.
//
// NOTE: yfinance / Yahoo data is NOT licensed for commercial
// redistribution. Prototype-and-personal-use only. Replace with Polygon
// or Finnhub before charging users — see TECH_STACK.md §3.

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
        symbol?: string;
        marketCap?: number;
      };
    }>;
  };
}

export interface MarketSnapshot {
  ticker: string;
  price: number | null;
  prevClose: number | null;
  marketCap: number | null;
}

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, { ts: number; snap: MarketSnapshot }>();

export async function fetchSnapshot(ticker: string): Promise<MarketSnapshot> {
  const norm = ticker.toUpperCase();
  const hit = cache.get(norm);
  if (hit && Date.now() - hit.ts < PRICE_CACHE_TTL_MS) return hit.snap;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(norm)}?interval=1d&range=1d`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InvestingAIDecisionEngine/0.1; +https://github.com/)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  let snap: MarketSnapshot = { ticker: norm, price: null, prevClose: null, marketCap: null };
  if (resp.ok) {
    const data = (await resp.json()) as YahooChartResult;
    const meta = data.chart?.result?.[0]?.meta;
    if (meta) {
      snap = {
        ticker: norm,
        price: meta.regularMarketPrice ?? null,
        prevClose: meta.chartPreviousClose ?? null,
        marketCap: meta.marketCap ?? null,
      };
    }
  }
  cache.set(norm, { ts: Date.now(), snap });
  return snap;
}
