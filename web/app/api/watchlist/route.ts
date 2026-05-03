// GET  /api/watchlist        → list current user's watchlists
// POST /api/watchlist        → create a new watchlist
//
// Auth required. Send the Firebase ID token in the Authorization header:
//   Authorization: Bearer <idToken>

import { listWatchlists, upsertWatchlist } from "@/lib/firebase/verdicts";
import { verifyAuth } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const watchlists = await listWatchlists(uid);
    return NextResponse.json({ watchlists });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      name?: string;
      tickers?: string[];
      weights?: Record<string, number>;
      portfolioTotal?: number;
    };
    if (!body.name || !Array.isArray(body.tickers)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const wid = `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await upsertWatchlist(uid, wid, {
      name: body.name,
      tickers: body.tickers.map((t) => t.toUpperCase()),
      weights: body.weights,
      portfolioTotal: body.portfolioTotal,
    });
    return NextResponse.json({ id: wid });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
