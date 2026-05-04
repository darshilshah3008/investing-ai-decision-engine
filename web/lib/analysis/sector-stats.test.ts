// Run with: npm test
// Uses Node 24's native TypeScript support — no transpiler needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  BROAD_MARKET,
  MIN_SAMPLE_SIZE,
  computeSectorStats,
  normalizeSector,
  percentileRank,
  pickCohort,
  quantile,
  type Breakpoints,
  type SectorStatsInput,
} from "./sector-stats.ts";
import type {
  ModelResult,
  Pillar,
  PillarResult,
  VerdictDoc,
} from "./types.ts";

// ─── Test fixtures ─────────────────────────────────────────────────────

function makeModel(name: string, pillar: Pillar, score: number): ModelResult {
  return {
    name,
    pillar,
    score,
    weight: 1,
    confidence: 1,
    formula: "test",
    inputs: [],
    interpretation: "",
    resultText: "",
  };
}

function makePillar(pillar: Pillar, score: number): PillarResult {
  return { pillar, score, pillarWeight: 0.25, contribution: score * 0.25, modelCount: 1 };
}

function makeVerdict(opts: {
  ticker: string;
  totalScore: number;
  pillarScores?: Partial<Record<Pillar, number>>;
  modelScores?: Record<string, { pillar: Pillar; score: number }>;
}): VerdictDoc {
  const pillars: PillarResult[] = [];
  if (opts.pillarScores) {
    for (const [p, s] of Object.entries(opts.pillarScores)) {
      pillars.push(makePillar(p as Pillar, s as number));
    }
  }
  const models: ModelResult[] = [];
  if (opts.modelScores) {
    for (const [name, { pillar, score }] of Object.entries(opts.modelScores)) {
      models.push(makeModel(name, pillar, score));
    }
  }
  return {
    ticker: opts.ticker,
    cik: "0000000000",
    companyName: opts.ticker + " Inc",
    asOf: "2026-01-01T00:00:00.000Z",
    latestFiling: null,
    thesis: "",
    models,
    pillars,
    totalScore: opts.totalScore,
    verdict: "HOLD",
    confidence: "Medium",
    catalysts: [],
    risks: [],
    sensitivity: [],
    marketSnapshot: {
      price: null,
      marketCap: null,
      dividendYield: null,
      forwardPE: null,
      trailingPE: null,
      beta: null,
      sector: null,
      industry: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      fiftyDayAverage: null,
      twoHundredDayAverage: null,
      regularMarketChangePct: null,
      businessSummary: null,
    },
  };
}

// ─── quantile ───────────────────────────────────────────────────────────

describe("quantile", () => {
  test("empty array returns 0", () => {
    assert.equal(quantile([], 0.5), 0);
  });

  test("single element returns itself for any q", () => {
    assert.equal(quantile([0.42], 0), 0.42);
    assert.equal(quantile([0.42], 0.5), 0.42);
    assert.equal(quantile([0.42], 1), 0.42);
  });

  test("Type-7 linear interpolation matches R defaults", () => {
    // R: quantile(c(1,2,3,4,5), 0.25) → 2
    //    quantile(c(1,2,3,4,5), 0.5)  → 3
    //    quantile(c(1,2,3,4,5), 0.75) → 4
    const xs = [1, 2, 3, 4, 5];
    assert.equal(quantile(xs, 0), 1);
    assert.equal(quantile(xs, 0.25), 2);
    assert.equal(quantile(xs, 0.5), 3);
    assert.equal(quantile(xs, 0.75), 4);
    assert.equal(quantile(xs, 1), 5);
  });

  test("interpolates between elements when n is even", () => {
    // [10, 20, 30, 40] at q=0.5 → pos = 1.5 → 0.5*20 + 0.5*30 = 25
    assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
  });

  test("clamps q outside [0,1]", () => {
    const xs = [1, 2, 3];
    assert.equal(quantile(xs, -0.5), 1);
    assert.equal(quantile(xs, 1.5), 3);
  });
});

// ─── percentileRank ─────────────────────────────────────────────────────

