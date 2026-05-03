"use client";

// Watchlist detail page — adapted from Stitch screen (6) HTML.
// Shows the watchlist as a sortable table; lets the user add/remove
// tickers and run all of them through the engine.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StockPickerDialog } from "@/components/stock-picker-dialog";
import { useAuth } from "@/lib/firebase/auth-context";
import type { VerdictDoc } from "@/lib/analysis/types";

interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
}

interface RowState {
  ticker: string;
  loading: boolean;
  error: string | null;
  verdict: VerdictDoc | null;
}

export default function WatchlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, configured, signInWithGoogle } = useAuth();
  const [wl, setWl] = useState<WatchlistEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    user.getIdToken().then((token) => {
      fetch(`/api/watchlist/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { watchlist: WatchlistEntry } | null) => {
          if (data?.watchlist) {
            setWl(data.watchlist);
            setRows(
              Object.fromEntries(
                data.watchlist.tickers.map((t) => [
                  t,
                  { ticker: t, loading: false, error: null, verdict: null },
                ]),
              ),
            );
          }
        });
    });
  }, [user, id]);

  const saveTickers = async (next: string[]) => {
    if (!user || !wl) return;
    const token = await user.getIdToken();
    await fetch(`/api/watchlist/${wl.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: wl.name, tickers: next }),
    });
    setWl({ ...wl, tickers: next });
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
    void saveTickers(next);
  };

  const removeTicker = async (t: string) => {
    if (!wl) return;
    await saveTickers(wl.tickers.filter((x) => x !== t));
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
      <div className="pt-6 px-8 pb-12 max-w-6xl mx-auto">
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
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-high/50 border-b border-[#1F2937]">
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">
                    Ticker
                  </th>
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">
                    Company
                  </th>
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">
                    Verdict
                  </th>
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">
                    Score
                  </th>
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">
                    Price
                  </th>
                  <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {wl.tickers.map((t) => {
                  const row = rows[t];
                  return (
                    <tr key={t} className="hover:bg-[#1A2230] transition-colors">
                      <td className="px-gutter py-3 font-data-md text-data-md text-slate-50">
                        {t}
                      </td>
                      <td className="px-gutter py-3 text-body-sm text-slate-300 max-w-[260px] truncate">
                        {row?.verdict?.companyName ?? "—"}
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
                            row.verdict.totalScore
                          : "—"}
                      </td>
                      <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                        {row?.verdict?.marketSnapshot.price != null
                          ? `$${row.verdict.marketSnapshot.price.toFixed(2)}`
                          : "—"}
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
