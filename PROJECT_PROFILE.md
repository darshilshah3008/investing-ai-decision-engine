# Investing AI Decision Engine — v2 Project Profile

A blueprint for evolving the current rule-based CLI engine into an **interactive
multi-tab application** that downloads SEC 10-K / 10-Q filings, analyzes them,
and produces Buy / Hold / Sell signals — for either a user-selected list of
stocks or the entire SEC universe.

This document is the design / planning artifact you can drop into the repo and
reference while building. It is intentionally implementation-agnostic in the
hard parts (UI framework, storage) so you can pick what fits.

---

## 1. Vision

> *"Pick the stocks I care about, fetch their actual SEC filings, and tell me
> whether to buy, hold, or sell — with reasoning I can audit. And let me bulk-
> download every 10-K/10-Q on EDGAR if I want to."*

### Core Principles (carried over from v1)

1. **Rules-based, not black-box ML.** Every signal is explainable.
2. **SEC filings are the source of truth.** Yahoo Finance is supplemental.
3. **Research tool, not a trading system.** No order execution.
4. **Reproducible outputs.** Every run produces auditable CSVs / JSON.

---

## 2. What's New vs. v1

| Capability                         | v1 (today)                     | v2 (this profile)                                                   |
|------------------------------------|--------------------------------|---------------------------------------------------------------------|
| Stock selection                    | Hard-coded `WATCHLIST` in code | Multi-select dropdown sourced from SEC ticker master                |
| Revenue data                       | XBRL companyfacts only         | XBRL **plus** raw 10-K / 10-Q document download & parsing           |
| Filings access                     | None                           | Per-ticker on-demand fetch (Tab 1) + bulk universe fetch (Tab 2)    |
| UI                                 | CLI / CSV                      | Web UI with two tabs, tables, signals, downloadable artifacts       |
| Output                             | Flat CSVs                      | CSV + JSON + cached filings on disk + an in-app analysis report     |
| Concurrency                        | Sequential                     | Async / threaded fetches respecting SEC fair-access rules           |

---

## 3. Feature Specification

### Tab 1 — *Targeted Analysis* (the primary workflow)

**Goal:** user picks N tickers, app fetches their 10-K/10-Q filings, runs the
decision engine, and shows Buy/Hold/Sell with reasoning.

User flow:

1. App loads the SEC ticker master into a searchable multi-select dropdown.
2. User selects 1 - N tickers (e.g. `GOOGL, NVDA, MSFT`).
3. User chooses parameters:
   - Number of filings per ticker (e.g. last 4 × 10-Q + last 2 × 10-K)
   - Whether to also pull Yahoo market data (price, P/E, forward P/E, beta)
4. App fetches the filings from EDGAR, caches them locally.
5. App extracts the financial facts (revenue trajectory, EPS, operating margin)
   from each filing.
6. Decision engine runs and produces:
   - A **per-stock card** (snapshot, valuation bucket, signals, final rating)
   - A **summary table** (one row per ticker)
   - Downloadable artifacts: the raw filing PDFs/HTML, an `analysis.json`,
     and a CSV of signals.

### Tab 2 — *Universe Builder* (the heavy job)

**Goal:** download 10-K and 10-Q filings for **every** company on EDGAR into a
local corpus that can be searched and analyzed offline.

User flow:

1. User picks a scope:
   - Form types: `10-K`, `10-Q`, or both
   - Date range (e.g. last 5 years, or all time)
   - Filter (optional): exchange (NYSE/NASDAQ), sector, market cap min
2. User starts the job. App:
   - Walks the SEC submissions index per CIK (`https://data.sec.gov/submissions/CIK<10digit>.json`)
   - For each filing matching the form/date filter, downloads the primary
     document and stores under `corpus/<TICKER>/<accessionNumber>/`
   - Maintains a `manifest.parquet` that lets you query "give me all NVDA 10-Qs
     from 2022".
3. Live progress: tickers processed / queued / failed, ETA, throttle status.
4. On completion: a **corpus dashboard** showing total filings, size on disk,
   per-sector counts, and a re-runnable resume button.

### Tab 3 (recommended) — *Watchlist & History*

A stretch tab for snapshots over time:

- Save a named watchlist (e.g. "AI Megacaps")
- Re-run the analysis weekly via a scheduler
- Diff today's signals against last week's to see *what changed and why*

---

## 4. Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              UI Layer                                  │
│   Streamlit (fastest path) OR FastAPI + React (production-grade)       │
│   Tab 1: Targeted Analysis     Tab 2: Universe Builder    Tab 3: Hist  │
└─────────────────────────┬──────────────────────────────────────────────┘
                          │ JSON / WebSocket
