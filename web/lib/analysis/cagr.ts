// Multi-year CAGR (Pillar: Growth).
//
// Computes 3-year and 5-year CAGRs of revenue and FCF, then averages.
// This is the *real* growth signal — not strict-quarterly trend.
//
//   CAGR_n = (V_t / V_{t-n}) ^ (1/n) − 1
//
// Continuous score [-1, +1]:
//   tanh((cagr − 5%) / 8%):
//     cagr = -10%  →  -0.97
//     cagr = -5%   →  -0.85
//     cagr =  0%   →  -0.55
//     cagr =  5%   →   0    (matches inflation, neutral)
//     cagr = 13%   →  +0.76
//     cagr = 20%   →  +0.94 (compounder)

import type { FactPoint } from "../edgar/companyfacts";
import { lastNAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

const CAGR_MID = 0.05;
const CAGR_UNIT = 0.08;

function cagr(latest: number, oldest: number, years: number): number | null {
  if (oldest <= 0 || latest <= 0 || years <= 0) return null;
  return Math.pow(latest / oldest, 1 / years) - 1;
}

export function cagrModel(args: {
  revenue: FactPoint[];
  operatingCashFlow: FactPoint[];
  capitalExpenditures: FactPoint[];
}): ModelResult {
  const revAnn = lastNAnnual(args.revenue, 6);
  const ocfAnn = lastNAnnual(args.operatingCashFlow, 6);
  const capexAnn = lastNAnnual(args.capitalExpenditures, 6);

  const inputs: InputTrace[] = [];

  // FCF series, year-aligned
  const fcfByFy = new Map<number, number>();
  for (const o of ocfAnn) {
    const cx = capexAnn.find((c) => c.fy === o.fy);
    fcfByFy.set(o.fy, o.val - (cx?.val ?? 0));
  }
  const fcfYears = Array.from(fcfByFy.keys()).sort((a, b) => b - a);

  const samples: { metric: string; cagr: number; years: number }[] = [];

  // Revenue CAGRs
  if (revAnn.length >= 4) {
    const c3 = cagr(revAnn[0].val, revAnn[3].val, 3);
    if (c3 != null) {
      samples.push({ metric: "Revenue 3y", cagr: c3, years: 3 });
      inputs.push(traceFromPoint(`Revenue FY${revAnn[0].fy}`, revAnn[0]));
      inputs.push(traceFromPoint(`Revenue FY${revAnn[3].fy}`, revAnn[3]));
    }
  }
  if (revAnn.length >= 6) {
    const c5 = cagr(revAnn[0].val, revAnn[5].val, 5);
    if (c5 != null) {
      samples.push({ metric: "Revenue 5y", cagr: c5, years: 5 });
      inputs.push(traceFromPoint(`Revenue FY${revAnn[5].fy}`, revAnn[5]));
    }
  }

  // FCF CAGRs (more sensitive — only push trace once for OCF since fcf is derived)
  if (fcfYears.length >= 4) {
    const c3 = cagr(fcfByFy.get(fcfYears[0])!, fcfByFy.get(fcfYears[3])!, 3);
    if (c3 != null) samples.push({ metric: "FCF 3y", cagr: c3, years: 3 });
  }
  if (fcfYears.length >= 6) {
    const c5 = cagr(fcfByFy.get(fcfYears[0])!, fcfByFy.get(fcfYears[5])!, 5);
    if (c5 != null) samples.push({ metric: "FCF 5y", cagr: c5, years: 5 });
  }

  if (samples.length === 0) {
    return {
      name: "Multi-Year CAGR",
      pillar: "Growth",
      score: 0,
      weight: 1.3, // growth pillar primary signal
      confidence: 0,
      formula: "CAGR_n = (V_t / V_{t−n})^(1/n) − 1   ·   score = tanh((avg − 5%) / 8%)",
      inputs,
      interpretation: "Insufficient annual history",
      resultText: "Skipped (need ≥3 years 10-K)",
    };
  }

  const avgCagr = samples.reduce((s, x) => s + x.cagr, 0) / samples.length;
  const score = tanhScore(avgCagr, CAGR_MID, CAGR_UNIT);
  const confidence = Math.min(1, samples.length / 4);

  return {
    name: "Multi-Year CAGR",
    pillar: "Growth",
    score,
    weight: 1.3,
    confidence,
    formula: "CAGR_n = (V_t / V_{t−n})^(1/n) − 1   ·   score = tanh((avg − 5%) / 8%)",
    inputs,
    interpretation: samples
      .map((s) => `${s.metric}: ${(s.cagr * 100).toFixed(1)}%`)
      .join(" · "),
    resultText: `Avg CAGR ${(avgCagr * 100).toFixed(1)}% across ${samples.length} series → score ${score.toFixed(2)}`,
  };
}
