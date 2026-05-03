// Domain types for the analysis engine.
// Mirrors the Verdict Document schema in REQUIREMENTS.md §5A.

import type { FactPoint } from "../edgar/companyfacts";

export type Verdict = "BUY" | "HOLD" | "SELL";

export type Pillar = "Quality" | "Growth" | "Valuation" | "Sustainability";

export interface SourceRef {
  form: "10-K" | "10-Q";
  accession: string;
  filed: string; // YYYY-MM-DD
  fy?: number;
  fp?: string;
  end?: string;
}

export interface InputTrace {
  field: string;
  value: number | null;
  unit?: string;
  source: SourceRef | null;
}

/**
 * Result emitted by a single fundamental model.
 *
 * `score` is a CONTINUOUS value in [-1, +1]:
 *   +1 = strong positive signal
 *    0 = neutral / insufficient data
 *   -1 = strong negative signal
 *
 * `weight` is the model's relative importance within its pillar (default 1).
 *
 * `confidence` is in [0, 1] — how much we trust this score for *this*
 * company. Lower confidence means the inputs were partial / extrapolated.
 * Synthesis weights each model's contribution by its confidence so a
 * thinly-supported model can't dominate the verdict.
 */
export interface ModelResult {
  name: string;
  pillar: Pillar;
  score: number;          // continuous, [-1, +1]
  weight: number;         // within-pillar relative weight, default 1
  confidence: number;     // [0, 1]
  formula: string;
  inputs: InputTrace[];
  interpretation: string;
  resultText: string;
}

export interface PillarResult {
  pillar: Pillar;
  score: number;          // continuous, [-1, +1] — confidence-weighted mean of models
  pillarWeight: number;   // weight within total
  contribution: number;   // score * pillarWeight
  modelCount: number;     // how many models contributed
}

export interface VerdictDoc {
  ticker: string;
  cik: string;
  companyName: string;
  asOf: string; // ISO timestamp
  latestFiling: SourceRef | null;
  thesis: string;
  models: ModelResult[];
  pillars: PillarResult[];
  totalScore: number;     // continuous, [-1, +1]
  verdict: Verdict;
  confidence: "High" | "Medium" | "Low";
  catalysts: string[];
  risks: string[];
  sensitivity: { scenario: string; effect: number; newVerdict: Verdict }[];
  marketSnapshot: {
    price: number | null;
    marketCap: number | null;
    dividendYield: number | null; // 0-1 fraction
    forwardPE: number | null;
    trailingPE: number | null;
    beta: number | null;
    sector: string | null;
    industry: string | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    fiftyDayAverage: number | null;
    twoHundredDayAverage: number | null;
    regularMarketChangePct: number | null;
    businessSummary: string | null;
  };
  externalContext?: ExternalContext;
}

/**
 * Wall Street consensus + headlines, displayed alongside the verdict
 * but never used in the math (per REQUIREMENTS.md §5B).
 */
export interface ExternalContext {
  recommendationKey: string | null;     // "strong_buy" | "buy" | "hold" | "sell" | etc.
  recommendationMean: number | null;    // 1.0 (strong buy) - 5.0 (sell)
  numberOfAnalystOpinions: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
}

// Helper: pull the most recent fact point that came from a 10-K (annual).
export function latestAnnual(points: FactPoint[]): FactPoint | undefined {
  return points.find((p) => p.form === "10-K" && p.fp === "FY");
}

/**
 * Helper: get N most recent fiscal-year (10-K) annual values.
 * Returns them newest-first.
 */
export function lastNAnnual(points: FactPoint[], n: number): FactPoint[] {
  const annual = points.filter((p) => p.form === "10-K" && p.fp === "FY");
  // Dedupe by fy, keeping the latest-filed for each year
  const byFy = new Map<number, FactPoint>();
  for (const p of annual) {
    const existing = byFy.get(p.fy);
    if (!existing || p.filed > existing.filed) byFy.set(p.fy, p);
  }
  return Array.from(byFy.values())
    .sort((a, b) => b.fy - a.fy)
    .slice(0, n);
}

/**
 * Helper: smooth-clip a raw value into [-1, +1] using a sigmoid-ish curve.
 * Used by models that compute a continuous "amount above/below threshold"
 * and need to project it onto the score range.
 *
 * `mid` is the value mapped to score 0.
 * `unit` is the value mapped to score 1 (and `mid - unit` to -1).
 *
 * Example: score(roic_above_wacc, mid=0, unit=0.10) means
 *   roic - wacc = 0    -> score 0
 *   roic - wacc = +10pp -> score +1
 *   roic - wacc = -10pp -> score -1
 *   roic - wacc = +20pp -> score ~+0.96 (asymptotic to 1)
 */
export function tanhScore(rawValue: number, mid: number, unit: number): number {
  if (!isFinite(rawValue)) return 0;
  const x = (rawValue - mid) / unit;
  return Math.tanh(x);
}

/**
 * Build an InputTrace from a single FactPoint (most common case).
 */
export function traceFromPoint(field: string, p: FactPoint, unit = "USD"): InputTrace {
  return {
    field,
    value: p.val,
    unit,
    source: {
      form: p.form,
      accession: p.accession,
      filed: p.filed,
      fy: p.fy,
      fp: p.fp,
      end: p.end,
    },
  };
}