describe("percentileRank", () => {
  const bp: Breakpoints = { p10: -0.6, p25: -0.3, p50: 0, p75: 0.3, p90: 0.6 };

  test("returns the breakpoint percentile for exact matches", () => {
    assert.equal(percentileRank(-0.6, bp), 10);
    assert.equal(percentileRank(-0.3, bp), 25);
    assert.equal(percentileRank(0, bp), 50);
    assert.equal(percentileRank(0.3, bp), 75);
    assert.equal(percentileRank(0.6, bp), 90);
  });

  test("clamps at -1 and +1 to 0 and 100", () => {
    assert.equal(percentileRank(-1, bp), 0);
    assert.equal(percentileRank(-1.5, bp), 0);
    assert.equal(percentileRank(1, bp), 100);
    assert.equal(percentileRank(2, bp), 100);
  });

  test("interpolates between p50 and p75", () => {
    // Halfway between p50=0 and p75=0.3 → rank halfway between 50 and 75 = 62.5
    assert.equal(percentileRank(0.15, bp), 62.5);
  });

  test("interpolates above p90 toward 100", () => {
    // Halfway from p90 (0.6) to 1.0 → rank halfway from 90 to 100 = 95
    assert.equal(percentileRank(0.8, bp), 95);
  });

  test("interpolates below p10 toward 0", () => {
    // Halfway from -1 to p10 (-0.6) is -0.8 → rank halfway from 0 to 10 = 5
    const r = percentileRank(-0.8, bp);
    assert.ok(Math.abs(r - 5) < 1e-9, `expected ~5, got ${r}`);
  });

  test("non-finite input returns 50 (neutral)", () => {
    assert.equal(percentileRank(NaN, bp), 50);
    assert.equal(percentileRank(Infinity, bp), 50);
  });

  test("collapsed segments are handled (degenerate breakpoints)", () => {
    // Sector with all-identical scores at 0
    const flat: Breakpoints = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
    // Below 0 hits the first segment with span > 0 (-1 to 0), interpolates [0,10]
    assert.equal(percentileRank(-1, flat), 0);
    assert.equal(percentileRank(0, flat), 10);
    // Above 0 hits last segment (0 to 1), interpolates [90,100]
    assert.equal(percentileRank(1, flat), 100);
    assert.equal(percentileRank(0.5, flat), 95);
  });

  test("ranks are monotonic in value", () => {
    let last = -Infinity;
    for (let v = -1; v <= 1.001; v += 0.05) {
      const r = percentileRank(v, bp);
      assert.ok(r >= last, `monotonicity broken at v=${v.toFixed(2)}, r=${r}, last=${last}`);
      last = r;
    }
  });
});

// ─── normalizeSector ────────────────────────────────────────────────────

describe("normalizeSector", () => {
  test("null/undefined/empty → BROAD_MARKET", () => {
    assert.equal(normalizeSector(null), BROAD_MARKET);
    assert.equal(normalizeSector(undefined), BROAD_MARKET);
    assert.equal(normalizeSector(""), BROAD_MARKET);
    assert.equal(normalizeSector("   "), BROAD_MARKET);
  });

  test("'n/a' (any case) → BROAD_MARKET", () => {
    assert.equal(normalizeSector("n/a"), BROAD_MARKET);
    assert.equal(normalizeSector("N/A"), BROAD_MARKET);
  });

  test("collapses whitespace and trims", () => {
    assert.equal(normalizeSector("  Information   Technology  "), "Information Technology");
  });

  test("preserves casing for known sectors", () => {
    assert.equal(normalizeSector("Technology"), "Technology");
    assert.equal(normalizeSector("Financial Services"), "Financial Services");
  });
});

// ─── computeSectorStats ─────────────────────────────────────────────────

