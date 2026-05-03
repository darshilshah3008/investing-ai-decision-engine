// Earnings yield vs. risk-free rate (Pillar: Valuation).
//
//   Earnings Yield = Net Income (TTM) / Market Cap   ( ≈ 1 / P/E )
//   Spread         = Earnings Yield − 10Y Treasury Yield
//
// This is the inverse of P/E, framed against the actual cost of money.
// At a 4% Treasury yield, an earnings yield of 4% is "fair" — anything
// higher is *cheap* on an absolute basis.
//
// We use a fixed 4% as the assumed long-run risk-free rate. That's
// reasonable for prototype; in production we'd pull the live 10Y
// Treasury yield from an API.
//
// Continuous score [-1, +1]:
//   tanh(spread / 4%):
//     spread = -4%  →  -0.76 (overpriced)
//     spread =  0%  →   0    (fairly valued vs Treasury)
//     spread = +4%  →  +0.76 (cheap)
//     spread = +8%  →  +0.96 (deep value)

import type { FactPoint } from "../edgar/companyfacts";
import { latestAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

const ASSUMED_TREASURY_YIELD = 0.04; // 4% — reasonable long-run baseline

export function earningsYieldModel(args: {
  netIncome: FactPoint[];
  marketCap: number | null;
}): ModelResult {
  const ni = latestAnnual(args.netIncome);

  const inputs: InputTrace[] = [];
  if (ni) inputs.push(traceFromPoint(`Net income FY${ni.fy}`, ni));
  inputs.push({
    field: "Market cap",
    value: args.marketCap,
    unit: "USD",
    source: null,
  });
  inputs.push({
    field: "Assumed 10Y Treasury yield",
    value: ASSUMED_TREASURY_YIELD,
    unit: "fraction",
    source: null,
  });

  if (!ni || !args.marketCap || args.marketCap <= 0) {
    return {
      name: "Earnings Yield vs Treasury",
      pillar: "Valuation",
      score: 0,
      weight: 0.9,
      confidence: 0,
      formula: "spread = NI/MCap − 4%   ·   score = tanh(spread / 4%)",
      inputs,
      interpretation: "Insufficient data",
      resultText: "Skipped",
    };
  }

  if (ni.val <= 0) {
    // Negative earnings — auto-fail this model with confidence
    return {
      name: "Earnings Yield vs Treasury",
      pillar: "Valuation",
      score: -0.5,
      weight: 0.9,
      confidence: 1,
      formula: "spread = NI/MCap − 4%   ·   score = tanh(spread / 4%)",
      inputs,
      interpretation: `Negative net income ($${(ni.val / 1e9).toFixed(1)}B)`,
      resultText: "Loss-making → score −0.50",
    };
  }

  const ey = ni.val / args.marketCap;
  const spread = ey - ASSUMED_TREASURY_YIELD;
  const score = tanhScore(spread, 0, 0.04);

  return {
    name: "Earnings Yield vs Treasury",
    pillar: "Valuation",
    score,
    weight: 0.9,
    confidence: 1,
    formula: "EY = NI / MCap   ·   spread = EY − 4%   ·   score = tanh(spread / 4%)",
    inputs,
    interpretation:
      `EY ${(ey * 100).toFixed(2)}% vs ${(ASSUMED_TREASURY_YIELD * 100).toFixed(0)}% Treasury → ` +
      `spread ${spread >= 0 ? "+" : ""}${(spread * 100).toFixed(2)}pp`,
    resultText: `EY ${(ey * 100).toFixed(2)}%, spread ${(spread * 100).toFixed(2)}pp → score ${score.toFixed(2)}`,
  };
}
