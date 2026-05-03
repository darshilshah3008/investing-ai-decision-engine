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

interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
  weights?: Record<string, number>;
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

  // Persist weights to Firestore when user clicks Save
  const persistWeights = async () => {
    if (!user || !wl) return;
    setSavingWeights(true);
    try {
      const nextWeights: Record<string, number> = {};
      for (const [t, raw] of Object.entries(weightDraft)) {
        const v = Number(raw);
        if (Number.isFinite(v) && v > 0) nextWeights[t] = v;
      }
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
        }),
      });
      setWl({ ...wl, weights: nextWeights });
    } finally {
      setSavingWeights(false);
    }
  };

  // ── Derived: portfolio composition ───────────────────────────────
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
              {wl.tickers.length} stocks · last updated just now
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
            {/* Portfolio composition panel */}
            {composition && (
              <CompositionPanel
                buckets={composition.buckets}
                totalWeight={composition.totalWeight}
                portfolioDivYield={composition.portfolioDivYield}
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
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {wl.tickers.map((t) => {
                    const row = rows[t];
                    const ms = row?.verdict?.marketSnapshot;
                    const bucket = bucketFromMcap(ms?.marketCap);
                    const divYld = ms?.dividendYield ?? null;
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
                        <td className="px-gutter py-3 font-data-md text-data-md">
                          {row?.verdict
                            ? (row.verdict.totalScore >= 0 ? "+" : "") +
                              row.verdict.totalScore.toFixed(2)
                            : "—"}
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
          <p className="text-sm text-on-surface-variant text-center py-3">
            Set weight % on each row below to see your cap-size distribution and
            portfolio dividend yield.
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="h-3 w-full bg-surface-container-lowest rounded-full overflow-hidden flex mb-4">
              {ordered.map((b) => {
                const pct = totalWeight > 0 ? (buckets[b].weight / totalWeight) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={b}
                    className={BUCKET_BAR_COLORS[b]}
                    style={{ width: `${pct}%` }}
                    title={`${b}: ${buckets[b].weight.toFixed(1)}% (${pct.toFixed(0)}% of allocated)`}
                  />
                );
              })}
            </div>

            {/* Per-bucket detail */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {allocated.map((x) => {
                const pctOfPortfolio = totalWeight > 0 ? (x.weight / totalWeight) * 100 : 0;
                return (
                  <div
                    key={x.b}
                    className="bg-surface-container-low border border-outline-variant rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={"w-2 h-2 rounded-full " + BUCKET_BAR_COLORS[x.b]} />
                      <span className="font-label-caps text-on-surface">{x.b} cap</span>
                    </div>
                    <div className="font-data-lg text-data-lg text-on-surface mb-1">
                      {x.weight.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-on-surface-variant">
                      {pctOfPortfolio.toFixed(0)}% of allocated · {x.tickers.length} stock{x.tickers.length === 1 ? "" : "s"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {x.tickers.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] font-data-sm bg-surface-container-highest px-1.5 py-0.5 rounded text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                      {x.tickers.length > 5 && (
                        <span className="text-[9px] text-on-surface-variant">
                          +{x.tickers.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
