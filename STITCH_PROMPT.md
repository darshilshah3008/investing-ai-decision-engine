Design a SaaS web app called **Investing AI Decision Engine**.

It's a research tool for long-term, fundamentals-driven equity investors — Buffett-style, 3 to 10 year holding periods. Users pick stocks from a searchable list of 12,000 SEC-filed US companies. The app pulls every 10-K and 10-Q from SEC EDGAR, runs 12 fundamental scoring models (Piotroski F-Score, ROIC vs WACC, 10-year DCF on Owner Earnings, Graham margin of safety, Greenblatt Magic Formula, Altman Z-Score, debt durability, moat stability, multi-year CAGRs, reinvestment quality, multiples vs. own history, Beneish veto), and produces a Buy / Hold / Sell verdict with the **complete reasoning visible** — every formula, every input number, every source filing referenced and clickable.

The product's promise is *"see the math behind every decision."* That promise is delivered or broken on the Verdict Screen. Spend the most design budget there.

Target user: 28-50, professional, manages own portfolio of 10-30 stocks, reads 10-Ks for top holdings, will pay $15/month for a tool that saves time and shows its work. Buffett / Graham / Munger fans, not day-traders.

**Visual direction — premium fintech, calm, confident, analytical.** Reference Linear (data density done elegantly), Mercury (banking restraint), Stripe Dashboard (information design), Ramp (confident fintech), Notion (clean structured tables). Avoid Robinhood's casino aesthetic, Bloomberg Terminal density, MetaTrader hostility, "GET RICH NOW" copy, lime-green flashing tickers, stock photography of suited men shaking hands. Mood: a serious tool for serious people, warm enough to invite first-timers.

**Default to dark mode.** Background `#0A0E14`, surface `#131922`, elevated surface `#1A2230`, subtle border `#1F2937`, primary text `#E8EAED`, secondary text `#8B95A5`, muted text `#5C6772`. Calm emerald `#4ADE80` for BUY, muted coral `#F87171` for SELL, warm amber `#FCD34D` for HOLD — never lime, never fire-engine red. Indigo `#6366F1` accent used sparingly for primary actions. Chart series: sky blue `#60A5FA`, violet `#A78BFA`, mint `#34D399`, gold `#FBBF24`. Also generate a light-mode variant: background `#FAFBFC`, surface `#FFFFFF`, primary text `#0F172A`, secondary text `#475569`, same accent colors.

**Typography:** Inter for UI and body text (geometric sans, professional). **JetBrains Mono for every number, ticker, formula, and data column** — non-negotiable. Financial numbers in a proportional font look amateur, columns must align. Heading scale 32 / 24 / 20 / 18 / 16. Body 14-15. Hero numbers 28-48.

Design six screens, in this order of importance:

**Screen 1 — Landing page.** Top nav: small wordmark left, "Pricing / Docs / Sign in" right, primary "Try free" button far right. Hero left half: large headline *"See the math behind every stock decision."* Subhead: *"We read every 10-K and 10-Q a company has filed with the SEC, run 12 fundamental models, and show you the formula behind every Buy / Hold / Sell — with every number traced to its source filing."* Two CTAs: primary indigo "Try it free", secondary outlined "Watch 60-second demo." Hero right half: a real mockup of the Verdict Screen for AAPL showing "BUY +1.33" and three pillar scores — make this look like the actual product, not a generic illustration. Below the fold: three side-by-side cards titled "Every score is a formula" (square-root icon), "Built for long-term investors" (calendar icon), "Sources you can audit" (link icon), each with one-sentence body copy. Then a three-step "How it works" section with thumbnails. Then a pricing teaser (Free / Pro $15 / Premium $30) with a "Compare features" link. Minimal footer: wordmark, tagline *"Research, not advice."*, links to Privacy / Terms / GitHub.

