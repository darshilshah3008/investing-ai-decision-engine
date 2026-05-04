// Sector-relative percentile statistics.
//
// A 12% ROIC is excellent for a utility, mediocre for a software company.
// This module computes percentile breakpoints (p10/p25/p50/p75/p90) for every
// model + pillar + total score, grouped by sector, so the verdict UI can
// render "78th percentile vs Technology peers" instead of context-free numbers.
//
// Pure functions only — no Firestore, no I/O. The admin job composes this with
// `verdicts/*` reads to produce `sectorStats/{sector}` documents.
//
// Key design choices:
//   • We store breakpoints, not the raw distribution. Each sector doc is ~2KB.
//   • `BROAD_MARKET` always contains every ticker, so it's a valid fallback
//     even for companies whose sector has too few peers.
//   • Sectors below MIN_SAMPLE_SIZE are still computed, but the verdict-build
//     step should fall back to BROAD_MARKET when consumed.
//   • Percentile rank is interpolated from the 5 breakpoints — lossy but fine
//     for a UI label like "78th pct".

import type { Pillar, VerdictDoc } from "./types";

/** Minimum peer count to trust a sector-specific cohort. */
export const MIN_SAMPLE_SIZE = 20;

/** Cohort label used when sector is unknown or too thin. */
export const BROAD_MARKET = "Broad Market";

/**
 * Bumped in lockstep with `verdicts.ts → CURRENT_SCHEMA_VERSION`. Old
 * sectorStats docs become invisible to readers and get recomputed on the
 * next admin run.
 */
export const SECTOR_STATS_SCHEMA_VERSION = 1;

export interface Breakpoints {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SectorStats {
  /** Either the Yahoo sector name (canonicalized) or BROAD_MARKET. */
  sector: string;
  computedAt: number;
  schemaVersion: number;
  /** How many tickers contributed to this sector's distributions. */
  sampleSize: number;
  /** Map keyed by `ModelResult.name` (e.g. "FCF Yield"). */
  models: Record<string, Breakpoints>;
  /** All four pillars are always present even if some are sparse. */
  pillars: Record<Pillar, Breakpoints>;
  totalScore: Breakpoints;
}

/**
 * Firestore document IDs cannot contain `/` and cannot be `.` or `..`.
 * Yahoo sector strings are clean today ("Technology", "Financial Services"),
 * but a defensive substitution costs nothing and protects against any future
 * upstream weirdness.
 */
export function encodeSectorKey(sector: string): string {
  return sector.replace(/\//g, "-").replace(/^\.+$/, "_");
}

/**
 * Normalizes Yahoo-provided sector strings:
 *   • trims and collapses whitespace
 *   • null / empty / "n/a" → BROAD_MARKET
 *   • preserves original casing for known sectors
 */
export function normalizeSector(raw: string | null | undefined): string {
  if (raw == null) return BROAD_MARKET;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return BROAD_MARKET;
  if (trimmed.toLowerCase() === "n/a") return BROAD_MARKET;
  return trimmed;
}

/**
 * Type-7 (R default) linear-interpolation quantile.
 * `q` ∈ [0,1]. Input must be sorted ascending. Empty array → 0.
 */
export function quantile(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0]!;
  const clamped = Math.max(0, Math.min(1, q));
  const pos = clamped * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = pos - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
}

function buildBreakpoints(values: number[]): Breakpoints | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
  };
}

const FLAT_BREAKPOINTS: Breakpoints = {
  p10: 0,
  p25: 0,
  p50: 0,
  p75: 0,
  p90: 0,
};

/**
 * Where `value` sits relative to a 5-point breakpoint distribution, 0–100.
 *
 *   ≤ p10:                    interpolate [0, 10] over [-1, p10]
 *   p10 < v ≤ p25:            interpolate [10, 25] over [p10, p25]
 *   p25 < v ≤ p50:            interpolate [25, 50] over [p25, p50]
 *   p50 < v ≤ p75:            interpolate [50, 75] over [p50, p75]
 *   p75 < v ≤ p90:            interpolate [75, 90] over [p75, p90]
 *   > p90:                    interpolate [90, 100] over [p90, +1]
 *
 * Degenerate breakpoints (consecutive equal values) collapse the segment.
 */
export function percentileRank(value: number, bp: Breakpoints): number {
  if (!Number.isFinite(value)) return 50;

  const segments: Array<{ from: number; to: number; rankFrom: number; rankTo: number }> = [
    { from: -1, to: bp.p10, rankFrom: 0, rankTo: 10 },
    { from: bp.p10, to: bp.p25, rankFrom: 10, rankTo: 25 },
    { from: bp.p25, to: bp.p50, rankFrom: 25, rankTo: 50 },
    { from: bp.p50, to: bp.p75, rankFrom: 50, rankTo: 75 },
    { from: bp.p75, to: bp.p90, rankFrom: 75, rankTo: 90 },
    { from: bp.p90, to: 1, rankFrom: 90, rankTo: 100 },
  ];

  if (value <= -1) return 0;
  if (value >= 1) return 100;

  for (const seg of segments) {
    if (value <= seg.to) {
      const span = seg.to - seg.from;
      if (span <= 0) return seg.rankTo;
      const frac = (value - seg.from) / span;
      return seg.rankFrom + frac * (seg.rankTo - seg.rankFrom);
    }
  }
  return 100;
}

