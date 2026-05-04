# Investing AI Decision Engine

A long-term-investor research tool that pulls every 10-K and 10-Q a company has filed with the SEC, runs nine fundamental scoring models, and produces a **Buy / Hold / Sell** verdict with the math fully visible — every formula, every input number, every source filing.

**Live:** <https://investing-ai-decision-engine.vercel.app>
**Stack:** Next.js 15 · Firebase · Vercel · Anthropic Claude · SEC EDGAR · Yahoo Finance
**License:** MIT

> **What this is not.** Not a day-trading tool, not investment advice, not a price-prediction service. It's research software that reads filings and shows the math behind a verdict. You decide what to do with the output.

---

## What it does

For any of ~12,000 SEC-listed US companies, the engine answers six questions:

| Question | How |
|---|---|
| Is this business **durable**? | Quality pillar (Piotroski F-Score, ROIC vs WACC, margin trend) |
| Is it **growing**? | Growth pillar (multi-year CAGR of revenue + FCF, quarterly trend) |
| Is it **fairly priced**? | Valuation pillar (FCF Yield, Earnings Yield vs Treasury, Graham Number) |
| Will it **survive a recession**? | Sustainability pillar (Debt/EBITDA, Interest Coverage, D/E) |
| What does **Wall Street** say? | News headlines via Google News RSS — display-only, never in math |
| How does it **fit my portfolio**? | Watchlist tools — weights, dividend forecast, P&L, sector concentration, intelligent suggestions |

Every score is a deterministic computation over public filings. No black-box ML. Same inputs always produce the same output.

---

## Features

### Free tier

- **Stock verdict screen** — pick any of 12K SEC tickers, see the engine's analysis with all nine model breakdowns, formulas filled in with real numbers, source-filing links, sector / 52-week range / business summary, and recent news headlines
- **Watchlists** with portfolio composition donut, intelligent suggestions, dividend income forecast, cost-basis P&L tracking, and per-position weights
- **Dashboard** with engine-signal counter cards (BUY / HOLD / SELL distribution across your cached verdicts) and recent analyses
- **Methodology page** — full math + data sources + limitations, public

### Pro tier (`tier === "pro"` in Firestore)

- **SEC Universe** — pre-computed verdicts across 358+ companies (S&P 500), filterable by signal / sector / cap, sortable, CSV-exportable
- **Chat assistant** — floating Claude-powered chat that knows your portfolio data; ask "why does MSFT score what it does?" or "what's my biggest concentration risk?" and get grounded answers with citations to your actual scores

---

## How it works

### The engine

Nine independent models, each emitting a continuous score in `[-1, +1]` and a confidence in `[0, 1]`. Models are grouped into four pillars; the verdict is a confidence-weighted average:

```
pillar_score = Σ (model.score × model.weight × model.confidence)
              ÷ Σ (model.weight × model.confidence)

total = 0.30 · quality
      + 0.25 · growth
      + 0.30 · valuation
      + 0.15 · sustainability

verdict =
  BUY   if total ≥ +0.30
  SELL  if total ≤ −0.20
  HOLD  otherwise
```

