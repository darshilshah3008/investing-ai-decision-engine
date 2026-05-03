// GET /api/news/AAPL?company=Apple+Inc.
// Returns recent news headlines for a ticker via Google News RSS.
//
// External context only — never used in the verdict math (per
// REQUIREMENTS.md §5B). Each item links out to the original
// publisher; we never reproduce article bodies.

import { fetchNewsForTicker } from "@/lib/news/google-news-rss";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker?.toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,8}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  const company = req.nextUrl.searchParams.get("company");
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "8"),
    20,
  );
  try {
    const items = await fetchNewsForTicker(ticker, company, limit);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err), items: [] },
      { status: 500 },
    );
  }
}
