// Verdict synthesis — sums the 3 sub-scores into BUY / HOLD / SELL.
//
//   total = revenue + piotroski + graham
//   BUY  if total ≥ +2
//   SELL if total ≤ −2
//   HOLD otherwise

import { fetchCompanyFacts, getConceptUSD, TAGS } from "../edgar/companyfacts";
import { findCikByTicker } from "../edgar/tickers";
import { grahamNumberModel } from "./graham";
import { piotroskiLiteModel } from "./piotroski";
import { revenueTrendModel } from "./revenue";
import type { ModelResult, SourceRef, Verdict, VerdictDoc } from "./types";

function deriveVerdict(total: number): Verdict {
  if (total >= 2) return "BUY";
  if (total <= -2) return "SELL";
  return "HOLD";
}

function genThesis(
  ticker: string,
  companyName: string,
  models: ModelResult[],
  verdict: Verdict,
  total: number,
): string {
  const top = [...models].sort((a, b) => b.subScore - a.subScore)[0];
  const bottom = [...models].sort((a, b) => a.subScore - b.subScore)[0];
  const stance =
    verdict === "BUY"
      ? "the math points to a Buy"
      : verdict === "SELL"
        ? "the math points to a Sell"
        : "the math suggests Hold";
  return (
    `${companyName} (${ticker}) scored ${total >= 0 ? "+" : ""}${total.toFixed(0)} ` +
    `across three fundamental models. ${stance}, primarily because ${top.interpretation.toLowerCase()}` +
    (bottom.subScore < 0
      ? `, partially offset by ${bottom.interpretation.toLowerCase()}.`
      : ".")
  );
}

function genCatalysts(models: ModelResult[]): string[] {
  return models
    .filter((m) => m.subScore > 0)
    .slice(0, 3)
    .map((m) => `${m.name}: ${m.interpretation}`);
}

function genRisks(models: ModelResult[]): string[] {
  return models
    .filter((m) => m.subScore < 0)
    .slice(0, 3)
    .map((m) => `${m.name}: ${m.interpretation}`);
}

export interface ComputeVerdictArgs {
  ticker: string;
  currentPrice?: number | null;
  marketCap?: number | null;
}

export async function computeVerdict(
  args: ComputeVerdictArgs,
): Promise<VerdictDoc> {
  const ticker = args.ticker.toUpperCase();
  const cik = await findCikByTicker(ticker);
  if (!cik) {
    throw new Error(`Unknown ticker: ${ticker}`);
  }
  const facts = await fetchCompanyFacts(cik);

  const revenue = getConceptUSD(facts, [...TAGS.revenue]);
  const eps = getConceptUSD(facts, [...TAGS.epsDiluted]);
  const netIncome = getConceptUSD(facts, [...TAGS.netIncome]);
  const ocf = getConceptUSD(facts, [...TAGS.operatingCashFlow]);
  const ltd = getConceptUSD(facts, [...TAGS.longTermDebt]);
  const shares = getConceptUSD(facts, [...TAGS.sharesOutstanding]);
  const sharesDiluted = getConceptUSD(facts, [...TAGS.sharesDilutedWeighted]);
  const equity = getConceptUSD(facts, [...TAGS.stockholdersEquity]);

  // Most recent filing across the whole dataset → header reference
  const allFilings = [...revenue, ...netIncome, ...ocf];
  const latestFiling: SourceRef | null = allFilings.length
    ? (() => {
        const p = allFilings.sort((a, b) => (a.filed < b.filed ? 1 : -1))[0];
        return {
          form: p.form,
          accession: p.accession,
          filed: p.filed,
          fy: p.fy,
          fp: p.fp,
          end: p.end,
        };
      })()
    : null;

  const m1 = revenueTrendModel({ revenue, eps });
  const m2 = piotroskiLiteModel({
    netIncome,
    operatingCashFlow: ocf,
    longTermDebt: ltd,
    sharesOutstanding: shares,
  });
  const m3 = grahamNumberModel({
    epsDiluted: eps,
    stockholdersEquity: equity,
    sharesDiluted,
    currentPrice: args.currentPrice ?? null,
  });

  const models = [m1, m2, m3];
  const totalScore = models.reduce((sum, m) => sum + m.subScore, 0);
  const verdict = deriveVerdict(totalScore);

  // Confidence based on how many models had usable inputs (rough proxy)
  const completeModels = models.filter((m) => m.inputs.some((i) => i.value != null)).length;
  const confidence: "High" | "Medium" | "Low" =
    completeModels === 3 ? "High" : completeModels === 2 ? "Medium" : "Low";

  return {
    ticker,
    cik,
    companyName: facts.name,
    asOf: new Date().toISOString(),
    latestFiling,
    thesis: genThesis(ticker, facts.name, models, verdict, totalScore),
    models,
    totalScore,
    verdict,
    confidence,
    catalysts: genCatalysts(models),
    risks: genRisks(models),
    sensitivity: [
      // Static educational examples for now — Phase 1 will compute these
      // by perturbing each input by ±15% and re-deriving the verdict.
      {
        scenario: "Latest revenue revised down 15%",
        effect: -1,
        newVerdict: deriveVerdict(totalScore - 1),
      },
      {
        scenario: "Long-term debt rises 25% (new issuance)",
        effect: -1,
        newVerdict: deriveVerdict(totalScore - 1),
      },
      {
        scenario: "Price falls 20% (multiple compression)",
        effect: 1,
        newVerdict: deriveVerdict(totalScore + 1),
      },
    ],
    marketSnapshot: {
      price: args.currentPrice ?? null,
      marketCap: args.marketCap ?? null,
    },
  };
}
