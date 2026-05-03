"use client";

// Universe page — Pro-tier feature.
// Free users see the gate (locked overlay + upgrade CTA).
// Pro users see the full pre-computed verdict table with filter + search.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/firebase/auth-context";
import type { Verdict } from "@/lib/analysis/types";
import {
  formatRelativeTime,
  formatScoreContinuous,
  scoreColorClass,
} from "@/lib/format";

type Signal = "ALL" | "BUY" | "HOLD" | "SELL";
type CapFilter = "ALL" | "Mega" | "Large" | "Mid" | "Small" | "Micro";
type SortField = "score" | "ticker" | "marketCap" | "price";
type SortDir = "asc" | "desc";

interface UniverseRow {
  ticker: string;
  companyName: string;
  cik: string;
  verdict: Verdict;
  totalScore: number;
  price: number | null;
  marketCap: number | null;
  sector: string | null;
  computedAt: number;
}

function bucketFromMcap(mcap: number | null | undefined): CapFilter | "—" {
  if (mcap == null) return "—";
  if (mcap >= 200e9) return "Mega";
  if (mcap >= 10e9) return "Large";
  if (mcap >= 2e9) return "Mid";
  if (mcap >= 300e6) return "Small";
  return "Micro";
}

interface ApiResp {
  rows: UniverseRow[];
  counts: { BUY: number; HOLD: number; SELL: number };
  total: number;
}

