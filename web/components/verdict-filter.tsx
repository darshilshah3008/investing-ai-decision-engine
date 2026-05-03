"use client";

// VerdictFilter — three counter cards (BUY / HOLD / SELL) plus a
// dropdown that lets the user filter the table below to a single
// signal. Powered by /api/verdicts.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Signal = "ALL" | "BUY" | "HOLD" | "SELL";

interface CachedRow {
  ticker: string;
  companyName: string;
  verdict: "BUY" | "HOLD" | "SELL";
  totalScore: number;
  price: number | null;
  cachedAt: number;
}

interface ApiResp {
  verdicts: CachedRow[];
  counts: { BUY: number; HOLD: number; SELL: number };
}

const SIGNAL_OPTIONS: { value: Signal; label: string }[] = [
  { value: "ALL", label: "All signals" },
  { value: "BUY", label: "BUY only" },
  { value: "HOLD", label: "HOLD only" },
  { value: "SELL", label: "SELL only" },
];

export function VerdictFilter() {
  const [signal, setSignal] = useState<Signal>("ALL");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = signal === "ALL" ? "/api/verdicts" : `/api/verdicts?signal=${signal}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ApiResp;
      })
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [signal]);

  const total = useMemo(() => {
    if (!data) return 0;
    return data.counts.BUY + data.counts.HOLD + data.counts.SELL;
  }, [data]);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-h2 text-h2 text-slate-100">Engine signals</h2>
        <select
          value={signal}
          onChange={(e) => setSignal(e.target.value as Signal)}
          className="bg-surface-container border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary"
        >
          {SIGNAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Counter cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-gutter">
        <CounterCard
          label="BUY"
          count={data?.counts.BUY ?? 0}
          total={total}
          colorClass="text-secondary"
          bgClass="border-secondary/30 bg-secondary/5"
          active={signal === "BUY"}
          onClick={() => setSignal(signal === "BUY" ? "ALL" : "BUY")}
        />
        <CounterCard
          label="HOLD"
          count={data?.counts.HOLD ?? 0}
          total={total}
          colorClass="text-on-surface"
          bgClass="border-outline-variant bg-surface-container"
          active={signal === "HOLD"}
          onClick={() => setSignal(signal === "HOLD" ? "ALL" : "HOLD")}
        />
        <CounterCard
          label="SELL"
          count={data?.counts.SELL ?? 0}
          total={total}
          colorClass="text-tertiary"
          bgClass="border-tertiary/30 bg-tertiary/5"
          active={signal === "SELL"}
          onClick={() => setSignal(signal === "SELL" ? "ALL" : "SELL")}
        />
      </div>

      {/* Table */}
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
                Last run
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2937]">
            {loading && (
              <tr>
                <td colSpan={6} className="px-gutter py-6 text-center text-on-surface-variant text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} className="px-gutter py-6 text-center text-error text-sm">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && data && data.verdicts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-gutter py-6 text-center text-on-surface-variant text-sm">
                  {signal === "ALL"
                    ? "No verdicts cached yet. Use \"+ Add stocks\" above to run your first."
                    : `No ${signal} verdicts in the cache. Run more analyses or change the filter.`}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              data?.verdicts.map((row) => (
                <tr
                  key={row.ticker + row.cachedAt}
                  className="hover:bg-[#1A2230] transition-colors"
                >
                  <td className="px-gutter py-3 font-data-md text-data-md text-slate-50">
                    {row.ticker}
                  </td>
                  <td className="px-gutter py-3 text-body-sm text-slate-300 truncate max-w-[260px]">
                    {row.companyName}
                  </td>
                  <td className="px-gutter py-3">
                    <span
                      className={
                        "text-[10px] px-2 py-0.5 rounded font-bold uppercase " +
                        (row.verdict === "BUY"
                          ? "verdict-buy"
                          : row.verdict === "SELL"
                            ? "verdict-sell"
                            : "verdict-hold")
                      }
                    >
                      {row.verdict}
                    </span>
                  </td>
                  <td className="px-gutter py-3 font-data-md text-data-md">
                    {row.totalScore >= 0 ? "+" : ""}
                    {row.totalScore}
                  </td>
                  <td className="px-gutter py-3 font-data-md text-data-md text-on-surface-variant">
                    {row.price != null ? `$${row.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-gutter py-3 text-right">
                    <Link
                      href={`/stock/${row.ticker}`}
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
  );
}

function CounterCard({
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
        (active ? " ring-2 ring-primary scale-[1.02]" : " hover:scale-[1.01]")
      }
    >
      <div className="flex items-center justify-between mb-2">
        <span className={"font-label-caps " + colorClass}>{label}</span>
        <span className="font-data-sm text-on-surface-variant">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className={"font-display-lg text-display-lg " + colorClass}>
        {count}
      </div>
      <div className="text-xs text-on-surface-variant mt-1">
        cached {label.toLowerCase()} verdicts
      </div>
    </button>
  );
}
