// Verdict synthesis — continuous-score, pillar-weighted, confidence-adjusted.
//
// Each model emits a score in [-1, +1] with a confidence in [0, 1] and
// a within-pillar weight. We aggregate as follows:
//
//   pillar_score = Σ (model.score × model.weight × model.confidence)
//                  / Σ (model.weight × model.confidence)
//
//   total = Σ (pillar_score × pillarWeight)
//
// Pillar weights (sum to 1):
//   Quality         0.30
//   Growth          0.25
//   Valuation       0.30
//   Sustainability  0.15
//
// Verdict bands (continuous total ∈ [-1, +1]):
//   total >= +0.30  →  BUY
//   total >= -0.20  →  HOLD
//   else            →  SELL

import { fetchCompanyFacts, getConceptUSD, TAGS } from "../edgar/companyfacts";
import { findCikByTicker } from "../edgar/tickers";
import { cagrModel } from "./cagr";
import { debtSustainabilityModel } from "./debt-sustainability";
import { earningsYieldModel } from "./earnings-yield";
import { fcfYieldModel } from "./fcf-yield";
import { grahamNumberModel } from "./graham";
import { marginTrendModel } from "./margin-trend";
import { piotroskiLiteModel } from "./piotroski";
import { revenueTrendModel } from "./revenue";
import { roicModel } from "./roic";
import type {
  ModelResult,
  Pillar,
  PillarResult,
  SourceRef,
  Verdict,
  VerdictDoc,
} from "./types";

const PILLAR_WEIGHTS: Record<Pillar, number> = {
  Quality: 0.30,
  Growth: 0.25,
  Valuation: 0.30,
  Sustainability: 0.15,
};

const BUY_THRESHOLD = 0.30;
const SELL_THRESHOLD = -0.20;

function computePillar(pillar: Pillar, models: ModelResult[]): PillarResult {
  const inPillar = models.filter((m) => m.pillar === pillar);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of inPillar) {
    const w = m.weight * m.confidence;
    weightedSum += m.score * w;
    totalWeight += w;
  }
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const pillarWeight = PILLAR_WEIGHTS[pillar];
  return {
    pillar,
    score,
    pillarWeight,
    contribution: score * pillarWeight,
    modelCount: inPillar.length,
  };
}

function deriveVerdict(total: number): Verdict {
  if (total >= BUY_THRESHOLD) return "BUY";
  if (total >= SELL_THRESHOLD) return "HOLD";
  return "SELL";
}

function genThesis(
  ticker: string,
  companyName: string,
  pillars: PillarResult[],
  total: number,
  verdict: Verdict,
): string {
  const sortedByContribution = [...pillars].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );
  const top = sortedByContribution[0];
  const bottom = pillars.find((p) => p.score < 0);

  const stance =
    verdict === "BUY"
      ? "the engine signals a BUY"
      : verdict === "SELL"
        ? "the engine signals a SELL"
        : "the engine signals a HOLD";

  const topPart = top
    ? `, primarily driven by ${top.pillar.toLowerCase()} (score ${top.score >= 0 ? "+" : ""}${top.score.toFixed(2)})`
    : "";
  const bottomPart =
    bottom && bottom !== top
      ? `, partially offset by weakness in ${bottom.pillar.toLowerCase()} (score ${bottom.score.toFixed(2)})`
      : "";

  return (
    `${companyName} (${ticker}) scored ${total >= 0 ? "+" : ""}${total.toFixed(2)} ` +
    `across nine fundamental models. With a continuous score in [-1, +1], ` +
    `${stance}${topPart}${bottomPart}.`
  );
}

function genCatalysts(models: ModelResult[]): string[] {
  return models
    .filter((m) => m.score > 0.2 && m.confidence > 0.3)
    .sort((a, b) => b.score * b.confidence - a.score * a.confidence)
    .slice(0, 3)
    .map((m) => `${m.name}: ${m.interpretation}`);
}

