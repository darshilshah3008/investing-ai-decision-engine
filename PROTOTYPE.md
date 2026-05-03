# Prototype Requirements — $0 / month, one weekend to demo

**Document type:** Build spec for the prototype
**Audience:** the developer (you) building this in spare time
**Goal:** prove the concept, not run a business
**Companion docs:** [`REQUIREMENTS.md`](REQUIREMENTS.md) (full PRD — defer all of it),
[`TECH_STACK.md`](TECH_STACK.md) (full stack — also defer most of it)

> If at any point you're tempted to add something that's not in this doc,
> stop and write it down for the *post*-prototype list. The point of a
> prototype is to be done with it, not to make it perfect.

---

## 1. Prototype mission

Build a **single-user, single-market, web app** that:

1. Lets you pick stocks from a dropdown of all SEC tickers
2. Pulls the latest 10-K + last 4× 10-Q from EDGAR for each
3. Computes 3 fundamental scores from the filings
4. Outputs a Buy / Hold / Sell verdict with a visible reasoning trail

That's it. No accounts, no payments, no LLM, no NSE/BSE, no alerts, no
analytics, no monitoring, no branding.

**Time budget:** 2 weekends (~16-20 hours).
**Money budget:** $0.

---

## 2. Scope — what's in, what's out

### In (the only features the prototype must have)

- One Streamlit page with a ticker multi-select (1-10 stocks)
- "Run analysis" button
- Per-stock card showing: verdict, 3 sub-scores with formulas, source
  filing for each input number
- Local SQLite cache for tickers and filings
- Rate-limited EDGAR client (8 req/s)
- README explaining how to run it locally

### Out (deferred to post-prototype)

| Feature                          | Why deferred                                         |
|----------------------------------|------------------------------------------------------|
| Login / accounts                 | Single user (you) — login is friction with no gain    |
| Subscription / payments          | Nobody pays for a prototype                          |
| LLM features                     | Adds API key, cost, and complexity. Templates suffice |
| NSE / BSE markets                | EDGAR alone takes a weekend; multi-market doubles it  |
| Universe Builder bulk job        | Not needed to demo the verdict flow                   |
| Auto-rerun / scheduling          | You can click the button manually                     |
| Email alerts                     | Same                                                  |
| Custom domain / branding         | `localhost:8501` is fine                              |
| Docker / Kubernetes              | `streamlit run` is fine                               |
| The other 9 math models          | 3 is enough to demo the idea                          |
| Postgres                         | SQLite handles this 100×                              |
| External context (Bloomberg / Zacks / news sentiment) | Direct scraping is a legal landmine; licensed aggregators cost $50-300/mo. Defer to Phase 2 per [REQUIREMENTS.md §5B](REQUIREMENTS.md) |
| Tests                            | Acceptable to skip in prototype only — but write the classifier as a pure function so you can test it later in 30 minutes |

---

## 3. Features in detail

### Feature 1: Ticker dropdown

- On first launch, fetch SEC ticker master from
  `https://www.sec.gov/files/company_tickers.json` and cache to SQLite
- On subsequent launches, use cached version (refresh if > 24h old)
- UI: `streamlit-searchbox` for fast typing-search across ~12K tickers

### Feature 2: Filings fetch

For each selected ticker, fetch via SEC EDGAR:

- **Submissions index** — to find recent filings:
  `https://data.sec.gov/submissions/CIK<10digit>.json`
- **Company facts (XBRL)** — for all numeric fields:
  `https://data.sec.gov/api/xbrl/companyfacts/CIK<10digit>.json`

Skip the actual 10-K/10-Q HTML for the prototype — XBRL companyfacts has
every number the 3 models need. The HTML parsing complexity isn't worth
it in v0.

### Feature 3: The 3 math models

Just three. Chosen so that each input is reliably present in XBRL
companyfacts and each represents a different pillar (Quality / Growth /
Valuation).

#### Model A — Revenue & EPS growth trend (Growth)

Reuse v1's logic, extended to EPS:

- Last 4 quarters strictly increasing → +1
- Last 4 quarters strictly decreasing → −1
- Otherwise → 0

