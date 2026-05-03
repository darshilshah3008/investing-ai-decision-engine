# Product Requirements Document — Investing AI Decision Engine

**Document type:** PRD (Product Requirements)
**Status:** Draft v0.1 — pending stakeholder review
**Companion docs:** [`PROJECT_PROFILE.md`](PROJECT_PROFILE.md) (technical blueprint), [`README.md`](README.md) (v1 engine)

This document defines **what the product is, who it is for, what it must do,
and on what economic terms it can be sold**. It is the source of truth for
scope. The technical blueprint (`PROJECT_PROFILE.md`) is downstream of it.

> **Naming clarification needed.** The brief mentions "NSC" and "BSC". This
> PRD assumes you meant **NSE** (National Stock Exchange of India) and **BSE**
> (Bombay Stock Exchange). If you meant different exchanges, only the
> exchange-specific sections need updating.

---

## 1. Product Overview

### 1.1 Vision

> *"A subscription research tool for **long-term investors** (3–10+ year
> holding period) that reads every 10-K and 10-Q a company has filed,
> computes the same fundamental models a Buffett- or Graham-style analyst
> would, and renders a Buy / Hold / Sell verdict with the full reasoning
> trail — every number, every formula, every threshold, every source
> filing — visible on screen."*

### 1.2 Target Investor — explicit

This product is built for the **long-term, fundamentals-driven investor**.

- **Holding period:** 3 to 10+ years per position.
- **Style:** value, quality-at-a-fair-price (Buffett / Munger / Lynch),
  dividend-growth, or quality-compounder.
- **Decision cadence:** weeks to months, not minutes.
- **Inputs they care about:** revenue / FCF / EPS trajectories over
  *years*, return on capital, balance-sheet durability, moat, valuation
  vs. intrinsic value with a margin of safety.

The product is **not** for day traders, swing traders, options players, or
anyone who needs intraday signals or technical indicators.

### 1.3 Problem Statement

Long-term investors face three persistent pain points:

1. **Black-box recommendations.** Most apps (Robinhood, Groww, Zerodha
   Streak) give signals without showing the math. Long-term investors
   need to *understand* why before committing capital for a decade.
2. **Reading 10-Ks is hard.** A single 10-K is 100–300 pages. Tracking
   the right ~20 numbers across 10 years of filings is a full afternoon
   of spreadsheet work per company.
3. **Fragmented data.** SEC filings, NSE/BSE filings, price feeds, and
   ratios live in different places. Pulling them together is manual work.

### 1.4 Solution Summary

A web application that:

- **Source of truth: filings.** For US stocks, every 10-K (annual) and
  10-Q (quarterly) a company has filed with the SEC, going back as far as
  EDGAR holds them (typically 20+ years). Indian equivalents (annual
  reports, quarterly results) are added in Phase 2/3.
- **Math built for the long-term:** Piotroski F-Score, Altman Z, Beneish
  M, Graham Number + Margin of Safety, 10-year two-stage DCF on Owner
  Earnings, Greenblatt Magic Formula (ROC + earnings yield), ROIC vs.
  WACC, multi-year CAGRs, and moat / quality trends. All models chosen
  specifically because they reward durable, compounding businesses — not
  short-term momentum.
- **Reasoning is the product.** Every verdict is rendered with the full
  decomposition: each model's score, the formula filled in with actual
  numbers, the source filing for each input, the catalysts, the risks,
  and a sensitivity table showing what would flip the verdict.
- **Sells as a subscription SaaS** with free, pro, and premium tiers.

### 1.5 Why It Can Win

| Competitor              | Their gap                                                | Our edge                                            |
|-------------------------|----------------------------------------------------------|-----------------------------------------------------|
| Tickertape              | India only; opaque "scorecard"                           | Cross-market + every score is a clickable formula   |
| Screener.in             | India only; raw numbers, no synthesized signal           | Synthesized signal with reasoning audit trail       |
| Simply Wall St          | Pretty visuals; closed methodology                       | Open methodology; user can tweak thresholds         |
| Seeking Alpha           | Editorial, not systematic                                | Deterministic; reproducible across runs             |
| Zacks                   | US only; rank without explanation                        | Multi-market with explicit math                     |

The differentiator is **explainability sold as a feature**, not a slogan.

---

## 2. Target Users (Personas)

### P1 — *"The Long-Term Compounder"* (primary, ~70% of revenue)

- Age 28-50, professional with disposable income, manages own portfolio.
- Holds 10-30 stocks; **typical holding period 3-10 years**; rebalances
  quarterly or annually, not weekly.
- Reads 10-Ks for top holdings; intimidated by full XBRL; tracks ~20
  fundamentals manually in a spreadsheet today.
- Wants to know: *is this business durable? Is it compounding capital
  efficiently? Am I overpaying right now?*
- Will pay **₹999 / $15 per month** if the product clearly saves 4+ hours
  per quarter, surfaces things they'd miss, and shows the full math so
  they can trust the verdict before committing capital for years.

### P2 — *"Cross-Border Indian Investor"* (secondary, ~20%)

- NRIs / urban Indian professionals investing in both US (via INDmoney /
  Vested) and India (via Zerodha / Groww).
- Wants a single dashboard. Currently uses 3+ tools.
- Will pay **₹1999 / $30 per month** for the multi-market tier.

### P3 — *"Finance Student / Charterholder Candidate"* (tertiary, ~10%)

- Studying CFA, MBA Finance, or self-learning fundamental analysis.
- Wants to *see* models like Piotroski and DCF run on real companies.
- Free tier converts to paid as they start managing real money.

### Non-personas (explicitly out of scope)

- Day traders / option scalpers — we are not a technical-analysis tool.
- Institutional analysts — they have Bloomberg / FactSet.
- HNI advisors managing third-party money — they need RIA-licensed tools.

---

## 3. Product Scope — Tabs / Modules

The app is a multi-tab web product. Tabs are grouped by **market** because
data sources, formats, and compliance rules differ by jurisdiction.

### 3.1 US Market — three tabs

| # | Tab                        | Purpose                                                              |
|---|----------------------------|----------------------------------------------------------------------|
| 1 | **US — Universe**          | Pull and refresh the full SEC ticker master; show count, last sync   |
| 2 | **US — Filings & Data**    | Per ticker (or multi-select): fetch latest 10-K + 10-Q, extract XBRL |
| 3 | **US — Buy/Hold/Sell**     | Run the scoring engine on selected tickers; show verdict + reasoning |

### 3.2 India Market (NSE) — three tabs

