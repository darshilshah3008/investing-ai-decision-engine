// GET /api/tickers
// Returns the SEC ticker master (~12K entries). Server-side fetch
// from data.sec.gov, then cached in memory for 6 hours.
//
// Response shape: { tickers: [{ cik, ticker, name }, ...] }

import { fetchTickerMaster } from "@/lib/edgar/tickers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tickers = await fetchTickerMaster();
    return NextResponse.json(
      { tickers, count: tickers.length },
      {
        headers: {
          "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    console.error("/api/tickers error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
