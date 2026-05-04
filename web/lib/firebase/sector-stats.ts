// Server-side reader for the sectorStats/{key} cohorts produced by the
// admin recompute job. Exposes a `pickPeerCohort` helper that encapsulates
// the "try sector first, fall back to Broad Market" rule so the classifier
// can stay decoupled from cohort policy.
//
// In-process memo cache (5 min TTL) keeps the verdict cron from re-reading
// the same handful of sector docs hundreds of times per batch.

import {
  BROAD_MARKET,
  MIN_SAMPLE_SIZE,
  encodeSectorKey,
  normalizeSector,
  type SectorStats,
} from "../analysis/sector-stats.ts";
import { getAdmin } from "./admin.ts";

/** Minimal reader contract — easy to fake in tests, easy to satisfy in prod. */
export type StatsLoader = (sectorKey: string) => Promise<SectorStats | null>;

const CACHE_TTL_MS = 5 * 60 * 1000;
const memoCache = new Map<string, { stats: SectorStats | null; cachedAt: number }>();

/** Default loader — reads sectorStats/{key} from Firestore admin. */
export async function defaultStatsLoader(sectorKey: string): Promise<SectorStats | null> {
  const cached = memoCache.get(sectorKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.stats;

  const { db } = getAdmin();
  if (!db) {
    memoCache.set(sectorKey, { stats: null, cachedAt: Date.now() });
    return null;
  }
  const doc = await db.collection("sectorStats").doc(sectorKey).get();
  const stats = doc.exists ? (doc.data() as SectorStats) : null;
  memoCache.set(sectorKey, { stats, cachedAt: Date.now() });
  return stats;
}

export interface PeerCohortResult {
  /** The cohort itself — has its own .sector and .sampleSize. */
  stats: SectorStats;
  /** Whether we got the company's own sector or fell back to Broad Market. */
  source: "sector" | "broad";
}

/**
 * Returns the right percentile cohort for a given sector:
 *   1. The sector's own cohort if it has ≥ MIN_SAMPLE_SIZE peers
 *   2. Otherwise the Broad Market cohort
 *   3. null if neither cohort exists yet (e.g. before the first cron run)
 *
 * `loader` defaults to the Firestore admin reader; tests pass a fake.
 */
export async function pickPeerCohort(
  sector: string | null | undefined,
  loader: StatsLoader = defaultStatsLoader,
): Promise<PeerCohortResult | null> {
  const canonical = normalizeSector(sector);

  if (canonical !== BROAD_MARKET) {
    const sectorStats = await loader(encodeSectorKey(canonical));
    if (sectorStats && sectorStats.sampleSize >= MIN_SAMPLE_SIZE) {
      return { stats: sectorStats, source: "sector" };
    }
  }

  const broad = await loader(encodeSectorKey(BROAD_MARKET));
  if (broad) return { stats: broad, source: "broad" };

  return null;
}

/**
 * Test-only helper. The memo cache is process-global so unit tests for the
 * default loader can reset between cases.
 */
export function _resetSectorStatsCacheForTests(): void {
  memoCache.clear();
}