┌─────────────────────────▼──────────────────────────────────────────────┐
│                        Service Layer                                   │
│   - TickerService     (search, dropdown source)                        │
│   - FilingsService    (per-ticker fetch, parse, cache)                 │
│   - UniverseJobService(bulk download w/ rate-limited worker pool)      │
│   - AnalysisService   (revenue screen + valuation + classifier)        │
│   - WatchlistService  (saved sets, scheduled runs, diffs)              │
└─────────────────────────┬──────────────────────────────────────────────┘
                          │
┌──────────────┬──────────▼────────────┬─────────────┬───────────────────┐
│              │                       │             │                   │
│  EDGAR API   │  Yahoo Finance        │  SQLite/    │  Local filesystem │
│  (filings,   │  (price, P/E, beta)   │  Postgres   │  (corpus/, cache) │
│  XBRL,       │                       │  (manifest, │                   │
│  submissions)│                       │  watchlists)│                   │
└──────────────┴───────────────────────┴─────────────┴───────────────────┘
```

### Why these layers?

- **UI ↔ Service split** lets you swap the UI later (Streamlit prototype →
  React production) without rewriting the engine.
- **Service Layer is pure Python** with no UI imports → testable in isolation.
- **SQLite first**, Postgres later — you only need a real DB if you adopt the
  scheduled-runs / diff feature in Tab 3.

---

## 5. Tech Stack — Recommended

| Concern              | Choice                            | Why                                                       |
|----------------------|-----------------------------------|-----------------------------------------------------------|
| Language             | Python 3.11+                      | Continuity with v1                                        |
| Web UI (Phase 1)     | **Streamlit**                     | Multi-tab, dropdowns, tables in ~200 lines; ship in days  |
| Web UI (Phase 2)     | FastAPI + React (Vite, TanStack)  | When you outgrow Streamlit's reactivity model             |
| HTTP client          | `httpx` (async) or `requests`     | Async unlocks the Tab 2 bulk job                          |
| Filing parsing       | `sec-edgar-downloader` + `lxml` / `beautifulsoup4` | Battle-tested, respects EDGAR ToS         |
| XBRL extraction      | direct EDGAR `companyfacts` JSON  | Already proven in v1                                      |
| Data frames          | `pandas` + `pyarrow`              | Parquet manifest for the corpus                           |
| Storage              | `corpus/` flat files + SQLite     | No infra to run locally                                   |
| Job orchestration    | `concurrent.futures` (Phase 1) → `arq` / `Celery` (Phase 2) | Keep it simple first              |
| Scheduling (Tab 3)   | `APScheduler`                     | In-process cron                                           |
| Logging              | `loguru`                          | Replaces v1's `log()` helper                              |
| Testing              | `pytest` + `responses` (HTTP mock)| Critical for SEC integration                              |
| Packaging            | `pyproject.toml` + `uv` or `pip`  | Standard                                                  |

> **Decision point for you:** go Streamlit-first. Build it in 2 weekends.
> Re-platform to FastAPI+React only if you actually need real-time updates,
> auth, or a public deployment.

---

## 6. Repository Structure (proposed)

```
investing-ai-decision-engine/
├── app/                              # UI layer (Streamlit pages)
│   ├── Home.py                       # Streamlit entrypoint
│   └── pages/
│       ├── 1_Targeted_Analysis.py
│       ├── 2_Universe_Builder.py
│       └── 3_Watchlist_History.py
│
├── src/investing_engine/             # Importable package
│   ├── __init__.py
│   ├── config.py                     # SEC headers, paths, rate limits
│   ├── tickers.py                    # download_all_tickers, search
│   ├── filings/
│   │   ├── edgar_client.py           # rate-limited EDGAR HTTP client
│   │   ├── downloader.py             # per-ticker filing download
│   │   ├── parser.py                 # 10-K/10-Q text + XBRL extraction
│   │   └── manifest.py               # parquet manifest read/write
│   ├── market/
│   │   └── yahoo.py                  # yfinance wrapper (replaces v1 inline)
│   ├── analysis/
│   │   ├── revenue_screen.py         # Q/Q + YoY rules from v1
│   │   ├── valuation.py              # P/E buckets + forward improvement
│   │   ├── analyst.py                # external_research.csv merge
│   │   └── classifier.py             # final BUY/HOLD/SELL decision
│   ├── jobs/
│   │   ├── targeted.py               # Tab 1 orchestrator
│   │   └── universe.py               # Tab 2 orchestrator (worker pool)
│   ├── storage/
│   │   ├── db.py                     # SQLite schema + migrations
│   │   └── cache.py                  # local filing cache
│   └── cli.py                        # `python -m investing_engine ...`
│
├── tests/
│   ├── unit/
│   │   ├── test_revenue_screen.py
│   │   ├── test_classifier.py
│   │   └── test_parser.py
│   └── integration/
│       └── test_edgar_client.py      # uses recorded HTTP fixtures
│
├── data/                             # gitignored
│   ├── corpus/                       # downloaded 10-K/10-Q files
│   ├── manifest.parquet
│   └── app.db                        # SQLite
│
├── output/                           # gitignored, kept for v1 compatibility
├── prompts/
│   └── prompt_investing.txt
├── scripts/
│   └── run_universe_job.py           # headless Tab 2 runner
│
├── pyproject.toml                    # replaces requirements.txt
├── README.md
├── PROJECT_PROFILE.md                # this file
├── LICENSE
└── .gitignore
```

> Keep `src/sec_engine_full.py` in place during the migration. Move logic
> module-by-module into `src/investing_engine/` and have the legacy script
> import from there until the UI is online; only then delete the legacy entry.

---

## 7. Key Algorithms & Logic

### 7.1 EDGAR client — the non-negotiables

SEC's fair-access policy: **max 10 requests/second**, real `User-Agent` with
contact email. Bake this into `EdgarClient`:

- One shared `httpx.AsyncClient` with a token-bucket limiter at 8 req/s
  (headroom under the 10/s ceiling).
- Automatic retry with exponential backoff on `429` and `5xx`.
- Persistent disk cache keyed by URL (avoid re-downloading the same filing).
- `User-Agent` pulled from `config.py` and validated on import — refuse to
  start if it's a placeholder.

### 7.2 Per-ticker filings discovery

For a CIK, hit `https://data.sec.gov/submissions/CIK<10digit>.json`. The
`filings.recent` block contains parallel arrays: `accessionNumber`, `form`,
`filingDate`, `primaryDocument`. Filter to `10-K` / `10-Q`, take the last N,
and construct download URLs:

