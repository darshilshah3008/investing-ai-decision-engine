"use client";

// Verdict screen — adapted from Stitch screen HTML (the hero).
// Loads the verdict from /api/verdict/[ticker]. Shows model cards with
// formulas and source-filing links per REQUIREMENTS.md §5A.

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { ModelResult, PillarResult, VerdictDoc } from "@/lib/analysis/types";
import {
  formatNumber,
  formatRelativeTime,
  formatScoreContinuous,
  formatUSD,
  scoreColorClass,
} from "@/lib/format";

const formatContinuousScore = formatScoreContinuous;

function pillarTooltip(pillar: string): string {
  switch (pillar) {
    case "Quality":
      return "Capital efficiency, earnings quality, margin trend. Models: Piotroski F-Score, ROIC vs WACC, Margin Trend.";
    case "Growth":
      return "Revenue, EPS, FCF compound growth + quarterly trend. Models: Multi-Year CAGR, Quarterly Trend.";
    case "Valuation":
      return "Is the price fair? Models: FCF Yield, Earnings Yield vs Treasury, Graham Number.";
    case "Sustainability":
      return "Can the business survive a recession? Models: Debt sustainability (NetDebt/OCF, Interest Coverage, D/E).";
    default:
      return "";
  }
}

export default function VerdictPage() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const ticker = (params.ticker ?? "").toUpperCase();
  const queue = (searchParams.get("queue") ?? "")
    .split(",")
    .filter(Boolean)
    .map((t) => t.toUpperCase());

  const [verdict, setVerdict] = useState<VerdictDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (force: boolean) => {
    setLoading(!verdict);
    setRefreshing(force);
    setError(null);
    fetch(`/api/verdict/${ticker}${force ? "?refresh=1" : ""}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        setVerdict(data.verdict as VerdictDoc);
        // Push into recent-verdicts localStorage for the dashboard
        try {
          const raw = localStorage.getItem("recent_verdicts");
          const arr = raw
            ? (JSON.parse(raw) as Array<{ ticker: string }>)
            : [];
          const v = data.verdict as VerdictDoc;
          const next = [
            {
              ticker: v.ticker,
              companyName: v.companyName,
              verdict: v.verdict,
              totalScore: v.totalScore,
              ts: Date.now(),
            },
            ...arr.filter((x) => x.ticker !== v.ticker),
          ].slice(0, 10);
          localStorage.setItem("recent_verdicts", JSON.stringify(next));
        } catch {
          /* ignore */
        }
      })
      .catch((e) => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    setVerdict(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-gutter py-xl">
        {/* Queue indicator (multi-select from picker) */}
        {queue.length > 0 && (
          <div className="mb-md flex items-center gap-3 text-xs">
            <span className="text-on-surface-variant">Up next:</span>
            {queue.map((t) => (
              <Link
                key={t}
                href={`/stock/${t}${queue.length > 1 ? `?queue=${queue.filter((x) => x !== t).join(",")}` : ""}`}
                className="font-data-sm text-data-sm text-primary hover:underline"
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {loading && <LoadingState ticker={ticker} />}
        {error && (
          <ErrorState ticker={ticker} error={error} onRetry={() => load(true)} />
        )}
        {verdict && !loading && (
          <VerdictView
            verdict={verdict}
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        )}
      </div>
    </AppShell>
  );
}

function LoadingState({ ticker }: { ticker: string }) {
  return (
    <div className="text-center py-24">
      <span className="material-symbols-outlined text-primary text-5xl animate-pulse mb-4 block">
        analytics
      </span>
      <h2 className="font-h1 text-h1 mb-2">Analyzing {ticker}…</h2>
      <p className="text-on-surface-variant text-sm max-w-md mx-auto">
        Fetching the company's full XBRL fact set from SEC EDGAR, then running
        three fundamental models. First-time runs take 10–30 seconds; cached
        verdicts are instant.
      </p>
    </div>
  );
}

function ErrorState({
  ticker,
  error,
  onRetry,
}: {
  ticker: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-24 max-w-md mx-auto">
      <span className="material-symbols-outlined text-error text-5xl mb-4 block">
        error
      </span>
      <h2 className="font-h1 text-h1 mb-2">Couldn't analyze {ticker}</h2>
      <p className="text-on-surface-variant text-sm mb-6 break-words">{error}</p>
      <button
        onClick={onRetry}
        className="bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps hover:brightness-110"
      >
        Retry
      </button>
    </div>
  );
}

function verdictPillClasses(v: VerdictDoc["verdict"]) {
  if (v === "BUY") return "bg-secondary text-on-secondary verdict-glow-buy";
  if (v === "SELL") return "bg-tertiary text-on-tertiary verdict-glow-sell";
  return "bg-surface-container-highest text-on-surface verdict-glow-hold";
}

function VerdictView({
  verdict,
  onRefresh,
  refreshing,
}: {
  verdict: VerdictDoc;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <>
      {/* Hero header */}
      <section className="mb-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md border-b border-outline-variant pb-md">
          <div>
            <div className="flex items-center gap-sm mb-xs">
              <span className="font-data-lg text-data-lg text-primary bg-surface-container-highest px-2 py-1 rounded">
                {verdict.ticker}
              </span>
              <span className="text-on-surface-variant font-label-caps text-label-caps">
                — {verdict.cik}
              </span>
            </div>
            <h2 className="font-display-lg text-display-lg tracking-tight">
              {verdict.companyName}
            </h2>
          </div>
          <div className="flex items-center gap-gutter">
            <div
              className={
                "px-6 py-2 rounded font-bold text-lg tracking-widest " +
                verdictPillClasses(verdict.verdict)
              }
              title={
                verdict.verdict === "BUY"
                  ? "Total weighted score ≥ +0.30 across 4 fundamental pillars. Engine sees genuine edge."
                  : verdict.verdict === "SELL"
                    ? "Total weighted score ≤ −0.20. Engine sees more headwinds than tailwinds."
                    : "Total score between −0.20 and +0.30. Mixed or neutral signals."
              }
            >
              {verdict.verdict}
            </div>
            <div className="text-right">
              <div className="font-data-lg text-data-lg text-secondary">
                {formatContinuousScore(verdict.totalScore)}
              </div>
              <div className="font-label-caps text-label-caps text-on-surface-variant">
                CONFIDENCE:{" "}
                <span className="text-secondary">{verdict.confidence.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="flex flex-wrap items-center gap-lg mt-md py-sm px-md bg-surface-container-low border border-outline-variant rounded">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
              calendar_today
            </span>
            <span className="font-label-caps text-label-caps">
              LATEST {verdict.latestFiling?.form ?? "FILING"}:{" "}
              {verdict.latestFiling?.filed ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-xs border-l border-outline-variant pl-lg">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Current Price:
            </span>
            <span className="font-data-md text-data-md">
              {verdict.marketSnapshot.price != null
                ? formatUSD(verdict.marketSnapshot.price)
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-xs border-l border-outline-variant pl-lg">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Market Cap:
            </span>
            <span className="font-data-md text-data-md">
              {formatUSD(verdict.marketSnapshot.marketCap, { compact: true })}
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1 text-primary text-xs hover:underline disabled:opacity-50"
          >
            <span
              className={
                "material-symbols-outlined text-[16px] " +
                (refreshing ? "animate-spin" : "")
              }
            >
              refresh
            </span>
            {refreshing ? "Refreshing…" : "Refresh from EDGAR"}
          </button>
        </div>
      </section>

      {/* Thesis */}
      <section className="mb-xl">
        <p className="font-serif italic text-xl leading-relaxed text-on-surface opacity-90 border-l-2 border-primary pl-gutter">
          {verdict.thesis}
        </p>
      </section>

      {/* Pillar Scorecard — defensive: guard against legacy cached verdicts */}
      {Array.isArray(verdict.pillars) && verdict.pillars.length > 0 && (
        <PillarScorecard pillars={verdict.pillars} totalScore={verdict.totalScore} />
      )}

      {/* Per-model cards */}
      <div className="grid grid-cols-1 gap-lg mb-xl mt-xl">
        {verdict.models.map((m, i) => (
          <ModelCard key={i} model={m} cik={verdict.cik} />
        ))}
      </div>

      {/* Catalysts + Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-xl">
        <CatalystsCard items={verdict.catalysts} />
        <RisksCard items={verdict.risks} />
      </div>

      {/* Sensitivity table */}
      <SensitivityCard items={verdict.sensitivity} />

      {/* What others are saying — disclaimer */}
      <div className="mt-xl text-center text-xs text-on-surface-variant max-w-xl mx-auto opacity-70">
        Verdict computed from SEC EDGAR filings only. External analyst opinions and
        news sentiment are excluded by design — they don't influence the math.
        See REQUIREMENTS.md §5B for the rationale.
      </div>
    </>
  );
}

function PillarScorecard({
  pillars,
  totalScore,
}: {
  pillars: PillarResult[];
  totalScore: number;
}) {
  const totalColor = scoreColorClass(totalScore);
  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
      <div className="px-md py-sm bg-surface-container-high border-b border-outline-variant flex justify-between items-center">
        <h3 className="font-label-caps text-label-caps">PILLAR SCORECARD</h3>
        <span className={"font-data-md text-data-md " + totalColor}>
          Total {formatContinuousScore(totalScore)}
        </span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low">
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">PILLAR</th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">SCORE</th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">WEIGHT</th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">CONTRIBUTION</th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">MODELS</th>
          </tr>
        </thead>
        <tbody className="font-data-md text-data-md">
          {pillars.map((p) => (
            <tr key={p.pillar} className="border-b border-outline-variant last:border-b-0">
              <td className="p-md font-semibold" title={pillarTooltip(p.pillar)}>
                {p.pillar}
              </td>
              <td className={"p-md " + scoreColorClass(p.score)}>
                {formatContinuousScore(p.score)}
              </td>
              <td className="p-md text-on-surface-variant">
                {(p.pillarWeight * 100).toFixed(0)}%
              </td>
              <td className={"p-md " + scoreColorClass(p.contribution)}>
                {formatContinuousScore(p.contribution)}
              </td>
              <td className="p-md text-on-surface-variant">{p.modelCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelCard({ model, cik }: { model: ModelResult; cik: string }) {
  const [expanded, setExpanded] = useState(false);
  // Defensive: handle legacy cached verdicts where `score` lived under
  // `subScore` (integer −2..+2). New schema uses continuous `score`.
  const score =
    typeof model.score === "number"
      ? model.score
      : typeof (model as unknown as { subScore?: number }).subScore === "number"
        ? (model as unknown as { subScore: number }).subScore / 2
        : 0;
  const colorClass = scoreColorClass(score);
  const lowConfidence = (model.confidence ?? 1) < 0.3;

  return (
    <div className="bg-surface-container border border-primary/30 rounded-lg overflow-hidden ring-1 ring-primary/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-md py-sm bg-surface-container-high border-b border-outline-variant flex justify-between items-center"
      >
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">analytics</span>
          <h3 className="font-label-caps text-label-caps uppercase">
            {model.pillar.toUpperCase()} MODEL: {model.name.toUpperCase()}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {lowConfidence && (
            <span
              className="text-[9px] uppercase tracking-wider text-on-surface-variant border border-outline-variant rounded px-1.5 py-0.5"
              title={`Low confidence (${(model.confidence * 100).toFixed(0)}%) — model has limited inputs for this ticker`}
            >
              Low conf
            </span>
          )}
          <span className={"font-data-md text-data-md " + colorClass}>
            {formatContinuousScore(score)}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-gutter grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2">
            <div className="bg-[#050f1b] p-md rounded border border-outline-variant mb-md">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-sm uppercase">
                Engine Reasoning: Formula
              </p>
              <div className="font-data-md text-data-md text-primary overflow-x-auto whitespace-nowrap py-sm">
                {model.formula}
              </div>
            </div>
            <div className="bg-surface-container-low p-md rounded border border-outline-variant">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-sm uppercase">
                Result
              </p>
              <p className="font-data-md text-data-md">{model.resultText}</p>
              <p className="text-on-surface-variant text-sm mt-2">
                {model.interpretation}
              </p>
            </div>
          </div>

          {/* Inputs with source-filing links */}
          <div className="space-y-sm">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-sm">
              Model Inputs
            </p>
            {model.inputs.length === 0 ? (
              <p className="text-on-surface-variant text-xs">
                No inputs available.
              </p>
            ) : (
              model.inputs.map((inp, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-xs border-b border-outline-variant last:border-b-0"
                >
                  <span className="font-body-sm text-body-sm flex-1 pr-2">
                    {inp.field}
                  </span>
                  <div className="flex items-center gap-sm">
                    <span className="font-data-sm text-data-sm">
                      {inp.value == null
                        ? "—"
                        : inp.unit === "USD"
                          ? formatUSD(inp.value, { compact: true })
                          : formatNumber(inp.value, { compact: true })}
                    </span>
                    {inp.source && (
                      <a
                        href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${parseInt(cik, 10)}&type=${inp.source.form}&dateb=&owner=include&count=40`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-data-sm flex items-center"
                      >
                        {inp.source.form}
                        <span className="material-symbols-outlined text-[12px] ml-xs">
                          north_east
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CatalystsCard({ items }: { items: string[] }) {
  return (
    <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-md">
      <h3 className="font-label-caps text-label-caps uppercase text-secondary mb-sm">
        Catalysts
      </h3>
      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No positive catalysts identified.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c, i) => (
            <li key={i} className="text-sm leading-relaxed flex gap-2">
              <span className="text-secondary mt-0.5">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RisksCard({ items }: { items: string[] }) {
  return (
    <div className="bg-tertiary/5 border border-tertiary/30 rounded-lg p-md">
      <h3 className="font-label-caps text-label-caps uppercase text-tertiary mb-sm">
        Risks
      </h3>
      {items.length === 0 ? (
        <p className="text-on-surface-variant text-sm">
          No material negative drivers — but absence of evidence isn't evidence of absence.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((c, i) => (
            <li key={i} className="text-sm leading-relaxed flex gap-2">
              <span className="text-tertiary mt-0.5">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SensitivityCard({
  items,
}: {
  items: VerdictDoc["sensitivity"];
}) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
      <div className="px-md py-sm bg-surface-container-high border-b border-outline-variant">
        <h3 className="font-label-caps text-label-caps uppercase">
          What would change this verdict?
        </h3>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low">
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">
              Scenario
            </th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">
              Effect
            </th>
            <th className="p-md font-label-caps text-label-caps text-on-surface-variant">
              New verdict
            </th>
          </tr>
        </thead>
        <tbody className="font-data-md text-data-md">
          {items.map((s, i) => (
            <tr key={i} className="border-b border-outline-variant last:border-b-0">
              <td className="p-md">{s.scenario}</td>
              <td className="p-md font-data-md text-on-surface-variant">
                {formatContinuousScore(s.effect)}
              </td>
              <td className="p-md">
                <span
                  className={
                    "text-[10px] px-2 py-0.5 rounded font-bold uppercase " +
                    (s.newVerdict === "BUY"
                      ? "verdict-buy"
                      : s.newVerdict === "SELL"
                        ? "verdict-sell"
                        : "verdict-hold")
                  }
                >
                  {s.newVerdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
