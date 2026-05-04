// POST /api/admin/recompute-sector-stats
//
// Reads every universe/{ticker} + verdicts/{ticker} document, computes
// percentile breakpoints per sector, and writes them to sectorStats/{key}.
//
// Authenticated by ADMIN_SEED_TOKEN (same shared secret as seed-universe).
// Called by the GitHub Actions weekly cron after the seed loop completes.
//
// Returns diagnostic counts so the caller can confirm the run was sane.

import { runRecomputeSectorStats, type FirestoreLike } from "@/lib/analysis/recompute-sector-stats";
import { getAdmin } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const { db } = getAdmin();
  if (!db) {
    return NextResponse.json({ error: "Firestore not configured" }, { status: 500 });
  }

  try {
    // firebase-admin's Firestore is structurally compatible with our minimal
    // shape — its collection/doc/get/set/delete methods match. Cast at the
    // boundary so the orchestration logic stays decoupled and testable.
    const result = await runRecomputeSectorStats(db as unknown as FirestoreLike);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
