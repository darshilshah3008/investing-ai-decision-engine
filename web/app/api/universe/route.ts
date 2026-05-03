// GET /api/universe?signal=BUY&search=app&limit=200
//
// Lists pre-computed verdicts from the `universe/{ticker}` collection.
// Public read (the data is non-secret cached engine output) — but the
// /universe UI page itself is gated behind tier === "pro" client-side.
//
// Optional query params:
//   signal=BUY|HOLD|SELL  filter by verdict
//   search=text           case-insensitive substring match on ticker / name
//   limit=N               max rows (default 200, cap 1000)

import { getAdmin } from "@/lib/firebase/admin";
import type { Verdict } from "@/lib/analysis/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UniverseRow {
  ticker: string;
  companyName: string;
  cik: string;
  verdict: Verdict;
  totalScore: number;
  price: number | null;
  marketCap: number | null;
  sector: string | null;
  computedAt: number;
}

export async function GET(req: NextRequest) {
  const signal = req.nextUrl.searchParams.get("signal");
  const search = req.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "200"),
    1000,
  );

  if (signal && !["BUY", "HOLD", "SELL"].includes(signal)) {
    return NextResponse.json({ error: "Invalid signal filter" }, { status: 400 });
  }

  const { db } = getAdmin();
  if (!db) {
    return NextResponse.json({
      rows: [],
      counts: { BUY: 0, HOLD: 0, SELL: 0 },
      total: 0,
    });
  }

  try {
    let q: FirebaseFirestore.Query = db.collection("universe");
    if (signal) q = q.where("verdict", "==", signal);
    q = q.limit(limit);
    const snap = await q.get();

    let rows = snap.docs.map((d) => d.data() as UniverseRow);

    // Substring search done in-memory (Firestore lacks native LIKE).
    if (search) {
      rows = rows.filter(
        (r) =>
          r.ticker.toLowerCase().includes(search) ||
          (r.companyName ?? "").toLowerCase().includes(search),
      );
    }

    // Counts across the whole universe (regardless of filter)
    const allSnap = await db
      .collection("universe")
      .select("verdict")
      .get();
    const counts = { BUY: 0, HOLD: 0, SELL: 0 };
    let total = 0;
    for (const d of allSnap.docs) {
      const v = (d.data() as { verdict: Verdict }).verdict;
      if (v === "BUY" || v === "HOLD" || v === "SELL") counts[v]++;
      total++;
    }

    return NextResponse.json({
      rows: rows.sort((a, b) => b.totalScore - a.totalScore),
      counts,
      total,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
