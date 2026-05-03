// System-prompt builder for the chat assistant.
//
// The prompt is the safety boundary: it tells Claude what to do, what
// NOT to do, and gives it the user's portfolio data to ground answers
// in. Without this, the model would happily hallucinate stock prices
// from training data and give "should you buy AAPL" advice — both bad.

import type { VerdictDoc } from "../analysis/types";

interface PortfolioPosition {
  ticker: string;
  weight: number;
  costBasis: number | null;
  verdict: VerdictDoc | null;
}

export interface ChatContext {
  /** Either "verdict" (single stock page) or "portfolio" (watchlist page) */
  kind: "verdict" | "portfolio";
  /** Single stock context — set when kind === "verdict" */
  stock?: VerdictDoc;
  /** Portfolio context — set when kind === "portfolio" */
  portfolio?: {
    name: string;
    portfolioTotal: number | null;
    positions: PortfolioPosition[];
  };
}

const COMMON_RULES = `
You are an investment-research assistant for the Investing AI Decision Engine.
You help users understand the engine's analysis of their portfolio.

# CRITICAL RULES — these are non-negotiable

1. NEVER predict stock prices, market direction, or future performance.
   If asked: "I can't predict prices. The engine scores stocks based on
   current fundamentals — it doesn't forecast where the price will go."

2. NEVER make buy / sell / hold recommendations. The engine's verdict
   is a research signal, not advice. If asked "should I buy X":
   "I can't recommend specific actions — that depends on your full
   financial situation, time horizon, and risk tolerance. What I can do
   is explain the engine's analysis: [cite the actual scores]"

3. ALWAYS cite specific numbers from the CONTEXT block I provide below.
   If a number isn't in the context, say "I don't have that data" —
   never guess or use your training knowledge for stock fundamentals,
   prices, or financials. Pure methodology questions (e.g. "what is
   Piotroski F-Score") may use general knowledge.

4. Plain text only — NO markdown formatting (no asterisks for bold, no
   pound signs for headers, no backticks). Use line breaks + dashes for
   lists. The UI doesn't render markdown.

5. Concise: 2-4 short paragraphs max. Skip pleasantries.

6. When the user's question is about action ("what should I do"),
   redirect to insight ("here's what the data shows; the decision is
   yours"). The user is the analyst — you're the explainer.

# Engine methodology (cite when explaining scores)

The engine produces one continuous score per stock in [-1, +1]:
  total >= +0.30 → BUY
  total <= -0.20 → SELL
  else            → HOLD

Total is a weighted average of 4 pillars:
  Quality        30%   (Piotroski-Lite, ROIC, Margin Trend)
  Growth         25%   (Multi-Year CAGR, Quarterly Trend)
  Valuation      30%   (FCF Yield, Earnings Yield vs Treasury, Graham Number)
  Sustainability 15%   (Debt Sustainability)

Each model emits its own continuous score in [-1, +1] AND a confidence
in [0, 1]. Lower confidence reduces that model's vote in synthesis.
`.trim();

