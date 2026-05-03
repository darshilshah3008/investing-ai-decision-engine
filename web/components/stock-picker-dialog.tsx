"use client";

// StockPickerDialog — modal from screen (4) HTML.
// Loads SEC ticker master from /api/tickers, lets the user search +
// multi-select, then invokes onAnalyze with the chosen tickers.

import { useEffect, useMemo, useRef, useState } from "react";

interface TickerEntry {
  cik: string;
  ticker: string;
  name: string;
}

const SUGGESTED = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "AMZN"];

export function StockPickerDialog({
  open,
  onClose,
  onAnalyze,
}: {
  open: boolean;
  onClose: () => void;
  onAnalyze: (tickers: string[]) => void;
}) {
  const [allTickers, setAllTickers] = useState<TickerEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load ticker master on open (cached after first load).
  useEffect(() => {
    if (!open || allTickers) return;
    setLoading(true);
    setError(null);
    fetch("/api/tickers")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { tickers: TickerEntry[] };
        setAllTickers(data.tickers);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, allTickers]);

  useEffect(() => {
    if (open) {
      // small delay to ensure modal renders before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery("");
    setSelected([]);
  }, [open]);

  const filtered = useMemo<TickerEntry[]>(() => {
    if (!allTickers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allTickers
      .filter(
        (t) =>
          t.ticker.toLowerCase().startsWith(q) ||
          t.name.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [allTickers, query]);

  if (!open) return null;

  const toggle = (ticker: string) => {
    setSelected((s) =>
      s.includes(ticker) ? s.filter((x) => x !== ticker) : [...s, ticker],
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-24 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <span className="font-label-caps text-on-surface-variant uppercase tracking-[0.1em]">
              Most-analyzed this week
            </span>
            <button
              aria-label="Close"
              onClick={onClose}
              className="material-symbols-outlined text-on-surface-variant hover:text-on-surface"
            >
              close
            </button>
          </div>
          <h1 className="font-h1 text-h1 tracking-tight text-on-surface mb-3">
            Add stocks to analyze.
          </h1>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selected.map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  className="inline-flex items-center gap-2 px-2 py-1 bg-primary-container text-on-primary-container rounded-full text-xs font-data-md hover:opacity-90"
                >
                  {t}
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type ticker or company name (e.g. AAPL, Microsoft)..."
              className="flex-1 bg-transparent border-none outline-none text-on-surface placeholder:text-outline text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto p-3">
          {loading && (
            <div className="px-3 py-2 text-on-surface-variant text-sm">
              Loading SEC ticker master...
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-error text-sm">Error: {error}</div>
          )}

          {/* Empty state — show suggested */}
          {!loading && !query && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {SUGGESTED.map((t) => {
                  const on = selected.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggle(t)}
                      className={
                        "px-3 py-2 rounded-lg text-sm font-data-md border transition-colors " +
                        (on
                          ? "border-primary bg-primary-container/30 text-primary"
                          : "border-outline-variant bg-surface-container-low text-on-surface hover:border-primary/50")
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="px-2 text-xs text-on-surface-variant">
                Or type a ticker symbol to search ~12,000 SEC-listed companies.
              </p>
            </>
          )}

          {/* Filtered results */}
          {!loading && query && filtered.length === 0 && (
            <div className="px-3 py-2 text-on-surface-variant text-sm">
              No matches. Try a different ticker or name.
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <ul className="space-y-1">
              {filtered.map((t) => {
                const on = selected.includes(t.ticker);
                return (
                  <li key={t.cik}>
                    <button
                      onClick={() => toggle(t.ticker)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors text-left"
                    >
                      <span className="font-data-md text-data-md text-on-surface w-16">
                        {t.ticker}
                      </span>
                      <span className="text-sm text-on-surface-variant flex-1 truncate">
                        {t.name}
                      </span>
                      <span
                        className={
                          "material-symbols-outlined text-[18px] " +
                          (on ? "text-primary" : "text-outline-variant")
                        }
                      >
                        {on ? "check_box" : "check_box_outline_blank"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-on-surface-variant text-sm hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            disabled={selected.length === 0}
            onClick={() => onAnalyze(selected)}
            className="bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          >
            Analyze {selected.length} stock{selected.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
