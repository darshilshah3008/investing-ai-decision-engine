"use client";

// Watchlist detail page — adapted from Stitch screen (6) HTML.
//
// Shows the watchlist as a sortable table; lets the user add/remove
// tickers, set per-position weights, and view portfolio composition
// (cap distribution, dividend yield, total weight check).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StockPickerDialog } from "@/components/stock-picker-dialog";
import { useAuth } from "@/lib/firebase/auth-context";
import type { VerdictDoc } from "@/lib/analysis/types";
import {
  formatRelativeTime,
  formatScoreContinuous,
  scoreColorClass,
} from "@/lib/format";

interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
  weights?: Record<string, number>;
  portfolioTotal?: number;
  costBasis?: Record<string, number>;
}

interface RowState {
  ticker: string;
  loading: boolean;
  error: string | null;
  verdict: VerdictDoc | null;
}

type CapBucket = "Mega" | "Large" | "Mid" | "Small" | "Micro" | "—";

function bucketFromMcap(mcap: number | null | undefined): CapBucket {
  if (mcap == null) return "—";
  if (mcap >= 200e9) return "Mega";
  if (mcap >= 10e9) return "Large";
  if (mcap >= 2e9) return "Mid";
  if (mcap >= 300e6) return "Small";
  return "Micro";
}

const BUCKET_COLORS: Record<CapBucket, string> = {
  Mega: "bg-primary/20 text-primary border-primary/30",
  Large: "bg-secondary/15 text-secondary border-secondary/30",
  Mid: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  Small: "bg-tertiary/15 text-tertiary border-tertiary/30",
  Micro: "bg-outline/15 text-outline border-outline/30",
  "—": "bg-surface-container-highest text-on-surface-variant border-outline-variant",
};