function formatVerdictForPrompt(v: VerdictDoc): string {
  const ms = v.marketSnapshot;
  const lines: string[] = [];
  lines.push(`Ticker: ${v.ticker} (${v.companyName})`);
  if (ms.sector) lines.push(`Sector / Industry: ${ms.sector} / ${ms.industry ?? "—"}`);
  lines.push(`Engine verdict: ${v.verdict}, total score ${v.totalScore.toFixed(2)}, confidence ${v.confidence}`);
  lines.push(`Engine thesis: ${v.thesis}`);
  if (ms.price != null) lines.push(`Current price: $${ms.price.toFixed(2)}`);
  if (ms.marketCap != null) lines.push(`Market cap: $${(ms.marketCap / 1e9).toFixed(1)}B`);
  if (ms.dividendYield != null) lines.push(`Dividend yield: ${(ms.dividendYield * 100).toFixed(2)}%`);
  if (ms.trailingPE != null) lines.push(`P/E (TTM): ${ms.trailingPE.toFixed(1)}x`);
  if (ms.beta != null) lines.push(`Beta: ${ms.beta.toFixed(2)}`);
  if (ms.fiftyTwoWeekHigh != null && ms.fiftyTwoWeekLow != null) {
    lines.push(`52-week range: $${ms.fiftyTwoWeekLow.toFixed(2)} – $${ms.fiftyTwoWeekHigh.toFixed(2)}`);
  }

  lines.push("");
  lines.push("Pillar scorecard:");
  for (const p of v.pillars) {
    lines.push(
      `  ${p.pillar}: score ${p.score.toFixed(2)} (weight ${(p.pillarWeight * 100).toFixed(0)}%, contribution ${p.contribution.toFixed(2)}, ${p.modelCount} models)`,
    );
  }

  lines.push("");
  lines.push("Per-model breakdown:");
  for (const m of v.models) {
    lines.push(
      `  [${m.pillar}] ${m.name}: score ${m.score.toFixed(2)} (confidence ${m.confidence.toFixed(2)})`,
    );
    lines.push(`    formula: ${m.formula}`);
    lines.push(`    interpretation: ${m.interpretation}`);
  }

  if (v.catalysts.length > 0) {
    lines.push("");
    lines.push("Catalysts (positives):");
    v.catalysts.forEach((c) => lines.push(`  - ${c}`));
  }
  if (v.risks.length > 0) {
    lines.push("");
    lines.push("Risks (negatives):");
    v.risks.forEach((r) => lines.push(`  - ${r}`));
  }
  return lines.join("\n");
}

function formatPortfolioForPrompt(args: {
  name: string;
  portfolioTotal: number | null;
  positions: PortfolioPosition[];
}): string {
  const lines: string[] = [];
  lines.push(`Watchlist name: ${args.name}`);
  if (args.portfolioTotal != null) {
    lines.push(`Total portfolio value: $${args.portfolioTotal.toLocaleString()}`);
  }
  lines.push(`Number of positions: ${args.positions.length}`);

  const totalWeight = args.positions.reduce((s, p) => s + p.weight, 0);
  lines.push(`Total weight allocated: ${totalWeight.toFixed(1)}%`);

  // Score-weighted summary
  const scored = args.positions.filter((p) => p.verdict != null);
  if (scored.length > 0) {
    const weightedScoreNum = scored.reduce(
      (s, p) => s + (p.verdict!.totalScore * p.weight),
      0,
    );
    const denom = scored.reduce((s, p) => s + p.weight, 0);
    if (denom > 0) {
      lines.push(`Portfolio weighted engine score: ${(weightedScoreNum / denom).toFixed(2)}`);
    }
  }

  lines.push("");
  lines.push("Positions:");
  // Sort by weight descending for readability
  const sorted = [...args.positions].sort((a, b) => b.weight - a.weight);
  for (const pos of sorted) {
    const v = pos.verdict;
    const verdict = v ? `${v.verdict} (${v.totalScore.toFixed(2)})` : "—";
    const sector = v?.marketSnapshot?.sector ?? "—";
    const dy = v?.marketSnapshot?.dividendYield;
    const dyStr = dy != null ? `, div yield ${(dy * 100).toFixed(2)}%` : "";
    const cb =
      pos.costBasis != null && args.portfolioTotal != null
        ? `, cost $${pos.costBasis.toLocaleString()} → P&L ${(((args.portfolioTotal * pos.weight) / 100 - pos.costBasis) >= 0 ? "+" : "")}$${Math.round((args.portfolioTotal * pos.weight) / 100 - pos.costBasis).toLocaleString()}`
        : "";
    lines.push(
      `  ${pos.ticker}: ${pos.weight.toFixed(1)}% weight, ${verdict}, ${sector}${dyStr}${cb}`,
    );
  }
  return lines.join("\n");
}

export function buildSystemPrompt(ctx: ChatContext): string {
  let contextBlock = "";
  if (ctx.kind === "verdict" && ctx.stock) {
    contextBlock =
      "# CONTEXT — current stock the user is viewing\n\n" +
      formatVerdictForPrompt(ctx.stock);
  } else if (ctx.kind === "portfolio" && ctx.portfolio) {
    contextBlock =
      "# CONTEXT — user's current watchlist / portfolio\n\n" +
      formatPortfolioForPrompt(ctx.portfolio);
  } else {
    contextBlock = "# CONTEXT — no specific data available";
  }
  return `${COMMON_RULES}\n\n${contextBlock}`;
}