```
https://www.sec.gov/Archives/edgar/data/<cik_int>/<accessionNoDashes>/<primaryDocument>
```

### 7.3 Filing parsing

For decision-engine purposes you don't need full NLP. Extract:

- **From XBRL companyfacts** (already working in v1): quarterly revenue, net
  income, EPS, shares outstanding.
- **From the filing HTML** (new): the *Risk Factors* and *MD&A* section
  headings — useful as context shown next to the rating, not as a signal.

Defer "summarize the MD&A with an LLM" to a later phase. The rule-based engine
shouldn't depend on it.

### 7.4 Decision engine

Reuse v1's classifier verbatim — it works. Refactor it into pure functions
that take a `dict`/`pydantic` model instead of a pandas row, then write unit
tests for each of the 12 branches in `classify_row`. The current logic is
implicitly tested only via end-to-end runs, which is fragile.

### 7.5 Universe Builder — the rate-limit math

~12,000 filers × ~5 quarterly filings × ~1 annual = ~70K filings to enumerate
per year of history. At 8 req/s, full corpus for one year ≈ 2.5 hours of
network time. For a 5-year corpus, plan for ~12 hours and design accordingly:

- **Resumable.** Persist progress in SQLite (`processed_ciks` table). A
  cancelled job resumes where it left off.
- **Incremental.** Default to "fetch only filings newer than my latest cached
  filing per CIK".
- **Idempotent.** Downloading the same accession twice must be a no-op.
- **Disk awareness.** Show estimated disk usage before starting (~50-200 GB
  for a multi-year full corpus).

---

## 8. Data Model (SQLite — Phase 1)

```sql
CREATE TABLE tickers (
    cik         TEXT PRIMARY KEY,
    ticker      TEXT NOT NULL,
    name        TEXT NOT NULL,
    sector      TEXT,
    industry    TEXT,
    updated_at  TIMESTAMP
);

CREATE TABLE filings (
    accession_no    TEXT PRIMARY KEY,
    cik             TEXT NOT NULL REFERENCES tickers(cik),
    form            TEXT NOT NULL,         -- '10-K' / '10-Q'
    filing_date     DATE NOT NULL,
    period_end      DATE,
    primary_doc     TEXT,
    local_path      TEXT,                  -- relative to data/corpus/
    bytes           INTEGER,
    downloaded_at   TIMESTAMP
);
CREATE INDEX idx_filings_cik_form ON filings(cik, form, filing_date);

CREATE TABLE analysis_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at          TIMESTAMP NOT NULL,
    tickers         TEXT NOT NULL,         -- comma-separated
    summary_json    TEXT NOT NULL          -- the full analysis payload
);

CREATE TABLE watchlists (
    name            TEXT PRIMARY KEY,
    tickers         TEXT NOT NULL,
    schedule_cron   TEXT,
    created_at      TIMESTAMP
);
```

