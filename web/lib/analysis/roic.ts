// ROIC / ROE — capital efficiency (Pillar: Quality).
//
//   ROE  = NetIncome / Stockholders' Equity
//   ROIC ≈ NetIncome / (Equity + LongTermDebt − Cash)   [simplified, no NOPAT adjustment]
//
// 5-year median is the headline. We use median (not mean) so a single
// blowup year doesn't dominate. Then map via tanh.
//
// Continuous score [-1, +1]:
//   ROIC has wider variance than ROE. Use tanh((roic − 12%) / 12%):
//     ROIC =  0%   →  -0.83
//     ROIC = 12%   →   0  (~cost of capital, fair)
//     ROIC = 24%   →  +0.76 (compounder)
//     ROIC = 36%   →  +0.96 (Apple/Visa territory)

import type { FactPoint } from "../edgar/companyfacts";
import { lastNAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

const ROIC_MID = 0.12;
const ROIC_UNIT = 0.12;

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function roicModel(args: {
  netIncome: FactPoint[];
  stockholdersEquity: FactPoint[];
  longTermDebt: FactPoint[];
  cash: FactPoint[];
}): ModelResult {
  const niAnn = lastNAnnual(args.netIncome, 5);
  const eqAnn = lastNAnnual(args.stockholdersEquity, 5);
  const ltdAnn = lastNAnnual(args.longTermDebt, 5);
  const cashAnn = lastNAnnual(args.cash, 5);

  const inputs: InputTrace[] = [];
  const roicSamples: { fy: number; roic: number }[] = [];

  for (const ni of niAnn) {
    const eq = eqAnn.find((e) => e.fy === ni.fy);
    if (!eq || eq.val <= 0) continue;
    const ltd = ltdAnn.find((d) => d.fy === ni.fy)?.val ?? 0;
    const cash = cashAnn.find((c) => c.fy === ni.fy)?.val ?? 0;
    const investedCap = eq.val + ltd - cash;
    if (investedCap <= 0) continue;
    const roic = ni.val / investedCap;
    roicSamples.push({ fy: ni.fy, roic });
    inputs.push(traceFromPoint(`Net Income FY${ni.fy}`, ni));
    inputs.push(traceFromPoint(`Equity FY${ni.fy}`, eq));
  }

  if (roicSamples.length === 0) {
    return {
      name: "Capital Efficiency (ROIC)",
      pillar: "Quality",
      score: 0,
      weight: 1.2,
      confidence: 0,
      formula: "ROIC ≈ NI / (Equity + LTD − Cash)   ·   5-year median, tanh-scaled",
      inputs,
      interpretation: "Insufficient data",
      resultText: "Skipped",
    };
  }

  const med = median(roicSamples.map((s) => s.roic));
  const score = tanhScore(med, ROIC_MID, ROIC_UNIT);
  const confidence = Math.min(1, roicSamples.length / 5);

  // Trend: comparing first half vs second half
  const trendAnnotation = (() => {
    if (roicSamples.length < 4) return "";
    const n = roicSamples.length;
    const recentMed = median(roicSamples.slice(0, Math.floor(n / 2)).map((s) => s.roic));
    const olderMed = median(roicSamples.slice(Math.ceil(n / 2)).map((s) => s.roic));
    if (recentMed > olderMed * 1.1) return ", improving";
    if (recentMed < olderMed * 0.9) return ", declining";
    return ", stable";
  })();

  return {
    name: "Capital Efficiency (ROIC)",
    pillar: "Quality",
    score,
    weight: 1.2,
    confidence,
    formula: "ROIC ≈ NI / (Equity + LTD − Cash)   ·   5-year median, tanh-scaled",
    inputs,
    interpretation: `${roicSamples.length}-year median ROIC ${(med * 100).toFixed(1)}%${trendAnnotation}`,
    resultText: `Median ROIC ${(med * 100).toFixed(1)}% → score ${score.toFixed(2)}`,
  };
}
