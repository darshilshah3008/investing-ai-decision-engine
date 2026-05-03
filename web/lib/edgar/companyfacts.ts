import { cikPad, edgarFetchJson } from "./client";

// XBRL companyfacts JSON — every numeric fact a filer has ever reported.
// Endpoint: https://data.sec.gov/api/xbrl/companyfacts/CIK<10digit>.json

interface RawFactUnit {
  end: string; // YYYY-MM-DD
  val: number;
  fy: number;
  fp: string; // "FY" | "Q1" | "Q2" | "Q3" | "Q4"
  form: string; // "10-K" | "10-Q" | etc.
  filed: string; // YYYY-MM-DD
  accn: string; // accession number
  start?: string;
}

interface RawFact {
  label?: string;
  description?: string;
  units: Record<string, RawFactUnit[]>;
}

interface RawCompanyFacts {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, RawFact>;
    dei?: Record<string, RawFact>;
  };
}

export interface FactPoint {
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: "10-K" | "10-Q";
  filed: string;
  accession: string;
}

export interface CompanyFacts {
  cik: string;
  name: string;
  raw: RawCompanyFacts;
}

/**
 * Fetch the full XBRL company-facts blob for one filer.
 */
export async function fetchCompanyFacts(cik: string): Promise<CompanyFacts> {
  const padded = cikPad(cik);
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
  const raw = await edgarFetchJson<RawCompanyFacts>(url, {
    cacheKey: `companyfacts-${padded}`,
  });
  return { cik: padded, name: raw.entityName, raw };
}

/**
 * Extract a list of points for one US-GAAP concept, restricted to 10-K
 * and 10-Q forms, sorted newest-first by period end.
 *
 * Tries each tag in order, returns the first one that yields data.
 * This handles the v1-style fallback chain across companies that use
 * slightly different XBRL tags for the same concept.
 */
export function getConceptUSD(
  facts: CompanyFacts,
  tags: string[],
): FactPoint[] {
  const usGaap = facts.raw.facts?.["us-gaap"] ?? {};
  for (const tag of tags) {
    const obj = usGaap[tag];
    if (!obj) continue;
    const usd = obj.units?.["USD"] ?? obj.units?.["USD/shares"] ?? obj.units?.["shares"];
    if (!usd || usd.length === 0) continue;
    const filtered = usd
      .filter((u) => u.form === "10-K" || u.form === "10-Q")
      .map<FactPoint>((u) => ({
        end: u.end,
        val: u.val,
        fy: u.fy,
        fp: u.fp,
        form: u.form as "10-K" | "10-Q",
        filed: u.filed,
        accession: u.accn,
      }));
    if (filtered.length > 0) {
      return filtered.sort((a, b) => (a.end < b.end ? 1 : -1));
    }
  }
  return [];
}

// Tag fallback chains — different filers report the same concept under
// different XBRL tags, so we try each in turn.
export const TAGS = {
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
  ],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingCashFlow: [
    "NetCashProvidedByOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivities",
  ],
  longTermDebt: [
    "LongTermDebtNoncurrent",
    "LongTermDebt",
  ],
  sharesOutstanding: [
    "CommonStockSharesOutstanding",
    "WeightedAverageNumberOfDilutedSharesOutstanding",
  ],
  sharesDilutedWeighted: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  epsDiluted: ["EarningsPerShareDiluted"],
  epsBasic: ["EarningsPerShareBasic"],
  stockholdersEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
} as const;