describe("computeSectorStats", () => {
  test("always emits a BROAD_MARKET bucket containing every ticker", () => {
    const inputs: SectorStatsInput[] = [
      { sector: "Technology", doc: makeVerdict({ ticker: "AAA", totalScore: 0.5 }) },
      { sector: "Energy", doc: makeVerdict({ ticker: "BBB", totalScore: -0.2 }) },
      { sector: null, doc: makeVerdict({ ticker: "CCC", totalScore: 0.1 }) },
    ];
    const stats = computeSectorStats(inputs);
    assert.ok(stats[BROAD_MARKET]);
    assert.equal(stats[BROAD_MARKET]!.sampleSize, 3);
  });

  test("groups by canonical sector and computes per-bucket sample sizes", () => {
    const inputs: SectorStatsInput[] = [
      { sector: "Technology", doc: makeVerdict({ ticker: "AAA", totalScore: 0.5 }) },
      { sector: "Technology", doc: makeVerdict({ ticker: "BBB", totalScore: 0.3 }) },
      { sector: "Energy", doc: makeVerdict({ ticker: "CCC", totalScore: -0.4 }) },
    ];
    const stats = computeSectorStats(inputs);
    assert.equal(stats["Technology"]!.sampleSize, 2);
    assert.equal(stats["Energy"]!.sampleSize, 1);
    assert.equal(stats[BROAD_MARKET]!.sampleSize, 3);
  });

  test("dedupes when the same ticker appears twice", () => {
    const inputs: SectorStatsInput[] = [
      { sector: "Technology", doc: makeVerdict({ ticker: "AAA", totalScore: 0.5 }) },
      { sector: "Technology", doc: makeVerdict({ ticker: "AAA", totalScore: 0.7 }) },
    ];
    const stats = computeSectorStats(inputs);
    assert.equal(stats["Technology"]!.sampleSize, 1);
  });

  test("breakpoints reflect the underlying distribution", () => {
    // Build a 100-ticker tech sector with totalScores spanning -1 to +1
    const inputs: SectorStatsInput[] = [];
    for (let i = 0; i < 100; i++) {
      const score = -1 + (2 * i) / 99;
      inputs.push({
        sector: "Technology",
        doc: makeVerdict({ ticker: "T" + i, totalScore: score }),
      });
    }
    const tech = computeSectorStats(inputs)["Technology"]!;
    // Roughly: p10 ≈ -0.8, p50 ≈ 0, p90 ≈ +0.8
    assert.ok(Math.abs(tech.totalScore.p10 - -0.8) < 0.05, `p10=${tech.totalScore.p10}`);
    assert.ok(Math.abs(tech.totalScore.p50 - 0) < 0.05, `p50=${tech.totalScore.p50}`);
    assert.ok(Math.abs(tech.totalScore.p90 - 0.8) < 0.05, `p90=${tech.totalScore.p90}`);
  });

  test("rolls null/empty/'n/a' sector tickers into BROAD_MARKET only", () => {
    const inputs: SectorStatsInput[] = [
      { sector: null, doc: makeVerdict({ ticker: "X", totalScore: 0.1 }) },
      { sector: "", doc: makeVerdict({ ticker: "Y", totalScore: 0.2 }) },
      { sector: "n/a", doc: makeVerdict({ ticker: "Z", totalScore: 0.3 }) },
    ];
    const stats = computeSectorStats(inputs);
    assert.equal(Object.keys(stats).length, 1);
    assert.equal(stats[BROAD_MARKET]!.sampleSize, 3);
  });

  test("computes pillar breakpoints from PillarResult.score", () => {
    const inputs: SectorStatsInput[] = [
      {
        sector: "Tech",
        doc: makeVerdict({
          ticker: "A",
          totalScore: 0,
          pillarScores: { Quality: 0.8, Growth: 0.5 },
        }),
      },
      {
        sector: "Tech",
        doc: makeVerdict({
          ticker: "B",
          totalScore: 0,
          pillarScores: { Quality: 0.2, Growth: -0.4 },
        }),
      },
    ];
    const tech = computeSectorStats(inputs)["Tech"]!;
    // Quality scores [0.2, 0.8] → p50 = 0.5
    assert.equal(tech.pillars.Quality.p50, 0.5);
    // Growth [-0.4, 0.5] → p50 = 0.05
    assert.ok(Math.abs(tech.pillars.Growth.p50 - 0.05) < 1e-9);
    // Empty pillars (Valuation, Sustainability) collapse to flat 0s
    assert.equal(tech.pillars.Valuation.p50, 0);
    assert.equal(tech.pillars.Sustainability.p50, 0);
  });

  test("computes per-model breakpoints keyed by model name", () => {
    const inputs: SectorStatsInput[] = [
      {
        sector: "Tech",
        doc: makeVerdict({
          ticker: "A",
          totalScore: 0,
          modelScores: { "FCF Yield": { pillar: "Valuation", score: 0.6 } },
        }),
      },
      {
        sector: "Tech",
        doc: makeVerdict({
          ticker: "B",
          totalScore: 0,
          modelScores: { "FCF Yield": { pillar: "Valuation", score: 0.2 } },
        }),
      },
    ];
    const tech = computeSectorStats(inputs)["Tech"]!;
    assert.ok(tech.models["FCF Yield"]);
    assert.equal(tech.models["FCF Yield"]!.p50, 0.4);
  });

  test("non-finite scores are skipped (do not poison the distribution)", () => {
    const inputs: SectorStatsInput[] = [
      { sector: "Tech", doc: makeVerdict({ ticker: "A", totalScore: 0.5 }) },
      { sector: "Tech", doc: makeVerdict({ ticker: "B", totalScore: NaN }) },
      { sector: "Tech", doc: makeVerdict({ ticker: "C", totalScore: 0.7 }) },
    ];
    const tech = computeSectorStats(inputs)["Tech"]!;
    assert.equal(tech.sampleSize, 3); // ticker count includes B
    // But the breakpoint distribution is built from [0.5, 0.7] only
    assert.equal(tech.totalScore.p50, 0.6);
  });

  test("uses provided `now` for computedAt", () => {
    const stats = computeSectorStats(
      [{ sector: "Tech", doc: makeVerdict({ ticker: "A", totalScore: 0 }) }],
      { now: 1700000000000 },
    );
    assert.equal(stats["Tech"]!.computedAt, 1700000000000);
    assert.equal(stats[BROAD_MARKET]!.computedAt, 1700000000000);
  });

  test("schemaVersion is stamped on every bucket", () => {
    const stats = computeSectorStats([
      { sector: "Tech", doc: makeVerdict({ ticker: "A", totalScore: 0 }) },
    ]);
    for (const v of Object.values(stats)) {
      assert.ok(v.schemaVersion >= 1);
    }
  });

  test("empty input returns only an empty BROAD_MARKET bucket", () => {
    const stats = computeSectorStats([]);
    assert.deepEqual(Object.keys(stats), [BROAD_MARKET]);
    assert.equal(stats[BROAD_MARKET]!.sampleSize, 0);
  });
});