function formatMcap(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export default function WatchlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, configured, signInWithGoogle } = useAuth();
  const [wl, setWl] = useState<WatchlistEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const [savingWeights, setSavingWeights] = useState(false);
  const [totalDraft, setTotalDraft] = useState<string>("");
  const [costBasisDraft, setCostBasisDraft] = useState<Record<string, string>>({});

  // Load watchlist + auto-fetch verdicts
  useEffect(() => {
    if (!user || !id) return;
    user.getIdToken().then((token) => {
      fetch(`/api/watchlist/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { watchlist: WatchlistEntry } | null) => {
          if (!data?.watchlist) return;
          setWl(data.watchlist);
          // Seed weight drafts from saved values
          const drafts: Record<string, string> = {};
          for (const t of data.watchlist.tickers) {
            const w = data.watchlist.weights?.[t];
            drafts[t] = w != null ? String(w) : "";
          }
          setWeightDraft(drafts);
          setTotalDraft(
            data.watchlist.portfolioTotal != null
              ? String(data.watchlist.portfolioTotal)
              : "",
          );
          const cbDrafts: Record<string, string> = {};
          for (const t of data.watchlist.tickers) {
            const c = data.watchlist.costBasis?.[t];
            cbDrafts[t] = c != null ? String(c) : "";
          }
          setCostBasisDraft(cbDrafts);
          // Initialize row state
          const initRows: Record<string, RowState> = {};
          for (const t of data.watchlist.tickers) {
            initRows[t] = { ticker: t, loading: false, error: null, verdict: null };
          }
          setRows(initRows);
          // Auto-fetch any cached verdicts in the background
          loadCachedVerdicts(data.watchlist.tickers);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const loadCachedVerdicts = async (tickers: string[]) => {
    // Hit /api/verdict/{ticker} for each — server returns cache hit instantly.
    await Promise.all(
      tickers.map(async (t) => {
        try {
          const r = await fetch(`/api/verdict/${t}`);
          if (r.ok) {
            const data = await r.json();
            setRows((rs) => ({
              ...rs,
              [t]: {
                ticker: t,
                loading: false,
                error: null,
                verdict: data.verdict as VerdictDoc,
              },
            }));
          }
        } catch {
          /* ignore individual failures */
        }
      }),
    );
  };

  const saveTickers = async (
    next: string[],
    nextWeights?: Record<string, number>,
  ) => {
    if (!user || !wl) return;
    const token = await user.getIdToken();
    await fetch(`/api/watchlist/${wl.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: wl.name,
        tickers: next,
        weights: nextWeights ?? wl.weights ?? {},
      }),
    });
    setWl({ ...wl, tickers: next, weights: nextWeights ?? wl.weights });
    setRows((prev) => {
      const out: Record<string, RowState> = {};
      next.forEach((t) => {
        out[t] = prev[t] ?? {
          ticker: t,
          loading: false,
          error: null,
          verdict: null,
        };
      });
      return out;
    });
  };

  const addTickers = (tickers: string[]) => {
    setPickerOpen(false);
    if (!wl) return;
    const next = Array.from(new Set([...wl.tickers, ...tickers]));
    void saveTickers(next).then(() => loadCachedVerdicts(next));
  };

  const removeTicker = async (t: string) => {
    if (!wl) return;
    const nextTickers = wl.tickers.filter((x) => x !== t);
    const nextWeights = { ...(wl.weights ?? {}) };
    delete nextWeights[t];
    await saveTickers(nextTickers, nextWeights);
  };

  const runAll = async () => {
    if (!wl) return;
    setRunning(true);
    await Promise.all(
      wl.tickers.map(async (t) => {
        setRows((r) => ({
          ...r,
          [t]: { ...(r[t] ?? { ticker: t }), loading: true, error: null, verdict: null },
        }));
        try {
          const r = await fetch(`/api/verdict/${t}`);
          const data = await r.json();
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
          setRows((rs) => ({
            ...rs,
            [t]: {
              ticker: t,
              loading: false,
              error: null,
              verdict: data.verdict as VerdictDoc,
            },
          }));
        } catch (e) {
          setRows((rs) => ({
            ...rs,
            [t]: {
              ticker: t,
              loading: false,
              error: String(e instanceof Error ? e.message : e),
              verdict: null,
            },
          }));
        }
      }),
    );
    setRunning(false);
  };

  // Persist weights + total + cost basis to Firestore when user clicks Save
  const persistWeights = async () => {
    if (!user || !wl) return;
    setSavingWeights(true);
    try {
      const nextWeights: Record<string, number> = {};
      for (const [t, raw] of Object.entries(weightDraft)) {
        const v = Number(raw);
        if (Number.isFinite(v) && v > 0) nextWeights[t] = v;
      }
      const nextCostBasis: Record<string, number> = {};
      for (const [t, raw] of Object.entries(costBasisDraft)) {
        const v = Number(raw);
        if (Number.isFinite(v) && v > 0) nextCostBasis[t] = v;
      }
      const totalParsed = Number(totalDraft);
      const nextTotal =
        Number.isFinite(totalParsed) && totalParsed > 0 ? totalParsed : undefined;
      const token = await user.getIdToken();
      await fetch(`/api/watchlist/${wl.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: wl.name,
          tickers: wl.tickers,
          weights: nextWeights,
          portfolioTotal: nextTotal,
          costBasis: nextCostBasis,
        }),
      });
      setWl({
        ...wl,
        weights: nextWeights,
        portfolioTotal: nextTotal,
        costBasis: nextCostBasis,
      });
    } finally {
      setSavingWeights(false);
    }
  };

  // ── Derived: portfolio composition + income forecast ─────────────
  const portfolioTotalNum = useMemo(() => {
    const v = Number(totalDraft);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [totalDraft]);

  const composition = useMemo(() => {
    if (!wl) return null;
    const buckets: Record<CapBucket, { weight: number; tickers: string[] }> = {
      Mega: { weight: 0, tickers: [] },
      Large: { weight: 0, tickers: [] },
      Mid: { weight: 0, tickers: [] },
      Small: { weight: 0, tickers: [] },
      Micro: { weight: 0, tickers: [] },
      "—": { weight: 0, tickers: [] },
    };
    let totalWeight = 0;
    let weightedDivYield = 0;
    let weightedDivYieldDenom = 0;

    for (const t of wl.tickers) {
      const raw = weightDraft[t] ?? "";
      const w = Number(raw);
      const weight = Number.isFinite(w) && w > 0 ? w : 0;
      const mcap = rows[t]?.verdict?.marketSnapshot?.marketCap ?? null;
      const bucket = bucketFromMcap(mcap);
      buckets[bucket].weight += weight;
      buckets[bucket].tickers.push(t);
      totalWeight += weight;

      const dy = rows[t]?.verdict?.marketSnapshot?.dividendYield ?? null;
      if (dy != null && weight > 0) {
        weightedDivYield += dy * weight;
        weightedDivYieldDenom += weight;
      }
    }

    return {
      buckets,
      totalWeight,
      portfolioDivYield:
        weightedDivYieldDenom > 0
          ? weightedDivYield / weightedDivYieldDenom
          : null,
    };
  }, [wl, rows, weightDraft]);

  // Per-position P&L — needs portfolioTotalNum + weights + costBasis.
  const pnl = useMemo(() => {
    if (!wl || !portfolioTotalNum) return null;
    const lines: {
      ticker: string;
      currentValue: number;
      costBasis: number | null;
      pnlDollars: number | null;
      pnlPct: number | null;
    }[] = [];
    let totalCurrent = 0;
    let totalCost = 0;
    let coveredPositions = 0;
    for (const t of wl.tickers) {
      const w = Number(weightDraft[t] ?? "");
      if (!Number.isFinite(w) || w <= 0) continue;
      const currentValue = portfolioTotalNum * (w / 100);
      const cb = Number(costBasisDraft[t] ?? "");
      const costBasis = Number.isFinite(cb) && cb > 0 ? cb : null;
      const pnlDollars = costBasis != null ? currentValue - costBasis : null;
      const pnlPct =
        costBasis != null && costBasis > 0
          ? (currentValue - costBasis) / costBasis
          : null;
      lines.push({ ticker: t, currentValue, costBasis, pnlDollars, pnlPct });
      totalCurrent += currentValue;
      if (costBasis != null) {
        totalCost += costBasis;
        coveredPositions++;
      }
    }
    return {
      lines,
      totalCurrent,
      totalCost: coveredPositions > 0 ? totalCost : null,
      totalPnl:
        coveredPositions > 0 && totalCost > 0 ? totalCurrent - totalCost : null,
      totalPnlPct:
        coveredPositions > 0 && totalCost > 0
          ? (totalCurrent - totalCost) / totalCost
          : null,
      coveragePct:
        wl.tickers.filter((t) => Number(weightDraft[t] ?? "") > 0).length > 0
          ? coveredPositions /
            wl.tickers.filter((t) => Number(weightDraft[t] ?? "") > 0).length
          : 0,
    };
  }, [wl, weightDraft, costBasisDraft, portfolioTotalNum]);

  // Per-position income forecast — needs portfolioTotalNum + weights + yields.
  const income = useMemo(() => {
    if (!wl || !portfolioTotalNum) return null;
    const lines: {
      ticker: string;
      companyName: string;
      weight: number;
      positionDollars: number;
      dividendYield: number | null;
      annualIncome: number;
    }[] = [];
    let totalAnnual = 0;
    let totalCovered = 0; // dollars in positions that DO pay a dividend
    let totalAllocated = 0;
    for (const t of wl.tickers) {
      const raw = weightDraft[t] ?? "";
      const w = Number(raw);
      if (!Number.isFinite(w) || w <= 0) continue;
      const positionDollars = portfolioTotalNum * (w / 100);
      const dy = rows[t]?.verdict?.marketSnapshot?.dividendYield ?? null;
      const annualIncome = dy != null ? positionDollars * dy : 0;
      lines.push({
        ticker: t,
        companyName: rows[t]?.verdict?.companyName ?? t,
        weight: w,
        positionDollars,
        dividendYield: dy,
        annualIncome,
      });
      totalAllocated += positionDollars;
      if (dy != null && dy > 0) totalCovered += positionDollars;
      totalAnnual += annualIncome;
    }
    lines.sort((a, b) => b.annualIncome - a.annualIncome);
    return {
      lines,
      totalAnnual,
      totalAllocated,
      totalCovered,
      coveragePct: totalAllocated > 0 ? totalCovered / totalAllocated : 0,
      effectiveYield: totalAllocated > 0 ? totalAnnual / totalAllocated : 0,
    };
  }, [wl, rows, weightDraft, portfolioTotalNum]);

  // ── Auth gate ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <AppShell>
        <div className="pt-6 px-8 pb-12 text-on-surface-variant">Loading…</div>
      </AppShell>
    );
  }
  if (configured && !user) {
    return (
      <AppShell>
        <div className="pt-20 px-8 pb-12 max-w-md mx-auto text-center">
          <h1 className="font-h1 text-h1 mb-4">Sign in to view watchlists</h1>
          <button
            onClick={() => signInWithGoogle().catch((e) => alert(String(e)))}
            className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-caps hover:brightness-110"
          >
            Sign in with Google
          </button>
        </div>
      </AppShell>
    );
  }
  if (!wl) {
    return (
      <AppShell>
        <div className="pt-6 px-8 pb-12 text-on-surface-variant">Loading watchlist…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-6 px-8 pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-8 pb-md border-b border-outline-variant">
          <div>
            <span className="font-label-caps text-label-caps text-indigo-400 mb-1 block">
              WATCHLIST
            </span>
            <h1 className="font-h1 text-h1 text-on-surface">{wl.name}</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              {wl.tickers.length} stocks
              {Object.values(rows).some((r) => r.verdict)
                ? ` · last data refresh ${formatRelativeTime(
                    Math.max(
                      ...Object.values(rows)
                        .map((r) => (r.verdict ? Date.parse(r.verdict.asOf) : 0))
                        .filter((t) => t > 0),
                    ),
                  )}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="border border-outline-variant text-on-surface px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add stocks
            </button>
            <button
              onClick={runAll}
              disabled={running || wl.tickers.length === 0}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg flex items-center gap-2 font-label-caps hover:brightness-110 disabled:opacity-40"
            >
              <span
                className={
                  "material-symbols-outlined text-[18px] " +
                  (running ? "animate-spin" : "")
                }
              >
                {running ? "progress_activity" : "play_arrow"}
              </span>
              {running ? "Running engine…" : "Run all"}
            </button>
          </div>
        </div>

        {wl.tickers.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center">
            <p className="text-on-surface-variant text-sm mb-4">
              This watchlist is empty. Add stocks to start running the engine.
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-caps"
            >
              Add stocks
            </button>
          </div>
        ) : (
          <>
            {/* Portfolio composition panel (donut chart) */}
            {composition && (
              <CompositionPanel
                buckets={composition.buckets}
                totalWeight={composition.totalWeight}
                portfolioDivYield={composition.portfolioDivYield}
              />
            )}

            {/* Income forecast panel */}
            <IncomeForecastPanel
              totalDraft={totalDraft}
              setTotalDraft={setTotalDraft}
              income={income}
            />

            {/* P&L summary panel */}
            <PnLSummaryPanel pnl={pnl} />

            {/* Personalized suggestions */}
            {composition && (
              <SuggestionsPanel
                tickers={wl.tickers}
                rows={rows}
                weightDraft={weightDraft}
                buckets={composition.buckets}
                totalWeight={composition.totalWeight}
                portfolioDivYield={composition.portfolioDivYield}
                annualIncome={income?.totalAnnual ?? null}
              />
            )}

            {/* Save-weights toolbar */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-on-surface-variant">
                Edit the <span className="text-on-surface font-medium">Weight %</span> column to
                set your position sizes. Composition above updates live; click Save to persist.
              </p>
              <button
                onClick={persistWeights}
                disabled={savingWeights}
                className="text-xs font-label-caps bg-primary-container/30 border border-primary/40 text-primary px-3 py-1.5 rounded hover:bg-primary-container/50 disabled:opacity-50"
              >
                {savingWeights ? "Saving…" : "Save weights"}
              </button>
            </div>

            {/* Main table */}
            <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-high/50 border-b border-[#1F2937]">
                    <Th>Ticker</Th>
                    <Th>Company</Th>
                    <Th>Cap</Th>
                    <Th>Verdict</Th>
                    <Th>Score</Th>
                    <Th>Price</Th>
                    <Th>Mkt Cap</Th>
                    <Th>Div Yld</Th>
                    <Th className="bg-primary-container/15">Weight %</Th>
                    <Th className="bg-primary-container/15">Cost $</Th>
                    <Th>P&amp;L</Th>
                    <Th>Est. Div / yr</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {wl.tickers.map((t) => {
                    const row = rows[t];
                    const ms = row?.verdict?.marketSnapshot;
                    const bucket = bucketFromMcap(ms?.marketCap);
                    const divYld = ms?.dividendYield ?? null;
                    const w = Number(weightDraft[t] ?? "");
                    const positionDollars =
                      portfolioTotalNum && Number.isFinite(w) && w > 0
                        ? portfolioTotalNum * (w / 100)
                        : null;
                    const annualDiv =
                      positionDollars != null && divYld != null
                        ? positionDollars * divYld
                        : null;
                    return (
                      <tr key={t} className="hover:bg-[#1A2230] transition-colors">
                        <td className="px-gutter py-3 font-data-md text-data-md text-slate-50">
                          {t}
                        </td>
                        <td className="px-gutter py-3 text-body-sm text-slate-300 max-w-[200px] truncate">
                          {row?.verdict?.companyName ?? "—"}
                        </td>
                        <td className="px-gutter py-3">
                          <span
                            className={
                              "text-[10px] px-2 py-0.5 rounded border font-bold uppercase " +
                              BUCKET_COLORS[bucket]
                            }
                          >
                            {bucket}
                          </span>
                        </td>
                        <td className="px-gutter py-3">
                          {row?.loading ? (
                            <span className="text-xs text-on-surface-variant">running…</span>
                          ) : row?.error ? (
                            <span className="text-xs text-error">error</span>
                          ) : row?.verdict ? (
                            <span
                              className={
                                "text-[10px] px-2 py-0.5 rounded font-bold uppercase " +
                                (row.verdict.verdict === "BUY"
                                  ? "verdict-buy"
                                  : row.verdict.verdict === "SELL"
                                    ? "verdict-sell"
                                    : "verdict-hold")
                              }
                            >
                              {row.verdict.verdict}
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className={"px-gutter py-3 font-data-md text-data-md " + (row?.verdict ? scoreColorClass(row.verdict.totalScore) : "")}>
                          {row?.verdict ? formatScoreContinuous(row.verdict.totalScore) : "—"}
                        </td>
                        <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                          {ms?.price != null ? `$${ms.price.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                          {formatMcap(ms?.marketCap)}
                        </td>
                        <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                          {divYld != null ? `${(divYld * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-gutter py-3">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={weightDraft[t] ?? ""}
                            onChange={(e) =>
                              setWeightDraft((prev) => ({ ...prev, [t]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-20 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-sm font-data-md text-on-surface focus:outline-none focus:border-primary"
                          />
                          <span className="text-xs text-on-surface-variant ml-1">%</span>
                        </td>
                        <td className="px-gutter py-3">
                          <span className="text-xs text-on-surface-variant">$</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={costBasisDraft[t] ?? ""}
                            onChange={(e) =>
                              setCostBasisDraft((prev) => ({
                                ...prev,
                                [t]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            title="What you paid for this position (total $ invested)"
                            className="w-24 bg-surface-container-low border border-outline-variant rounded px-2 py-1 text-sm font-data-md text-on-surface focus:outline-none focus:border-primary ml-1"
                          />
                        </td>
                        <td className="px-gutter py-3 font-data-md text-data-md">
                          {(() => {
                            const line = pnl?.lines.find((l) => l.ticker === t);
                            if (!line || line.pnlDollars == null) {
                              return <span className="text-on-surface-variant">—</span>;
                            }
                            const colorClass =
                              line.pnlDollars > 0
                                ? "text-secondary"
                                : line.pnlDollars < 0
                                  ? "text-tertiary"
                                  : "text-on-surface-variant";
                            return (
                              <span className={colorClass}>
                                {line.pnlDollars >= 0 ? "+" : ""}$
                                {Math.abs(line.pnlDollars).toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                                <span className="text-xs ml-1">
                                  ({line.pnlPct! >= 0 ? "+" : ""}
                                  {(line.pnlPct! * 100).toFixed(1)}%)
                                </span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-gutter py-3 font-data-md text-data-md">
                          {annualDiv != null
                            ? annualDiv > 0
                              ? <span className="text-secondary">${annualDiv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              : <span className="text-on-surface-variant">$0</span>
                            : <span className="text-on-surface-variant">—</span>}
                        </td>
                        <td className="px-gutter py-3 text-right">
                          <Link
                            href={`/stock/${t}`}
                            className="text-[11px] font-bold text-indigo-400 uppercase hover:text-indigo-300 mr-3"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => void removeTicker(t)}
                            className="text-[11px] font-bold text-tertiary uppercase hover:text-tertiary-container"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <StockPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAnalyze={addTickers}
      />
    </AppShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        "px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest " +
        (className ?? "")
      }
    >
      {children}
    </th>
  );
}

// ────────────────────────────────────────────────────────────────────
// Portfolio composition panel
// ────────────────────────────────────────────────────────────────────

const BUCKET_BAR_COLORS: Record<CapBucket, string> = {
  Mega: "bg-primary",
  Large: "bg-secondary",
  Mid: "bg-amber-400",
  Small: "bg-tertiary",
  Micro: "bg-outline",
  "—": "bg-surface-container-highest",
};

const BUCKET_HEX: Record<CapBucket, string> = {
  Mega: "#c0c1ff",     // primary
  Large: "#4de082",    // secondary
  Mid: "#fbbf24",      // amber-400
  Small: "#ffb3b0",    // tertiary
  Micro: "#908fa0",    // outline
  "—": "#2c3543",      // surface-container-highest
};

// SVG donut chart — pure CSS, no chart library.
// Each slice is an arc on a circle of radius 40. We draw each slice
// with its own <circle> using stroke-dasharray.
function DonutChart({
  slices,
  size = 220,
  centerLabel,
  centerSubLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel: string;
  centerSubLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const r = 40;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle cx="50" cy="50" r={r} fill="transparent" stroke="#16202d" strokeWidth="14" />
        {slices.map((s, i) => {
          const pct = s.value / total;
          const dash = pct * circ;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="font-display-lg text-display-lg text-on-surface leading-none">
          {centerLabel}
        </div>
        {centerSubLabel && (
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
            {centerSubLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function CompositionPanel({
  buckets,
  totalWeight,
  portfolioDivYield,
}: {
  buckets: Record<CapBucket, { weight: number; tickers: string[] }>;
  totalWeight: number;
  portfolioDivYield: number | null;
}) {
  const ordered: CapBucket[] = ["Mega", "Large", "Mid", "Small", "Micro", "—"];
  const allocated = ordered
    .map((b) => ({ b, ...buckets[b] }))
    .filter((x) => x.weight > 0);

  const status =
    totalWeight === 0
      ? { label: "No weights set", color: "text-on-surface-variant" }
      : Math.abs(totalWeight - 100) < 0.5
        ? { label: "Balanced (100%)", color: "text-secondary" }
        : totalWeight > 100
          ? { label: `Over-allocated (+${(totalWeight - 100).toFixed(1)}%)`, color: "text-tertiary" }
          : { label: `${(100 - totalWeight).toFixed(1)}% unallocated`, color: "text-amber-300" };

  const donutSlices = allocated.map((x) => ({
    label: `${x.b} cap`,
    value: x.weight,
    color: BUCKET_HEX[x.b],
  }));

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline-variant">
        <h3 className="font-label-caps text-label-caps">PORTFOLIO COMPOSITION</h3>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-on-surface-variant">Total weight: </span>
            <span className={"font-data-md " + status.color}>
              {totalWeight.toFixed(1)}%
            </span>
            <span className={"ml-2 " + status.color}>· {status.label}</span>
          </div>
          {portfolioDivYield != null && (
            <div className="border-l border-outline-variant pl-4">
              <span className="text-on-surface-variant">Portfolio yield: </span>
              <span className="font-data-md text-secondary">
                {(portfolioDivYield * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-md">
        {totalWeight === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            Set weight % on each row below to see your cap-size distribution as a
            donut chart, plus portfolio dividend yield.
          </p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            {/* Donut */}
            <div className="flex-shrink-0">
              <DonutChart
                slices={donutSlices}
                size={220}
                centerLabel={`${totalWeight.toFixed(0)}%`}
                centerSubLabel="Allocated"
              />
            </div>

            {/* Legend / per-bucket breakdown */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
              {allocated.map((x) => {
                const pctOfPortfolio =
                  totalWeight > 0 ? (x.weight / totalWeight) * 100 : 0;
                return (
                  <div
                    key={x.b}
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: BUCKET_HEX[x.b] }}
                        />
                        <span className="font-label-caps text-on-surface">
                          {x.b} cap
                        </span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant">
                        {x.tickers.length} stock{x.tickers.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="font-data-lg text-data-lg text-on-surface mb-1">
                      {x.weight.toFixed(1)}%
                      <span className="font-body-sm text-xs text-on-surface-variant ml-2">
                        ({pctOfPortfolio.toFixed(0)}% of alloc)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {x.tickers.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] font-data-sm bg-surface-container-highest px-1.5 py-0.5 rounded text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                      {x.tickers.length > 6 && (
                        <span className="text-[9px] text-on-surface-variant">
                          +{x.tickers.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Income forecast panel
// ────────────────────────────────────────────────────────────────────

interface IncomeData {
  lines: {
    ticker: string;
    companyName: string;
    weight: number;
    positionDollars: number;
    dividendYield: number | null;
    annualIncome: number;
  }[];
  totalAnnual: number;
  totalAllocated: number;
  totalCovered: number;
  coveragePct: number;
  effectiveYield: number;
}

function formatDollars(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function IncomeForecastPanel({
  totalDraft,
  setTotalDraft,
  income,
}: {
  totalDraft: string;
  setTotalDraft: (s: string) => void;
  income: IncomeData | null;
}) {
  const hasTotal = !!income && income.totalAllocated > 0;

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px]">
            paid
          </span>
          <h3 className="font-label-caps text-label-caps">DIVIDEND INCOME FORECAST</h3>
        </div>
        <span className="text-[10px] text-on-surface-variant">
          Based on TTM yields · not investment advice
        </span>
      </div>

      <div className="p-md">
        {/* Portfolio total input row */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 pb-4 border-b border-outline-variant">
          <label className="font-label-caps text-on-surface flex-shrink-0">
            Total portfolio value:
          </label>
          <div className="flex items-center gap-1">
            <span className="text-on-surface-variant text-sm">$</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={totalDraft}
              onChange={(e) => setTotalDraft(e.target.value)}
              placeholder="100000"
              className="w-40 bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-sm font-data-md text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs text-on-surface-variant">
            {hasTotal
              ? "Click 'Save weights' below to persist."
              : "Enter your total invested capital. Position $ and dividend $ are computed from this × weights."}
          </span>
        </div>

        {!hasTotal ? (
          <div className="text-center py-4 text-sm text-on-surface-variant">
            Set portfolio value + weights to see your forecast next-year dividend income.
          </div>
        ) : (
          <>
            {/* Headline numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <HeadlineMetric
                label="Annual income (est.)"
                value={formatDollars(income!.totalAnnual)}
                color="text-secondary"
                emphasis
              />
              <HeadlineMetric
                label="Monthly average"
                value={formatDollars(income!.totalAnnual / 12)}
                color="text-secondary"
              />
              <HeadlineMetric
                label="Effective yield on allocated"
                value={`${(income!.effectiveYield * 100).toFixed(2)}%`}
                color="text-on-surface"
              />
              <HeadlineMetric
                label="Yield-paying coverage"
                value={`${(income!.coveragePct * 100).toFixed(0)}%`}
                color="text-on-surface"
                hint={`${formatDollars(income!.totalCovered)} of ${formatDollars(income!.totalAllocated)}`}
              />
            </div>

            {/* Top contributors */}
            {income!.lines.filter((l) => l.annualIncome > 0).length > 0 && (
              <div>
                <p className="font-label-caps text-on-surface-variant mb-2">
                  TOP CONTRIBUTORS
                </p>
                <div className="space-y-1">
                  {income!.lines
                    .filter((l) => l.annualIncome > 0)
                    .slice(0, 5)
                    .map((l) => {
                      const pctOfIncome =
                        income!.totalAnnual > 0
                          ? (l.annualIncome / income!.totalAnnual) * 100
                          : 0;
                      return (
                        <div
                          key={l.ticker}
                          className="flex items-center gap-3 py-1.5"
                        >
                          <span className="font-data-md text-on-surface w-16">
                            {l.ticker}
                          </span>
                          <div className="flex-1 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                            <div
                              className="h-full bg-secondary"
                              style={{ width: `${pctOfIncome}%` }}
                            />
                          </div>
                          <span className="font-data-sm text-on-surface-variant text-xs w-32 text-right">
                            {formatDollars(l.annualIncome)} / yr
                            <span className="text-on-surface-variant ml-1">
                              ({l.dividendYield != null ? (l.dividendYield * 100).toFixed(2) : "0"}%)
                            </span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Caveats */}
            <div className="mt-4 pt-4 border-t border-outline-variant grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-on-surface-variant">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-[14px] text-amber-300 flex-shrink-0 mt-0.5">
                  warning
                </span>
                <span>
                  TTM yields, not forecasts. Companies cut or hike dividends — these numbers move.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-[14px] text-amber-300 flex-shrink-0 mt-0.5">
                  info
                </span>
                <span>
                  Buybacks excluded. Some low-yield names (AAPL ~0.6%) return more via buybacks (~3%).
                </span>
              </div>
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-[14px] text-amber-300 flex-shrink-0 mt-0.5">
                  public
                </span>
                <span>
                  Foreign ADRs (BABA, JD, etc.) may lose 10-30% to withholding tax. Net is lower.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// P&L summary panel
// ────────────────────────────────────────────────────────────────────

interface PnLData {
  lines: {
    ticker: string;
    currentValue: number;
    costBasis: number | null;
    pnlDollars: number | null;
    pnlPct: number | null;
  }[];
  totalCurrent: number;
  totalCost: number | null;
  totalPnl: number | null;
  totalPnlPct: number | null;
  coveragePct: number;
}

function PnLSummaryPanel({ pnl }: { pnl: PnLData | null }) {
  if (!pnl) return null;
  const hasCostBasis =
    pnl.totalPnl != null && pnl.totalCost != null && pnl.totalCost > 0;

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span
            className={
              "material-symbols-outlined text-[18px] " +
              (pnl.totalPnl != null && pnl.totalPnl > 0
                ? "text-secondary"
                : pnl.totalPnl != null && pnl.totalPnl < 0
                  ? "text-tertiary"
                  : "text-on-surface-variant")
            }
          >
            trending_up
          </span>
          <h3 className="font-label-caps text-label-caps">UNREALIZED P&amp;L</h3>
        </div>
        <span className="text-[10px] text-on-surface-variant">
          Current value (weight × total) − cost basis
        </span>
      </div>
      <div className="p-md">
        {!hasCostBasis ? (
          <p className="text-sm text-on-surface-variant text-center py-3">
            Enter <span className="text-on-surface font-medium">Cost $</span> for each position
            below — what you actually paid for it. P&amp;L per position and the portfolio total
            will appear here once at least one cost basis is set.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <HeadlineMetric
              label="Total invested (cost basis)"
              value={`$${pnl.totalCost!.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="text-on-surface"
            />
            <HeadlineMetric
              label="Current value"
              value={`$${pnl.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="text-on-surface"
            />
            <HeadlineMetric
              label="Unrealized P&L"
              value={`${pnl.totalPnl! >= 0 ? "+" : "−"}$${Math.abs(pnl.totalPnl!).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color={pnl.totalPnl! >= 0 ? "text-secondary" : "text-tertiary"}
              emphasis
            />
            <HeadlineMetric
              label="Return %"
              value={`${pnl.totalPnlPct! >= 0 ? "+" : ""}${(pnl.totalPnlPct! * 100).toFixed(1)}%`}
              color={pnl.totalPnlPct! >= 0 ? "text-secondary" : "text-tertiary"}
              hint={`Coverage: ${(pnl.coveragePct * 100).toFixed(0)}% of positions have cost basis set`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HeadlineMetric({
  label,
  value,
  color,
  emphasis,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={
        "rounded-lg p-3 border " +
        (emphasis
          ? "bg-secondary/10 border-secondary/40"
          : "bg-surface-container-low border-outline-variant")
      }
    >
      <p className="font-label-caps text-on-surface-variant mb-1">{label}</p>
      <p className={"font-display-lg text-display-lg leading-tight " + color}>
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-on-surface-variant mt-1">{hint}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Personalized suggestions
// ────────────────────────────────────────────────────────────────────

interface Suggestion {
  severity: "good" | "info" | "warn" | "alert";
  title: string;
  body: string;
}

function buildSuggestions(args: {
  tickers: string[];
  rows: Record<string, RowState>;
  weights: Record<string, number>;
  buckets: Record<CapBucket, { weight: number; tickers: string[] }>;
  totalWeight: number;
  portfolioDivYield: number | null;
  annualIncome: number | null;
}): Suggestion[] {
  const out: Suggestion[] = [];
  const {
    tickers,
    rows,
    weights,
    buckets,
    totalWeight,
    portfolioDivYield,
    annualIncome,
  } = args;

  // ── 0. Empty state ──────────────────────────────────────────────
  if (totalWeight === 0) {
    out.push({
      severity: "info",
      title: "Add weights to unlock personalized analysis",
      body: "Type a percentage into each Weight % cell and click Save. The engine will then analyze concentration risk, sector exposure, conviction-vs-weight mismatches, and pillar gaps — and surface specific rebalance ideas.",
    });
    return out;
  }

  // Holdings with weight + engine output joined.
  // Includes pillars + sector data when available.
  const holdings = tickers
    .map((t) => {
      const verdict = rows[t]?.verdict;
      return {
        ticker: t,
        companyName: verdict?.companyName ?? t,
        weight: weights[t] ?? 0,
        verdict: verdict?.verdict ?? null,
        score: verdict?.totalScore ?? 0,
        pillars: verdict?.pillars ?? [],
        sector: verdict?.marketSnapshot?.sector ?? null,
        beta: verdict?.marketSnapshot?.beta ?? null,
      };
    })
    .filter((h) => h.weight > 0);

  // ── 1. Allocation balance ──────────────────────────────────────
  if (Math.abs(totalWeight - 100) > 0.5) {
    out.push({
      severity: totalWeight > 100 ? "alert" : "warn",
      title:
        totalWeight > 100
          ? `Over-allocated: ${(totalWeight - 100).toFixed(1)}% above 100%`
          : `${(100 - totalWeight).toFixed(1)}% sits in cash / unallocated`,
      body:
        totalWeight > 100
          ? "Total exceeds 100%. Trim or rescale — analysis below treats your weights at face value, so over-allocation will overstate risk."
          : `Holding ${(100 - totalWeight).toFixed(1)}% in cash is reasonable as dry powder, but at current short-term Treasury yields (~4%), idle cash earns more than many low-conviction equity positions. Either deploy it or accept the drag.`,
    });
  }

  // ── 2. Score-weighted portfolio assessment (the headline metric) ─
  const weightedScoreSum = holdings.reduce((s, h) => s + h.score * h.weight, 0);
  const weightedScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 0;
  out.push({
    severity:
      weightedScore > 0.20 ? "good" :
      weightedScore < -0.10 ? "alert" :
      weightedScore > 0 ? "info" : "warn",
    title: `Portfolio weighted score: ${weightedScore >= 0 ? "+" : ""}${weightedScore.toFixed(2)} ${
      weightedScore > 0.20 ? "— strong" :
      weightedScore < -0.10 ? "— weak" : "— neutral"
    }`,
    body:
      weightedScore > 0.20
        ? "Your weighted-average engine score is meaningfully positive. Your capital is concentrated in higher-scored names. Continue holding and let compounders compound — frequent trading would erode this edge."
        : weightedScore > 0
          ? "Slight positive tilt. Most holdings score above neutral, but there's room to rotate weight away from the lower-scored positions toward the highest-conviction ones."
          : weightedScore < -0.10
            ? "Your weighted score is negative — meaning the engine sees more headwinds than tailwinds across your holdings as a whole. Look at the Risks section on each position before adding capital."
            : "Roughly neutral. Engine signals are mixed across holdings. The 'Conviction vs weight' mismatches below show where rebalancing would lift the score most.",
  });

  // ── 3. Portfolio-level pillar aggregation ───────────────────────
  // Weighted average of each pillar's score across holdings.
  const pillarTotals: Record<string, { sum: number; weight: number }> = {
    Quality: { sum: 0, weight: 0 },
    Growth: { sum: 0, weight: 0 },
    Valuation: { sum: 0, weight: 0 },
    Sustainability: { sum: 0, weight: 0 },
  };
  for (const h of holdings) {
    for (const p of h.pillars) {
      const slot = pillarTotals[p.pillar];
      if (slot) {
        slot.sum += p.score * h.weight;
        slot.weight += h.weight;
      }
    }
  }
  const pillarScores = Object.entries(pillarTotals)
    .filter(([, v]) => v.weight > 0)
    .map(([k, v]) => ({ pillar: k, score: v.sum / v.weight }));
  if (pillarScores.length === 4) {
    const sorted = [...pillarScores].sort((a, b) => a.score - b.score);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];
    if (weakest.score < -0.10 || strongest.score > 0.30) {
      out.push({
        severity: weakest.score < -0.20 ? "warn" : "info",
        title: `Pillar profile: strongest in ${strongest.pillar} (${strongest.score >= 0 ? "+" : ""}${strongest.score.toFixed(2)}), weakest in ${weakest.pillar} (${weakest.score >= 0 ? "+" : ""}${weakest.score.toFixed(2)})`,
        body:
          weakest.score < -0.10
            ? `Your portfolio has a structural gap in ${weakest.pillar.toLowerCase()}. ` +
              (weakest.pillar === "Valuation"
                ? "Most of your holdings are trading at premium valuations. You're paying up for quality — fine if you're long-horizon, painful if multiples compress."
                : weakest.pillar === "Sustainability"
                  ? "Several of your holdings carry meaningful debt or weak interest coverage. A recession or rate spike would hurt them disproportionately."
                  : weakest.pillar === "Growth"
                    ? "Your holdings are mature businesses with limited revenue/FCF growth. Total return will lean on dividends and buybacks more than compounding."
                    : "Quality scores (Piotroski, ROIC, margin trend) are weak across the portfolio. Earnings reliability is below average."
              )
            : `Engine sees genuine ${strongest.pillar.toLowerCase()} edge across your holdings. That's a durable competitive advantage if it persists.`,
      });
    }
  }

  // ── 4. Conviction vs weight mismatch ────────────────────────────
  // Find positions where weight rank ≠ score rank — your money isn't
  // in your highest-conviction names.
  const byScore = [...holdings].sort((a, b) => b.score - a.score);
  const byWeight = [...holdings].sort((a, b) => b.weight - a.weight);
  if (holdings.length >= 4) {
    const lowScoreHighWeight = holdings.filter(
      (h) =>
        h.score < 0 &&
        byWeight.findIndex((x) => x.ticker === h.ticker) < 3,
    );
    const highScoreLowWeight = holdings.filter(
      (h) =>
        h.score > 0.3 &&
        byWeight.findIndex((x) => x.ticker === h.ticker) >= holdings.length / 2,
    );
    if (lowScoreHighWeight.length > 0) {
      const examples = lowScoreHighWeight
        .map((h) => `${h.ticker} (${h.weight.toFixed(1)}% weight, ${h.score >= 0 ? "+" : ""}${h.score.toFixed(2)} score)`)
        .join(", ");
      out.push({
        severity: "warn",
        title: `Conviction-weight mismatch: top-weighted positions have weak scores`,
        body: `Your money is concentrated in ${examples} — but the engine doesn't see strong fundamentals there. Either you have a thesis the math can't see (legitimate, but worth writing down), or the position deserves to be smaller. Consider trimming and redirecting to your highest-scored names.`,
      });
    }
    if (highScoreLowWeight.length > 0 && holdings.length >= 6) {
      const examples = highScoreLowWeight
        .slice(0, 3)
        .map((h) => `${h.ticker} (+${h.score.toFixed(2)} but only ${h.weight.toFixed(1)}%)`)
        .join(", ");
      out.push({
        severity: "info",
        title: `Highest-conviction names are under-weighted`,
        body: `${examples}. The engine sees real edge in these names but they're small in your portfolio. Sizing up would lift weighted score — assuming your independent analysis agrees.`,
      });
    }
  }

  // ── 5. Specific rebalance suggestion ────────────────────────────
  // The most actionable one: pick the most negative-score position
  // with non-trivial weight, suggest trimming and rotating to the
  // highest-score holding.
  if (holdings.length >= 4 && byScore.length >= 2) {
    const topGain = byScore[0];
    const topDrag = byScore[byScore.length - 1];
    if (topGain.score - topDrag.score > 0.4 && topDrag.weight >= 2) {
      const trimAmount = Math.min(topDrag.weight * 0.5, 5);
      const liftEstimate = (topGain.score - topDrag.score) * (trimAmount / 100);
      out.push({
        severity: "info",
        title: `Rebalance idea: trim ${topDrag.ticker}, rotate into ${topGain.ticker}`,
        body: `Moving ${trimAmount.toFixed(1)}% from ${topDrag.ticker} (${topDrag.score >= 0 ? "+" : ""}${topDrag.score.toFixed(2)}) into ${topGain.ticker} (+${topGain.score.toFixed(2)}) would lift your portfolio's weighted score by approximately +${liftEstimate.toFixed(3)}. This is mechanical math — verify the thesis on each before acting.`,
      });
    }
  }

  // ── 6. Single-position concentration ────────────────────────────
  const sortedByWeight = [...holdings].sort((a, b) => b.weight - a.weight);
  if (sortedByWeight.length > 0) {
    const top = sortedByWeight[0];
    const pctOfPortfolio = (top.weight / totalWeight) * 100;
    if (pctOfPortfolio > 25) {
      out.push({
        severity: "warn",
        title: `Heavy concentration in ${top.ticker} (${pctOfPortfolio.toFixed(0)}% of portfolio)`,
        body: `A single-stock position above 25% means one earnings miss or accounting issue can move your whole portfolio 5-10% in a day. Diversified retail portfolios usually cap individual positions at 10-15% — even when conviction is high. ${top.score < 0 ? `Especially relevant here because ${top.ticker} has a negative engine score.` : ""}`,
      });
    }
  }

  // ── 7. Sector concentration ─────────────────────────────────────
  const sectorBuckets: Record<string, { weight: number; tickers: string[] }> = {};
  for (const h of holdings) {
    if (!h.sector) continue;
    if (!sectorBuckets[h.sector]) {
      sectorBuckets[h.sector] = { weight: 0, tickers: [] };
    }
    sectorBuckets[h.sector].weight += h.weight;
    sectorBuckets[h.sector].tickers.push(h.ticker);
  }
  const sectorEntries = Object.entries(sectorBuckets)
    .map(([sec, v]) => ({ sector: sec, ...v, pct: (v.weight / totalWeight) * 100 }))
    .sort((a, b) => b.weight - a.weight);
  if (sectorEntries.length > 0 && sectorEntries[0].pct > 40) {
    const top = sectorEntries[0];
    out.push({
      severity: top.pct > 60 ? "warn" : "info",
      title: `${top.sector} concentration: ${top.pct.toFixed(0)}% of portfolio`,
      body: `${top.tickers.join(", ")} all sit in ${top.sector}. Sector concentration above 40% means a single regulatory or macro event affects most of your portfolio at once. Consider whether holdings in adjacent sectors with similar fundamentals would smooth this out.`,
    });
  }

  // ── 8. Cap-size diversification ─────────────────────────────────
  const megaLargeWeight = buckets.Mega.weight + buckets.Large.weight;
  const smallMicroWeight = buckets.Small.weight + buckets.Micro.weight;
  const megaLargePct = (megaLargeWeight / totalWeight) * 100;
  const smallMicroPct = (smallMicroWeight / totalWeight) * 100;
  if (megaLargePct > 90 && tickers.length >= 5) {
    out.push({
      severity: "info",
      title: `Mega/Large-cap dominant (${megaLargePct.toFixed(0)}% of portfolio)`,
      body: "Mega/Large-cap exposure means lower volatility but historically lower long-run returns than mid/small. Adding 10-15% mid-cap exposure typically improves the risk/return ratio. Filter the Universe page (BUY + Mid-cap) for candidates.",
    });
  }
  if (smallMicroPct > 30) {
    out.push({
      severity: "warn",
      title: `Heavy small/micro cap (${smallMicroPct.toFixed(0)}% of portfolio)`,
      body: "Small and micro caps can deliver outsized long-term returns but with 2-3x the volatility of large caps. Drawdowns of 50%+ are normal even for good companies. Make sure this is sized appropriately for your time horizon and ability to hold through turbulence.",
    });
  }

  // ── 9. Verdict mix ──────────────────────────────────────────────
  const sells = holdings.filter((h) => h.verdict === "SELL");
  if (sells.length > 0) {
    const total = sells.reduce((s, h) => s + h.weight, 0);
    const totalPct = (total / totalWeight) * 100;
    out.push({
      severity: totalPct > 10 ? "alert" : "warn",
      title: `${sells.length} position${sells.length === 1 ? "" : "s"} flagged SELL by the engine (${totalPct.toFixed(0)}% of portfolio)`,
      body:
        `Engine signals SELL on: ${sells.map((s) => `${s.ticker} (${s.score >= 0 ? "+" : ""}${s.score.toFixed(2)}, ${s.weight.toFixed(1)}%)`).join(", ")}. ` +
        "These have the most negative weighted scores in your portfolio. Click 'View' on each row to see exactly which models are flagging concerns — sometimes it's noise (e.g., low confidence on missing data) and sometimes it's a real risk.",
    });
  }
  const buys = holdings.filter((h) => h.verdict === "BUY");
  if (buys.length >= 2) {
    const top = [...buys].sort((a, b) => b.score - a.score).slice(0, 3);
    out.push({
      severity: "good",
      title: `${buys.length} positions rated BUY (${((buys.reduce((s, h) => s + h.weight, 0) / totalWeight) * 100).toFixed(0)}% of portfolio)`,
      body: `Highest-scoring: ${top.map((h) => `${h.ticker} (+${h.score.toFixed(2)})`).join(", ")}. Engine sees these as undervalued or compounding strongly relative to fundamentals — your money is sitting in good places for these.`,
    });
  }

  // ── 10. Beta-weighted volatility ────────────────────────────────
  const betaSamples = holdings.filter((h) => h.beta != null);
  if (betaSamples.length >= 3) {
    const totalBetaWeight = betaSamples.reduce((s, h) => s + h.weight, 0);
    const portfolioBeta =
      betaSamples.reduce((s, h) => s + (h.beta ?? 0) * h.weight, 0) /
      totalBetaWeight;
    if (portfolioBeta > 1.3) {
      out.push({
        severity: "info",
        title: `Portfolio beta ≈ ${portfolioBeta.toFixed(2)} — high market sensitivity`,
        body: `Your weighted beta is ${portfolioBeta.toFixed(2)} vs. market 1.0, meaning a 10% market drop would tend to drop your portfolio ${(portfolioBeta * 10).toFixed(0)}%. That's a feature in bull markets and a bug in bear ones. If you're nearing a goal where you can't afford a 30%+ drawdown, consider rotating some weight to lower-beta names (utilities, staples, healthcare).`,
      });
    } else if (portfolioBeta < 0.8) {
      out.push({
        severity: "info",
        title: `Portfolio beta ≈ ${portfolioBeta.toFixed(2)} — defensive positioning`,
        body: "Below-market beta means smoother rides but typically lower long-run returns vs. the index. Fine if capital preservation is the priority.",
      });
    }
  }

  // ── 11. Income forecast commentary ──────────────────────────────
  if (annualIncome != null && annualIncome > 0) {
    const monthly = annualIncome / 12;
    out.push({
      severity: "good",
      title: `Estimated annual dividends: $${annualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      body:
        `Based on TTM yields and your weights, this portfolio should generate roughly ` +
        `$${annualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year ` +
        `(~$${monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month). ` +
        `If reinvested at the same yield, it would compound — and yield growth from your dividend payers is the real long-term lever.`,
    });
  }

  // ── 12. Yield commentary ────────────────────────────────────────
  if (portfolioDivYield != null) {
    const yieldPct = portfolioDivYield * 100;
    if (yieldPct < 1.0 && totalWeight > 50) {
      out.push({
        severity: "info",
        title: `Growth-tilted portfolio (yield ${yieldPct.toFixed(2)}%)`,
        body: "Negligible income — fine if your goal is appreciation. If you'll need supplemental income later (retirement runway), consider a 10-20% sleeve in higher-yield names (dividend aristocrats, utilities) to smooth withdrawal volatility.",
      });
    } else if (yieldPct >= 3.0) {
      out.push({
        severity: "good",
        title: `Income-tilted portfolio (yield ${yieldPct.toFixed(2)}%)`,
        body: `You're collecting roughly ${yieldPct.toFixed(2)}% per year in dividends from this portfolio. Decent inflation hedge if dividend growth keeps pace — verify by checking each position's 5-year dividend CAGR.`,
      });
    }
  }

  return out;
}

const SEVERITY_STYLE: Record<Suggestion["severity"], { border: string; icon: string; iconColor: string }> = {
  good: { border: "border-secondary/40 bg-secondary/5", icon: "check_circle", iconColor: "text-secondary" },
  info: { border: "border-primary/40 bg-primary/5", icon: "info", iconColor: "text-primary" },
  warn: { border: "border-amber-400/40 bg-amber-400/5", icon: "warning", iconColor: "text-amber-300" },
  alert: { border: "border-tertiary/40 bg-tertiary/5", icon: "error", iconColor: "text-tertiary" },
};

function SuggestionsPanel({
  tickers,
  rows,
  weightDraft,
  buckets,
  totalWeight,
  portfolioDivYield,
  annualIncome,
}: {
  tickers: string[];
  rows: Record<string, RowState>;
  weightDraft: Record<string, string>;
  buckets: Record<CapBucket, { weight: number; tickers: string[] }>;
  totalWeight: number;
  portfolioDivYield: number | null;
  annualIncome: number | null;
}) {
  const weights: Record<string, number> = {};
  for (const [t, raw] of Object.entries(weightDraft)) {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) weights[t] = v;
  }
  const suggestions = buildSuggestions({
    tickers,
    rows,
    weights,
    buckets,
    totalWeight,
    portfolioDivYield,
    annualIncome,
  });

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">
            psychology
          </span>
          <h3 className="font-label-caps text-label-caps">PERSONALIZED SUGGESTIONS</h3>
        </div>
        <span className="text-[10px] text-on-surface-variant">
          Based on weights + engine scores · not investment advice
        </span>
      </div>

      <div className="p-md grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((s, i) => {
          const style = SEVERITY_STYLE[s.severity];
          return (
            <div
              key={i}
              className={"border rounded-lg p-3 " + style.border}
            >
              <div className="flex items-start gap-2">
                <span
                  className={"material-symbols-outlined text-[18px] mt-0.5 " + style.iconColor}
                >
                  {style.icon}
                </span>
                <div className="flex-1">
                  <div className="font-body-md font-semibold text-on-surface text-sm mb-1">
                    {s.title}
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
