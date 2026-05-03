// Graham Number — Pillar: Valuation.
//
//   Graham Number = √(22.5 × EPS × BVPS)
//   BVPS          = Total Equity / Diluted Shares
//   Margin of Safety = 1 − (Current Price / Graham Number)
//
//   MoS ≥ 30% → +1   ·   −20%..+30% → 0   ·   < −20% → −1
//   Skip (sub-score 0) if EPS or BVPS is negative.

import type { FactPoint } from "../edgar/companyfacts";
import { latestAnnual } from "./types";
import type { InputTrace, ModelResult, SourceRef, SubScore } from "./types";

function makeSource(p: FactPoint): SourceRef {
  return {
    form: p.form,
    accession: p.accession,
    filed: p.filed,
    fy: p.fy,
    fp: p.fp,
    end: p.end,
  };
}

export function grahamNumberModel(args: {
  epsDiluted: FactPoint[];
  stockholdersEquity: FactPoint[];
  sharesDiluted: FactPoint[];
  currentPrice: number | null;
}): ModelResult {
  const eps = latestAnnual(args.epsDiluted);
  const equity = latestAnnual(args.stockholdersEquity);
  const shares = latestAnnual(args.sharesDiluted);

  const inputs: InputTrace[] = [];

  if (eps) {
    inputs.push({
      field: `EPS diluted FY${eps.fy}`,
      value: eps.val,
      unit: "USD/share",
      source: makeSource(eps),
    });
  }
  if (equity) {
    inputs.push({
      field: `Stockholders' equity FY${equity.fy}`,
      value: equity.val,
      unit: "USD",
      source: makeSource(equity),
    });
  }
  if (shares) {
    inputs.push({
      field: `Diluted shares (weighted) FY${shares.fy}`,
      value: shares.val,
      source: makeSource(shares),
    });
  }
  inputs.push({
    field: "Current market price",
    value: args.currentPrice,
    unit: "USD/share",
    source: null,
  });

  // Skip if any required input missing or non-positive.
  if (!eps || !equity || !shares || eps.val <= 0 || equity.val <= 0 || shares.val <= 0) {
    return {
      name: "Graham Number",
      pillar: "Valuation",
      subScore: 0,
      formula: "Graham Number = √(22.5 × EPS × BVPS)   ·   BVPS = Equity / Shares",
      inputs,
      interpretation: "Insufficient or non-positive inputs — skipped",
      resultText: "Skipped (subScore = 0)",
    };
  }

  const bvps = equity.val / shares.val;
  const grahamNumber = Math.sqrt(22.5 * eps.val * bvps);

  if (args.currentPrice == null) {
    return {
      name: "Graham Number",
      pillar: "Valuation",
      subScore: 0,
      formula: "Graham Number = √(22.5 × EPS × BVPS)",
      inputs,
      interpretation: `Graham Number = $${grahamNumber.toFixed(2)} · BVPS $${bvps.toFixed(2)}, but current price unavailable`,
      resultText: `Graham Number $${grahamNumber.toFixed(2)} (no price for MoS)`,
    };
  }

  const mos = 1 - args.currentPrice / grahamNumber;
  let subScore: SubScore;
  if (mos >= 0.3) subScore = 1;
  else if (mos < -0.2) subScore = -1;
  else subScore = 0;

  const mosPct = (mos * 100).toFixed(1);

  return {
    name: "Graham Number",
    pillar: "Valuation",
    subScore,
    formula: "Graham Number = √(22.5 × EPS × BVPS)   ·   MoS = 1 − Price / GrahamNumber",
    inputs,
    interpretation: `Graham Number $${grahamNumber.toFixed(2)} · BVPS $${bvps.toFixed(2)} · MoS ${mosPct}%`,
    resultText: `Fair $${grahamNumber.toFixed(2)} → vs Current $${args.currentPrice.toFixed(2)} → MoS ${mosPct}% → ${subScore >= 0 ? "+" : ""}${subScore}`,
  };
}
