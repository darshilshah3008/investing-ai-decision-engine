// Server-side Firestore helpers for the verdicts cache.
//
// Schema:
//   verdicts/{ticker}                 → cached VerdictDoc, refreshed daily
//   tickers/master                    → cached SEC ticker master, refreshed every 24h
//   users/{uid}/watchlists/{wid}      → user-owned watchlist

import type { VerdictDoc } from "../analysis/types";
import { getAdmin } from "./admin";

const VERDICT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function getCachedVerdict(ticker: string): Promise<VerdictDoc | null> {
  const { db } = getAdmin();
  if (!db) return null;
  const doc = await db.collection("verdicts").doc(ticker.toUpperCase()).get();
  if (!doc.exists) return null;
  const data = doc.data() as { verdict: VerdictDoc; cachedAt: number };
  if (Date.now() - data.cachedAt > VERDICT_TTL_MS) return null;
  return data.verdict;
}

export async function setCachedVerdict(verdict: VerdictDoc): Promise<void> {
  const { db } = getAdmin();
  if (!db) return;
  await db
    .collection("verdicts")
    .doc(verdict.ticker.toUpperCase())
    .set({ verdict, cachedAt: Date.now() });
}

export interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
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
  data: { name: string; tickers: string[] },
): Promise<void> {
  const { db } = getAdmin();
  if (!db) throw new Error("Firebase admin not configured");
  const ref = db.collection("users").doc(uid).collection("watchlists").doc(wid);
  const now = Date.now();
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...data, updatedAt: now });
  } else {
    await ref.set({ ...data, createdAt: now, updatedAt: now });
  }
}

export async function deleteWatchlist(uid: string, wid: string): Promise<void> {
  const { db } = getAdmin();
  if (!db) throw new Error("Firebase admin not configured");
  await db.collection("users").doc(uid).collection("watchlists").doc(wid).delete();
}