// ─── pickCohort ─────────────────────────────────────────────────────────

describe("pickCohort", () => {
  function buildStats(techSize: number, broadSize: number): Record<string, ReturnType<typeof computeSectorStats>[string]> {
    const inputs: SectorStatsInput[] = [];
    for (let i = 0; i < techSize; i++) {
      inputs.push({
        sector: "Technology",
        doc: makeVerdict({ ticker: "T" + i, totalScore: i / techSize }),
      });
    }
    for (let i = 0; i < broadSize - techSize; i++) {
      inputs.push({
        sector: "Energy",
        doc: makeVerdict({ ticker: "E" + i, totalScore: -i / broadSize }),
      });
    }
    return computeSectorStats(inputs);
  }

  test("returns sector cohort when ≥ MIN_SAMPLE_SIZE", () => {
    const stats = buildStats(MIN_SAMPLE_SIZE, MIN_SAMPLE_SIZE * 2);
    const cohort = pickCohort(stats, "Technology");
    assert.equal(cohort?.sector, "Technology");
  });

  test("falls back to BROAD_MARKET when sector is too thin", () => {
    const stats = buildStats(5, 30);
    const cohort = pickCohort(stats, "Technology");
    assert.equal(cohort?.sector, BROAD_MARKET);
  });

  test("falls back to BROAD_MARKET when sector is unknown", () => {
    const stats = buildStats(MIN_SAMPLE_SIZE, MIN_SAMPLE_SIZE * 2);
    const cohort = pickCohort(stats, "Unknown Sector");
    assert.equal(cohort?.sector, BROAD_MARKET);
  });

  test("falls back to BROAD_MARKET when sector is null", () => {
    const stats = buildStats(MIN_SAMPLE_SIZE, MIN_SAMPLE_SIZE * 2);
    const cohort = pickCohort(stats, null);
    assert.equal(cohort?.sector, BROAD_MARKET);
  });

  test("returns null when even BROAD_MARKET is missing", () => {
    const cohort = pickCohort({}, "Technology");
    assert.equal(cohort, null);
  });
});

// ─── End-to-end happy path ─────────────────────────────────────────────

describe("end-to-end", () => {
  test("compute → percentileRank yields plausible ranks", () => {
    // Build 50 tech tickers with known total scores
    const inputs: SectorStatsInput[] = [];
    for (let i = 0; i < 50; i++) {
      const score = -0.5 + i / 50; // -0.5 to ~0.5
      inputs.push({
        sector: "Technology",
        doc: makeVerdict({ ticker: "T" + i, totalScore: score }),
      });
    }
    const stats = computeSectorStats(inputs);
    const cohort = pickCohort(stats, "Technology")!;

    // The median (around 0) should rank near 50
    const medianRank = percentileRank(0, cohort.totalScore);
    assert.ok(Math.abs(medianRank - 50) < 5, `medianRank=${medianRank}`);

    // The top score should rank near 90+
    const topRank = percentileRank(0.5, cohort.totalScore);
    assert.ok(topRank >= 88, `topRank=${topRank}`);

    // The bottom score should rank near 10 or below
    const botRank = percentileRank(-0.5, cohort.totalScore);
    assert.ok(botRank <= 12, `botRank=${botRank}`);
  });
});
