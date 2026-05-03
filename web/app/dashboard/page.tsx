"use client";

// Dashboard — adapted from Stitch screen (2) HTML.
// Wired to:
//   - "+ Add stocks" → opens StockPickerDialog → navigates to /stock/{ticker}
//   - Recent analyses table is loaded from localStorage (last 10 verdicts run)
//   - Watchlists are loaded from Firestore via /api/watchlist
//
// Authentication: if Firebase is configured but the user isn't signed in,
// shows a Google sign-in button instead of the dashboard.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StockPickerDialog } from "@/components/stock-picker-dialog";
import { VerdictFilter } from "@/components/verdict-filter";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  formatRelativeTime,
  formatScoreContinuous,
  scoreColorClass,
} from "@/lib/format";

interface RecentAnalysis {
  ticker: string;
  companyName: string;
  verdict: "BUY" | "HOLD" | "SELL";
  totalScore: number;
  ts: number;
}

interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recents, setRecents] = useState<RecentAnalysis[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recent_verdicts");
      if (raw) setRecents(JSON.parse(raw) as RecentAnalysis[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch("/api/watchlist", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { watchlists: [] }))
        .then((data: { watchlists: WatchlistEntry[] }) =>
          setWatchlists(data.watchlists ?? []),
        )
        .catch(() => setWatchlists([]));
    });
  }, [user]);

  const handleAnalyze = (tickers: string[]) => {
    setPickerOpen(false);
    if (tickers.length === 0) return;
    if (tickers.length === 1) {
      router.push(`/stock/${tickers[0]}`);
    } else {
      // Multi-select: route to the first; the others can be opened from links
      router.push(`/stock/${tickers[0]}?queue=${tickers.slice(1).join(",")}`);
    }
  };

  // ─── Auth gate ────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="pt-20 px-8 pb-12 text-on-surface-variant">Loading…</div>
      </AppShell>
    );
  }
  if (configured && !user) {
    return (
      <AppShell>
        <div className="pt-20 px-8 pb-12 max-w-md mx-auto text-center">
          <span className="material-symbols-outlined text-primary text-5xl mb-4 block">lock</span>
          <h1 className="font-h1 text-h1 mb-2">Sign in to continue</h1>
          <p className="text-on-surface-variant text-sm mb-6">
            Sign in with your Google account to analyze stocks, save watchlists, and view the
            engine's reasoning trail.
          </p>
          <button
            onClick={() => signInWithGoogle().catch((e) => alert(String(e)))}
            className="inline-flex items-center gap-3 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-caps hover:brightness-110"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Sign in with Google
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-6 px-8 pb-12">
        {/* Greeting + primary action */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="font-label-caps text-label-caps text-indigo-400 mb-1 block">
              TERMINAL DASHBOARD
            </span>
            <h1 className="font-h1 text-h1 text-slate-50">
              Good evening, {user?.displayName?.split(" ")[0] ?? "Analyst"}
            </h1>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="bg-primary-container text-on-primary-container px-4 py-2 flex items-center gap-2 font-body-md font-semibold hover:opacity-90 active:scale-[0.98] transition-all rounded-lg"
          >
            <span className="material-symbols-outlined">add</span>
            Add stocks
          </button>
        </div>

        {/* Engine signals — filter dropdown + counter cards backed by Firestore verdicts cache */}
        <VerdictFilter />

        {/* Verdicts that changed — uses recents */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-h2 text-h2 text-slate-100">Verdicts that changed</h2>
            <span className="text-indigo-400 text-xs font-semibold">
              {recents.length} recent
            </span>
          </div>
          {recents.length === 0 ? (
            <div className="bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl block mb-2">
                analytics
              </span>
              <p className="text-on-surface-variant text-sm mb-4">
                No analyses yet. Click "+ Add stocks" to run the engine on a ticker.
              </p>
              <button
                onClick={() => setPickerOpen(true)}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-caps hover:brightness-110"
              >
                Run your first analysis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {recents.slice(0, 3).map((r) => (
                <Link
                  href={`/stock/${r.ticker}`}
                  key={r.ticker + r.ts}
                  className="bg-surface-container border border-outline-variant p-gutter rounded-xl hover:border-indigo-500/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="font-data-lg text-data-lg text-slate-50 block">
                        {r.ticker}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium uppercase">
                        {r.companyName}
                      </span>
                    </div>
                    <span
                      className={
                        "text-[10px] px-2 py-0.5 rounded font-bold uppercase " +
                        (r.verdict === "BUY"
                          ? "verdict-buy"
                          : r.verdict === "SELL"
                            ? "verdict-sell"
                            : "verdict-hold")
                      }
                    >
                      {r.verdict}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mb-4">
                    Engine total score:{" "}
                    <span className={"font-data-md " + scoreColorClass(r.totalScore)}>
                      {formatScoreContinuous(r.totalScore)}
                    </span>
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-[#1F2937]">
                    <span className="font-label-caps text-[9px] text-slate-500">
                      SOURCE: SEC FILINGS
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.ts).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Watchlists + Recent Analyses */}
        <div className="grid grid-cols-12 gap-gutter items-start">
          {/* Watchlists */}
          <section className="col-span-12 lg:col-span-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-h2 text-h2 text-slate-100">Your Watchlists</h2>
            </div>
            <div className="space-y-gutter">
              {watchlists.map((wl) => (
                <Link
                  href={`/watchlist/${wl.id}`}
                  key={wl.id}
                  className="bg-surface-container border border-outline-variant p-4 rounded-xl hover:border-indigo-500/50 transition-colors block"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-body-md font-bold text-slate-200">{wl.name}</h3>
                    <span className="text-[10px] font-data-md text-secondary">
                      {wl.tickers.length} assets
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wl.tickers.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-data-sm bg-surface-container-highest px-2 py-0.5 rounded border border-outline-variant text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                    {wl.tickers.length > 3 && (
                      <span className="text-[10px] font-data-sm bg-surface-container-highest px-2 py-0.5 rounded border border-outline-variant text-slate-300">
                        +{wl.tickers.length - 3} more
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              <button
                onClick={() => setPickerOpen(true)}
                className="w-full py-3 border border-dashed border-outline-variant rounded-xl text-slate-500 text-xs font-semibold hover:bg-surface-container-low transition-colors"
              >
                + Create new watchlist
              </button>
            </div>
          </section>

          {/* Recent analyses table */}
          <section className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-h2 text-h2 text-slate-100">Recent Analyses</h2>
              <span className="text-xs text-slate-500">
                {recents.length === 0 ? "no runs yet" : `last run: ${formatRelativeTime(recents[0]!.ts)}`}
              </span>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
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
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {recents.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-gutter py-6 text-center text-on-surface-variant text-sm"
                      >
                        No analyses yet. Click "+ Add stocks" above to run your first.
                      </td>
                    </tr>
                  )}
                  {recents.slice(0, 10).map((r) => (
                    <tr
                      key={r.ticker + r.ts}
                      className="hover:bg-[#1A2230] transition-colors"
                    >
                      <td className="px-gutter py-3 font-data-md text-data-md text-slate-50">
                        {r.ticker}
                      </td>
                      <td className="px-gutter py-3 text-body-sm text-slate-300 truncate max-w-[200px]">
                        {r.companyName}
                      </td>
                      <td className="px-gutter py-3">
                        <span
                          className={
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase " +
                            (r.verdict === "BUY"
                              ? "verdict-buy"
                              : r.verdict === "SELL"
                                ? "verdict-sell"
                                : "verdict-hold")
                          }
                        >
                          {r.verdict}
                        </span>
                      </td>
                      <td className={"px-gutter py-3 font-data-md text-data-md " + scoreColorClass(r.totalScore)}>
                        {formatScoreContinuous(r.totalScore)}
                      </td>
                      <td className="px-gutter py-3">
                        <Link
                          href={`/stock/${r.ticker}`}
                          className="text-[11px] font-bold text-indigo-400 uppercase hover:text-indigo-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <StockPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAnalyze={handleAnalyze}
      />
    </AppShell>
  );
}