| # | Tab                        | Purpose                                                              |
|---|----------------------------|----------------------------------------------------------------------|
| 4 | **NSE — Universe**         | Pull NSE-listed equities (~2000+); show count, last sync             |
| 5 | **NSE — Filings & Data**   | Per ticker: pull annual report, latest quarterly results, BSE/NSE corporate filings |
| 6 | **NSE — Buy/Hold/Sell**    | Run the same scoring engine adapted for IndAS / Indian filings       |

### 3.3 India Market (BSE) — three tabs

| # | Tab                        | Purpose                                                              |
|---|----------------------------|----------------------------------------------------------------------|
| 7 | **BSE — Universe**         | Pull BSE-listed equities (~5000+, includes SMEs)                     |
| 8 | **BSE — Filings & Data**   | Per ticker: pull filings via BSE corporate-announcements API         |
| 9 | **BSE — Buy/Hold/Sell**    | Same engine; flag SME-board liquidity risk separately                |

### 3.4 Cross-cutting tabs

| # | Tab                        | Purpose                                                              |
|---|----------------------------|----------------------------------------------------------------------|
| 10| **Watchlist**              | Saved sets across markets; weekly re-runs; signal-change diffs       |
| 11| **Portfolio**              | Optional: import holdings (CSV / broker API); see current verdict per holding |
| 12| **Account & Billing**      | Subscription tier, payment, invoices, API key (Premium tier)         |

> **MVP cut (see §10):** ship Tabs 1–3 (US) + Tab 10 (Watchlist) + Tab 12
> (Billing). NSE/BSE tabs are Phase 2.

---

## 4. Functional Requirements

Numbered for traceability. Format: `FR-<area>-<n>`.

### 4.1 Universe ingestion

- **FR-UNI-1:** System shall pull the SEC company-tickers master daily and
  store CIK, ticker, name, exchange, and industry classification (SIC code).
- **FR-UNI-2:** System shall pull the NSE equity master daily (symbol, ISIN,
  series, name, sector).
- **FR-UNI-3:** System shall pull the BSE equity master daily (scrip code,
  symbol, ISIN, group, sector).
- **FR-UNI-4:** Each ingestion shall log row count, duration, and any failed
  records; failures shall not block the rest of the run.
- **FR-UNI-5:** Universe data shall be searchable by ticker, ISIN, or
  company name (fuzzy match) with sub-300ms latency.

### 4.2 Filings & data — SEC 10-K / 10-Q is the source of truth

The engine's primary data source for US stocks is the **complete history
of 10-K (annual) and 10-Q (quarterly) filings** retrieved from SEC EDGAR.
Four free, public endpoints power this:

| Endpoint              | URL pattern                                                                        | Use                                            |
|-----------------------|------------------------------------------------------------------------------------|------------------------------------------------|
| Submissions index     | `https://data.sec.gov/submissions/CIK<10digit>.json`                               | Lists every filing for a CIK (form, date, accession#) |
| XBRL company facts    | `https://data.sec.gov/api/xbrl/companyfacts/CIK<10digit>.json`                     | All numeric facts ever reported, ~150 fields   |
| XBRL frames           | `https://data.sec.gov/api/xbrl/frames/us-gaap/<concept>/USD/CY<year>Q<n>.json`     | One concept across all companies for a period (peer comps) |
| Filing documents      | `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/<primary-doc>`          | The actual 10-K / 10-Q HTML                    |

EDGAR holds 20+ years of filings for most large companies — enough
history for every model in §5 (10-yr CAGRs, ROIC trends, moat
stability).

#### Functional requirements

- **FR-FIL-1:** For any user-selected US ticker, system shall fetch the
  **complete available history** of 10-K and 10-Q filings from EDGAR
  (capped at 10 years for the default analysis run; full history for the
  Universe Builder corpus).
- **FR-FIL-2:** System shall extract from each filing the following
  fields, structured per fiscal period: revenue, cost of revenue, gross
  profit, operating income, net income, EPS (basic + diluted), total
  assets, total liabilities, total equity, retained earnings, cash &
  short-term investments, total debt (current + long-term), operating
  cash flow, capital expenditures, free cash flow, depreciation &
  amortization, interest expense, income tax expense, effective tax rate,
  shares outstanding (basic + diluted), and dividends paid.
- **FR-FIL-2a:** Extraction precedence: (1) XBRL companyfacts for
  numeric fields, (2) document HTML parsing as fallback for fields with
  no XBRL tag or for older filings predating XBRL mandate.
- **FR-FIL-2b:** Each extracted value shall be stored with its
  `(form, accession_number, filing_date, period_end, page_anchor)`
  provenance, so the verdict's Inputs Trace (§5A.1 Block 8) is fully
  populated.
- **FR-FIL-3:** For any NSE/BSE ticker (Phase 2/3), system shall fetch
  the latest annual report and last 4 quarterly results, normalizing to
  the same schema as FR-FIL-2 (with IndAS-to-USGAAP-equivalent mapping
  where applicable).
- **FR-FIL-4:** Market data (price, market cap, beta, 52W high/low)
  shall be retrieved on demand from a primary source with a documented
  fallback (yfinance → Polygon / IEX for US; NSEpy → Yahoo for India).
  Note: per §7.4, yfinance is *not* licensed for paid-tier
  redistribution — replace with Polygon / IEX before charging users.
- **FR-FIL-5:** All fetched filings and data shall be cached locally
  with a TTL appropriate to the data type (filings: indefinite; prices:
  5 min; fundamentals: 24h).
- **FR-FIL-6:** EDGAR fair-access policy shall be honored at all times
  (max ~10 req/s, real `User-Agent` with contact email). The engine
  shall hard-fail at startup if the User-Agent is unconfigured.

### 4.3 Scoring engine — the math

System shall compute and display the following models per stock. **Every
input, intermediate, and threshold shall be visible to the user on click.**

- **FR-SCR-1: Piotroski F-Score (0–9)** — 9 binary fundamental tests across
  profitability, leverage/liquidity, and operating efficiency.
- **FR-SCR-2: Altman Z-Score** — bankruptcy risk; flag <1.81 distressed,
  >2.99 safe, in-between as grey zone.
- **FR-SCR-3: Beneish M-Score** — earnings manipulation flag (>−1.78 = likely
  manipulator).
- **FR-SCR-4: Graham Number** — intrinsic value floor; price/Graham ratio
  drives a value bucket.
- **FR-SCR-5: Discounted Cash Flow (2-stage)** — 5-year explicit FCF
  projection + terminal value; user-adjustable WACC and terminal growth.
- **FR-SCR-6: Multi-factor valuation** — P/E, forward P/E, P/B, P/S,
  EV/EBITDA, PEG; bucket vs. sector median.
- **FR-SCR-7: Revenue / earnings momentum** — Q-o-Q and Y-o-Y growth checks
  (the v1 logic, kept verbatim).
- **FR-SCR-8: Quality** — ROE, ROCE, ROIC, debt/equity, interest coverage,
  current ratio.

### 4.4 Buy / Hold / Sell synthesis

- **FR-VER-1:** Each model in §4.3 shall produce a sub-score in
  `{−2, −1, 0, +1, +2}`.
- **FR-VER-2:** The final verdict shall be a weighted sum of sub-scores,
  with weights documented and user-overridable in the Pro tier.
- **FR-VER-3:** Default thresholds: total ≥ +4 → BUY, between −2 and +3 →
  HOLD, ≤ −3 → SELL.
- **FR-VER-4:** The verdict screen shall show, for each stock:
  - Final verdict + total score
  - Each sub-score with the formula, the inputs used, and a one-line
    explanation
  - The single biggest positive contributor and biggest negative contributor
  - A "what would change this verdict?" sensitivity row (e.g. "BUY would
    flip to HOLD if forward P/E rises above 28")
- **FR-VER-5:** Two runs against the same input data shall produce the same
  verdict. Determinism is a hard requirement.

### 4.5 Watchlist & alerts

- **FR-WAT-1:** Users shall create / rename / delete named watchlists.
- **FR-WAT-2:** A watchlist shall accept tickers from any supported market.
- **FR-WAT-3:** Watchlists shall auto-rerun on a user-selected cadence
  (daily / weekly / monthly).
- **FR-WAT-4:** When a verdict flips for any stock in a watchlist, system
  shall send an alert (email for Pro, email + push for Premium).

### 4.6 Subscriptions & billing

- **FR-SUB-1:** Three tiers: Free, Pro, Premium (see §8).
- **FR-SUB-2:** Payments via Stripe (US/global) and Razorpay (India) with
  local currency at checkout.
- **FR-SUB-3:** Free trial: 14 days of Pro on signup, no card required.
- **FR-SUB-4:** Cancel-anytime, prorated refunds for annual plans within 30
  days.

### 4.7 API access (Premium tier)

- **FR-API-1:** REST API for verdict retrieval, watchlist management, and
  filings download.
- **FR-API-2:** Rate limit: 60 req/min on Premium; metered overage.
- **FR-API-3:** OpenAPI spec published; SDKs in Python and JavaScript.

---

## 5. Mathematical Models — built for the long-term investor

This section is **the product's moat**. Every model is clean, sourced from
named filings (10-K / 10-Q), and publicly documented in-app.

**Why these models, and not others.** Long-term investing rewards
*durability* and *compounding* over years. Day-trading metrics (RSI, MACD,
moving averages, momentum-only signals) are deliberately excluded. Every
model below either (a) measures multi-year quality / capital efficiency,
(b) estimates intrinsic value with a margin of safety, or (c) flags
balance-sheet or accounting risks that destroy long-term returns.

The engine runs **four pillars**: Quality, Growth, Valuation,
Sustainability. Each pillar has 2-3 models. Each model contributes a
sub-score in `{−2, −1, 0, +1, +2}`.

---

### Pillar A — Quality (does this business deserve to compound capital?)

#### 5.1 Piotroski F-Score (FR-SCR-1)

Nine binary tests on the latest two 10-Ks. One point each.

| # | Test                                     | Pass condition                            |
|---|------------------------------------------|-------------------------------------------|
| 1 | Net income > 0                           | NI<sub>t</sub> > 0                        |
| 2 | Operating cash flow > 0                  | OCF<sub>t</sub> > 0                       |
| 3 | ROA improved Y-o-Y                       | ROA<sub>t</sub> > ROA<sub>t-1</sub>       |
| 4 | OCF > NI (earnings quality)              | OCF<sub>t</sub> > NI<sub>t</sub>          |
| 5 | Long-term debt declined Y-o-Y            | LTD<sub>t</sub> < LTD<sub>t-1</sub>       |
| 6 | Current ratio improved                   | CR<sub>t</sub> > CR<sub>t-1</sub>         |
| 7 | No new shares issued                     | Shares<sub>t</sub> ≤ Shares<sub>t-1</sub> |
| 8 | Gross margin improved                    | GM<sub>t</sub> > GM<sub>t-1</sub>         |
| 9 | Asset turnover improved                  | AT<sub>t</sub> > AT<sub>t-1</sub>         |

Sub-score mapping: `0–3 → −2`, `4 → −1`, `5–6 → 0`, `7 → +1`, `8–9 → +2`.

#### 5.2 ROIC vs. WACC + ROIC trend (FR-SCR-9)

The single most important number for long-term investing — does the
company earn more on each dollar reinvested than it costs to fund?

```
NOPAT     = EBIT × (1 − effective tax rate)
Inv Cap   = Total Equity + Total Debt − Cash & Short-Term Investments
ROIC_t    = NOPAT_t / avg(Inv Cap_t, Inv Cap_{t-1})
spread    = ROIC_t − WACC_t
```

We compute ROIC for every year of available 10-Ks (typically 10 years).

Sub-score:
- `+2` if 10-yr median ROIC > WACC + 5pp **and** ROIC trend is flat-or-up
- `+1` if 10-yr median ROIC > WACC by 0–5pp
- `0`  if ROIC ≈ WACC
- `−1` if ROIC < WACC for the latest year only
- `−2` if ROIC < WACC for ≥ 3 of the last 5 years (capital destroyer)

#### 5.3 Moat proxies — gross margin & ROIC stability (FR-SCR-10)

Buffett's "economic moat" is not directly observable, but stability is a
strong proxy. Compute over the last 10 fiscal years:

```
gm_stability    = 1 − (stdev(GM_t for t in last 10y) / mean(GM_t))
roic_stability  = 1 − (stdev(ROIC_t) / mean(ROIC_t))
moat_score      = 0.5 × gm_stability + 0.5 × roic_stability   # range [0, 1]
```

Sub-score: `> 0.85 → +2 (wide moat proxy)`, `0.70–0.85 → +1`,
`0.50–0.70 → 0`, `< 0.50 → −1 (volatile economics)`.

---

### Pillar B — Growth (is the engine actually running over years, not quarters?)

#### 5.4 Multi-year CAGRs (FR-SCR-11)

For revenue, EPS, free cash flow, and **owner earnings** (Buffett's
preferred metric: net income + D&A − maintenance capex; we approximate
maintenance capex as the 5-yr median capex):

```
CAGR_n = (Value_t / Value_{t-n}) ^ (1/n) − 1     for n ∈ {3, 5, 10}
```

Sub-score logic per metric:
- `+2` if 10-yr CAGR ≥ 10% **and** 5-yr CAGR ≥ 10% (durable compounder)
- `+1` if 5-yr CAGR ≥ 8%
- `0`  if 5-yr CAGR is 0–8%
- `−1` if 5-yr CAGR is negative
- `−2` if 5-yr CAGR < −5% (declining business)

Final pillar score = mean of the four metric sub-scores, clipped to
`[−2, +2]`.

#### 5.5 Reinvestment quality (FR-SCR-12)

Are retained earnings being deployed productively?

```
incremental_ROIC = ΔNOPAT_5yr / ΔInvested_Capital_5yr
```

Sub-score: `> 20% → +2`, `15–20% → +1`, `10–15% → 0`, `5–10% → −1`,
`< 5% → −2`.

---

### Pillar C — Valuation (can I buy this at a margin of safety?)

#### 5.6 Two-stage DCF on Owner Earnings (FR-SCR-5)

Long-horizon (10-year explicit + terminal) DCF using owner earnings, not
reported EPS. This is the centerpiece valuation model for long-term
investors.

```
OE_t      = NetIncome_t + D&A_t − maintenance_capex_t
projected = grow OE_0 by user-set rate g_high for years 1..10
              (default g_high = min(historical 5y FCF CAGR, 12%))
EV        = Σ OE_t / (1+WACC)^t   for t = 1..10
            + ( OE_10 × (1+g_term) / (WACC − g_term) ) / (1+WACC)^10
            (default g_term = 2.5% US, 4.5% India — long-run GDP)
Fair Equity = EV − Net Debt + Excess Cash
Fair Price  = Fair Equity / Diluted Shares
```

Sub-score driven by **margin of safety** = `1 − Price / FairPrice`:
- `MoS ≥ 40%` → `+2` (Graham's classic threshold)
- `MoS 20–40%` → `+1`
- `MoS −10% to +20%` → `0`
- `MoS −30% to −10%` → `−1`
- `MoS < −30%` → `−2`

WACC and growth are user-adjustable (Pro tier); engine recomputes live.

#### 5.7 Graham Number + intrinsic value floor (FR-SCR-4)

```
Graham Number = √(22.5 × EPS × BVPS)        # Graham's defensive-investor formula
```

Used as a **floor check**, not the primary valuation. Sub-score:
`Price / GrahamNumber` → `< 0.7: +1`, `0.7–1.5: 0`, `> 1.5: −1`. Skip if
EPS or BVPS is negative.

#### 5.8 Greenblatt's Magic Formula (FR-SCR-13)

Two ratios, ranked across the entire SEC universe:

```
Earnings Yield = EBIT / Enterprise Value
Return on Cap  = EBIT / (Net Working Capital + Net Fixed Assets)

magic_rank = rank(EarningsYield) + rank(ReturnOnCapital)
```

Lower combined rank is better. Sub-score:
`top 10% → +2`, `top 25% → +1`, `25–75% → 0`, `bottom 25% → −1`.

#### 5.9 Multiples vs. the company's own 10-year history (FR-SCR-14)

Lynch's "is it on sale relative to itself?" check. For each of P/E, P/B,
EV/EBITDA, FCF yield:

```
percentile_t = percentile_rank(R_t, [R_{t-10}, ..., R_{t-1}])
```

Sub-score: avg of per-multiple percentile-based scores —
`bottom 25% (cheap vs. own history) → +1`, `top 25% (expensive) → −1`.

---

### Pillar D — Sustainability (will it survive my 5-10 year holding period?)

#### 5.10 Altman Z-Score (FR-SCR-2)

For non-financial firms; sector-appropriate variant.

```
Z = 1.2·(WC/TA) + 1.4·(RE/TA) + 3.3·(EBIT/TA) + 0.6·(MVE/TL) + 1.0·(S/TA)
```

`Z < 1.81 → −2 (distressed)`, `1.81–2.99 → 0`, `> 2.99 → +1`. Banks /
insurers use Z'' variant.

#### 5.11 Beneish M-Score (FR-SCR-3) — **veto only**

Earnings-manipulation flag. Eight variables (DSRI, GMI, AQI, SGI, DEPI,
SGAI, LVGI, TATA). `M > −1.78 → likely manipulator`.

Special rule: Beneish can only **subtract** from the total. A passing
M-score adds 0; a failing one applies `−3` and clamps the verdict to no
better than HOLD. Long-term investors should never knowingly buy a stock
where the cash and earnings don't reconcile.

#### 5.12 Debt durability (FR-SCR-15)

```
de_ratio          = Total Debt / Total Equity
nd_ebitda         = (Total Debt − Cash) / EBITDA
interest_cover    = EBIT / Interest Expense
```

Each gets a sub-score on standard thresholds; final pillar score is the
mean.

| Metric            | +1                | 0                | −1               | −2                |
|-------------------|-------------------|------------------|------------------|-------------------|
| D/E               | < 0.5             | 0.5–1.0          | 1.0–2.0          | > 2.0             |
| Net Debt / EBITDA | < 1.0             | 1.0–2.5          | 2.5–4.0          | > 4.0             |
| Interest coverage | > 10×             | 5–10×            | 2–5×             | < 2×              |

---

### 5.13 Aggregation — the final verdict

Each pillar produces a score by summing its model sub-scores; pillar
scores are then weighted (defaults shown; Pro users may override).

```
quality_score        = piotroski + roic_vs_wacc + moat
growth_score         = cagrs + reinvestment_quality
valuation_score      = dcf + graham + magic_formula + own_history
sustainability_score = altman + debt_durability

total = 0.30·quality_score + 0.20·growth_score
      + 0.35·valuation_score + 0.15·sustainability_score
      + beneish_veto                # always ≤ 0; never positive

verdict = BUY  if total ≥ +1.5
        = SELL if total ≤ −1.0
        = HOLD otherwise
```

Defaults reflect a long-term, value-tilted bias: **valuation gets the
heaviest weight (35%)** because long-term returns are dominated by the
price you paid; quality is second (30%) because durable economics
preserve value over decades.

The aggregation thresholds are deliberately conservative — long-term
investing rewards inaction. The engine should produce HOLD verdicts
most of the time. BUY signals should be rare and well-supported.

---

## 5A. Reasoning Output Specification — *why* we say BUY / HOLD / SELL

This section defines the contract for the verdict screen. The "why" is
the product. A verdict without a complete reasoning trail is a bug.

### 5A.1 Required components — every verdict screen, no exceptions

For every `(ticker, run_timestamp)` pair, the engine produces a
**Verdict Document** containing the eight blocks below. The UI may render
them as expandable cards, but the data contract is fixed.

#### Block 1 — Header

- Ticker, company name, sector, industry
- Final verdict: **BUY / HOLD / SELL**
- Total weighted score (e.g. `+2.4`)
- Confidence label: `High / Medium / Low` based on data completeness
  (how many of the 12 models had complete inputs)
- Latest 10-K filed: `2025-02-14 (FY2024)`
- Latest 10-Q filed: `2025-10-30 (Q3 FY2025)`
- "As of" timestamp + price used in valuation

#### Block 2 — Plain-English thesis (3–5 sentences)

Auto-generated from the engine state. Template:

> *"{Company} is a {sector} business with a {moat label, e.g. 'wide-moat'}
> profile (ROIC {x}% vs WACC {y}% over the last 10 years). Revenue has
> compounded at {a}% over 5 years and free cash flow at {b}%. At today's
> price of ${p}, the stock trades at a {c}% {discount/premium} to our
> 10-year DCF fair value of ${fv}. The verdict is **{BUY/HOLD/SELL}**
> primarily because {top contributor} and {second contributor}, partially
> offset by {top detractor}."*

The thesis is mechanical text-from-numbers. No LLM hallucination — every
filled token is a value the engine computed.

#### Block 3 — Pillar scorecard

A single table summarizing the four pillars:

| Pillar          | Score | Weight | Contribution | Top driver                   |
|-----------------|------:|-------:|-------------:|------------------------------|
| Quality         | +1.5  |  0.30  |        +0.45 | ROIC 22% vs WACC 9%          |
| Growth          | +1.0  |  0.20  |        +0.20 | 5-yr revenue CAGR 14%        |
| Valuation       | +1.5  |  0.35  |        +0.53 | 28% margin of safety vs DCF  |
| Sustainability  | +1.0  |  0.15  |        +0.15 | Net debt/EBITDA 0.6×         |
| **Total**       |       |        |    **+1.33** |                              |

#### Block 4 — Per-model breakdown (the math, fully exposed)

For each of the 12 models in §5, render a card containing:

- Model name and sub-score
- The **formula**, in math notation
- The formula **filled in with the actual numbers used** (this is the
  thing every competitor hides; we surface it)
- A one-line interpretation
- A **link to the source filing(s)** for each number

Example — DCF card:

> **Model: 10-year DCF on Owner Earnings → +1**
> Formula:
> ```
> Fair Equity = Σ OE_t / (1+WACC)^t   for t=1..10
>             + Terminal Value / (1+WACC)^10
> ```
> Inputs (all from filings):
> - Owner Earnings FY2024: $84.3B [10-K filed 2025-02-14, accession 0000320193-25-000010]
> - Growth rate (years 1-10): 9% (5-yr OE CAGR, capped at 12%)
> - Terminal growth: 2.5% (US long-run GDP)
> - WACC: 9.4% (sector median)
> - Net debt: $52B [10-K page F-7]
> - Diluted shares: 15.3B [10-K page F-9]
>
> Result: Fair Price $245 vs. Current Price $176 → **MoS 28% → +1**

#### Block 5 — Catalysts (what supports the verdict)

The 3–5 highest-positive contributors, ranked by absolute contribution to
total score. Each is a single sentence pointing at a specific number from
a specific filing.

> 1. **ROIC of 22% vs WACC of 9%**, sustained for 9 of last 10 years
>    (10-K trend, FY2015–FY2024).
> 2. **28% margin of safety** vs. our 10-year DCF fair value of $245.
> 3. **Free cash flow has grown at 11% CAGR** over 10 years (FY2014: $11B
>    → FY2024: $32B).

#### Block 6 — Risks (what works against the verdict)

The 3–5 lowest-scoring drivers, framed as risks. Same format.

> 1. **Gross margin compressed 320 bps** in FY2024 (44.1% → 40.9% per
>    10-K) — first decline in 7 years.
> 2. **Magic Formula rank in 62nd percentile** — cheaper opportunities
>    exist on a pure value basis.
> 3. **Beneish M-score is −1.92**, near the −1.78 manipulation
>    threshold — accruals quality has weakened.

#### Block 7 — Sensitivity table

The single most useful element for a long-term investor: *what would
need to be true for me to change my mind?*

| Scenario                                  | Effect on score | New verdict |
|-------------------------------------------|----------------:|-------------|
| Fair price falls 15% (revenue miss)       |          −0.65  | HOLD        |
| WACC rises from 9.4% to 11%               |          −0.40  | HOLD        |
| ROIC falls below 12% next year            |          −0.50  | HOLD        |
| Beneish M-score crosses −1.78 (veto)      |          −3.00  | HOLD (veto) |
| Forward revenue growth falls below 3%     |          −0.55  | HOLD        |

#### Block 8 — Inputs trace

A single auditable table — every numeric input the engine consumed,
with its source filing. This is the "show your work" appendix.

| Field                | Value          | Source                         | Filed       |
|----------------------|----------------|--------------------------------|-------------|
| Revenue FY2024       | $383.3 B       | 10-K, accession 0000320193-25-000010 | 2025-02-14 |
| Net income FY2024    | $93.7 B        | same                           | 2025-02-14  |
| Operating cash flow  | $118.3 B       | same                           | 2025-02-14  |
| Capex FY2024         | $9.4 B         | same                           | 2025-02-14  |
| Total debt FY2024    | $106.6 B       | same                           | 2025-02-14  |
| Shares diluted       | 15.34 B        | same                           | 2025-02-14  |
| Latest revenue Q3    | $94.9 B        | 10-Q, accession 0000320193-25-000074 | 2025-10-30 |
| ... (≈ 40 rows)      |                |                                |             |

Each filing accession number is a clickable deep-link to the document on
EDGAR, scrolled to the relevant section where possible.

### 5A.2 What the verdict screen must NOT do

- Must **not** include unsourced or LLM-generated qualitative claims.
  Every sentence must be either (a) mechanical text-from-numbers or (b)
  a quoted span from the filing with a page reference.
- Must **not** display recommendations personalized to the user's
  portfolio, risk tolerance, or financial situation. Doing so triggers
  RIA-licensing requirements in both the US and India (see §7).
- Must **not** reference price targets from analysts, news, or social
  media. The product's whole differentiator is filings-only reasoning.

### 5A.3 Determinism — the same inputs always produce the same output

- The Verdict Document is a pure function of `(filings_snapshot,
  market_snapshot, user_weights, engine_version)`.
- `engine_version` is bumped on any change to formulas or thresholds.
- Every Verdict Document is persisted with all four parts of its input
  hash, so the verdict can be exactly reproduced 12+ months later for
  audit.

### 5A.4 Storage shape

```jsonc
// verdict_<ticker>_<runId>.json
{
  "ticker": "AAPL",
  "engine_version": "2.0.3",
  "run_at": "2026-05-02T14:33:01Z",
  "header": { ... },
  "thesis": "Apple is a Technology business with a wide-moat profile ...",
  "pillars": [
    { "name": "quality", "score": 1.5, "weight": 0.30, ... }
  ],
  "models": [
    { "name": "dcf", "sub_score": 1, "formula": "...",
      "inputs": [ { "field": "OE_FY2024", "value": 84.3e9,
                    "source": { "form": "10-K",
                                "accession": "0000320193-25-000010",
                                "filed": "2025-02-14" } } ],
      "result": { "fair_price": 245.10, "mos_pct": 0.281 } }
  ],
  "catalysts": [ ... ],
  "risks": [ ... ],
  "sensitivity": [ ... ],
  "inputs_trace": [ ... ],
  "verdict": "BUY",
  "total_score": 1.33,
  "confidence": "High"
}
```

This single object powers the UI screen, the API response, and the
audit log. The schema is the contract.

---

## 5B. External Context Layer — *what others are saying*

Alongside the deterministic filings-driven verdict, the product surfaces
a sidebar of **third-party analyst opinions and news headlines**: Wall
Street consensus rating, mean price target, headline summaries, and
sentiment indicators. This gives users market-narrative context without
contaminating the engine's math.

### 5B.1 The architectural rule — context, not input

External signals enter the **display only**. They never:

- Modify any sub-score in §5
- Modify the final verdict total in §5.13
- Appear in the auto-generated thesis sentence (§5A Block 2)
- Appear in catalysts, risks, or sensitivity tables

They render in a clearly-labeled "What others are saying" panel,
visually separated from the verdict cards, with sources attributed and
a disclaimer. This preserves:

- **Determinism** of the math engine
- **The "filings-only reasoning" pitch** (§5A.2)
- **Compliance posture** — third-party recommendations stay attributed
  to their source, never blended into our output
- **Legal clarity** — no liability for analyst calls we didn't make

### 5B.2 Permitted data sources

| Source                                              | License                                  | Use                          | Approved?            |
|-----------------------------------------------------|------------------------------------------|------------------------------|----------------------|
| `yfinance` analyst fields (`recommendationKey`, `targetMeanPrice`, `numberOfAnalystOpinions`) | Free; ToS forbids commercial use | Prototype / personal only   | ✓ Prototype only     |
| **Finnhub**                                         | $50-150/mo, commercial license           | Production analyst data      | ✓ Production         |
| **Polygon.io news**                                 | $30-200/mo, commercial license           | Production news headlines    | ✓ Production         |
| **Tiingo**                                          | $30-300/mo, commercial license           | News + fundamentals          | ✓ Production         |
| **Marketaux**                                       | $0-100/mo, commercial license            | News sentiment               | ✓ Production         |
| **Public RSS feeds** (Reuters, AP, MarketWatch RSS) | Most permit attributed aggregation       | Headlines with source link   | ✓ Conditional        |
| **Reddit official API**                             | Free tier limited; commercial requires negotiation | r/stocks / r/investing sentiment | ✓ Conditional |
| **Twitter / X official API**                        | $100+/mo for v2 API                      | Real-time sentiment          | ✓ if budget allows   |

### 5B.3 Forbidden data acquisition methods

The following are **prohibited** in this product, regardless of utility:

- **Scraping `bloomberg.com`, `zacks.com`, `seekingalpha.com`,
  `marketwatch.com` (article bodies), `refinitiv.com`, or any
  paywalled / ToS-restricted financial site.** Their Terms of Service
  forbid automated extraction. Doing so creates:
  - **DMCA / copyright liability** — analyst reports are protected works
  - **ToS-violation civil exposure** — CFAA in the US, IT Act §43 in India
  - **Trademark issues** if their branding appears in our UI
  - **Operational fragility** — anti-bot defenses (Cloudflare, Datadome,
    PerimeterX) break scrapers within days; rotating-proxy stacks cost
    $50-300/month and still fail in production
- **Reproducing analyst report text verbatim**, even if technically
  accessible
- **Implying endorsement** from any analyst firm in marketing copy
- **Caching or republishing** content from sources whose ToS forbids it

If a desirable signal is only available behind one of these barriers,
the answer is: license it via §5B.2, or do without.

### 5B.4 Functional requirements

- **FR-EXT-1:** For each verdict screen, system shall display a
  "What others are saying" panel containing:
  - Latest analyst consensus rating (numeric and label)
  - Mean price target with implied upside/downside vs. current price
  - Number of analysts covering the stock
  - 3-5 most recent news headlines with publication date and source
- **FR-EXT-2:** Each item shall **link out** to its original source.
  No in-app reproduction of full article text.
- **FR-EXT-3:** Panel shall display a clearly-visible disclaimer:
  *"External sources shown for context only. These do not influence our
  verdict calculation. Click any item to read at the original source."*
- **FR-EXT-4:** If no data is available for a ticker, the panel shall
  render an explicit empty state. Never fabricate or interpolate values.
- **FR-EXT-5:** External-context fetches shall not block verdict
  rendering. The verdict computes and displays first; the panel loads
  asynchronously and may show a skeleton state.
- **FR-EXT-6:** External data shall be cached with TTL of 4 hours per
  ticker, refreshed in the background.
- **FR-EXT-7:** Users may dismiss the panel; the preference persists per
  user.

### 5B.5 Phasing

- **Prototype / Phase 0:** out of scope (see [PROTOTYPE.md](PROTOTYPE.md))
- **Phase 1 MVP:** `yfinance` analyst fields only, with a "personal /
  research use" banner. Not for paid commercial launch.
- **Phase 2 (paid product):** replace `yfinance` with Finnhub or
  Polygon (commercial license). Add news headlines from Marketaux.
- **Phase 3:** add Reddit / X sentiment if user feedback justifies it
- **Never:** direct scraping of Bloomberg, Zacks, Seeking Alpha,
  Refinitiv, or any paywalled financial-news site

### 5B.6 What this delivers vs. the user's mental model

The user often *thinks* of "Bloomberg / Zacks ratings" as the gold
standard. In practice, the licensed aggregators above republish the
same underlying analyst consensus data (compiled from the same sell-side
firms) under proper agreements. So the panel can legitimately show:

> *"Wall Street consensus: BUY (4.1 / 5.0) from 28 analysts. Mean target
> $245 (+12% upside). [3 recent headlines linked to source]"*

— which is functionally what the user wanted, sourced from a
commercial-license aggregator instead of a scraped paywalled site.

---

## 6. Non-Functional Requirements

| Area              | Requirement                                                                            |
|-------------------|----------------------------------------------------------------------------------------|
| **Latency**       | P95 < 2s for verdict on a single ticker (cached); < 30s cold (filing fetch + extract)  |
| **Throughput**    | 1k concurrent users at launch; 10k by month 12                                         |
| **Availability**  | 99.5% monthly uptime; status page public                                               |
| **Data freshness**| Filings: within 24h of EDGAR/NSE/BSE publication; prices: 15-min delayed (free), real-time (Premium) |
| **Security**      | TLS 1.3 only; user passwords via Argon2id; PCI-DSS via Stripe/Razorpay (no card data on our servers); JWT short-lived + refresh tokens |
| **Privacy**       | GDPR + DPDP Act 2023 (India) compliant; data export + delete on request within 30 days |
| **Auditability**  | Every verdict run is logged with input snapshot + version of scoring engine; reproducible for ≥ 12 months |
| **Accessibility** | WCAG 2.1 AA on all primary user flows                                                  |
| **Observability** | Structured logs, request tracing, error budget tracking; alerts on SLO burn            |
| **Scale ceiling** | Postgres until ~10M verdict-rows; partition by market; consider columnar store after  |
| **Rate limits**   | EDGAR: 8 req/s shared pool; NSE/BSE: per-source documented in code                     |

---

## 7. Compliance & Legal — non-negotiable

A subscription product touching investment decisions has real legal exposure.
The following is required for a saleable product, not optional.

### 7.1 Disclaimers & positioning

- Position the product as **"investment research and decision-support
  software"**, not "investment advice".
- Every page with a verdict shall display: *"This is research output, not a
  recommendation. Not investment advice. Past performance does not guarantee
  future results."*
- Onboarding shall require explicit acknowledgment of the disclaimer
  (checkbox + timestamp logged).

### 7.2 India — SEBI

- SEBI **Investment Advisor Regulations 2013** apply to anyone giving
  personalized investment advice for consideration. Generic, non-personalized
  research delivered as software (a "research analyst" stance) is generally
  permissible **without** RIA registration if:
  - The output is not tailored to an individual's portfolio / risk profile.
  - No buy/sell recommendation is *for* a specific client situation.
- **Action items:**
  - Consult a SEBI-registered lawyer before launch in India.
  - Consider registering as a **SEBI Research Analyst (RA)** — lower bar than
    RIA, and explicitly fits this product.
  - Display RA registration number on every page once obtained.

### 7.3 US — SEC / state regulators

- **Investment Advisers Act of 1940**: software providing impersonal
  investment advice is generally exempt under the *publisher's exemption*
  (Lowe v. SEC), provided it is:
  - Bona fide publication of regular and general circulation
  - Not personalized to subscriber portfolios
  - Not promoted as a substitute for individual advice
- **Action items:**
  - Legal review before launching paid US tier.
  - Avoid features that personalize verdicts to a user's holdings/risk
    profile in the free/paid web tiers.
  - Portfolio tab (FR-WAT family) must stay informational ("here is the
    verdict for stocks you hold") and never re-rank against the user's
    situation.

### 7.4 Data licensing

- **EDGAR**: free and re-distributable with attribution.
- **NSE / BSE**: official APIs require a vendor agreement for commercial
  redistribution. Initial launch may use freely-available end-of-day data;
  intra-day/real-time tiers require licensing.
- **Yahoo Finance**: ToS prohibits commercial redistribution. Replace with
  Polygon / IEX (US) and a licensed Indian data vendor (Refinitiv, Truedata,
  GlobalDataFeeds) before charging users.

### 7.5 Copy and marketing

- No "guaranteed returns" / "10x" / "stock tip" language anywhere.
- Backtesting results, if shown, must include methodology, time period,
  costs/slippage assumptions, and a disclaimer.

---

## 8. Subscription Tiers & Pricing

Pricing in INR for India and USD for rest-of-world. Annual = 10× monthly
(2 months free).

| Feature                                | Free          | Pro             | Premium          |
|----------------------------------------|---------------|-----------------|------------------|
| **Markets**                            | US only       | US + NSE        | US + NSE + BSE   |
| **Stocks analyzed / month**            | 5             | 100             | Unlimited        |
| **Verdicts per stock**                 | Latest only   | Full history    | Full history     |
| **Math/reasoning visible**             | ✓             | ✓               | ✓                |
| **Custom scoring weights**             | —             | ✓               | ✓                |
| **Filings download (10-K/10-Q/AR)**    | —             | ✓               | ✓                |
| **Watchlists**                         | 1 (max 5)     | 5 (max 50 each) | Unlimited        |
| **Auto re-run cadence**                | —             | Weekly          | Daily            |
| **Alerts on verdict change**           | —             | Email           | Email + push     |
| **Portfolio import (CSV / broker)**    | —             | ✓               | ✓                |
| **API access**                         | —             | —               | 60 req/min       |
| **Real-time prices**                   | —             | 15-min          | Real-time        |
| **Support**                            | Community     | Email           | Priority email   |
| **Price (monthly)**                    | ₹0 / $0       | ₹999 / $15      | ₹1999 / $30      |
| **Price (annual)**                     | —             | ₹9,990 / $150   | ₹19,990 / $300   |

### 8.1 Pricing rationale

- **Pro at ₹999/$15** undercuts Tickertape Pro (₹3,499/yr equivalent ≈ ₹291/mo
  for limited features) on capability and Simply Wall St ($14/mo) on
  multi-market access.
- **Premium at ₹1999/$30** prices below Seeking Alpha Premium ($239/yr ≈
  $20/mo) but above Tickertape, justified by API + multi-market + real-time.
- **Free tier** is the funnel; 5 stocks/month forces upgrade for any serious
  user but is enough to demonstrate the math.

### 8.2 Pricing experiments planned

- A/B test annual price points at $120 / $150 / $180.
- Student discount (50% off Pro) gated by `.edu` email.
- Referral: 1 month free Pro for each referred paid signup.

---

## 9. Success Metrics (KPIs)

### 9.1 North-star metric

**Weekly Active Verdicts (WAV)** — count of distinct user-stock-verdict
events per week. Captures *engagement with the product's core value*, not
just sessions.

### 9.2 Acquisition / activation

| Metric                                | 6-month target | 12-month target |
|---------------------------------------|----------------|-----------------|
| Signups / month                       | 2,000          | 10,000          |
| Free → Pro conversion rate            | 4%             | 7%              |
| Trial completion rate                 | 25%            | 35%             |
| Day-7 retention                       | 30%            | 40%             |

### 9.3 Revenue

| Metric                                | 6-month target | 12-month target |
|---------------------------------------|----------------|-----------------|
| MRR                                   | $5,000         | $40,000         |
| ARPU                                  | $14            | $17             |
| Gross margin                          | 70%            | 80%             |
| Net revenue retention                 | 95%            | 105%            |
| Monthly churn (paid)                  | < 8%           | < 5%            |

### 9.4 Quality / trust

| Metric                                | Target                          |
|---------------------------------------|---------------------------------|
| Verdict reproducibility               | 100% (deterministic by spec)    |
| Filing extraction accuracy (sampled)  | ≥ 98%                           |
| Support ticket SLA                    | First response < 24h            |
| NPS (paid users)                      | ≥ 40                            |

---

## 10. MVP Scope

> **Ship a sellable thing in 8-10 weeks. Do not build everything in §3.**

### 10.1 In MVP

- Tabs 1–3 (US Market: Universe, Filings, Buy/Hold/Sell)
- Tab 10 (Watchlist) — manual re-run only, no auto-cadence
- Tab 12 (Account & Billing) — Stripe only, USD pricing, Free + Pro tiers
- Scoring engine: FR-SCR-1, 2, 4, 6, 7, 8 (skip Beneish + DCF for v1.0; add
  in v1.1)
- Disclaimer + onboarding consent
- Basic responsive web UI; no native apps

### 10.2 Phase 2 (weeks 11–18)

- NSE tabs (4–6)
- DCF (FR-SCR-5) and Beneish (FR-SCR-3)
- Razorpay + INR pricing
- Premium tier with daily auto-rerun + email alerts
- API access (FR-API-1..3)

### 10.3 Phase 3 (weeks 19–26)

- BSE tabs (7–9)
- Portfolio import (Tab 11) — CSV first, then Zerodha Kite + Robinhood APIs
- SEBI Research Analyst registration applied for
- Mobile-responsive PWA polish; consider native app

### 10.4 Out of MVP / out of scope (explicit)

- Options / futures / derivatives analysis
- Mutual funds, ETFs, bonds
- Technical analysis (charts, indicators, signals)
- Crypto
- Social / community features (chat, comments)
- Multi-user / team accounts
- White-label / B2B licensing (revisit in year 2)
- Personalized portfolio re-balancing recommendations (compliance risk)

---

## 11. Risks & Mitigations

| Risk                                                 | Severity | Mitigation                                                                  |
|------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| Regulatory action (SEBI / SEC) for unlicensed advice | High     | Legal review pre-launch; RA registration; impersonal-research positioning   |
| NSE/BSE data licensing dispute                       | High     | Use only freely-available data at MVP; license before scale                 |
| Filings extraction errors → wrong verdicts           | High     | 98%+ extraction accuracy gate; human audit on low-confidence; show source span |
| User trusts verdict blindly and loses money         | Medium   | Disclaimer everywhere; mandatory "show the math" panel; education content   |
| Yahoo Finance breaks and we have no fallback         | Medium   | Multi-source design from day 1; primary + fallback per data type            |
| Indian payments fail (Razorpay outage)              | Medium   | Stripe India fallback; queue + retry on payment events                      |
| Compute cost spikes from Premium auto-reruns        | Medium   | Per-tier daily verdict cap; queue with backpressure                         |
| Competitor (Tickertape, Screener) ships our feature  | Medium   | Speed to market; lean into multi-market + open math as differentiation      |
| Founder bandwidth / single-person company           | High     | MVP scope is realistic for one part-time builder; outsource UI polish + legal |

---

## 12. Acceptance Criteria — "v1.0 is shippable when..."

- [ ] A new user can sign up, complete onboarding (with disclaimer
      acknowledgment), and reach a verdict for a US stock in < 5 minutes.
- [ ] Free tier limit (5 stocks/month) is enforced server-side and surfaced
      gracefully in the UI.
- [ ] A Pro subscriber can pay via Stripe, receive an invoice, and access
      Pro features within 60 seconds of payment.
- [ ] Every verdict displays the per-model sub-scores, formulas, and
      "what-changes-this" sensitivity row (FR-VER-4).
- [ ] Two runs of the same ticker on the same day produce identical
      verdicts and identical numerical sub-scores (FR-VER-5).
- [ ] All US tickers in the SEC master are searchable in the dropdown with
      P95 < 300ms.
- [ ] Manual extraction-accuracy audit on a 50-stock sample shows ≥ 98%
      correct values for the FR-FIL-2 fields.
- [ ] Cold-start verdict (no cache) returns within 30s P95.
- [ ] Subscription cancel + refund flow is tested end-to-end.
- [ ] Privacy policy, terms, refund policy, and disclaimer are reviewed by
      a lawyer and live on the marketing site.
- [ ] Status page is online; uptime monitoring + alerting is wired.

---

## 13. Open Questions for Stakeholder

> Answer these before kickoff. Each materially affects scope or cost.

1. **Naming:** confirm NSE + BSE (not other exchanges).
2. **Geography of incorporation:** Indian Pvt Ltd, Delaware C-Corp, or
   both? Affects tax + payment processing + investor optionality.
3. **Founder time commitment:** full-time or nights/weekends? Phase plan
   above assumes ~25 h/week.
4. **Capital plan:** bootstrap, friends & family, or seek angel? Affects
   how aggressive the legal/data-licensing budget can be.
5. **MVP geography:** US-only at launch, or India-only, or both? Earlier
   sections assume US-first because EDGAR is licensable; reconsider if your
   network is stronger in India.
6. **Branding / domain name:** "Investing AI Decision Engine" is a working
   title. Decide on a brand before any marketing spend.
7. **Free tier abuse:** is 5 stocks/month sufficient to deter throwaway
   accounts, or should we require email verification + rate-limit on IP?
8. **Mobile-first or desktop-first?** PRD assumes responsive web; a
   mobile-first PWA changes some UX decisions.

---

## 14. Glossary

| Term       | Meaning                                                                |
|------------|------------------------------------------------------------------------|
| 10-K       | US annual report filed with the SEC                                    |
| 10-Q       | US quarterly report filed with the SEC                                 |
| AR         | Annual Report (Indian companies file with MCA / stock exchanges)       |
| BSE        | Bombay Stock Exchange (India)                                          |
| CIK        | Central Index Key — SEC's unique identifier for a filer                |
| DCF        | Discounted Cash Flow — intrinsic-value model                           |
| EDGAR      | SEC's filings database                                                 |
| EV/EBITDA  | Enterprise value / earnings before interest, tax, dep & amort          |
| FCF        | Free Cash Flow                                                         |
| IndAS      | Indian Accounting Standards                                            |
| ISIN       | International Securities Identification Number                         |
| NSE        | National Stock Exchange of India                                       |
| P/B        | Price / Book value per share                                           |
| P/E        | Price / Earnings per share                                             |
| PEG        | P/E divided by earnings growth rate                                    |
| RA         | Research Analyst (SEBI-registered category)                            |
| RIA        | Registered Investment Advisor                                          |
| SEBI       | Securities and Exchange Board of India                                 |
| SEC        | US Securities and Exchange Commission                                  |
| WACC       | Weighted Average Cost of Capital                                       |
| XBRL       | eXtensible Business Reporting Language — structured filing format      |

---

*This is a living document. Material changes to scope, pricing, or
compliance posture must be reflected here in the same PR as the code
change. PRs that change product behavior without updating this file should
be rejected.*