Run for both `Revenues` and `EarningsPerShareDiluted`. Sub-score = sum
of the two, clipped to `[−2, +2]`.

#### Model B — Piotroski-lite F-Score (Quality)

Five of the original nine tests — chosen because their inputs are
reliably tagged in XBRL:

| # | Test                                | XBRL inputs                                  |
|---|-------------------------------------|----------------------------------------------|
| 1 | Net income > 0                      | `NetIncomeLoss`                              |
| 2 | Operating cash flow > 0             | `NetCashProvidedByOperatingActivities`       |
| 3 | OCF > Net income                    | both above                                   |
| 4 | No new shares issued                | `CommonStockSharesOutstanding`               |
| 5 | Long-term debt declined Y-o-Y       | `LongTermDebtNoncurrent`                     |

Score: 0-5. Sub-score: `0-1 → −1`, `2-3 → 0`, `4-5 → +1`.

#### Model C — Graham Number (Valuation)

```
Graham Number = √(22.5 × EPS × BVPS)

BVPS = StockholdersEquity / WeightedAverageNumberOfDilutedSharesOutstanding
EPS  = EarningsPerShareDiluted (latest 10-K)
```

Margin of Safety = `1 − (CurrentPrice / GrahamNumber)`

Sub-score: `MoS ≥ 30% → +1`, `MoS −20% to +30% → 0`, `MoS < −20% → −1`.
Skip (sub-score 0) if EPS or BVPS is negative.

Current price from `yfinance` (free, fine for prototype; replace before
charging anyone).

### Feature 4: Verdict synthesis

```
total = revenue_eps_score + piotroski_lite_score + graham_score

verdict = BUY  if total >= +2
        = SELL if total <= -2
        = HOLD otherwise
```

### Feature 5: Reasoning trail (the "why")

For each stock, display:

