// GET /api/verdict/AAPL
// Server-side: fetch SEC EDGAR + Yahoo price → run engine → return
// VerdictDoc. Cached in Firestore for 24h to avoid re-running EDGAR
// for popular tickers.
//
// Query params:
//   ?refresh=1   force re-compute even if cache is fresh

import { computeVerdict } from "@/lib/analysis/classifier";
import { getCachedVerdict, setCachedVerdict } from "@/lib/firebase/verdicts";
import { fetchSnapshot } from "@/lib/market/yahoo";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // EDGAR fetches can be slow on cold start

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker?.toUpperCase();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!ticker || !/^[A-Z.\-]{1,8}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    // Cache hit (server-side)
    if (!refresh) {
      const cached = await getCachedVerdict(ticker);
      if (cached) {
        return NextResponse.json({ verdict: cached, cached: true });
      }
    }

    // Compute fresh
    const snap = await fetchSnapshot(ticker).catch(() => ({
      ticker,
      price: null,
      prevClose: null,
      marketCap: null,
      dividendYield: null,
      forwardPE: null,
      beta: null,
      sector: null,
      industry: null,
    }));
    const verdict = await computeVerdict({
      ticker,
      currentPrice: snap.price,
      marketCap: snap.marketCap,
      dividendYield: snap.dividendYield,
      forwardPE: snap.forwardPE,
      beta: snap.beta,
      sector: snap.sector,
      industry: snap.industry,
    });
    // Best-effort cache write — don't fail the request if Firebase isn't configured
    setCachedVerdict(verdict).catch(() => undefined);
    return NextResponse.json({ verdict, cached: false });
  } catch (err) {
    console.error(`/api/verdict/${ticker} error:`, err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
