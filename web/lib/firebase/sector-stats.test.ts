// Unit tests for the firebase-side sector-stats reader. Uses a fake
// `StatsLoader` so we can exercise the cohort-selection rules without
// touching Firestore or the in-process memo cache.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  pickPeerCohort,
  type StatsLoader,
} from "./sector-stats.ts";
import {
  BROAD_MARKET,
  MIN_SAMPLE_SIZE,
  encodeSectorKey,
  type SectorStats,
} from "../analysis/sector-stats.ts";
import type { Pillar } from "../analysis/types.ts";

function makeStats(opts: {
  sector: string;
  sampleSize: number;
}): SectorStats {
  const flat = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
  const pillars = {} as Record<Pillar, typeof flat>;
  (["Quality", "Growth", "Valuation", "Sustainability"] as Pillar[]).forEach((p) => {
    pillars[p] = flat;
  });
  return {
    sector: opts.sector,
    computedAt: 1,
    schemaVersion: 1,
    sampleSize: opts.sampleSize,
    models: {},
    pillars,
    totalScore: flat,
  };
}

function loaderFrom(map: Record<string, SectorStats | null>): StatsLoader {
  return async (key: string) => map[key] ?? null;
}

describe("pickPeerCohort", () => {
  test("returns sector cohort when ≥ MIN_SAMPLE_SIZE", async () => {
    const tech = makeStats({ sector: "Technology", sampleSize: MIN_SAMPLE_SIZE + 5 });
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 100 });
    const loader = loaderFrom({
      [encodeSectorKey("Technology")]: tech,
      [encodeSectorKey(BROAD_MARKET)]: broad,
    });
    const result = await pickPeerCohort("Technology", loader);
    assert.equal(result?.source, "sector");
    assert.equal(result?.stats.sector, "Technology");
  });

  test("falls back to Broad Market when sector is too thin", async () => {
    const tech = makeStats({ sector: "Technology", sampleSize: 5 });
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 100 });
    const loader = loaderFrom({
      [encodeSectorKey("Technology")]: tech,
      [encodeSectorKey(BROAD_MARKET)]: broad,
    });
    const result = await pickPeerCohort("Technology", loader);
    assert.equal(result?.source, "broad");
    assert.equal(result?.stats.sector, BROAD_MARKET);
  });

  test("falls back to Broad Market when sector cohort doesn't exist", async () => {
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 100 });
    const loader = loaderFrom({
      [encodeSectorKey(BROAD_MARKET)]: broad,
    });
    const result = await pickPeerCohort("Healthcare", loader);
    assert.equal(result?.source, "broad");
  });

  test("returns null when even Broad Market is missing (first run)", async () => {
    const loader = loaderFrom({});
    const result = await pickPeerCohort("Technology", loader);
    assert.equal(result, null);
  });

  test("null/undefined sector uses Broad Market directly without trying a sector key", async () => {
    let triedKeys: string[] = [];
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 50 });
    const loader: StatsLoader = async (key) => {
      triedKeys.push(key);
      return key === encodeSectorKey(BROAD_MARKET) ? broad : null;
    };
    const result = await pickPeerCohort(null, loader);
    assert.equal(result?.source, "broad");
    // Should only have tried the Broad Market key — no point asking for a "null" sector
    assert.deepEqual(triedKeys, [encodeSectorKey(BROAD_MARKET)]);
  });

  test("normalizes 'n/a' sector to Broad Market lookup only", async () => {
    let triedKeys: string[] = [];
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 50 });
    const loader: StatsLoader = async (key) => {
      triedKeys.push(key);
      return key === encodeSectorKey(BROAD_MARKET) ? broad : null;
    };
    await pickPeerCohort("N/A", loader);
    assert.deepEqual(triedKeys, [encodeSectorKey(BROAD_MARKET)]);
  });

  test("uses encoded sector key (forward-slash safe)", async () => {
    let triedKeys: string[] = [];
    const loader: StatsLoader = async (key) => {
      triedKeys.push(key);
      return null;
    };
    await pickPeerCohort("Foo/Bar", loader);
    // Sector lookup should use the encoded form (slash → dash)
    assert.ok(triedKeys.includes("Foo-Bar"), `expected Foo-Bar in ${triedKeys}`);
  });

  test("when sector cohort hits MIN_SAMPLE_SIZE exactly, prefers it", async () => {
    const tech = makeStats({ sector: "Technology", sampleSize: MIN_SAMPLE_SIZE });
    const broad = makeStats({ sector: BROAD_MARKET, sampleSize: 200 });
    const loader = loaderFrom({
      [encodeSectorKey("Technology")]: tech,
      [encodeSectorKey(BROAD_MARKET)]: broad,
    });
    const result = await pickPeerCohort("Technology", loader);
    assert.equal(result?.source, "sector");
  });
});
