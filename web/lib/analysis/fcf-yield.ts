// FCF Yield (Pillar: Valuation).
//
//   FCF       = Operating Cash Flow − Capital Expenditures
//   FCF Yield = FCF (TTM) / Market Cap
//
// Robust to share buybacks and intangible-heavy companies where
// Graham Number / book-value approaches fail. Also robust to GAAP
// accounting tricks because it uses cash flows, not earnings.
//
// Continuous score [-1, +1]:
//   We use tanh((yield − 4%) / 4%):
//     yield = 0%   →  -0.76 (premium-priced)
//     yield = 4%   →   0    (~Treasury yield, fair)
//     yield = 8%   →  +0.76
//     yield = 12%  →  +0.96 (deep value or distressed)
//
// 4% midpoint approximates the long-run real cost of equity / 10Y
// Treasury level. Tunable.

import type { FactPoint } from "../edgar/companyfacts";
import { latestAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

const YIELD_MID = 0.04; // 4% — the indifference point
const YIELD_UNIT = 0.04;

export function fcfYieldModel(args: {
  operatingCashFlow: FactPoint[];
  capitalExpenditures: FactPoint[];
  marketCap: number | null;
}): ModelResult {
  const ocf = latestAnnual(args.operatingCashFlow);
  const capex = latestAnnual(args.capitalExpenditures);

  const inputs: InputTrace[] = [];
  if (ocf) inputs.push(traceFromPoint(`Operating CF FY${ocf.fy}`, ocf));
  if (capex) inputs.push(traceFromPoint(`Capex FY${capex.fy}`, capex));
  inputs.push({
    field: "Market cap",
    value: args.marketCap,
    unit: "USD",
    source: null,
  });

  if (!ocf || !args.marketCap || args.marketCap <= 0) {
    return {
      name: "FCF Yield",
      pillar: "Valuation",
      score: 0,
      weight: 1.2, // valuation pillar — high weight
      confidence: 0,
      formula: "FCF Yield = (OCF − Capex) / Market Cap",
      inputs,
      interpretation: "Insufficient data",
      resultText: "Skipped",
    };
  }

  // Treat missing capex as zero (some companies don't break it out)
  const fcf = ocf.val - (capex?.val ?? 0);
  const fcfYield = fcf / args.marketCap;
  const score = tanhScore(fcfYield, YIELD_MID, YIELD_UNIT);

  return {
    name: "FCF Yield",
    pillar: "Valuation",
    score,
    weight: 1.2,
    confidence: capex ? 1 : 0.6, // less confident when capex missing
    formula: "FCF Yield = (OCF − Capex) / MarketCap   ·   score = tanh((y − 4%) / 4%)",
    inputs,
    interpretation:
      fcfYield < 0
        ? "Negative FCF — burning cash"
        : `FCF yield ${(fcfYield * 100).toFixed(2)}%`,
    resultText: `FCF $${(fcf / 1e9).toFixed(1)}B / MCap $${(args.marketCap / 1e9).toFixed(1)}B = ${(fcfYield * 100).toFixed(2)}% → score ${score.toFixed(2)}`,
  };
}
