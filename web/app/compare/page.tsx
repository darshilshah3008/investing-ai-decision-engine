"use client";

// Compare page — side-by-side fundamentals for 2-4 tickers.
// State lives in the URL (?tickers=AAPL,MSFT,GOOGL) so views are shareable.
// Free-tier feature; AppShell handles auth gate.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StockPickerDialog } from "@/components/stock-picker-dialog";
import {
  formatPercent,
  formatScoreContinuous,
  formatUSD,
  scoreColorClass,
} from "@/lib/format";
import type { Pillar, VerdictDoc } from "@/lib/analysis/types";

const MAX_TICKERS = 4;
const PILLARS: Pillar[] = ["Quality", "Growth", "Valuation", "Sustainability"];

type ColumnState =
  | { ticker: string; status: "loading" }
  | { ticker: string; status: "ok"; verdict: VerdictDoc }
  | { ticker: string; status: "error"; error: string };

function parseTickerParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TICKERS) break;
  }
  return out;
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="pt-20 px-8 pb-12 text-on-surface-variant">Loading…</div>
        </AppShell>
      }
    >
      <ComparePageInner />
    </Suspense>
  );
}

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickers = useMemo(
    () => parseTickerParam(searchParams.get("tickers")),
    [searchParams],
  );

  const [columns, setColumns] = useState<ColumnState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch verdicts whenever the ticker list changes.
  useEffect(() => {
    if (tickers.length === 0) {
      setColumns([]);
      return;
    }
    let cancelled = false;
    setColumns(tickers.map((t) => ({ ticker: t, status: "loading" as const })));

    Promise.all(
      tickers.map(async (t): Promise<ColumnState> => {
        try {
          const r = await fetch(`/api/verdict/${t}`);
          if (!r.ok) {
            return { ticker: t, status: "error", error: `HTTP ${r.status}` };
          }
          const data = (await r.json()) as { verdict: VerdictDoc };
          return { ticker: t, status: "ok", verdict: data.verdict };
        } catch (e) {
          return { ticker: t, status: "error", error: String(e) };
        }
      }),
    ).then((results) => {
      if (!cancelled) setColumns(results);
    });

    return () => {
      cancelled = true;
    };
  }, [tickers]);

  const setTickers = (next: string[]) => {
    const capped = next.slice(0, MAX_TICKERS);
    if (capped.length === 0) {
      router.replace(`/compare`);
    } else {
      router.replace(`/compare?tickers=${capped.join(",")}`);
    }
  };

  const removeTicker = (t: string) => {
    setTickers(tickers.filter((x) => x !== t));
  };

  const handleAddFromPicker = (chosen: string[]) => {
    setPickerOpen(false);
    if (chosen.length === 0) return;
    const merged: string[] = [...tickers];
    for (const c of chosen) {
      const t = c.toUpperCase();
      if (!merged.includes(t)) merged.push(t);
      if (merged.length >= MAX_TICKERS) break;
    }
    setTickers(merged);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore — older browsers / non-https
    }
  };

  // ─── Empty state ──────────────────────────────────────────────────
  if (tickers.length === 0) {
    return (
      <AppShell>
        <div className="pt-20 px-8 pb-12 max-w-3xl mx-auto text-center">
          <span className="material-symbols-outlined text-primary text-5xl mb-4 block">
            compare_arrows
          </span>
          <h1 className="font-h1 text-h1 mb-2">Compare stocks side-by-side</h1>
          <p className="text-on-surface-variant text-sm mb-6 max-w-lg mx-auto">
            Pick 2–4 tickers to see verdict, total score, and pillar breakdown
            in one view. Useful when you&apos;re deciding between a handful of
            names before going deeper on any one.
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps hover:brightness-110"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Pick stocks to compare
          </button>
        </div>
        <StockPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onAnalyze={handleAddFromPicker}
        />
      </AppShell>
    );
  }

  // ─── Comparison view ──────────────────────────────────────────────
  return (
    <AppShell>
      <div className="pt-8 px-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-h1 text-h1 mb-1">Compare</h1>
            <p className="text-xs text-on-surface-variant">
              {tickers.length} of {MAX_TICKERS} tickers — verdicts pulled from
              the most recent SEC filing for each.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container-high"
              title="Copy URL"
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              Copy link
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6 pb-2">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#0A0E14] text-left font-label-caps text-label-caps text-on-surface-variant uppercase pr-4 pb-3 align-bottom w-40">
                  Metric
                </th>
                {columns.map((c) => (
                  <CompareHeader
                    key={c.ticker}
                    column={c}
                    onRemove={() => removeTicker(c.ticker)}
                  />
                ))}
                {tickers.length < MAX_TICKERS && (
                  <th className="text-center pb-3 align-bottom w-40 px-2">
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="w-full h-full inline-flex flex-col items-center justify-center gap-1 px-3 py-4 text-on-surface-variant border border-dashed border-outline-variant rounded-lg hover:border-primary/60 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      <span className="text-xs">Add ticker</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              <SectionRow label="Verdict" />
              <DataRow
                label="Signal"
                columns={columns}
                render={(v) => <VerdictBadge verdict={v.verdict} />}
              />
              <DataRow
                label="Total score"
                columns={columns}
                render={(v) => (
                  <span
                    className={"font-data-md text-data-md " + scoreColorClass(v.totalScore)}
                  >
                    {formatScoreContinuous(v.totalScore)}
                  </span>
                )}
              />
              <DataRow
                label="Confidence"
                columns={columns}
                render={(v) => (
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                    {v.confidence}
                  </span>
                )}
              />

              <SectionRow label="Pillars" />
              {PILLARS.map((p) => (
                <DataRow
                  key={p}
                  label={p}
                  columns={columns}
                  render={(v) => {
                    const score = v.pillars.find((x) => x.pillar === p)?.score ?? null;
                    return (
                      <span
                        className={"font-data-md text-data-md " + scoreColorClass(score)}
                      >
                        {formatScoreContinuous(score)}
                      </span>
                    );
                  }}
                />
              ))}

              <SectionRow label="Market" />
              <DataRow
                label="Price"
                columns={columns}
                render={(v) => (
                  <span className="font-data-md">
                    {formatUSD(v.marketSnapshot.price)}
                  </span>
                )}
              />
              <DataRow
                label="Market cap"
                columns={columns}
                render={(v) => (
                  <span className="font-data-md">
                    {formatUSD(v.marketSnapshot.marketCap, { compact: true })}
                  </span>
                )}
              />
              <DataRow
                label="Trailing P/E"
                columns={columns}
                render={(v) => (
                  <span className="font-data-md">
                    {v.marketSnapshot.trailingPE != null
                      ? v.marketSnapshot.trailingPE.toFixed(1)
                      : "—"}
                  </span>
                )}
              />
              <DataRow
                label="Dividend yield"
                columns={columns}
                render={(v) => (
                  <span className="font-data-md">
                    {formatPercent(v.marketSnapshot.dividendYield, 2)}
                  </span>
                )}
              />

              <SectionRow label="Highlights" />
              <DataRow
                label="Top catalyst"
                columns={columns}
                render={(v) => (
                  <span className="text-xs text-on-surface-variant block leading-snug">
                    {v.catalysts[0] ?? "—"}
                  </span>
                )}
              />
              <DataRow
                label="Top risk"
                columns={columns}
                render={(v) => (
                  <span className="text-xs text-on-surface-variant block leading-snug">
                    {v.risks[0] ?? "—"}
                  </span>
                )}
              />

              <tr>
                <td className="sticky left-0 bg-[#0A0E14] py-3 pr-4" />
                {columns.map((c) => (
                  <td key={c.ticker} className="py-3 px-2 text-center align-top">
                    <Link
                      href={`/stock/${c.ticker}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View full analysis
                      <span className="material-symbols-outlined text-[14px]">
                        arrow_forward
                      </span>
                    </Link>
                  </td>
                ))}
                {tickers.length < MAX_TICKERS && <td />}
              </tr>
            </tbody>
          </table>
        </div>

        {tickers.length === 1 && (
          <p className="mt-4 text-xs text-on-surface-variant text-center">
            Add another ticker to start comparing.
          </p>
        )}
      </div>

      <StockPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAnalyze={handleAddFromPicker}
      />
    </AppShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function CompareHeader({
  column,
  onRemove,
}: {
  column: ColumnState;
  onRemove: () => void;
}) {
  const ticker = column.ticker;
  const company =
    column.status === "ok" ? column.verdict.companyName : ticker;
  const sector =
    column.status === "ok" ? column.verdict.marketSnapshot.sector : null;

  return (
    <th className="text-left pb-3 align-bottom w-40 px-2 font-normal">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/stock/${ticker}`}
          className="font-data-lg text-data-lg text-primary hover:underline"
        >
          {ticker}
        </Link>
        <button
          onClick={onRemove}
          aria-label={`Remove ${ticker}`}
          className="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-on-surface"
        >
          close
        </button>
      </div>
      <div className="text-xs text-on-surface mt-1 truncate" title={company}>
        {company}
      </div>
      {sector && (
        <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
          {sector}
        </span>
      )}
    </th>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={MAX_TICKERS + 2}
        className="pt-5 pb-2 font-label-caps text-label-caps uppercase tracking-[0.1em] text-on-surface-variant border-b border-outline-variant"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  label,
  columns,
  render,
}: {
  label: string;
  columns: ColumnState[];
  render: (verdict: VerdictDoc) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="sticky left-0 bg-[#0A0E14] py-2 pr-4 text-xs text-on-surface-variant">
        {label}
      </td>
      {columns.map((c) => (
        <td key={c.ticker} className="py-2 px-2 align-top">
          <ColumnCell column={c} render={render} />
        </td>
      ))}
    </tr>
  );
}

function ColumnCell({
  column,
  render,
}: {
  column: ColumnState;
  render: (verdict: VerdictDoc) => React.ReactNode;
}) {
  if (column.status === "loading") {
    return <span className="text-on-surface-variant">—</span>;
  }
  if (column.status === "error") {
    return (
      <span
        className="text-xs text-on-surface-variant italic"
        title={column.error}
      >
        no verdict
      </span>
    );
  }
  return <>{render(column.verdict)}</>;
}

function VerdictBadge({ verdict }: { verdict: VerdictDoc["verdict"] }) {
  const cls =
    verdict === "BUY"
      ? "bg-secondary text-on-secondary"
      : verdict === "SELL"
        ? "bg-tertiary text-on-tertiary"
        : "bg-surface-container-highest text-on-surface";
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-widest " +
        cls
      }
    >
      {verdict}
    </span>
  );
}
