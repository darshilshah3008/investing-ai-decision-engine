// Pretty-printers for financial numbers. Used everywhere the UI shows
// currency, large numbers, or percentages.

export function formatUSD(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || !isFinite(n)) return "—";
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  }
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatNumber(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || !isFinite(n)) return "—";
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatScore(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Build a deep link to a filing on EDGAR for a given accession number.
export function edgarFilingUrl(cik: string, accession: string): string {
  // accession from companyfacts is dashed: e.g. "0000320193-25-000010"
  const cikInt = String(parseInt(cik, 10));
  const accNoDashes = accession.replace(/-/g, "");
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}&type=10-K&dateb=&owner=include&count=40`;
}