function genRisks(models: ModelResult[]): string[] {
  return models
    .filter((m) => m.score < -0.2 && m.confidence > 0.3)
    .sort((a, b) => a.score * a.confidence - b.score * b.confidence)
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

  // Pull all the XBRL series we need
  const revenue = getConceptUSD(facts, [...TAGS.revenue]);
  const eps = getConceptUSD(facts, [...TAGS.epsDiluted]);
  const netIncome = getConceptUSD(facts, [...TAGS.netIncome]);
  const ocf = getConceptUSD(facts, [...TAGS.operatingCashFlow]);
  const capex = getConceptUSD(facts, [...TAGS.capitalExpenditures]);
  const ltd = getConceptUSD(facts, [...TAGS.longTermDebt]);
  const std = getConceptUSD(facts, [...TAGS.shortTermDebt]);
  const cash = getConceptUSD(facts, [...TAGS.cashAndEquivalents]);
  const shares = getConceptUSD(facts, [...TAGS.sharesOutstanding]);
  const sharesDiluted = getConceptUSD(facts, [...TAGS.sharesDilutedWeighted]);
  const equity = getConceptUSD(facts, [...TAGS.stockholdersEquity]);
  const cor = getConceptUSD(facts, [...TAGS.costOfRevenue]);
  const gp = getConceptUSD(facts, [...TAGS.grossProfit]);
  const oi = getConceptUSD(facts, [...TAGS.operatingIncome]);
  const ie = getConceptUSD(facts, [...TAGS.interestExpense]);

  // Most recent filing → header reference
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

  // Run all 9 models
  const models: ModelResult[] = [
    revenueTrendModel({ revenue, eps }),
    cagrModel({ revenue, operatingCashFlow: ocf, capitalExpenditures: capex }),
    piotroskiLiteModel({
      netIncome,
      operatingCashFlow: ocf,
      longTermDebt: ltd,
      sharesOutstanding: shares,
    }),
    roicModel({
      netIncome,
      stockholdersEquity: equity,
      longTermDebt: ltd,
      cash,
    }),
    marginTrendModel({
      revenue,
      costOfRevenue: cor,
      grossProfit: gp,
      operatingIncome: oi,
    }),
    earningsYieldModel({
      netIncome,
      marketCap: args.marketCap ?? null,
    }),
    fcfYieldModel({
      operatingCashFlow: ocf,
      capitalExpenditures: capex,
      marketCap: args.marketCap ?? null,
    }),
    grahamNumberModel({
      epsDiluted: eps,
      stockholdersEquity: equity,
      sharesDiluted,
      currentPrice: args.currentPrice ?? null,
    }),
    debtSustainabilityModel({
      longTermDebt: ltd,
      shortTermDebt: std,
      cash,
      operatingCashFlow: ocf,
      operatingIncome: oi,
      interestExpense: ie,
      stockholdersEquity: equity,
    }),
  ];

  // Aggregate per pillar
  const pillarOrder: Pillar[] = ["Quality", "Growth", "Valuation", "Sustainability"];
  const pillars = pillarOrder.map((p) => computePillar(p, models));

  // Total score = weighted sum of pillar scores
  const totalScore = pillars.reduce((s, p) => s + p.contribution, 0);
  const verdict = deriveVerdict(totalScore);

  // Confidence rating: how many models had high confidence (>0.5)?
  const highConfModels = models.filter((m) => m.confidence > 0.5).length;
  const confidence: "High" | "Medium" | "Low" =
    highConfModels >= 6 ? "High" : highConfModels >= 4 ? "Medium" : "Low";

  return {
    ticker,
    cik,
    companyName: facts.name,
    asOf: new Date().toISOString(),
    latestFiling,
    thesis: genThesis(ticker, facts.name, pillars, totalScore, verdict),
    models,
    pillars,
    totalScore,
    verdict,
    confidence,
    catalysts: genCatalysts(models),
    risks: genRisks(models),
    sensitivity: [
      // Educational placeholders — Phase 2 will compute by perturbing inputs
      {
        scenario: "Revenue drops 10% next year",
        effect: -0.15,
        newVerdict: deriveVerdict(totalScore - 0.15),
      },
      {
        scenario: "Treasury yield rises to 6%",
        effect: -0.20,
        newVerdict: deriveVerdict(totalScore - 0.20),
      },
      {
        scenario: "Price falls 25% (multiple compression)",
        effect: 0.30,
        newVerdict: deriveVerdict(totalScore + 0.30),
      },
    ],
    marketSnapshot: {
      price: args.currentPrice ?? null,
      marketCap: args.marketCap ?? null,
    },
  };
}