1. **Verdict + total score** at the top
2. **Three model cards**, expandable, each showing:
   - Sub-score
   - Formula filled in with the actual numbers
   - Source: which 10-K (form, accession#, filing date) each input came from
3. **One-line auto-thesis**: template-generated, e.g.
   > "AAPL: BUY (+2). Revenue growing 4 quarters in a row, F-Score 4/5,
   > trades 12% below Graham Number ($245 vs $278)."

No LLM, no narrative prose. Just numbers and template text. Total UI
work: ~3-4 hours.

---

## 4. Tech stack — absolute minimum

```toml
# pyproject.toml
[project]
requires-python = ">=3.11"
dependencies = [
  "streamlit>=1.39",
  "streamlit-searchbox>=0.1",
  "httpx>=0.27",
  "pandas>=2.2",
  "yfinance>=0.2",
  "pydantic>=2.9",
  "loguru>=0.7",
]
```

That's seven dependencies. No DB driver (SQLite is stdlib), no LLM, no
auth, no payments. **Disk footprint of installed env: ~250 MB.**

### Repo structure (prototype scope)

```
investing-ai-decision-engine/
├── app/
│   └── Home.py                  # the entire Streamlit UI
├── src/investing_engine/
│   ├── __init__.py
│   ├── config.py                # SEC_USER_AGENT loaded from env
│   ├── edgar.py                 # rate-limited httpx client + ticker + filings fetch
│   ├── extract.py               # pull ~10 fields out of companyfacts JSON
│   ├── models.py                # Pydantic: ClassifierInputs, Verdict
│   └── analysis.py              # the 3 math models + verdict synthesis
├── data/
│   └── cache.db                 # SQLite, gitignored
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

**8 Python files, ~600-800 lines of code total.** That's the prototype.

---

## 5. Data flow (the whole prototype on one diagram)

```
   User in browser
        │
        ▼
   Streamlit (app/Home.py)
        │
        │ 1. Show searchable ticker dropdown
        │    (loaded from SQLite cache, refreshed daily from EDGAR)
        │
        │ 2. On "Run analysis":
        │    For each selected ticker:
        ▼
   edgar.py
        │ ─── HTTPS ───▶  data.sec.gov   (XBRL companyfacts JSON)
        │ ─── HTTPS ───▶  Yahoo Finance  (current price only)
        │
        │ Cache filings JSON in SQLite (indefinite)
        │ Cache prices for 1 hour
        ▼
   extract.py    →  ClassifierInputs (Pydantic)
        ▼
   analysis.py   →  Verdict (BUY/HOLD/SELL + 3 sub-scores + reasoning)
        ▼
   Render in Streamlit   →   Browser
```

No queue, no worker, no API, no separate frontend. Single process.

---

## 6. Hosting — pick one of these

All three are free.

| Option | Pros | Cons | Cost |
|---|---|---|---|
| **Localhost** | Zero setup, full control | Only you can use it | $0 |
| **Streamlit Community Cloud** | Public URL, deploy from GitHub | Public-only repos, sleeps after inactivity, 1 GB RAM | $0 |
| **Hugging Face Spaces** | Public URL, supports Streamlit | Same RAM/sleep limits | $0 |

**Recommendation:** localhost during development; Streamlit Cloud once
you want to share a link with friends. Both are zero-config.

---

## 7. Cost — itemized

| Item | Cost / month | Notes |
|---|---|---|
| Hosting | $0 | Streamlit Cloud free tier |
| Domain | $0 | Use the `*.streamlit.app` subdomain |
| Database | $0 | SQLite file on disk |
| File storage | $0 | Local filesystem (~50 MB cache) |
| SEC EDGAR access | $0 | Free, public — only need a real email in User-Agent |
| Yahoo Finance | $0 | `yfinance` (replace before commercializing) |
| LLM | $0 | None in the prototype |
| Auth | $0 | No accounts |
| Email | $0 | No alerts |
| Monitoring | $0 | `print()` / `loguru` to console |
| **Total** | **$0** | |

The only "cost" is your time.

---

## 8. Setup — what running it looks like

```bash
git clone <your-repo>
cd investing-ai-decision-engine
python -m venv .venv && source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -e .
cp .env.example .env
# edit .env → SEC_USER_AGENT="Your Name <you@example.com>"
streamlit run app/Home.py
```

Browser opens at `http://localhost:8501`. Six commands. Done.

---

## 9. Acceptance criteria — "the prototype is done when…"

- [ ] `streamlit run app/Home.py` starts without errors on a clean clone
- [ ] Ticker dropdown loads with all ~12K SEC tickers, searchable in
      <300ms after the first cache fill
- [ ] Selecting `AAPL, MSFT, NVDA` and clicking "Run analysis" produces
      three verdict cards within 30 seconds
- [ ] Each card shows: verdict, total score, three sub-scores with
      formulas filled in with actual numbers, and the accession# of the
      10-K each number came from
- [ ] All cached data persists across restarts (SQLite file in `data/`)
- [ ] EDGAR client respects the 8 req/s limit (verify via log timestamps)
- [ ] Hard-fail at startup if `SEC_USER_AGENT` is unset

When all six are checked, the prototype is **done**. Resist scope creep.

---

## 10. What you ship next (post-prototype, in order)

Do not start any of this until the prototype is in someone else's hands
and they've used it. Build for feedback, not for completeness.

1. **Add 3 more models** (DCF, Altman, ROIC vs WACC) — proves the
   "show all the math" pitch
2. **Cache 10 years of filings**, not just latest — enables 10-yr CAGRs
3. **Add the External Context sidebar** ([REQUIREMENTS.md §5B](REQUIREMENTS.md))
   — analyst consensus + headlines via `yfinance` for personal use,
   later via Finnhub for commercial. Display-only, never enters the
   verdict math.
4. **Add LLM-generated MD&A summaries** with a user-supplied Claude
   API key — first paid-feature candidate
5. **Add accounts (Clerk free tier) + Stripe** — first paying users
6. **Migrate to FastAPI + Postgres** — only if Streamlit limitations
   are blocking actual revenue

Each step has clear "we're ready when…" criteria. The prototype is the
foundation; everything else is iteration.

---

## 11. The single most important rule

**If a feature isn't on the list in §3, it's not in the prototype.**

Add to "post-prototype" instead. Ship what's here, get someone to use
it, then come back to this doc and decide what's next based on what you
actually learned.
