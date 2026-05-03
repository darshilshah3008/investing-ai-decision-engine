// Piotroski-Lite F-Score (Pillar: Quality).
//
// Continuous score [-1, +1]:
//   Five binary tests. Score = (passed/total) × 2 − 1.
//   So 0/5 → -1, 2.5/5 → 0, 5/5 → +1.

import type { FactPoint } from "../edgar/companyfacts";
import { traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";
import { latestAnnual } from "./types";

function priorAnnual(points: FactPoint[], current: FactPoint): FactPoint | undefined {
  return points.find((p) => p.form === "10-K" && p.fp === "FY" && p.fy === current.fy - 1);
}

export function piotroskiLiteModel(args: {
  netIncome: FactPoint[];
  operatingCashFlow: FactPoint[];
  longTermDebt: FactPoint[];
  sharesOutstanding: FactPoint[];
}): ModelResult {
  const niLatest = latestAnnual(args.netIncome);
  const ocfLatest = latestAnnual(args.operatingCashFlow);
  const ltdLatest = latestAnnual(args.longTermDebt);
  const shrLatest = latestAnnual(args.sharesOutstanding);

  const inputs: InputTrace[] = [];
  const checks: { test: string; pass: boolean }[] = [];

  if (niLatest) {
    inputs.push(traceFromPoint(`Net income FY${niLatest.fy}`, niLatest));
    checks.push({ test: "NI > 0", pass: niLatest.val > 0 });
  }
  if (ocfLatest) {
    inputs.push(traceFromPoint(`Operating cash flow FY${ocfLatest.fy}`, ocfLatest));
    checks.push({ test: "OCF > 0", pass: ocfLatest.val > 0 });
  }
  if (ocfLatest && niLatest) {
    checks.push({ test: "OCF > NI", pass: ocfLatest.val > niLatest.val });
  }
  if (shrLatest) {
    inputs.push(traceFromPoint(`Shares FY${shrLatest.fy}`, shrLatest, "shares"));
    const prior = priorAnnual(args.sharesOutstanding, shrLatest);
    if (prior) {
      inputs.push(traceFromPoint(`Shares FY${prior.fy}`, prior, "shares"));
      checks.push({ test: "No dilution", pass: shrLatest.val <= prior.val });
    }
  }
  if (ltdLatest) {
    inputs.push(traceFromPoint(`Long-term debt FY${ltdLatest.fy}`, ltdLatest));
    const prior = priorAnnual(args.longTermDebt, ltdLatest);
    if (prior) {
      checks.push({ test: "LTD declining", pass: ltdLatest.val < prior.val });
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const score = total === 0 ? 0 : (passed / total) * 2 - 1;
  const confidence = total / 5; // 5 = full series

  return {
    name: "Piotroski-Lite F-Score",
    pillar: "Quality",
    score,
    weight: 1.0,
    confidence,
    formula: "Sum of {NI>0, OCF>0, OCF>NI, no dilution, LTD declining}, mapped to [-1,+1]",
    inputs,
    interpretation:
      total === 0
        ? "Insufficient data"
        : checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.test}`).join(" · "),
    resultText: `${passed}/${total} tests passed → score ${score.toFixed(2)}`,
  };
}
