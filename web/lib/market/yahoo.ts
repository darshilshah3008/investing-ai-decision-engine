// Server-side Yahoo Finance fetch — price + market cap + dividend yield + sector.
//
// Uses two endpoints:
//   1. v8/finance/chart  — fast price snapshot (used during verdict compute)
//   2. v10/finance/quoteSummary — richer fields (dividend yield, sector,
//      industry, forward PE) needed for the watchlist Portfolio view.
//
// Both server-side only. Yahoo blocks CORS from browsers.
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

interface YahooQuoteSummaryRaw<T> {
  raw?: T;
  fmt?: string;
}

interface YahooQuoteSummaryResult {
  quoteSummary?: {
    result?: Array<{
      summaryDetail?: {
        dividendYield?: YahooQuoteSummaryRaw<number>;
        forwardPE?: YahooQuoteSummaryRaw<number>;
        marketCap?: YahooQuoteSummaryRaw<number>;
        beta?: YahooQuoteSummaryRaw<number>;
      };
      assetProfile?: {
        sector?: string;
        industry?: string;
      };
      price?: {
        regularMarketPrice?: YahooQuoteSummaryRaw<number>;
      };
    }>;
  };
}

export interface MarketSnapshot {
  ticker: string;
  price: number | null;
  prevClose: number | null;
  marketCap: number | null;
  dividendYield: number | null; // 0-1 fraction (0.025 = 2.5%)
  forwardPE: number | null;
  beta: number | null;
  sector: string | null;
  industry: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, { ts: number; snap: MarketSnapshot }>();

const UA =
  "Mozilla/5.0 (compatible; InvestingAIDecisionEngine/0.2; +https://github.com/)";

async function fetchChart(
  ticker: string,
): Promise<Pick<MarketSnapshot, "price" | "prevClose" | "marketCap">> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!resp.ok) return { price: null, prevClose: null, marketCap: null };
    const data = (await resp.json()) as YahooChartResult;
    const meta = data.chart?.result?.[0]?.meta;
    return {
      price: meta?.regularMarketPrice ?? null,
      prevClose: meta?.chartPreviousClose ?? null,
      marketCap: meta?.marketCap ?? null,
    };
  } catch {
    return { price: null, prevClose: null, marketCap: null };
  }
}

async function fetchQuoteSummary(
  ticker: string,
): Promise<
  Pick<
    MarketSnapshot,
    "marketCap" | "dividendYield" | "forwardPE" | "beta" | "sector" | "industry" | "price"
  >
> {
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=summaryDetail,assetProfile,price`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!resp.ok) {
      return {
        marketCap: null,
        dividendYield: null,
        forwardPE: null,
        beta: null,
        sector: null,
        industry: null,
        price: null,
      };
    }
    const data = (await resp.json()) as YahooQuoteSummaryResult;
    const result = data.quoteSummary?.result?.[0];
    return {
      marketCap: result?.summaryDetail?.marketCap?.raw ?? null,
      dividendYield: result?.summaryDetail?.dividendYield?.raw ?? null,
      forwardPE: result?.summaryDetail?.forwardPE?.raw ?? null,
      beta: result?.summaryDetail?.beta?.raw ?? null,
      sector: result?.assetProfile?.sector ?? null,
      industry: result?.assetProfile?.industry ?? null,
      price: result?.price?.regularMarketPrice?.raw ?? null,
    };
  } catch {
    return {
      marketCap: null,
      dividendYield: null,
      forwardPE: null,
      beta: null,
      sector: null,
      industry: null,
      price: null,
    };
  }
}

export async function fetchSnapshot(ticker: string): Promise<MarketSnapshot> {
  const norm = ticker.toUpperCase();
  const hit = cache.get(norm);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.snap;

  // Fire both endpoints in parallel — chart is fastest for price,
  // quoteSummary supplies the rest.
  const [chart, summary] = await Promise.all([
    fetchChart(norm),
    fetchQuoteSummary(norm),
  ]);

  const snap: MarketSnapshot = {
    ticker: norm,
    price: chart.price ?? summary.price,
    prevClose: chart.prevClose,
    marketCap: chart.marketCap ?? summary.marketCap,
    dividendYield: summary.dividendYield,
    forwardPE: summary.forwardPE,
    beta: summary.beta,
    sector: summary.sector,
    industry: summary.industry,
  };
  cache.set(norm, { ts: Date.now(), snap });
  return snap;
}
