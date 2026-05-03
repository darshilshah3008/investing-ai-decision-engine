// Revenue / EPS quarterly trend model — Pillar: Growth.
// Pure port of v1's logic, with a +/- bias instead of a binary flag.
//
//   +1 if last 4 quarters strictly increasing AND latest > same-Q-last-yr
//   -1 if last 4 quarters strictly decreasing
//    0 otherwise

import type { FactPoint } from "../edgar/companyfacts";
import type { InputTrace, ModelResult, SubScore } from "./types";

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
  let revScore: SubScore = 0;
  let epsScore: SubScore = 0;
  const reasons: string[] = [];

  // Revenue trend
  if (revQ.length === 4) {
    const [q1, q2, q3, q4] = revQ.map((p) => p.val);
    const strictUp = q1 > q2 && q2 > q3 && q3 > q4;
    const strictDown = q1 < q2 && q2 < q3 && q3 < q4;
    if (strictUp) {
      revScore = 1;
      reasons.push("Revenue rose for 4 straight quarters");
    } else if (strictDown) {
      revScore = -1;
      reasons.push("Revenue fell for 4 straight quarters");
    } else {
      reasons.push("Revenue trend mixed across last 4 quarters");
    }
    revQ.forEach((p, i) => {
      inputs.push({
        field: `Revenue ${p.fp} FY${p.fy}`,
        value: p.val,
        unit: "USD",
        source: {
          form: p.form,
          accession: p.accession,
          filed: p.filed,
          fy: p.fy,
          fp: p.fp,
          end: p.end,
        },
      });
    });
  } else {
    reasons.push("Insufficient quarterly revenue data");
  }

  // EPS trend
  if (epsQ.length === 4) {
    const [e1, e2, e3, e4] = epsQ.map((p) => p.val);
    const strictUp = e1 > e2 && e2 > e3 && e3 > e4;
    const strictDown = e1 < e2 && e2 < e3 && e3 < e4;
    if (strictUp) {
      epsScore = 1;
      reasons.push("EPS rose for 4 straight quarters");
    } else if (strictDown) {
      epsScore = -1;
      reasons.push("EPS fell for 4 straight quarters");
    }
  }

  let total: SubScore = (revScore + epsScore) as SubScore;
  if (total > 2) total = 2;
  if (total < -2) total = -2;

  return {
    name: "Revenue & EPS Trend",
    pillar: "Growth",
    subScore: total,
    formula:
      "Q1 > Q2 > Q3 > Q4  →  +1 (each metric)   ·   Q1 < Q2 < Q3 < Q4  →  −1",
    inputs,
    interpretation: reasons.join(" · ") || "No trend detectable",
    resultText: `Revenue trend ${revScore >= 0 ? "+" : ""}${revScore}, EPS trend ${epsScore >= 0 ? "+" : ""}${epsScore} → ${total >= 0 ? "+" : ""}${total}`,
  };
}
