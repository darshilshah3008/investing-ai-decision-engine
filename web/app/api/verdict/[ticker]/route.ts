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
import { captureServerError } from "@/lib/observability";
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
    const snap = await fetchSnapshot(ticker).catch(() => null);
    const verdict = await computeVerdict({
      ticker,
      currentPrice: snap?.price ?? null,
      marketCap: snap?.marketCap ?? null,
      dividendYield: snap?.dividendYield ?? null,
      forwardPE: snap?.forwardPE ?? null,
      trailingPE: snap?.trailingPE ?? null,
      beta: snap?.beta ?? null,
      sector: snap?.sector ?? null,
      industry: snap?.industry ?? null,
      fiftyTwoWeekHigh: snap?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: snap?.fiftyTwoWeekLow ?? null,
      fiftyDayAverage: snap?.fiftyDayAverage ?? null,
      twoHundredDayAverage: snap?.twoHundredDayAverage ?? null,
      regularMarketChangePct: snap?.regularMarketChangePct ?? null,
      businessSummary: snap?.businessSummary ?? null,
    });
    // Best-effort cache write — don't fail the request if Firebase isn't configured
    setCachedVerdict(verdict).catch(() => undefined);
    return NextResponse.json({ verdict, cached: false });
  } catch (err) {
    // Log the full error server-side for Vercel function logs / Sentry,
    // but never leak stack traces, internal URLs, or transport-layer
    // errors (e.g. ECONNRESET) to clients.
    captureServerError(err, { route: "/api/verdict", extra: { ticker } });
    const message = err instanceof Error ? err.message : String(err);
    const isUpstreamData = /EDGAR|companyfacts|fetch|ECONN|ETIMEDOUT|ENOTFOUND/i.test(
      message,
    );
    const isMissingTicker = /not found|404|no .*data/i.test(message);
    return NextResponse.json(
      {
        error: isMissingTicker
          ? `We couldn't find filings for ${ticker}. Double-check the ticker symbol and try again.`
          : isUpstreamData
            ? "Couldn't load data for this ticker right now. Please try again in a moment."
            : "Something went wrong while running the engine. Please try again.",
      },
      { status: isMissingTicker ? 404 : 500 },
    );
  }
}
