// Revenue & EPS quarterly trend (Pillar: Growth).
//
// Continuous score [-1, +1]:
//   We count how many of the last 4 q-o-q transitions were positive
//   (range 0..3 transitions for 4 points). Map: 0/3 → -1, 1.5/3 → 0, 3/3 → +1.
//   Combined: average of revenue + EPS trend.
//
// This replaces the v1 strict-monotonic check, which almost never
// fired positively for seasonal businesses.

import type { FactPoint } from "../edgar/companyfacts";
import type { InputTrace, ModelResult } from "./types";
import { traceFromPoint } from "./types";

function trendScore(values: number[]): number {
  if (values.length < 2) return 0;
  // values is newest-first. Compare each adjacent pair (newer vs older).
  let positive = 0;
  let total = 0;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] !== values[i + 1]) {
      total++;
      if (values[i] > values[i + 1]) positive++;
    }
  }
  if (total === 0) return 0;
  // Map ratio [0..1] to score [-1..+1]
  const ratio = positive / total;
  return ratio * 2 - 1;
}

function takeQuarterly(points: FactPoint[], n: number): FactPoint[] {
  return points.filter((p) => p.form === "10-Q").slice(0, n);
}

export function revenueTrendModel(args: {
  revenue: FactPoint[];
  eps: FactPoint[];
}): ModelResult {
  const revQ = takeQuarterly(args.revenue, 4);
  const epsQ = takeQuarterly(args.eps, 4);

  const inputs: InputTrace[] = [];
  revQ.forEach((p) =>
    inputs.push(traceFromPoint(`Revenue ${p.fp} FY${p.fy}`, p, "USD")),
  );
  epsQ.forEach((p) =>
    inputs.push(traceFromPoint(`EPS diluted ${p.fp} FY${p.fy}`, p, "USD/share")),
  );

  const revScore = trendScore(revQ.map((p) => p.val));
  const epsScore = trendScore(epsQ.map((p) => p.val));

  const score = (revScore + epsScore) / 2;
  const dataPoints = revQ.length + epsQ.length;
  const confidence = Math.min(1, dataPoints / 8); // 8 = full series

  return {
    name: "Quarterly Trend",
    pillar: "Growth",
    score,
    weight: 0.7, // less than CAGR which uses multi-year data
    confidence,
    formula: "score = avg(rev_q-o-q_up_ratio, eps_q-o-q_up_ratio) × 2 − 1",
    inputs,
    interpretation:
      revQ.length < 4
        ? "Insufficient quarterly history"
        : `Revenue trend ${(revScore * 100).toFixed(0)}%, EPS trend ${(epsScore * 100).toFixed(0)}%`,
    resultText: `score ${score.toFixed(2)} · confidence ${(confidence * 100).toFixed(0)}%`,
  };
}