Same data is also written as Parquet/CSV for portability — SQLite is the index,
the filesystem is the corpus.

---

## 9. UI Sketch

### Tab 1 — Targeted Analysis

```
┌─ Targeted Analysis ──────────────────────────────────────────────────┐
│  Pick tickers:  [GOOGL × NVDA × MSFT × ▼ search...]                  │
│  Filings:  [✓] last 4 × 10-Q   [✓] last 2 × 10-K                     │
│  Market data: [✓] include Yahoo (price, P/E, forward P/E)            │
│                                              [ Run analysis → ]      │
├──────────────────────────────────────────────────────────────────────┤
│  Summary                                                             │
│  ┌────────┬──────────────┬─────┬─────────┬─────────┬─────────────┐   │
│  │ Ticker │ Sector       │ Rev │ Trail PE│ Fwd PE  │ Signal      │   │
│  ├────────┼──────────────┼─────┼─────────┼─────────┼─────────────┤   │
│  │ GOOGL  │ Comm. Svcs   │ ✓   │ 31.0    │ 35.0    │ HOLD        │   │
│  │ NVDA   │ Technology   │ ✓   │ 60.4    │ 38.7    │ BUY         │   │
│  │ MSFT   │ Technology   │ ✓   │ 36.2    │ 32.1    │ BUY         │   │
│  └────────┴──────────────┴─────┴─────────┴─────────┴─────────────┘   │
│                                                                      │
│  Per-stock cards (expandable)                                        │
│   ▸ GOOGL — HOLD — Rev ✓, valuation rich                             │
│   ▸ NVDA  — BUY  — Rev ✓ + fwd PE improving                          │
│   ▸ MSFT  — BUY  — Rev ✓ + reasonable valuation                      │
│                                                                      │
│  [ Download analysis.json ]  [ Download signals.csv ]                │
└──────────────────────────────────────────────────────────────────────┘
```

### Tab 2 — Universe Builder

