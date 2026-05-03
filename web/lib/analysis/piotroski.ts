// Piotroski-lite F-Score — Pillar: Quality.
// Five of the original nine tests, chosen because their XBRL tags are
// reliably populated across the SEC universe.
//
//   1. Net income > 0
//   2. Operating cash flow > 0
//   3. OCF > Net income (earnings quality)
//   4. No new shares issued (shares ≤ prior year)
//   5. Long-term debt declined Y-o-Y
//
// Sub-score: 0-1 → −1, 2-3 → 0, 4-5 → +1

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

  // Test 1: Net income > 0
  if (niLatest) {
    inputs.push({
      field: `Net income FY${niLatest.fy}`,
      value: niLatest.val,
      unit: "USD",
      source: makeSource(niLatest),
    });
    checks.push({ test: "Net income > 0", pass: niLatest.val > 0 });
  }

  // Test 2: Operating cash flow > 0
  if (ocfLatest) {
    inputs.push({
      field: `Operating cash flow FY${ocfLatest.fy}`,
      value: ocfLatest.val,
      unit: "USD",
      source: makeSource(ocfLatest),
    });
    checks.push({ test: "Operating cash flow > 0", pass: ocfLatest.val > 0 });
  }

  // Test 3: OCF > Net income (earnings quality)
  if (ocfLatest && niLatest) {
    checks.push({
      test: "OCF > Net Income (earnings quality)",
      pass: ocfLatest.val > niLatest.val,
    });
  }

  // Test 4: No new shares issued (shares this year ≤ prior year)
  if (shrLatest) {
    const shrPrior = priorAnnual(args.sharesOutstanding, shrLatest);
    inputs.push({
      field: `Shares outstanding FY${shrLatest.fy}`,
      value: shrLatest.val,
      source: makeSource(shrLatest),
    });
    if (shrPrior) {
      inputs.push({
        field: `Shares outstanding FY${shrPrior.fy}`,
        value: shrPrior.val,
        source: makeSource(shrPrior),
      });
      checks.push({
        test: "Shares ≤ prior year (no dilution)",
        pass: shrLatest.val <= shrPrior.val,
      });
    }
  }

  // Test 5: Long-term debt declined Y-o-Y
  if (ltdLatest) {
    const ltdPrior = priorAnnual(args.longTermDebt, ltdLatest);
    inputs.push({
      field: `Long-term debt FY${ltdLatest.fy}`,
      value: ltdLatest.val,
      unit: "USD",
      source: makeSource(ltdLatest),
    });
    if (ltdPrior) {
      checks.push({
        test: "Long-term debt declined YoY",
        pass: ltdLatest.val < ltdPrior.val,
      });
    }
  }

  const score = checks.filter((c) => c.pass).length;
  let subScore: SubScore;
  if (score <= 1) subScore = -1;
  else if (score <= 3) subScore = 0;
  else subScore = 1;

  const passDetails = checks
    .map((c) => `${c.pass ? "✓" : "✗"} ${c.test}`)
    .join(" · ");

  return {
    name: "Piotroski-Lite F-Score",
    pillar: "Quality",
    subScore,
    formula:
      "Sum of {NI>0, OCF>0, OCF>NI, no dilution, LTD declining}.   0-1 → −1   ·   2-3 → 0   ·   4-5 → +1",
    inputs,
    interpretation: passDetails,
    resultText: `${score} / ${checks.length} tests passed → ${subScore >= 0 ? "+" : ""}${subScore}`,
  };
}
