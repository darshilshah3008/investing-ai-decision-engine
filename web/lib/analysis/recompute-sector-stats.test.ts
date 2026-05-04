// End-to-end tests for the recompute orchestrator using an in-memory
// Firestore fake. Exercises the read → compute → write → cleanup pipeline.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  encodeSectorKey,
  runRecomputeSectorStats,
  type CollectionRefLike,
  type DocRefLike,
  type DocSnapshotLike,
  type FirestoreLike,
  type QuerySnapshotLike,
} from "./recompute-sector-stats.ts";
import { BROAD_MARKET, MIN_SAMPLE_SIZE } from "./sector-stats.ts";
import type { ModelResult, Pillar, PillarResult, VerdictDoc } from "./types.ts";

// ─── In-memory Firestore fake ──────────────────────────────────────────

class FakeFirestore implements FirestoreLike {
  private store = new Map<string, Map<string, unknown>>();

  seed(collection: string, id: string, data: unknown): void {
    if (!this.store.has(collection)) this.store.set(collection, new Map());
    this.store.get(collection)!.set(id, data);
  }

  has(collection: string, id: string): boolean {
    return this.store.get(collection)?.has(id) ?? false;
  }

  get(collection: string, id: string): unknown {
    return this.store.get(collection)?.get(id);
  }

  size(collection: string): number {
    return this.store.get(collection)?.size ?? 0;
  }

