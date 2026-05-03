// Server-side Firestore helpers for the verdicts cache.
//
// Schema:
//   verdicts/{ticker}                 → cached VerdictDoc, refreshed daily
//   tickers/master                    → cached SEC ticker master, refreshed every 24h
//   users/{uid}/watchlists/{wid}      → user-owned watchlist

import type { VerdictDoc } from "../analysis/types";
import { getAdmin } from "./admin";

const VERDICT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Bump this whenever the engine schema or scoring changes — forces all
// cached verdicts to be recomputed on next read instead of returning
// stale docs that crash the new UI.
//
// Version history:
//   1 = legacy v1 engine (subScore-based, no pillars)
//   2 = continuous-score 9-model engine (chunk 4)
//   3 = added dividendYield, sector, beta to marketSnapshot (chunk 7)
//   4 = Yahoo crumb auth for quoteSummary; previous v3 docs had null
//       marketCap/divYield/sector because the unauthenticated call
//       returned 401. Force re-fetch.
const CURRENT_SCHEMA_VERSION = 4;

export async function getCachedVerdict(ticker: string): Promise<VerdictDoc | null> {
  const { db } = getAdmin();
  if (!db) return null;
  const doc = await db.collection("verdicts").doc(ticker.toUpperCase()).get();
  if (!doc.exists) return null;
  const data = doc.data() as {
    verdict: VerdictDoc;
    cachedAt: number;
    schemaVersion?: number;
  };
  if (Date.now() - data.cachedAt > VERDICT_TTL_MS) return null;
  // Schema check — discard caches written by older engine versions.
  if ((data.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION) return null;
  // Structural checks belt-and-braces:
  // (a) v1 docs have no `pillars` array
  if (!Array.isArray(data.verdict?.pillars)) return null;
  // (b) pre-chunk-7 docs lack dividendYield in marketSnapshot
  if (
    !data.verdict?.marketSnapshot ||
    !("dividendYield" in data.verdict.marketSnapshot)
  ) {
    return null;
  }
  return data.verdict;
}

export async function setCachedVerdict(verdict: VerdictDoc): Promise<void> {
  const { db } = getAdmin();
  if (!db) return;
  await db
    .collection("verdicts")
    .doc(verdict.ticker.toUpperCase())
    .set({
      verdict,
      cachedAt: Date.now(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
}

export interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
  /**
   * Optional per-ticker portfolio weight (percentage 0-100).
   * Sum may exceed 100 (over-allocated) or fall below (cash position).
   * Stored sparsely — missing ticker means weight 0.
   */
  weights?: Record<string, number>;
  /**
   * Optional total portfolio value in USD. Combined with weights and
   * the per-position dividend yield, lets us project an annual dividend
   * income figure. Untouched if user hasn't set it.
   */
  portfolioTotal?: number;
  createdAt: number;
  updatedAt: number;
}

export async function listWatchlists(uid: string): Promise<WatchlistEntry[]> {
  const { db } = getAdmin();
  if (!db) return [];
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("watchlists")
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WatchlistEntry, "id">) }));
}

export async function getWatchlist(uid: string, wid: string): Promise<WatchlistEntry | null> {
  const { db } = getAdmin();
  if (!db) return null;
  const doc = await db
    .collection("users")
    .doc(uid)
    .collection("watchlists")
    .doc(wid)
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<WatchlistEntry, "id">) };
}

export async function upsertWatchlist(
  uid: string,
  wid: string,
  data: {
    name: string;
    tickers: string[];
    weights?: Record<string, number>;
    portfolioTotal?: number;
  },
): Promise<void> {
  const { db } = getAdmin();
  if (!db) throw new Error("Firebase admin not configured");
  const ref = db.collection("users").doc(uid).collection("watchlists").doc(wid);
  const now = Date.now();
  const existing = await ref.get();
  // Strip weights for tickers no longer in the list — keeps the doc tidy.
  const cleanedWeights: Record<string, number> = {};
  if (data.weights) {
    for (const t of data.tickers) {
      const w = data.weights[t];
      if (typeof w === "number" && w > 0) cleanedWeights[t] = w;
    }
  }
  const cleanedTotal =
    typeof data.portfolioTotal === "number" && data.portfolioTotal > 0
      ? data.portfolioTotal
      : null;
  const payload = {
    name: data.name,
    tickers: data.tickers,
    weights: cleanedWeights,
    portfolioTotal: cleanedTotal,
  };
  if (existing.exists) {
    await ref.update({ ...payload, updatedAt: now });
  } else {
    await ref.set({ ...payload, createdAt: now, updatedAt: now });
  }
}

export async function deleteWatchlist(uid: string, wid: string): Promise<void> {
  const { db } = getAdmin();
  if (!db) throw new Error("Firebase admin not configured");
  await db.collection("users").doc(uid).collection("watchlists").doc(wid).delete();
}
