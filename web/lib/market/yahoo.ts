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
        trailingPE?: YahooQuoteSummaryRaw<number>;
        marketCap?: YahooQuoteSummaryRaw<number>;
        beta?: YahooQuoteSummaryRaw<number>;
        fiftyTwoWeekHigh?: YahooQuoteSummaryRaw<number>;
        fiftyTwoWeekLow?: YahooQuoteSummaryRaw<number>;
        fiftyDayAverage?: YahooQuoteSummaryRaw<number>;
        twoHundredDayAverage?: YahooQuoteSummaryRaw<number>;
      };
      assetProfile?: {
        sector?: string;
        industry?: string;
        longBusinessSummary?: string;
      };
      price?: {
        regularMarketPrice?: YahooQuoteSummaryRaw<number>;
        regularMarketChangePercent?: YahooQuoteSummaryRaw<number>;
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
  trailingPE: number | null;
  beta: number | null;
  sector: string | null;
  industry: string | null;
  /** 52-week high / low — useful for range bars on the verdict screen */
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /** 50-day and 200-day moving averages for trend context */
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  /** Today's percentage change vs previous close */
  regularMarketChangePct: number | null;
  /** Plain-English company description (for the verdict screen) */
  businessSummary: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, { ts: number; snap: MarketSnapshot }>();

// Yahoo started enforcing crumb authentication on quoteSummary in 2023.
// Without crumb, the v10 endpoint returns 401 / "Invalid Cookie". With
// crumb (and the matching cookie), it works fine.
//
// Flow: hit fc.yahoo.com to get a cookie, then /v1/test/getcrumb to get
// the crumb value. Both are cached for 1 hour.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

let crumbCache: { cookie: string; crumb: string; ts: number } | null = null;
const CRUMB_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
    return { cookie: crumbCache.cookie, crumb: crumbCache.crumb };
  }
  try {
    // Step 1: hit fc.yahoo.com to get session cookies
    const cookieResp = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
    });
    const setCookieHeader = cookieResp.headers.get("set-cookie");
    if (!setCookieHeader) {
      console.warn("[yahoo] no set-cookie from fc.yahoo.com");
      return null;
    }
    // Multiple cookies are comma-separated; we want all of them flattened
    // to a "name=value; name=value" header value.
    const cookie = setCookieHeader
      .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
      .map((s) => s.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    // Step 2: get a crumb using the cookie
    const crumbResp = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: {
          "User-Agent": UA,
          Cookie: cookie,
          Accept: "*/*",
        },
      },
    );
    if (!crumbResp.ok) {
      console.warn(`[yahoo] crumb request failed: ${crumbResp.status}`);
      return null;
    }
    const crumb = (await crumbResp.text()).trim();
    if (!crumb || crumb.length < 5 || crumb.includes("<")) {
      console.warn("[yahoo] crumb response looked invalid");
      return null;
    }
    crumbCache = { cookie, crumb, ts: Date.now() };
    return { cookie, crumb };
  } catch (err) {
    console.error("[yahoo] crumb error:", err);
    return null;
  }
}

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

type QuoteSummaryFields = Pick<
  MarketSnapshot,
  | "marketCap"
  | "dividendYield"
  | "forwardPE"
  | "trailingPE"
  | "beta"
  | "sector"
  | "industry"
  | "price"
  | "fiftyTwoWeekHigh"
  | "fiftyTwoWeekLow"
  | "fiftyDayAverage"
  | "twoHundredDayAverage"
  | "regularMarketChangePct"
  | "businessSummary"
>;

const EMPTY_QS: QuoteSummaryFields = {
  marketCap: null,
  dividendYield: null,
  forwardPE: null,
  trailingPE: null,
  beta: null,
  sector: null,
  industry: null,
  price: null,
  fiftyTwoWeekHigh: null,
  fiftyTwoWeekLow: null,
  fiftyDayAverage: null,
  twoHundredDayAverage: null,
  regularMarketChangePct: null,
  businessSummary: null,
};

async function fetchQuoteSummary(ticker: string): Promise<QuoteSummaryFields> {
  // Need a crumb for v10 quoteSummary in 2024+. Without it, Yahoo
  // returns 401 "Invalid Cookie".
  const auth = await getCrumb();
  if (!auth) {
    console.warn(`[yahoo] no crumb available, skipping quoteSummary for ${ticker}`);
    return EMPTY_QS;
  }

  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=summaryDetail,assetProfile,price,defaultKeyStatistics` +
    `&crumb=${encodeURIComponent(auth.crumb)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Cookie: auth.cookie,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!resp.ok) {
      // Crumb may have expired — invalidate and let the next call retry
      if (resp.status === 401 || resp.status === 403) {
        crumbCache = null;
      }
      console.warn(`[yahoo] quoteSummary ${ticker}: HTTP ${resp.status}`);
      return EMPTY_QS;
    }
    const data = (await resp.json()) as YahooQuoteSummaryResult;
    const result = data.quoteSummary?.result?.[0];
    if (!result) {
      console.warn(`[yahoo] quoteSummary ${ticker}: empty result`);
      return EMPTY_QS;
    }
    return {
      marketCap: result.summaryDetail?.marketCap?.raw ?? null,
      dividendYield: result.summaryDetail?.dividendYield?.raw ?? null,
      forwardPE: result.summaryDetail?.forwardPE?.raw ?? null,
      trailingPE: result.summaryDetail?.trailingPE?.raw ?? null,
      beta: result.summaryDetail?.beta?.raw ?? null,
      sector: result.assetProfile?.sector ?? null,
      industry: result.assetProfile?.industry ?? null,
      price: result.price?.regularMarketPrice?.raw ?? null,
      fiftyTwoWeekHigh: result.summaryDetail?.fiftyTwoWeekHigh?.raw ?? null,
      fiftyTwoWeekLow: result.summaryDetail?.fiftyTwoWeekLow?.raw ?? null,
      fiftyDayAverage: result.summaryDetail?.fiftyDayAverage?.raw ?? null,
      twoHundredDayAverage:
        result.summaryDetail?.twoHundredDayAverage?.raw ?? null,
      regularMarketChangePct:
        result.price?.regularMarketChangePercent?.raw ?? null,
      businessSummary: result.assetProfile?.longBusinessSummary ?? null,
    };
  } catch (err) {
    console.error(`[yahoo] quoteSummary ${ticker} error:`, err);
    return EMPTY_QS;
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
    trailingPE: summary.trailingPE,
    beta: summary.beta,
    sector: summary.sector,
    industry: summary.industry,
    fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: summary.fiftyTwoWeekLow,
    fiftyDayAverage: summary.fiftyDayAverage,
    twoHundredDayAverage: summary.twoHundredDayAverage,
    regularMarketChangePct: summary.regularMarketChangePct,
    businessSummary: summary.businessSummary,
  };
  cache.set(norm, { ts: Date.now(), snap });
  return snap;
}