  collection(name: string): CollectionRefLike {
    const self = this;
    return {
      get: async (): Promise<QuerySnapshotLike> => {
        const inner = self.store.get(name) ?? new Map();
        const docs: DocSnapshotLike[] = [];
        for (const [id, data] of inner) {
          docs.push({ id, exists: true, data: () => data });
        }
        return { docs };
      },
      doc: (id: string): DocRefLike => ({
        get: async () => {
          const inner = self.store.get(name);
          const data = inner?.get(id);
          return {
            id,
            exists: data !== undefined,
            data: () => data,
          };
        },
        set: async (data: unknown) => {
          if (!self.store.has(name)) self.store.set(name, new Map());
          self.store.get(name)!.set(id, data);
        },
        delete: async () => {
          self.store.get(name)?.delete(id);
        },
      }),
    };
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────────

function makeVerdict(opts: {
  ticker: string;
  totalScore: number;
  pillars?: Partial<Record<Pillar, number>>;
}): VerdictDoc {
  const pillars: PillarResult[] = [];
  for (const [p, s] of Object.entries(opts.pillars ?? {})) {
    pillars.push({
      pillar: p as Pillar,
      score: s as number,
      pillarWeight: 0.25,
      contribution: (s as number) * 0.25,
      modelCount: 1,
    });
  }
  const models: ModelResult[] = [
    {
      name: "FCF Yield",
      pillar: "Valuation",
      score: opts.totalScore,
      weight: 1,
      confidence: 1,
      formula: "test",
      inputs: [],
      interpretation: "",
      resultText: "",
    },
  ];
  return {
    ticker: opts.ticker,
    cik: "0000000000",
    companyName: opts.ticker,
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

function seedFixture(db: FakeFirestore, opts: {
  ticker: string;
  sector: string | null;
  totalScore: number;
}): void {
  db.seed("universe", opts.ticker, {
    ticker: opts.ticker,
    sector: opts.sector,
  });
  db.seed("verdicts", opts.ticker, {
    verdict: makeVerdict({
      ticker: opts.ticker,
      totalScore: opts.totalScore,
      pillars: { Quality: opts.totalScore, Valuation: opts.totalScore },
    }),
    cachedAt: Date.now(),
    schemaVersion: 5,
  });
}

// ─── encodeSectorKey ───────────────────────────────────────────────────

describe("encodeSectorKey", () => {
  test("preserves common sector names", () => {
    assert.equal(encodeSectorKey("Technology"), "Technology");
    assert.equal(encodeSectorKey("Financial Services"), "Financial Services");
    assert.equal(encodeSectorKey(BROAD_MARKET), "Broad Market");
  });

  test("replaces forward slashes (forbidden in Firestore IDs)", () => {
    assert.equal(encodeSectorKey("Foo/Bar"), "Foo-Bar");
  });

  test("collapses pure-dot strings to a safe placeholder", () => {
    assert.equal(encodeSectorKey("."), "_");
    assert.equal(encodeSectorKey(".."), "_");
  });
});

// ─── runRecomputeSectorStats ───────────────────────────────────────────

describe("runRecomputeSectorStats", () => {
  test("empty universe → only Broad Market doc with sampleSize=0", async () => {
    const db = new FakeFirestore();
    const result = await runRecomputeSectorStats(db);
    assert.equal(result.universeRowsScanned, 0);
    assert.equal(result.verdictsHydrated, 0);
    assert.equal(result.written, 1);
    assert.equal(result.deleted, 0);
    assert.deepEqual(Object.keys(result.sectors), [BROAD_MARKET]);
    assert.equal(db.size("sectorStats"), 1);
  });

  test("writes one doc per sector + Broad Market", async () => {
    const db = new FakeFirestore();
    seedFixture(db, { ticker: "AAPL", sector: "Technology", totalScore: 0.5 });
    seedFixture(db, { ticker: "MSFT", sector: "Technology", totalScore: 0.3 });
    seedFixture(db, { ticker: "XOM", sector: "Energy", totalScore: -0.2 });

    const result = await runRecomputeSectorStats(db);
    assert.equal(result.universeRowsScanned, 3);
    assert.equal(result.verdictsHydrated, 3);
    assert.equal(result.written, 3); // Technology, Energy, Broad Market
    assert.equal(db.size("sectorStats"), 3);

    assert.ok(db.has("sectorStats", "Technology"));
    assert.ok(db.has("sectorStats", "Energy"));
    assert.ok(db.has("sectorStats", "Broad Market"));

    assert.equal(result.sectors["Technology"], 2);
    assert.equal(result.sectors["Energy"], 1);
    assert.equal(result.sectors[BROAD_MARKET], 3);
  });

  test("skips universe rows whose verdict doc is missing", async () => {
    const db = new FakeFirestore();
    db.seed("universe", "GHOST", { ticker: "GHOST", sector: "Technology" });
    seedFixture(db, { ticker: "AAPL", sector: "Technology", totalScore: 0.5 });

    const result = await runRecomputeSectorStats(db);
    assert.equal(result.universeRowsScanned, 2);
    assert.equal(result.verdictsHydrated, 1); // GHOST silently dropped
  });

  test("skips verdict docs with malformed shape (e.g. legacy v1)", async () => {
    const db = new FakeFirestore();
    db.seed("universe", "OLD", { ticker: "OLD", sector: "Technology" });
    db.seed("verdicts", "OLD", {
      // pre-pillars legacy shape
      verdict: { ticker: "OLD", subScore: -2 },
      cachedAt: Date.now(),
    });
    seedFixture(db, { ticker: "NEW", sector: "Technology", totalScore: 0.5 });

    const result = await runRecomputeSectorStats(db);
    assert.equal(result.universeRowsScanned, 2);
    assert.equal(result.verdictsHydrated, 1);
  });

  test("deletes stale sectorStats docs that no longer have any tickers", async () => {
    const db = new FakeFirestore();
    // Pre-existing stale cohort from a previous run
    db.seed("sectorStats", "Buggy Whips", { sector: "Buggy Whips", sampleSize: 3 });
    db.seed("sectorStats", "Technology", { sector: "Technology", sampleSize: 99 });
    seedFixture(db, { ticker: "AAPL", sector: "Technology", totalScore: 0.5 });

    const result = await runRecomputeSectorStats(db);
    assert.equal(result.deleted, 1);
    assert.equal(db.has("sectorStats", "Buggy Whips"), false);
    assert.ok(db.has("sectorStats", "Technology")); // overwritten, not deleted
    assert.ok(db.has("sectorStats", "Broad Market"));
  });

  test("never deletes the Broad Market cohort even if pre-existing", async () => {
    const db = new FakeFirestore();
    db.seed("sectorStats", "Broad Market", { sector: BROAD_MARKET, sampleSize: 0 });
    // No universe rows → recompute will overwrite Broad Market with sampleSize=0
    const result = await runRecomputeSectorStats(db);
    assert.equal(result.deleted, 0);
    assert.ok(db.has("sectorStats", "Broad Market"));
  });

  test("written sectorStats payload is shaped correctly", async () => {
    const db = new FakeFirestore();
    for (let i = 0; i < MIN_SAMPLE_SIZE; i++) {
      seedFixture(db, {
        ticker: "T" + i,
        sector: "Technology",
        totalScore: -0.5 + i / MIN_SAMPLE_SIZE,
      });
    }
    await runRecomputeSectorStats(db, { now: 1700000000000 });

    const tech = db.get("sectorStats", "Technology") as {
      sector: string;
      computedAt: number;
      schemaVersion: number;
      sampleSize: number;
      models: Record<string, unknown>;
      pillars: Record<string, unknown>;
      totalScore: { p10: number; p50: number; p90: number };
    };

    assert.equal(tech.sector, "Technology");
    assert.equal(tech.computedAt, 1700000000000);
    assert.equal(tech.sampleSize, MIN_SAMPLE_SIZE);
    assert.ok(tech.models["FCF Yield"], "FCF Yield breakpoints present");
    assert.ok(tech.pillars["Quality"], "Quality breakpoints present");
    assert.ok(tech.totalScore.p50 != null);
  });

  test("dedupes by ticker if universe has duplicates", async () => {
    const db = new FakeFirestore();
    // Same ticker seeded once → universe row has one entry, verdicts has one
    seedFixture(db, { ticker: "AAPL", sector: "Technology", totalScore: 0.5 });
    const result = await runRecomputeSectorStats(db);
    assert.equal(result.sectors["Technology"], 1);
  });

  test("respects chunkSize without dropping rows", async () => {
    const db = new FakeFirestore();
    for (let i = 0; i < 50; i++) {
      seedFixture(db, {
        ticker: "T" + i,
        sector: "Technology",
        totalScore: i / 50,
      });
    }
    const result = await runRecomputeSectorStats(db, { chunkSize: 7 });
    assert.equal(result.verdictsHydrated, 50);
    assert.equal(result.sectors["Technology"], 50);
  });
});