**Screen 2 — Dashboard (logged-in home).** Layout: 240px left sidebar + main content. Sidebar contains wordmark top, nav items (Dashboard, Watchlists, Search, Universe, History, Settings), avatar + plan badge "Pro" at bottom. Main content: greeting *"Good evening, Darshil"* top-left, big "+ Add stocks to analyze" button top-right. Hero strip "Verdicts that changed since last week" — horizontally scrolling cards showing ticker, company, old verdict → new verdict with arrow, one-line reason like *"Forward P/E rose above threshold"*, color stripe on card edge matching verdict. Section "Your watchlists": grid of 2-4 cards, each showing name (*"AI Megacaps"*), 8 ticker mini-pills with verdict colors, last-run timestamp, "Re-run" button. Section "Recent analyses": table of last 10 individual stock analyses with ticker (monospace), company, verdict chip, four pillar mini-bars, "View" button.

**Screen 3 — Verdict Screen — THE HERO. Spend the most design budget here.** Single column layout, ~1000px wide, generous vertical spacing. Top header card: large ticker + company name on left (`AAPL — Apple Inc.`), sector badge below (`Technology · Consumer Electronics`); on right, a big BUY pill in calm emerald, 32-40pt, with white-on-emerald label, and below it in monospace: `Total +1.33  ·  Confidence: High`. Thin metadata strip: `Latest 10-K: Feb 14, 2025 · Latest 10-Q: Oct 30, 2025 · Price as of: 14:33 EST · $176.42`.

Below header, a "Thesis" section — heading in small caps, then a 3-4 sentence paragraph in a serif face like Source Serif or Charter for warmth (the rest of the app is sans):

> *Apple is a Technology business with a wide-moat profile (10-year median ROIC 22% vs WACC 9%). Revenue has compounded at 8.4% over 5 years and free cash flow at 11.2%. At today's price of $176, the stock trades at a 28% discount to our 10-year DCF fair value of $245. The verdict is **BUY**, primarily because of the durable capital efficiency and the meaningful margin of safety, partially offset by recent gross-margin compression.*

Below thesis, the Pillar Scorecard — a clean four-row table with columns Pillar / Score (colored chip) / Weight / Contribution / Top driver. Pillars: Quality (+1.5, 0.30 weight), Growth (+1.0, 0.20), Valuation (+1.5, 0.35), Sustainability (+1.0, 0.15). Total +1.33 row at bottom in bold, monospace.

Below scorecard, a vertical stack of 12 expandable model cards. Collapsed state of each card shows: model name + small icon on left, one-line interpretation in middle, sub-score chip on right (`+2`, `+1`, `0`, `−1`, `−2` colored pills), chevron indicator. **Design the DCF card expanded state in detail** — use this layout pattern for the other 11 cards too:

```
10-year DCF on Owner Earnings                                Score: +1

Formula
  Fair Equity = Σ OE_t / (1+WACC)^t   for t = 1..10
              + Terminal Value / (1+WACC)^10

Inputs (every number sourced)
  Owner Earnings FY2024     $84.3 B    ↗ 10-K (2025-02-14)
  Growth rate (years 1-10)  9%         from 5-yr OE CAGR
  Terminal growth           2.5%       US long-run GDP
  WACC                      9.4%       sector median
  Net debt                  $52 B      ↗ 10-K, page F-7
  Diluted shares            15.3 B     ↗ 10-K, page F-9

Result
  Fair Price $245.10  →  vs Current $176.42  →  MoS 28%
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  28% margin of safety → Sub-score +1
```

Formula and every number rendered in JetBrains Mono. The `↗` is a link-out icon to EDGAR. The result row gets a thin emerald gradient.

Below the model stack, two side-by-side cards: **Catalysts** (green-tinted, 3-4 bullet items, each one specific sentence with a number — *"ROIC of 22% vs WACC of 9%, sustained for 9 of last 10 years (10-K trend, FY2015-FY2024)"*) and **Risks** (red-tinted — *"Gross margin compressed 320 bps in FY2024 (44.1% → 40.9% per 10-K) — first decline in 7 years"*).

Below those, a small **"What would change this verdict?"** sensitivity table with three rows: scenario / score effect / new verdict. Example rows: *"Fair price falls 15% (revenue miss) | −0.65 | HOLD"*, *"WACC rises from 9.4% to 11% | −0.40 | HOLD"*, *"Beneish M-score crosses −1.78 (veto) | −3.00 | HOLD (veto)"*.