/**
 * Input shape for the compute step. The admin job hydrates each universe row
 * with its full VerdictDoc and pairs it with the sector taken from the
 * verdict's marketSnapshot (or the universe row's sector field).
 */
export interface SectorStatsInput {
  sector: string | null;
  doc: VerdictDoc;
}

const ALL_PILLARS: Pillar[] = ["Quality", "Growth", "Valuation", "Sustainability"];

interface Bucket {
  totalScores: number[];
  pillarScores: Record<Pillar, number[]>;
  modelScores: Record<string, number[]>;
  tickers: Set<string>;
}

function newBucket(): Bucket {
  return {
    totalScores: [],
    pillarScores: {
      Quality: [],
      Growth: [],
      Valuation: [],
      Sustainability: [],
    },
    modelScores: {},
    tickers: new Set(),
  };
}

function addToBucket(bucket: Bucket, doc: VerdictDoc): void {
  if (bucket.tickers.has(doc.ticker)) return; // dedupe
  bucket.tickers.add(doc.ticker);

  if (Number.isFinite(doc.totalScore)) {
    bucket.totalScores.push(doc.totalScore);
  }

  for (const p of doc.pillars ?? []) {
    if (Number.isFinite(p.score)) {
      bucket.pillarScores[p.pillar]?.push(p.score);
    }
  }

  for (const m of doc.models ?? []) {
    if (!Number.isFinite(m.score)) continue;
    const arr = bucket.modelScores[m.name] ?? (bucket.modelScores[m.name] = []);
    arr.push(m.score);
  }
}

function bucketToStats(bucket: Bucket, sector: string, computedAt: number): SectorStats {
  const pillars = {} as Record<Pillar, Breakpoints>;
  for (const pillar of ALL_PILLARS) {
    pillars[pillar] = buildBreakpoints(bucket.pillarScores[pillar]) ?? FLAT_BREAKPOINTS;
  }

  const models: Record<string, Breakpoints> = {};
  for (const [name, scores] of Object.entries(bucket.modelScores)) {
    const bp = buildBreakpoints(scores);
    if (bp) models[name] = bp;
  }

  return {
    sector,
    computedAt,
    schemaVersion: SECTOR_STATS_SCHEMA_VERSION,
    sampleSize: bucket.tickers.size,
    models,
    pillars,
    totalScore: buildBreakpoints(bucket.totalScores) ?? FLAT_BREAKPOINTS,
  };
}

/**
 * Group inputs by sector, build percentile breakpoints per group, and always
 * emit a BROAD_MARKET bucket containing every input. Returned map is keyed by
 * canonical sector name.
 *
 * Buckets with < MIN_SAMPLE_SIZE are still returned — the consumer chooses
 * whether to use them or fall back to BROAD_MARKET.
 */
export function computeSectorStats(
  inputs: SectorStatsInput[],
  options: { now?: number } = {},
): Record<string, SectorStats> {
  const now = options.now ?? Date.now();
  const buckets = new Map<string, Bucket>();
  const broad = newBucket();

  for (const input of inputs) {
    const sector = normalizeSector(input.sector);
    addToBucket(broad, input.doc);
    if (sector === BROAD_MARKET) continue; // already added once
    let bucket = buckets.get(sector);
    if (!bucket) {
      bucket = newBucket();
      buckets.set(sector, bucket);
    }
    addToBucket(bucket, input.doc);
  }

  const out: Record<string, SectorStats> = {
    [BROAD_MARKET]: bucketToStats(broad, BROAD_MARKET, now),
  };
  for (const [sector, bucket] of buckets) {
    out[sector] = bucketToStats(bucket, sector, now);
  }
  return out;
}

/**
 * Pick the cohort to use when ranking a single ticker. Returns the
 * sector-specific cohort if it has ≥ MIN_SAMPLE_SIZE peers; otherwise the
 * broad-market cohort. Returns null if neither is available.
 */
export function pickCohort(
  stats: Record<string, SectorStats>,
  sector: string | null | undefined,
): SectorStats | null {
  const canonical = normalizeSector(sector);
  const sectorStats = stats[canonical];
  if (sectorStats && sectorStats.sampleSize >= MIN_SAMPLE_SIZE) {
    return sectorStats;
  }
  return stats[BROAD_MARKET] ?? null;
}
