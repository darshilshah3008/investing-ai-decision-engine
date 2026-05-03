// GET /api/verdicts?signal=BUY&limit=50
// Lists cached verdicts from Firestore, optionally filtered by signal.
//
// This powers the dashboard's "Verdict ▾" filter dropdown.
// Public — verdicts are cached engine output (non-secret).

import { getAdmin } from "@/lib/firebase/admin";
import type { Verdict, VerdictDoc } from "@/lib/analysis/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CachedVerdictRow {
  ticker: string;
  companyName: string;
  verdict: Verdict;
  totalScore: number;
  price: number | null;
  cachedAt: number;
}

export async function GET(req: NextRequest) {
  const signal = req.nextUrl.searchParams.get("signal");
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "100"),
    500,
  );

  if (signal && !["BUY", "HOLD", "SELL"].includes(signal)) {
    return NextResponse.json({ error: "Invalid signal filter" }, { status: 400 });
  }

  const { db } = getAdmin();
  if (!db) {
    return NextResponse.json({ verdicts: [], counts: { BUY: 0, HOLD: 0, SELL: 0 } });
  }

  try {
    let q = db.collection("verdicts").limit(limit);
    if (signal) {
      q = q.where("verdict.verdict", "==", signal) as typeof q;
    }
    const snap = await q.get();

    const verdicts: CachedVerdictRow[] = snap.docs.map((d) => {
      const data = d.data() as { verdict: VerdictDoc; cachedAt: number };
      return {
        ticker: data.verdict.ticker,
        companyName: data.verdict.companyName,
        verdict: data.verdict.verdict,
        totalScore: data.verdict.totalScore,
        price: data.verdict.marketSnapshot?.price ?? null,
        cachedAt: data.cachedAt,
      };
    });

    // Always return overall counts (regardless of filter) so the UI
    // chips show totals.
    const allSnap = await db
      .collection("verdicts")
      .select("verdict.verdict")
      .get();
    const counts = { BUY: 0, HOLD: 0, SELL: 0 };
    for (const d of allSnap.docs) {
      const v = (d.data() as { verdict: { verdict: Verdict } }).verdict?.verdict;
      if (v === "BUY" || v === "HOLD" || v === "SELL") counts[v]++;
    }

    return NextResponse.json({
      verdicts: verdicts.sort((a, b) => b.cachedAt - a.cachedAt),
      counts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
