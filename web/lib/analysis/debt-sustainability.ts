// Debt sustainability (Pillar: Sustainability).
//
// Three checks combined:
//   1. Net Debt / Operating Cash Flow      — how many years of cash to clear debt
//   2. Interest Coverage = OpInc / Interest — buffer against rate shocks
//   3. Debt / Equity                        — leverage level
//
// Continuous score [-1, +1]:
//   Each component is tanh-mapped, then averaged.

import type { FactPoint } from "../edgar/companyfacts";
import { latestAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

export function debtSustainabilityModel(args: {
  longTermDebt: FactPoint[];
  shortTermDebt: FactPoint[];
  cash: FactPoint[];
  operatingCashFlow: FactPoint[];
  operatingIncome: FactPoint[];
  interestExpense: FactPoint[];
  stockholdersEquity: FactPoint[];
}): ModelResult {
  const ltd = latestAnnual(args.longTermDebt);
  const std = latestAnnual(args.shortTermDebt);
  const cash = latestAnnual(args.cash);
  const ocf = latestAnnual(args.operatingCashFlow);
  const oi = latestAnnual(args.operatingIncome);
  const ie = latestAnnual(args.interestExpense);
  const eq = latestAnnual(args.stockholdersEquity);

  const inputs: InputTrace[] = [];
  if (ltd) inputs.push(traceFromPoint(`Long-term debt FY${ltd.fy}`, ltd));
  if (std) inputs.push(traceFromPoint(`Short-term debt FY${std.fy}`, std));
  if (cash) inputs.push(traceFromPoint(`Cash FY${cash.fy}`, cash));
  if (ocf) inputs.push(traceFromPoint(`Operating CF FY${ocf.fy}`, ocf));
  if (ie) inputs.push(traceFromPoint(`Interest expense FY${ie.fy}`, ie));
  if (eq) inputs.push(traceFromPoint(`Equity FY${eq.fy}`, eq));

  const totalDebt = (ltd?.val ?? 0) + (std?.val ?? 0);
  const netDebt = totalDebt - (cash?.val ?? 0);

  const components: { name: string; score: number; note: string }[] = [];

  // 1. Net Debt / OCF — how many years of OCF to clear debt
  // Score: tanh((4 − ratio) / 3)
  //   ratio = -2 (net cash) → +0.95
  //   ratio = 0 (no debt)   → +0.83
  //   ratio = 4              → 0   (manageable)
  //   ratio = 8              → -0.83
  if (ocf && ocf.val > 0) {
    const ratio = netDebt / ocf.val;
    const s = tanhScore(4 - ratio, 0, 3);
    components.push({
      name: "Net Debt / OCF",
      score: s,
      note: `${ratio.toFixed(1)}x`,
    });
  }

  // 2. Interest Coverage = OperatingIncome / InterestExpense
  // Score: tanh((cov − 5) / 5)
  //   cov < 1  → -1 (servicing impossible)
  //   cov = 5  →  0
  //   cov = 10 → +0.76
  if (oi && ie && ie.val > 0) {
    const cov = oi.val / ie.val;
    const s = tanhScore(cov - 5, 0, 5);
    components.push({
      name: "Interest coverage",
      score: s,
      note: `${cov.toFixed(1)}x`,
    });
  }

  // 3. Debt / Equity
  // Score: tanh((1 − ratio) / 1)
  //   ratio = 0    → +0.76 (no leverage)
  //   ratio = 1    →  0
  //   ratio = 2    → -0.76
  if (eq && eq.val > 0) {
    const ratio = totalDebt / eq.val;
    const s = tanhScore(1 - ratio, 0, 1);
    components.push({
      name: "Debt / Equity",
      score: s,
      note: `${ratio.toFixed(2)}`,
    });
  }

  if (components.length === 0) {
    return {
      name: "Debt Sustainability",
      pillar: "Sustainability",
      score: 0,
      weight: 1.0,
      confidence: 0,
      formula: "avg(NetDebt/OCF, InterestCoverage, D/E) — each tanh-mapped",
      inputs,
      interpretation: "Insufficient data",
      resultText: "Skipped",
    };
  }

  const score = components.reduce((s, c) => s + c.score, 0) / components.length;
  const confidence = components.length / 3;

  return {
    name: "Debt Sustainability",
    pillar: "Sustainability",
    score,
    weight: 1.0,
    confidence,
    formula:
      "avg of: tanh((4 − NetDebt/OCF)/3), tanh((IntCov − 5)/5), tanh((1 − D/E)/1)",
    inputs,
    interpretation: components
      .map((c) => `${c.name} ${c.note}`)
      .join(" · "),
    resultText: `${components.length}/3 components → score ${score.toFixed(2)}`,
  };
}
