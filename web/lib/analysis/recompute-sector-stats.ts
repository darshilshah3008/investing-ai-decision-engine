// Orchestrator for the sector-stats recompute job.
//
// Reads every `universe/{ticker}` row + its corresponding `verdicts/{ticker}`,
// groups them by sector, computes percentile breakpoints, and writes one
// `sectorStats/{sectorKey}` document per cohort (plus a Broad Market fallback).
//
// Stale cohorts (sectors that no longer have any tickers) are deleted in the
// same pass so the collection doesn't accumulate dead docs across schema
// changes.
//
// This module deliberately uses a minimal `FirestoreLike` interface rather
// than firebase-admin's `Firestore` type so the orchestration logic is unit
// testable with an in-memory fake. The route handler casts the real admin db
// to this shape — the relevant methods (collection/doc/get/set/delete) are
// structurally compatible.

import {
  BROAD_MARKET,
  computeSectorStats,
  type SectorStats,
  type SectorStatsInput,
} from "./sector-stats.ts";
import type { VerdictDoc } from "./types.ts";

// ─── Minimal Firestore shape ───────────────────────────────────────────

export interface DocSnapshotLike {
  id: string;
  exists: boolean;
  data(): unknown;
}

export interface QuerySnapshotLike {
  docs: DocSnapshotLike[];
}

export interface DocRefLike {
  get(): Promise<DocSnapshotLike>;
  set(data: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface CollectionRefLike {
  get(): Promise<QuerySnapshotLike>;
  doc(id: string): DocRefLike;
}

export interface FirestoreLike {
  collection(name: string): CollectionRefLike;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Firestore document IDs cannot contain `/` and must not be `.` / `..`.
 * Sector names from Yahoo are clean today ("Technology", "Financial Services"),
 * but a defensive substitution costs nothing and protects against future
 * upstream changes.
 */
export function encodeSectorKey(sector: string): string {
  return sector.replace(/\//g, "-").replace(/^\.+$/, "_");
}

interface UniverseRow {
  ticker: string;
  sector: string | null;
}

function parseUniverseRow(snap: DocSnapshotLike): UniverseRow | null {
  const data = snap.data() as { ticker?: string; sector?: string | null } | undefined;
  if (!data?.ticker) return null;
  return {
    ticker: data.ticker.toUpperCase(),
    sector: typeof data.sector === "string" ? data.sector : null,
  };
}

function isUsableVerdict(doc: unknown): doc is VerdictDoc {
  if (!doc || typeof doc !== "object") return false;
  const v = doc as Partial<VerdictDoc>;
  return (
    typeof v.ticker === "string" &&
    Array.isArray(v.pillars) &&
    Array.isArray(v.models) &&
    typeof v.totalScore === "number"
  );
}

/**
 * Hydrate VerdictDocs for an array of tickers, in chunks to avoid firing
 * hundreds of simultaneous Firestore reads.
 */
async function hydrateVerdicts(
  db: FirestoreLike,
  rows: UniverseRow[],
  chunkSize: number,
): Promise<SectorStatsInput[]> {
  const verdictsCol = db.collection("verdicts");
  const out: SectorStatsInput[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const fetched = await Promise.all(
      chunk.map(async (row) => {
        const snap = await verdictsCol.doc(row.ticker).get();
        if (!snap.exists) return null;
        const data = snap.data() as { verdict?: unknown } | undefined;
        const verdict = data?.verdict;
        if (!isUsableVerdict(verdict)) return null;
        return { sector: row.sector, doc: verdict };
      }),
    );
    for (const x of fetched) if (x) out.push(x);
  }
  return out;
}

// ─── Result shape ──────────────────────────────────────────────────────

export interface RecomputeResult {
  universeRowsScanned: number;
  verdictsHydrated: number;
  /** sectors → sample size, including BROAD_MARKET. */
  sectors: Record<string, number>;
  written: number;
  deleted: number;
  durationMs: number;
}

// ─── Main orchestration ────────────────────────────────────────────────

/**
 * Run the recompute pipeline against a Firestore instance.
 *
 * @param db - any implementation of FirestoreLike
 * @param options.chunkSize - parallel verdict reads per batch (default 25)
 * @param options.now - injected timestamp for deterministic tests
 */
export async function runRecomputeSectorStats(
  db: FirestoreLike,
  options: { chunkSize?: number; now?: number } = {},
): Promise<RecomputeResult> {
  const t0 = Date.now();
  const chunkSize = options.chunkSize ?? 25;
  const now = options.now ?? Date.now();

  // 1. Read universe rows
  const universeSnap = await db.collection("universe").get();
  const rows: UniverseRow[] = [];
  for (const doc of universeSnap.docs) {
    const row = parseUniverseRow(doc);
    if (row) rows.push(row);
  }

  // 2. Hydrate verdicts
  const inputs = await hydrateVerdicts(db, rows, chunkSize);

  // 3. Compute breakpoints
  const stats = computeSectorStats(inputs, { now });

  // 4. Read existing sectorStats keys for staleness cleanup
  const existingSnap = await db.collection("sectorStats").get();
  const existingKeys = new Set(existingSnap.docs.map((d) => d.id));

  // 5. Write new docs (one per sector, BROAD_MARKET always included)
  const sectorStatsCol = db.collection("sectorStats");
  const sectorsSummary: Record<string, number> = {};
  let written = 0;

  for (const [sector, payload] of Object.entries(stats)) {
    const key = encodeSectorKey(sector);
    sectorsSummary[sector] = payload.sampleSize;
    await sectorStatsCol.doc(key).set(payload satisfies SectorStats);
    written += 1;
    existingKeys.delete(key);
  }

  // 6. Delete stale cohorts (always preserve the BROAD_MARKET key as a
  //    safety net even if it was never written this run — but in practice
  //    it always is, since computeSectorStats always emits it).
  let deleted = 0;
  for (const staleKey of existingKeys) {
    if (staleKey === encodeSectorKey(BROAD_MARKET)) continue;
    await sectorStatsCol.doc(staleKey).delete();
    deleted += 1;
  }

  return {
    universeRowsScanned: rows.length,
    verdictsHydrated: inputs.length,
    sectors: sectorsSummary,
    written,
    deleted,
    durationMs: Date.now() - t0,
  };
}
