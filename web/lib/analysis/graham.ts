// Graham Number (Pillar: Valuation).
//
//   Graham Number    = √(22.5 × EPS × BVPS)
//   Margin of Safety = 1 − Price / Graham Number
//
// Continuous score [-1, +1] via tanh(MoS / 0.4):
//   MoS = -100% →  -0.97 (Graham would say grossly overpriced)
//   MoS = -40%  →  -0.76
//   MoS =   0%  →   0   (fair)
//   MoS = +40%  →  +0.76 (deep value per Graham)
//
// IMPORTANT: low **confidence** for buyback-heavy companies. If shares
// outstanding has declined >20% over 5 years, BVPS is artificially low
// and the model can't be trusted. We down-weight automatically.

import type { FactPoint } from "../edgar/companyfacts";
import { lastNAnnual, latestAnnual, tanhScore, traceFromPoint } from "./types";
import type { InputTrace, ModelResult } from "./types";

export function grahamNumberModel(args: {
  epsDiluted: FactPoint[];
  stockholdersEquity: FactPoint[];
  sharesDiluted: FactPoint[];
  currentPrice: number | null;
}): ModelResult {
  const eps = latestAnnual(args.epsDiluted);
  const equity = latestAnnual(args.stockholdersEquity);
  const shares = latestAnnual(args.sharesDiluted);
  const sharesHistory = lastNAnnual(args.sharesDiluted, 6);

  const inputs: InputTrace[] = [];
  if (eps) inputs.push(traceFromPoint(`EPS diluted FY${eps.fy}`, eps, "USD/share"));
  if (equity) inputs.push(traceFromPoint(`Equity FY${equity.fy}`, equity));
  if (shares) inputs.push(traceFromPoint(`Diluted shares FY${shares.fy}`, shares, "shares"));
  inputs.push({
    field: "Current market price",
    value: args.currentPrice,
    unit: "USD/share",
    source: null,
  });

  if (
    !eps ||
    !equity ||
    !shares ||
    eps.val <= 0 ||
    equity.val <= 0 ||
    shares.val <= 0 ||
    args.currentPrice == null
  ) {
    return {
      name: "Graham Number",
      pillar: "Valuation",
      score: 0,
      weight: 0.6, // de-prioritized vs. FCF Yield + Earnings Yield
      confidence: 0,
      formula: "Graham Number = √(22.5 × EPS × BVPS)   ·   MoS = 1 − Price/GN",
      inputs,
      interpretation: "Insufficient or non-positive inputs — skipped",
      resultText: "Skipped",
    };
  }

  const bvps = equity.val / shares.val;
  const grahamNumber = Math.sqrt(22.5 * eps.val * bvps);
  const mos = 1 - args.currentPrice / grahamNumber;
  const score = tanhScore(mos, 0, 0.4);

  // Confidence penalty for heavy buyback companies — Graham is unreliable for them.
  // If shares have shrunk >20% over 5 years, halve confidence.
  let confidence = 1;
  let buybackNote = "";
  if (sharesHistory.length >= 5) {
    const oldest = sharesHistory[sharesHistory.length - 1].val;
    const newest = sharesHistory[0].val;
    if (newest < oldest * 0.8) {
      confidence = 0.4;
      const pct = ((1 - newest / oldest) * 100).toFixed(0);
      buybackNote = ` (buybacks reduced shares ${pct}% over 5y — Graham unreliable, confidence lowered)`;
    } else if (newest < oldest * 0.95) {
      confidence = 0.7;
    }
  }

  return {
    name: "Graham Number",
    pillar: "Valuation",
    score,
    weight: 0.6,
    confidence,
    formula: "Graham = √(22.5 × EPS × BVPS)   ·   MoS = 1 − Price/Graham",
    inputs,
    interpretation:
      `Graham $${grahamNumber.toFixed(2)} · BVPS $${bvps.toFixed(2)} · MoS ${(mos * 100).toFixed(0)}%${buybackNote}`,
    resultText: `Fair $${grahamNumber.toFixed(2)} vs $${args.currentPrice.toFixed(2)} → MoS ${(mos * 100).toFixed(0)}% → score ${score.toFixed(2)}`,
  };
}
