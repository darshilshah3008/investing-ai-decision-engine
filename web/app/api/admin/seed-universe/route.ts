// POST /api/admin/seed-universe
//
// Triggers a single-batch universe seed run. Authenticated by a shared
// secret (env var ADMIN_SEED_TOKEN). Called by GitHub Actions on a
// weekly cron.
//
// Body params (JSON):
//   { tickers?: string[], limit?: number }
//
// If `tickers` is supplied we run that exact list. Otherwise we use the
// S&P 500 default. `limit` caps the count (useful for partial runs that
// fit inside Vercel's 60s function timeout — call repeatedly to walk
// through the full list).

import { computeVerdict } from "@/lib/analysis/classifier";
import { getAdmin } from "@/lib/firebase/admin";
import { fetchSnapshot } from "@/lib/market/yahoo";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same S&P 500 default as scripts/seed-universe.mjs (kept short here for
// the cron's one-shot batches). Cron should rotate through this list
// across multiple invocations.
const DEFAULT_BATCH = [
  "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK.B","UNH","JPM",
  "V","XOM","JNJ","PG","MA","AVGO","HD","CVX","MRK","LLY",
];

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Server not configured for admin operations (ADMIN_SEED_TOKEN unset)" },
      { status: 500 },
    );
  }
  const got = req.headers.get("x-admin-token");
  if (!got || got !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    tickers?: string[];
    limit?: number;
  };

  const list = (body.tickers ?? DEFAULT_BATCH)
    .map((t) => t.toUpperCase())
    .slice(0, body.limit ?? 25); // hard-cap per request to fit in 60s

  const { db } = getAdmin();
  if (!db) {
    return NextResponse.json({ error: "Firestore not configured" }, { status: 500 });
  }

  const results: Array<{
    ticker: string;
    ok: boolean;
    verdict?: string;
    error?: string;
  }> = [];

  for (const ticker of list) {
    try {
      const snap = await fetchSnapshot(ticker);
      const v = await computeVerdict({
        ticker,
        currentPrice: snap.price,
        marketCap: snap.marketCap,
        dividendYield: snap.dividendYield,
        forwardPE: snap.forwardPE,
        trailingPE: snap.trailingPE,
        beta: snap.beta,
        sector: snap.sector,
        industry: snap.industry,
        fiftyTwoWeekHigh: snap.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: snap.fiftyTwoWeekLow,
        fiftyDayAverage: snap.fiftyDayAverage,
        twoHundredDayAverage: snap.twoHundredDayAverage,
        regularMarketChangePct: snap.regularMarketChangePct,
        businessSummary: snap.businessSummary,
      });
      await db.collection("universe").doc(ticker).set({
        ticker: v.ticker,
        companyName: v.companyName,
        cik: v.cik,
        verdict: v.verdict,
        totalScore: v.totalScore,
        price: v.marketSnapshot.price,
        marketCap: v.marketSnapshot.marketCap,
        dividendYield: v.marketSnapshot.dividendYield,
        forwardPE: v.marketSnapshot.forwardPE,
        sector: v.marketSnapshot.sector,
        industry: v.marketSnapshot.industry,
        computedAt: Date.now(),
      });
      results.push({ ticker, ok: true, verdict: v.verdict });
    } catch (err) {
      results.push({
        ticker,
        ok: false,
        error: String(err instanceof Error ? err.message : err),
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
