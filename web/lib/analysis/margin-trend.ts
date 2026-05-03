// Margin trend (Pillar: Quality).
//
// Tracks gross margin and operating margin across the last 4 fiscal years.
// Catches deteriorating businesses early — even profitable ones.
//
//   Gross Margin = (Revenue − Cost of Revenue) / Revenue
//   Op Margin    = Operating Income / Revenue
//
// Score combines (a) latest level vs sector-implied baseline and
// (b) 3-year trend (improving / stable / deteriorating).

import type { FactPoint } from "../edgar/companyfacts";
import { lastNAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

function pairBy<T extends { fy: number }>(a: T[], b: T[]): { fy: number; a: T; b: T }[] {
  const out: { fy: number; a: T; b: T }[] = [];
  for (const x of a) {
    const match = b.find((y) => y.fy === x.fy);
    if (match) out.push({ fy: x.fy, a: x, b: match });
  }
  return out;
}

export function marginTrendModel(args: {
  revenue: FactPoint[];
  costOfRevenue: FactPoint[];
  grossProfit: FactPoint[];
  operatingIncome: FactPoint[];
}): ModelResult {
  const revAnn = lastNAnnual(args.revenue, 5);
  const corAnn = lastNAnnual(args.costOfRevenue, 5);
  const gpAnn = lastNAnnual(args.grossProfit, 5);
  const oiAnn = lastNAnnual(args.operatingIncome, 5);

  const inputs: InputTrace[] = [];

  // Build gross margin series (prefer GrossProfit if available, else compute Rev − Cost)
  const gmSeries: { fy: number; gm: number }[] = [];
  if (gpAnn.length > 0 && revAnn.length > 0) {
    for (const { fy, a: gp, b: rev } of pairBy(gpAnn, revAnn)) {
      if (rev.val > 0) {
        gmSeries.push({ fy, gm: gp.val / rev.val });
        inputs.push(traceFromPoint(`Gross profit FY${fy}`, gp));
      }
    }
  } else if (corAnn.length > 0 && revAnn.length > 0) {
    for (const { fy, a: rev, b: cor } of pairBy(revAnn, corAnn)) {
      if (rev.val > 0) gmSeries.push({ fy, gm: (rev.val - cor.val) / rev.val });
    }
  }
  gmSeries.sort((a, b) => b.fy - a.fy);

  // Operating margin series
  const omSeries: { fy: number; om: number }[] = [];
  for (const { fy, a: oi, b: rev } of pairBy(oiAnn, revAnn)) {
    if (rev.val > 0) {
      omSeries.push({ fy, om: oi.val / rev.val });
      inputs.push(traceFromPoint(`Operating income FY${fy}`, oi));
    }
  }
  omSeries.sort((a, b) => b.fy - a.fy);

  if (gmSeries.length === 0 && omSeries.length === 0) {
    return {
      name: "Margin Trend",
      pillar: "Quality",
      score: 0,
      weight: 0.8,
      confidence: 0,
      formula: "Gross / Operating margin level + 3-year trend",
      inputs,
      interpretation: "Insufficient data (no margin series)",
      resultText: "Skipped",
    };
  }

  // Component A: latest operating margin level
  // tanh((om − 12%) / 12%) — neutral at 12%, strong at 24%+
  const latestOm = omSeries[0]?.om ?? 0;
  const omLevelScore = omSeries.length > 0 ? tanhScore(latestOm, 0.12, 0.12) : 0;

  // Component B: trend (latest gm vs gm 3 years ago)
  let gmTrendScore = 0;
  let gmTrendNote = "";
  if (gmSeries.length >= 4) {
    const delta = gmSeries[0].gm - gmSeries[3].gm; // latest − 3y ago
    gmTrendScore = tanhScore(delta, 0, 0.03); // ±3pp = ±tanh(1) ≈ 0.76
    gmTrendNote = `, GM Δ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp over 3y`;
  }

  // Combine: 60% level, 40% trend (when both available)
  const score = omSeries.length > 0 && gmSeries.length >= 4
    ? 0.6 * omLevelScore + 0.4 * gmTrendScore
    : omSeries.length > 0
      ? omLevelScore
      : gmTrendScore;

  const confidence = Math.min(
    1,
    (omSeries.length + gmSeries.length) / 8,
  );

  return {
    name: "Margin Trend",
    pillar: "Quality",
    score,
    weight: 0.8,
    confidence,
    formula: "0.6 × tanh((OpMargin − 12%) / 12%)   +   0.4 × tanh(ΔGrossMargin_3y / 3pp)",
    inputs,
    interpretation:
      omSeries.length > 0
        ? `Op margin ${(latestOm * 100).toFixed(1)}%${gmTrendNote}`
        : `Gross margin trend only${gmTrendNote}`,
    resultText: `score ${score.toFixed(2)}`,
  };
}
