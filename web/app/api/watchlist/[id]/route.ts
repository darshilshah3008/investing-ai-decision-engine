// GET    /api/watchlist/:id  → fetch one watchlist
// PUT    /api/watchlist/:id  → update name/tickers
// DELETE /api/watchlist/:id  → remove

import {
  deleteWatchlist,
  getWatchlist,
  upsertWatchlist,
} from "@/lib/firebase/verdicts";
import { verifyAuth } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const wl = await getWatchlist(uid, id);
  if (!wl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ watchlist: wl });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json()) as {
    name?: string;
    tickers?: string[];
    weights?: Record<string, number>;
    portfolioTotal?: number;
    costBasis?: Record<string, number>;
  };
  if (!body.name || !Array.isArray(body.tickers)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await upsertWatchlist(uid, id, {
    name: body.name,
    tickers: body.tickers.map((t) => t.toUpperCase()),
    weights: body.weights,
    portfolioTotal: body.portfolioTotal,
    costBasis: body.costBasis,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await deleteWatchlist(uid, id);
  return NextResponse.json({ ok: true });
}