export default function UniversePage() {
  const { user, loading, configured, tier, signInWithGoogle } = useAuth();
  const [signal, setSignal] = useState<Signal>("ALL");
  const [capFilter, setCapFilter] = useState<CapFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ApiResp | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = tier === "pro";

  useEffect(() => {
    if (!isPro) return;
    setFetching(true);
    setError(null);
    const params = new URLSearchParams();
    if (signal !== "ALL") params.set("signal", signal);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "500");
    fetch(`/api/universe?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ApiResp;
      })
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setFetching(false));
  }, [isPro, signal, search]);

  // Apply client-side filters (cap, sector) + sort that the API doesn't handle.
  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (capFilter !== "ALL") {
      rows = rows.filter((r) => bucketFromMcap(r.marketCap) === capFilter);
    }
    if (sectorFilter !== "ALL") {
      rows = rows.filter((r) => r.sector === sectorFilter);
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "ticker":
          cmp = a.ticker.localeCompare(b.ticker);
          break;
        case "marketCap":
          cmp = (a.marketCap ?? 0) - (b.marketCap ?? 0);
          break;
        case "price":
          cmp = (a.price ?? 0) - (b.price ?? 0);
          break;
        case "score":
        default:
          cmp = a.totalScore - b.totalScore;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, capFilter, sectorFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "ticker" ? "asc" : "desc");
    }
  };

  const sortIcon = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "";

  // Auth gate
  if (loading) {
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
          <span className="material-symbols-outlined text-primary text-5xl mb-4 block">lock</span>
          <h1 className="font-h1 text-h1 mb-2">Sign in to view the Universe</h1>
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

  // Tier gate — free users see upgrade CTA
  if (!isPro) {
    return (
      <AppShell>
        <ProGate />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-6 px-8 pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-8 pb-md border-b border-outline-variant">
          <div>
            <span className="font-label-caps text-label-caps text-secondary mb-1 block">
              PRO TIER · UNIVERSE
            </span>
            <h1 className="font-h1 text-h1 text-on-surface">SEC Universe</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Pre-computed verdicts across {data?.total ?? "—"} SEC-listed companies. Refreshed weekly.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            UNIVERSE LIVE
          </div>
        </div>

        {/* Counter cards (smaller variant) */}
        <div className="grid grid-cols-3 gap-gutter mb-gutter">
          <SmallCounterCard
            label="BUY"
            count={data?.counts.BUY ?? 0}
            total={data?.total ?? 0}
            colorClass="text-secondary"
            bgClass="border-secondary/30 bg-secondary/5"
            active={signal === "BUY"}
            onClick={() => setSignal(signal === "BUY" ? "ALL" : "BUY")}
          />
          <SmallCounterCard
            label="HOLD"
            count={data?.counts.HOLD ?? 0}
            total={data?.total ?? 0}
            colorClass="text-on-surface"
            bgClass="border-outline-variant bg-surface-container"
            active={signal === "HOLD"}
            onClick={() => setSignal(signal === "HOLD" ? "ALL" : "HOLD")}
          />
          <SmallCounterCard
            label="SELL"
            count={data?.counts.SELL ?? 0}
            total={data?.total ?? 0}
            colorClass="text-tertiary"
            bgClass="border-tertiary/30 bg-tertiary/5"
            active={signal === "SELL"}
            onClick={() => setSignal(signal === "SELL" ? "ALL" : "SELL")}
          />
        </div>

        {/* Search + filter row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or company name..."
              className="flex-1 bg-transparent border-none outline-none text-on-surface placeholder:text-outline text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="material-symbols-outlined text-on-surface-variant text-[18px] hover:text-on-surface"
              >
                close
              </button>
            )}
          </div>
          <select
            value={signal}
            onChange={(e) => setSignal(e.target.value as Signal)}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            title="Filter by engine verdict"
          >
            <option value="ALL">All signals</option>
            <option value="BUY">BUY only</option>
            <option value="HOLD">HOLD only</option>
            <option value="SELL">SELL only</option>
          </select>
          <select
            value={capFilter}
            onChange={(e) => setCapFilter(e.target.value as CapFilter)}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            title="Filter by market-cap bucket"
          >
            <option value="ALL">All caps</option>
            <option value="Mega">Mega ($200B+)</option>
            <option value="Large">Large ($10B+)</option>
            <option value="Mid">Mid ($2B+)</option>
            <option value="Small">Small ($300M+)</option>
            <option value="Micro">Micro</option>
          </select>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            title="Filter by GICS sector"
          >
            <option value="ALL">All sectors</option>
            {Array.from(
              new Set(
                (data?.rows ?? [])
                  .map((r) => r.sector)
                  .filter((s): s is string => !!s),
              ),
            )
              .sort()
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
          <button
            onClick={() => exportCSV(filteredRows)}
            disabled={!data || filteredRows.length === 0}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50 flex items-center gap-1"
            title="Export filtered rows as CSV"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-high/50 border-b border-[#1F2937]">
                <SortableTh active={sortField === "ticker"} dir={sortDir} onClick={() => toggleSort("ticker")}>
                  Ticker {sortIcon("ticker")}
                </SortableTh>
                <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">Company</th>
                <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">Sector</th>
                <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest">Verdict</th>
                <SortableTh active={sortField === "score"} dir={sortDir} onClick={() => toggleSort("score")}>
                  Score {sortIcon("score")}
                </SortableTh>
                <SortableTh active={sortField === "price"} dir={sortDir} onClick={() => toggleSort("price")}>
                  Price {sortIcon("price")}
                </SortableTh>
                <SortableTh active={sortField === "marketCap"} dir={sortDir} onClick={() => toggleSort("marketCap")}>
                  Market Cap {sortIcon("marketCap")}
                </SortableTh>
                <th className="px-gutter py-3 font-label-caps text-[10px] text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {fetching && (
                <tr>
                  <td colSpan={8} className="px-gutter py-6 text-center text-on-surface-variant text-sm">
                    Loading universe…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={8} className="px-gutter py-6 text-center text-error text-sm">
                    {error}
                  </td>
                </tr>
              )}
              {!fetching && !error && data && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-gutter py-12 text-center">
                    <p className="text-on-surface-variant text-sm mb-1">
                      {data.total === 0
                        ? "Universe not yet seeded."
                        : "No matches for that filter combination."}
                    </p>
                    <p className="text-on-surface-variant text-xs">
                      {data.total === 0
                        ? "Run scripts/seed-universe.ts or trigger /api/admin/seed-universe to populate."
                        : "Try clearing search, cap, or sector filter."}
                    </p>
                  </td>
                </tr>
              )}
              {!fetching &&
                !error &&
                filteredRows.map((r) => (
                  <tr key={r.ticker} className="hover:bg-[#1A2230] transition-colors">
                    <td className="px-gutter py-3 font-data-md text-data-md text-slate-50">{r.ticker}</td>
                    <td className="px-gutter py-3 text-body-sm text-slate-300 truncate max-w-[220px]">
                      {r.companyName}
                    </td>
                    <td className="px-gutter py-3 text-body-sm text-on-surface-variant truncate max-w-[140px]">
                      {r.sector ?? "—"}
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
                    <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                      {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                      {formatMcap(r.marketCap)}
                    </td>
                    <td className="px-gutter py-3 text-right">
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

        <p className="mt-4 text-xs text-on-surface-variant text-center">
          Showing {filteredRows.length} of {data?.total ?? 0} stocks · sorted by{" "}
          {sortField} {sortDir === "asc" ? "ascending" : "descending"}
          {data?.rows[0]?.computedAt
            ? ` · last refresh ${formatRelativeTime(data.rows[0].computedAt)}`
            : ""}
        </p>
      </div>
    </AppShell>
  );
}

function ProGate() {
  return (
    <div className="pt-12 px-8 pb-12 max-w-2xl mx-auto text-center">
      <span className="material-symbols-outlined text-primary text-5xl mb-4 block">workspace_premium</span>
      <h1 className="font-h1 text-h1 mb-2">SEC Universe is a Pro feature</h1>
      <p className="text-on-surface-variant text-sm mb-6 max-w-md mx-auto">
        Pre-computed verdicts across all ~12,000 SEC-listed companies, refreshed weekly. Filter by
        BUY / HOLD / SELL, search by ticker or company name, sort by score.
      </p>

      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 mb-6 text-left">
        <h3 className="font-h2 text-h2 mb-4 text-center">What you get on Pro</h3>
        <ul className="space-y-3 max-w-md mx-auto">
          {[
            "Pre-computed verdicts on ~12,000 SEC-listed companies",
            "Filter by BUY / HOLD / SELL across the whole universe",
            "Search by ticker or company name",
            "Sorted by engine score, refreshed weekly",
            "Everything in Free tier (per-stock analysis, watchlists, math transparency)",
          ].map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-caps hover:brightness-110"
      >
        <span className="material-symbols-outlined text-[18px]">upgrade</span>
        Upgrade to Pro
      </Link>

      <p className="mt-6 text-xs text-on-surface-variant">
        $15/month · cancel anytime · everything in Free tier included
      </p>
    </div>
  );
}

function SmallCounterCard({
  label,
  count,
  total,
  colorClass,
  bgClass,
  active,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  bgClass: string;
  active: boolean;
  onClick: () => void;
}) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <button
      onClick={onClick}
      className={
        "p-gutter rounded-xl border text-left transition-all " +
        bgClass +
        (active ? " ring-2 ring-primary" : " hover:scale-[1.01]")
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className={"font-label-caps " + colorClass}>{label}</span>
        <span className="font-data-sm text-on-surface-variant">{pct.toFixed(0)}%</span>
      </div>
      <div className={"font-h1 text-h1 " + colorClass}>{count}</div>
    </button>
  );
}

function formatMcap(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function SortableTh({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  void dir; // arrow rendered by caller via icon prop
  return (
    <th
      className={
        "px-gutter py-3 font-label-caps text-[10px] uppercase tracking-widest cursor-pointer select-none transition-colors " +
        (active
          ? "text-primary"
          : "text-slate-400 hover:text-on-surface")
      }
      onClick={onClick}
    >
      {children}
    </th>
  );
}

function exportCSV(rows: UniverseRow[]): void {
  if (rows.length === 0) return;
  const header = [
    "Ticker",
    "Company",
    "Sector",
    "Verdict",
    "Score",
    "Price",
    "MarketCap",
  ];
  const csvRows = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.ticker,
        // Escape quotes + commas in company name
        `"${(r.companyName ?? "").replace(/"/g, '""')}"`,
        `"${(r.sector ?? "").replace(/"/g, '""')}"`,
        r.verdict,
        r.totalScore.toFixed(4),
        r.price ?? "",
        r.marketCap ?? "",
      ].join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `universe-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