Pillar weights reflect a value-tilted long-term-investor bias: valuation and quality dominate (60%) because they drive long-run returns; sustainability is the floor (15% — you can't compound if you go bankrupt).

Full formulas + sources for every model: `web/app/methodology/page.tsx` (or visit `/methodology` on the live site).

### Architecture

```
        Browser
           │
           ▼
   Vercel — Next.js 15 (App Router)
           │
           ├── pages: /, /pricing, /methodology, /dashboard,
           │          /stock/[ticker], /universe,
           │          /watchlist, /watchlist/[id]
           │
           ├── API routes (server-side):
           │     /api/tickers          — SEC ticker master cache
           │     /api/verdict/[ticker] — runs the engine
           │     /api/verdicts         — list cached verdicts
           │     /api/universe         — pre-computed table
           │     /api/me               — user profile + tier
           │     /api/watchlist[/id]   — per-user watchlists
           │     /api/news/[ticker]    — Google News RSS
           │     /api/chat             — Pro-tier Claude chat
           │     /api/admin/seed-universe — cron-triggered batch seed
           │
           ▼
  ┌───────────────┬──────────────────┬────────────────────┬─────────────────┐
  │  SEC EDGAR    │  Yahoo Finance   │  Firebase          │  Anthropic      │
  │  (filings,    │  (price, mcap,   │  Auth + Firestore  │  Claude Haiku   │
  │   XBRL)       │   yield, sector) │  (verdicts cache,  │  (chat only)    │
  │  free, public │  unofficial      │   user data)       │  ~$0.0006/q     │
  │  8 req/s      │  + crumb auth    │  Spark plan free   │                 │
  └───────────────┴──────────────────┴────────────────────┴─────────────────┘
```

Verdicts are cached in Firestore with a **schema version**. When the engine schema changes, the version bumps and stale caches auto-invalidate on next read. This pattern (`lib/firebase/verdicts.ts` → `CURRENT_SCHEMA_VERSION`) prevents UI crashes on schema changes.

### Tier gating

`users/{uid}` Firestore doc has a `tier` field (`"free"` or `"pro"`). Checked server-side on Pro routes (`/api/chat`, etc.) and client-side for UX (`useAuth().tier`). Firestore rules forbid client writes to the user doc — only the admin SDK can promote a user, so users can't self-upgrade.

### What we deliberately don't do

| ❌ Never | Why |
|---|---|
| Scrape paywalled sources (Bloomberg, Zacks, Seeking Alpha) | ToS violation, DMCA / CFAA exposure, scrapers break weekly. We use Yahoo + Google News RSS instead. |
| Include analyst opinions in the engine math | Display-only by design. The "filings-only verdict" is the differentiator vs. Tickertape / Simply Wall St. |
| Predict specific stock prices | Decades of data show no one — including paid analysts — reliably does this. We emit direction signals, not point estimates. |
| Let the chat assistant recommend buy / sell | System prompt forbids it. It explains the math; you decide actions. |
| Reproduce article body text | News RSS is for syndication: headlines + link out only. |

These are baked into the system prompt, the API contracts, and the methodology doc — not just claims in marketing copy.

---

## Run it locally

### Prerequisites

- **Node.js 20+** and npm
- **Git**
- Optional but recommended:
  - A free **Firebase project** (for auth + watchlists; the app runs without it but those features won't work)
  - An **Anthropic API key** (for the chat assistant; Pro feature)

### Setup (5 minutes)

```bash
# 1. Clone + install
git clone https://github.com/darshilshah3008/investing-ai-decision-engine.git
cd investing-ai-decision-engine/web
npm install

# 2. Configure env vars
cp .env.example .env.local
# edit .env.local — see below
```

Minimum `.env.local` to run anything:

```bash
# Required — SEC blocks requests without a real email in the User-Agent
SEC_USER_AGENT="Your Name <you@example.com>"
```

That's the only **required** variable. Without Firebase, sign-in and watchlists won't work but the verdict engine will. Without Anthropic, chat won't work. Add either later when you want those features.

To enable Firebase (auth + watchlists):
1. Create a free Firebase project at <https://console.firebase.google.com>
2. Enable Authentication → Google sign-in
3. Enable Firestore Database (production mode)
4. Project Settings → Your apps → Web → register an app → copy the 6 keys
5. Project Settings → Service accounts → Generate new private key → download the JSON
6. Paste into `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # full JSON on one line
```

Deploy the Firestore rules:
```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project your-project
```

To enable chat (Pro feature):
- Sign up at <https://console.anthropic.com> ($5 free credit, no card)
- Create an API key
- Add to `.env.local`:
  ```bash
  ANTHROPIC_API_KEY=sk-ant-api03-...
  ```

### Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The first time you analyze a ticker takes 10–30 seconds (cold EDGAR fetch); subsequent loads are cached and instant.

### Build for production

On Windows specifically, the build process needs more heap memory than the default:

```bash
NODE_OPTIONS="--max_old_space_size=8192" npm run build
```

On macOS / Linux:

```bash
npm run build
```

### Seed the universe (Pro feature data)

The `/universe` page shows pre-computed verdicts across the S&P 500. To populate:

```bash
# Quick test — 20 tickers, ~30 seconds
node scripts/seed-universe.mjs --limit=20

# Full S&P 500 — ~5 minutes
node scripts/seed-universe.mjs

# Full SEC universe (~12K tickers) — ~6 hours
node scripts/seed-universe.mjs --all
```

The seeder is **resumable** — it skips tickers already seeded today, so you can stop and restart without losing progress.

---

## Deploy to production

The live deployment uses **Vercel** (Hobby tier, free) for hosting and **Firebase** (Spark tier, free) for the database + auth. Total monthly cost at prototype scale: $0.

Step-by-step deploy guide: [`web/DEPLOY.md`](web/DEPLOY.md).

In short:

1. Push your repo to GitHub
2. Go to <https://vercel.com/new> → import the repo
3. **Important:** set **Root Directory** to `web` (the Next.js app is in a subfolder)
4. Add environment variables (same as `.env.local` from above) in Vercel's dashboard
5. Click Deploy
6. Add your Vercel domain to Firebase Auth → Authorized domains (so Google sign-in works)
7. Optionally: create a Pro user by editing `users/{uid}.tier = "pro"` in the Firebase Console

Future deploys are automatic — push to `main` and Vercel rebuilds in ~90 seconds.

For the universe weekly auto-refresh, set the `ADMIN_SEED_TOKEN` secret in both Vercel env vars and GitHub Actions secrets, then the cron at `.github/workflows/seed-universe.yml` runs every Monday at 06:00 UTC.

---

## Project layout

```
/                                        ← repo root
├── README.md                            ← you are here
├── CLAUDE.md                            ← guide for AI coding agents in this repo
├── REQUIREMENTS.md                      ← long-term product spec
├── PROJECT_PROFILE.md                   ← architecture blueprint
├── BUSINESS_CASE.md                     ← honest market analysis
├── METHODOLOGY etc.                     ← see /docs section below
├── src/                                  ← v1 Python CLI (legacy reference; not deployed)
└── web/                                  ← THE PRODUCT (Next.js 15 + Firebase)
    ├── app/                             ← pages + API routes
    │   ├── page.tsx                     ← landing
    │   ├── pricing/, methodology/        ← public marketing
    │   ├── dashboard/                   ← signed-in home
    │   ├── stock/[ticker]/              ← verdict screen
    │   ├── universe/                    ← Pro-tier full SEC table
    │   ├── watchlist/[id]/              ← portfolio analysis
    │   └── api/                         ← server routes
    ├── lib/
    │   ├── analysis/                    ← 9 math models + classifier
    │   ├── edgar/                       ← SEC EDGAR client (rate-limited)
    │   ├── firebase/                    ← admin + client SDK helpers
    │   ├── market/yahoo.ts              ← Yahoo crumb-auth fetch
    │   ├── news/google-news-rss.ts      ← RSS headline fetch
    │   ├── anthropic/                   ← Claude chat helpers
    │   └── format.ts                    ← shared formatters
    ├── components/                      ← shared React components
    ├── scripts/seed-universe.mjs        ← S&P 500 batch seeder
    ├── firestore.rules                  ← security rules
    └── .env.example                     ← env-var template
```

---

## The math, briefly

For each company, the engine pulls every 10-K and 10-Q from SEC EDGAR (typically 10–20 years of history) and runs:

**Quality (30%)**
- **Piotroski-Lite F-Score** — five binary tests on profitability, leverage, and earnings quality
- **Capital Efficiency (ROIC)** — `NI / (Equity + LongTermDebt − Cash)`, 5-year median, tanh-scaled around 12% (~ cost of capital)
- **Margin Trend** — operating margin level + 3-year gross margin trajectory

**Growth (25%)**
- **Multi-Year CAGR** — 3-year and 5-year revenue + FCF compound growth, averaged
- **Quarterly Trend** — last 4 quarters' Q-o-Q up-ratio for revenue and EPS

**Valuation (30%)**
- **FCF Yield** — `(OCF − Capex) / MarketCap`, the most robust valuation metric (works for buyback-heavy companies where Graham fails)
- **Earnings Yield vs Treasury** — `(NI / MarketCap) − 4%` — inverse P/E framed against the actual cost of capital
- **Graham Number** — Benjamin Graham's `√(22.5 × EPS × BVPS)` formula. Confidence is automatically halved for buyback-heavy companies (>20% share reduction in 5 years).

**Sustainability (15%)**
- **Debt Sustainability** — average of `tanh((4 − NetDebt/OCF)/3)`, `tanh((InterestCoverage − 5)/5)`, `tanh((1 − D/E)/1)`

Each model has its own confidence based on data completeness; missing or thin data reduces a model's vote in synthesis. So a company with weak XBRL coverage gets a verdict with low overall confidence rather than a confidently wrong score.

Full math: <https://investing-ai-decision-engine.vercel.app/methodology>

---

## Schema versions

The verdict cache is **schema-versioned** (`lib/firebase/verdicts.ts` → `CURRENT_SCHEMA_VERSION`). When the verdict shape changes, the version bumps and older cached docs are rejected on read. This pattern is critical: without it, schema changes would crash the UI on stale Firestore reads.

| Version | Change |
|---|---|
| 1 | Legacy bucketed scores (subScore -2..+2) |
| 2 | Continuous scores + 9 fundamental models |
| 3 | + dividendYield, sector, beta on marketSnapshot |
| 4 | Yahoo crumb auth fixed (v3 docs had null marketCap/yields) |
| 5 | + 52W high/low, 50d/200d MA, P/E (trailing+forward), business summary |

When you change `lib/analysis/types.ts → VerdictDoc.marketSnapshot` shape, bump the version and add a structural check.

---

## Outstanding work

The product is live and functional. Roadmap items not yet built:

- **Compare-stocks tool** — `/compare?tickers=...` page, side-by-side pillar tables
- **Engine fair-price band** — surface existing Graham + FCF Yield as `Conservative / Base / Aggressive` price points
- **Sector-relative valuation** — currently absolute thresholds; would improve to compare P/E vs sector median
- **Mobile responsive review** — verdict screen is dense; not formally tested at <768px
- **Stripe / Razorpay payments** — pricing page is marketing-only; nothing actually charges users yet (legal review prerequisite)
- **Multi-lot cost basis** — current implementation assumes one purchase price per position

See `~/.claude/projects/.../memory/next_session_punchlist.md` (local-only) for prioritized detail.

---

## Documentation in this repo

| Doc | What it covers |
|---|---|
| [`README.md`](README.md) | This file — what the product is and how to run it |
| [`CLAUDE.md`](CLAUDE.md) | Repo guide for AI coding agents; conventions, file map, schema versions |
| [`web/README.md`](web/README.md) | Web-app-specific quickstart |
| [`web/DEPLOY.md`](web/DEPLOY.md) | Step-by-step Vercel + Firebase deployment |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | Long-term product spec — features, math, compliance, pricing |
| [`PROJECT_PROFILE.md`](PROJECT_PROFILE.md) | Architecture blueprint (early planning) |
| [`BUSINESS_CASE.md`](BUSINESS_CASE.md) | Honest market analysis — competitive landscape, financial scenarios |
| [`TECH_STACK.md`](TECH_STACK.md) | Layer-by-layer tech choices |
| [`PROTOTYPE.md`](PROTOTYPE.md) | Original $0 prototype scope (superseded — we shipped well past it) |

The `src/`, `output/`, and `prompts/` folders contain the original v1 Python CLI engine — kept as a reference but not deployed.

---

## Contributing

This is a personal project. PRs welcome but I may not merge or respond on a fast cadence.

If you do want to contribute:

1. Read `CLAUDE.md` for repo conventions (push directly to main, schema bumps, score formatting)
2. Open an issue first to discuss bigger changes
3. Keep PRs focused — one feature per PR
4. Don't add things that violate the "Things we deliberately don't do" list above

---

## Disclaimer

**This is research software, not investment advice.** The engine produces decision-support output, not personalized recommendations. Stock investing carries real risk, including loss of principal. Past performance doesn't predict future results. Consult a licensed advisor before making investment decisions.

Nothing here is a solicitation to buy or sell any security. Verdicts are computed from public SEC filings using deterministic models — they're not predictions, not endorsements, and not customized to your situation. Use them as one input among many in your own research process, not as a substitute for it.

We are not registered as investment advisors with the SEC or any state regulator.

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## Acknowledgments

- **SEC EDGAR** for free, public, audit-ready filings — the foundation that makes this whole project possible
- **Anthropic** for Claude (the chat assistant) and for being the company that built Claude Code, which co-authored most of this codebase
- **Stitch** for the initial UI design system
- **Yahoo Finance** for unofficial market data (used in good faith for prototype use only — see TECH_STACK.md for paid alternatives if commercializing)
