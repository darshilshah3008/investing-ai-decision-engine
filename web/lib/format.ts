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

/**
 * Format a continuous engine score (range [-1, +1]) for UI display.
 * Always shows a sign and 2 decimal places.
 *   +0.18    →  "+0.18"
 *   −0.32    →  "−0.32"
 *   0        →  "+0.00"
 */
export function formatScoreContinuous(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/**
 * Map a continuous score to a Tailwind text color class.
 * Symmetric thresholds: ±0.30 strong, ±0.10 mid, otherwise neutral.
 */
export function scoreColorClass(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "text-on-surface-variant";
  if (n >= 0.30) return "text-secondary font-semibold";
  if (n >= 0.10) return "text-secondary";
  if (n <= -0.30) return "text-tertiary font-semibold";
  if (n <= -0.10) return "text-tertiary";
  return "text-on-surface-variant";
}

/**
 * Format an ISO timestamp as a human-readable "X ago" string.
 *   2 minutes ago, 4h ago, 2d ago, etc.
 */
export function formatRelativeTime(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  const ts = typeof iso === "string" ? Date.parse(iso) : iso;
  if (!isFinite(ts)) return "—";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(ts).toLocaleDateString();
}

// Build a deep link to a filing on EDGAR for a given accession number.
export function edgarFilingUrl(cik: string, accession: string): string {
  // accession from companyfacts is dashed: e.g. "0000320193-25-000010"
  const cikInt = String(parseInt(cik, 10));
  const accNoDashes = accession.replace(/-/g, "");
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}&type=10-K&dateb=&owner=include&count=40`;
}