Below sensitivity, a collapsed-by-default **"Show all inputs"** button that expands into the full Inputs Trace table — every number used, ~40 rows, each with source filing accession#.

A small **"What others are saying"** panel goes on the right side, visually de-emphasized — gray border, lighter text, smaller font, clearly labeled *"For context · not used in our math"*. Contains analyst consensus rating, mean price target with implied upside, # analysts covering. **This must look like a footnote, not a hero — it must not compete with the main content.**

Sticky action bar at bottom: "Add to watchlist", "Download PDF report" (Pro feature), "Re-run with custom weights" (Pro feature), last-updated timestamp.

**Screen 4 — Stock picker dialog.** Centered modal ~640px wide. Title: "Add stocks to analyze." Search input at top with magnifying-glass icon, placeholder *"Type ticker or company name (e.g. AAPL, Microsoft)..."*, focused by default. Below: live-filtered virtualized list, each row showing monospace bold ticker, company name, sector pill, checkbox on right. Selected items appear as removable chips above the search input. When search is empty, show a "Most-analyzed this week" section with 6 popular tickers (AAPL, MSFT, GOOGL, NVDA, BRK.B, V). Footer: text "Cancel" link + primary "Analyze 5 stocks" button with counter that updates dynamically.

**Screen 5 — Watchlist view.** Dense scannable table layout. Header row: editable watchlist name, last-run timestamp, "Re-run" button, settings gear icon. Sortable columns: Ticker (monospace, bold, with small color stripe matching verdict), Company name, Sector, Verdict chip (BUY emerald / HOLD amber / SELL coral), Total score (monospace, with directional arrow if changed since last run), four pillar mini bar charts in a row (0-2pp scale), Price (monospace), Last updated (faded gray), actions kebab. Below table: footer with total count, "Export CSV" link.

**Screen 6 — Pricing page.** Three-column comparison. Heading "Pricing", subhead *"Pay only when the math helps you. Cancel any time."* Three cards side-by-side. **Free** $0/forever: 5 stocks/month, latest verdict only, math visible, community support; CTA "Start free." **Pro** $15/month, highlighted with subtle indigo border + "Most popular" badge: 100 stocks/month, full history, custom scoring weights, 5 watchlists, weekly auto-rerun, email alerts, downloadable reports; CTA "Try Pro free for 14 days." **Premium** $30/month: unlimited stocks, daily auto-rerun, real-time prices, API access, priority support, multi-market when available; CTA "Try Premium free for 14 days." Below the cards, a comparison table with checkmarks. FAQ section with 4-5 expandable questions (cancellation, refund, data sources, security, why no free trial of Free tier). Bottom trust strip: small SEC EDGAR logo with text *"Filings sourced directly from SEC EDGAR — free, public, audit-ready."*

**Reusable components** (design these once, use everywhere): Verdict pill (BUY / HOLD / SELL × small / medium / large). Sub-score chip (−2 to +2 colored pills). Pillar mini bar (horizontal 4-segment chart). Source-link badge (`↗ 10-K (2025-02-14)`, monospace, clickable). Number display block (large monospace number, small label above, unit suffix). Formula block (monospace, dark background even in light mode for code aesthetic). Trend sparkline (80×24px line chart for use in tables). Loading skeleton for the verdict screen during the ~30s cold-start computation. Empty-state illustrations: geometric and minimal, never cartoonish.

**Responsive:** desktop 1280-1440px is primary. Tablet 768-1024px gracefully collapses columns. Mobile 375-414px reorders verdict screen to single column, stacks model cards vertically, sensitivity table becomes swipeable.

**Accessibility:** WCAG 2.1 AA contrast on all text. BUY/HOLD/SELL signals encoded as text label + chip shape, never color alone. 2px indigo focus rings on every interactive element. Full keyboard navigation.

The Verdict Screen is the product. Every other screen exists to deliver users *to* the verdict screen as fast as possible. Make formulas legible. Make source links obvious. Make numbers monospace. Make the reasoning the hero.