```
┌─ Universe Builder ───────────────────────────────────────────────────┐
│  Forms:  [✓] 10-K   [✓] 10-Q                                         │
│  Range:  [ 2020-01-01 ] to [ today ]                                 │
│  Filter: Sector [Any ▼]   Min Mkt Cap [ ___ ]                        │
│                                              [ Start job → ]         │
│                                                                      │
│  Status: RUNNING                                                     │
│  Throttle: 7.8 req/s (cap 10)                                        │
│  CIKs:    1,247 / 12,094  (10.3%)    Failed: 12  Skipped: 84         │
│  Disk:    18.4 GB used                                               │
│  ETA:     ~6h 32m                                                    │
│  Recent: [SAVE]  AAPL/0000320193-25-000010.htm  (2.4 MB)             │
│         [SAVE]  MSFT/0001564590-25-000074.htm  (1.8 MB)              │
│                                                                      │
│  [ Pause ]  [ Cancel ]                            [ Open corpus → ]  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Implementation Roadmap

> Aim for vertical slices — each milestone is independently shippable.

### Phase 0 — Refactor (1-2 days)

- Convert flat `src/` scripts into the `src/investing_engine/` package.
- Add `pyproject.toml`, replace `requirements.txt`.
- Wrap v1's `classify_row` into a unit-tested pure function.
- Extract `EdgarClient` with rate limiting; rewrite `download_all_tickers`
  and `fetch_quarterly_revenue` to use it.

### Phase 1 — Tab 1, end to end (3-5 days)

- Streamlit app shell with three empty tabs.
- Ticker dropdown sourced from cached SEC master.
- For selected tickers: fetch submissions index → download last N filings
  → run v1 classifier → render summary table + per-stock cards.
- Download buttons for `analysis.json` / `signals.csv`.

### Phase 2 — Tab 2, bulk corpus (4-7 days)

- `UniverseJobService` with a `concurrent.futures` worker pool, a token
  bucket, and SQLite-backed resumability.
- Live progress UI (Streamlit auto-refresh or websocket).
- Manifest written as `data/manifest.parquet`.
- A headless `scripts/run_universe_job.py` for cron / overnight runs.

### Phase 3 — Tab 3, watchlists & diffs (3-4 days)

- Save / load named watchlists (SQLite).
- APScheduler weekly run that writes a new `analysis_runs` row.
- Diff view: "what changed since last run?" — highlight signal flips.

### Phase 4 — Polish & ship (2-3 days)

- Replace `print` with `loguru`, write structured logs to `data/logs/`.
- Add CI (GitHub Actions): lint (`ruff`), type-check (`mypy`), `pytest`.
- README rewrite with screenshots and quickstart.
- Tag `v2.0.0`.

**Total: ~3 weeks of focused part-time work.**

---

## 11. Risks & Mitigations

| Risk                                              | Mitigation                                                         |
|---------------------------------------------------|--------------------------------------------------------------------|
| SEC rate-limit / IP ban                           | Token-bucket at 8 req/s; valid `User-Agent`; backoff on 429        |
| Filings storage explodes (>100 GB)                | Show pre-flight estimate; default to HTML-only, skip exhibits      |
| `yfinance` flaky / scraping breakage              | Treat market data as optional; engine must work without it         |
| XBRL tag drift across companies                   | Already mitigated in v1 via tag fallbacks; add coverage in tests   |
| Bulk job interrupted (network/laptop sleep)       | SQLite-backed progress; `--resume` on the headless script          |
| Streamlit performance with 12k-row dropdown       | Virtualized select (e.g. `streamlit-searchbox`) or server-side fuzzy filter |
| User runs without setting their email             | Hard-fail at startup if `User-Agent` is the placeholder            |
| LLM hallucinated "facts" in MD&A summarization    | Phase 4+ only; quote source spans, never paraphrase numbers        |

---

## 12. Testing Strategy

- **Unit tests** for every decision branch in `classifier.py` — table-driven,
  one row per `(rev_flag, val_bucket, growth_val_positive, analyst_bias) →
  expected_signal` combination. v1 has zero tests for this; that's the
  highest-leverage thing to fix.
- **Recorded HTTP fixtures** for the EDGAR client (`responses` or `vcrpy`).
  Tests must run offline.
- **Smoke test** of Tab 1 against a fixed 3-ticker portfolio with frozen
  fixtures — the JSON output is the assertion.
- **No integration test of Tab 2 in CI** (too slow, too much data) — just a
  contract test that one CIK end-to-end produces a valid manifest row.

---

## 13. Open Questions for You

Decide these before Phase 1:

1. **UI framework:** Streamlit (recommended) vs. FastAPI+React?
2. **Bulk corpus scope:** are you willing to allocate 50-200 GB of disk, or
   should Tab 2 default to *index-only* (filings list, no document bodies)?
3. **LLM-assisted MD&A summarization:** in scope for v2, or defer to v3?
4. **Deployment:** local-only desktop app (your laptop), or hosted somewhere
   (Streamlit Community Cloud / Railway)? Affects auth, secrets, rate-limit
   strategy.
5. **License:** stay MIT, or switch to a research-only license now that the
   tool is more capable?

---

## 14. Definition of Done — v2.0.0

- [ ] Tab 1: pick ≥ 1 ticker → get filings → see Buy/Hold/Sell with reasoning
- [ ] Tab 2: start a bulk job for 10-K + 10-Q → resume across restarts → see
      a manifest of every downloaded filing
- [ ] All v1 logic preserved and now covered by unit tests
- [ ] `pyproject.toml` installable; `streamlit run app/Home.py` works on a
      clean clone
- [ ] README has a screenshot of each tab and a 60-second quickstart
- [ ] CI green: lint + type-check + tests
- [ ] Tagged `v2.0.0` on GitHub, with a release note linking back to this file

---

## 15. Quickstart (target shape — for the future README)

```bash
# Clone and install
git clone https://github.com/<you>/investing-ai-decision-engine.git
cd investing-ai-decision-engine
pip install -e .

# Configure your SEC User-Agent
cp .env.example .env
# edit .env → SEC_USER_AGENT="Your Name <you@example.com>"

# Run the app
streamlit run app/Home.py

# Or run the engine headless (v1-style)
python -m investing_engine analyze --tickers GOOGL,NVDA,MSFT
python -m investing_engine universe --forms 10-K,10-Q --since 2020-01-01
```

---

*This profile is the contract for v2. When it disagrees with the code, update
the profile in the same PR — don't let it rot.*
