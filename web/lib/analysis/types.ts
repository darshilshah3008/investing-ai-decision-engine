// Domain types for the analysis engine.
// Mirrors the Verdict Document schema in REQUIREMENTS.md §5A.

import type { FactPoint } from "../edgar/companyfacts";

export type Verdict = "BUY" | "HOLD" | "SELL";
export type SubScore = -2 | -1 | 0 | 1 | 2;

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

export interface ModelResult {
  name: string;
  pillar: "Quality" | "Growth" | "Valuation";
  subScore: SubScore;
  formula: string;
  inputs: InputTrace[];
  interpretation: string;
  resultText: string;
}

export interface VerdictDoc {
  ticker: string;
  cik: string;
  companyName: string;
  asOf: string; // ISO timestamp
  latestFiling: SourceRef | null;
  thesis: string;
  models: ModelResult[];
  totalScore: number;
  verdict: Verdict;
  confidence: "High" | "Medium" | "Low";
  catalysts: string[];
  risks: string[];
  sensitivity: { scenario: string; effect: number; newVerdict: Verdict }[];
  marketSnapshot: {
    price: number | null;
    marketCap: number | null;
  };
}

// Helper: pull the most recent fact point that came from a 10-K (annual).
export function latestAnnual(points: FactPoint[]): FactPoint | undefined {
  return points.find((p) => p.form === "10-K" && p.fp === "FY");
}
