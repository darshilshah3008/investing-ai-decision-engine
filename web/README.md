# Investing AI Decision Engine — Web App

A Next.js 15 + Firebase web app that lets anyone press a button and have
the engine pull a stock's 10-K and 10-Q filings from SEC EDGAR, run three
fundamental scoring models, and render a Buy / Hold / Sell verdict with
the **complete reasoning trail** — every formula, every input, every
source filing.

Visual design ported from the Stitch mockups in `../stitch_equity_logic_engine.zip`.

## What it does

| Screen | Path | What you can do |
|---|---|---|
| Landing | `/` | Marketing hero — the public-facing pitch |
| Dashboard | `/dashboard` | Sign in, see recent verdicts, open stock picker |
| Stock picker | (modal) | Search ~12,000 SEC tickers, multi-select |
| Verdict | `/stock/[ticker]` | **The hero.** Pull EDGAR data, run the engine, render math |
| Watchlist index | `/watchlist` | Your saved sets |
| Watchlist detail | `/watchlist/[id]` | Run all, add/remove tickers |
| Pricing | `/pricing` | Free / Pro / Premium tiers (no payments wired yet) |

## Architecture

```
Browser (Next.js client)
    │
    ├── Firebase Auth (Google sign-in)         ← user identity
    ├── /api/tickers                            ← SEC ticker master cache
    ├── /api/verdict/[ticker]                   ← runs the engine
    └── /api/watchlist[/:id]                    ← user-owned watchlists
              │
              ▼
   Next.js server (API routes — no separate backend)
              │
              ├── EDGAR HTTP client (rate-limited, ~8 req/s)
              ├── Math engine (TypeScript port of v1)
              ├── Yahoo price snapshot
              └── Firestore (verdicts cache + watchlists)
```

**No separate Firebase Functions** — Next.js API routes act as the
EDGAR proxy, so SEC's CORS restriction never reaches the browser.

## Math models implemented

Three of the long-term-investor models from `../REQUIREMENTS.md §5`:

1. **Revenue & EPS Trend** (Pillar: Growth) — Q1>Q2>Q3>Q4 → +1, reverse → −1
2. **Piotroski-Lite F-Score** (Pillar: Quality) — 5 of 9 tests
3. **Graham Number + Margin of Safety** (Pillar: Valuation)

Verdict: BUY if total ≥ +2, SELL if total ≤ −2, HOLD otherwise.

The full 12-model engine from REQUIREMENTS.md is the post-prototype
target. See `lib/analysis/` to add more.

## Setup

### 1. Install

```bash
cd web
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a project (any name).
2. Enable **Authentication** → Sign-in method → Google.
3. Enable **Firestore Database** → start in production mode (the
   `firestore.rules` in this repo will be applied at deploy time).
4. **Project settings → General → Your apps → Web app**: register a
   new web app and copy the config object.
5. **Project settings → Service accounts → Generate new private key**:
   download the JSON file. This is for the server-side admin SDK.

### 3. Configure environment

```bash
cp .env.example .env.local
# edit .env.local
```

Fill in:

- `NEXT_PUBLIC_FIREBASE_*` — from the web-app config in step 4
- `FIREBASE_SERVICE_ACCOUNT_JSON` — paste the **entire JSON** from
  step 5 as a single line (use `JSON.stringify` if needed). Example:
  ```
  FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...",...}'
  ```
- `SEC_USER_AGENT` — your real name and email. SEC blocks requests
  without one. Example: `"Darshil Shah <darshil@example.com>"`

### 4. Set the project ID

```bash
# Edit .firebaserc — replace REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID
```

### 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. Click **Try free** → sign in with Google
→ click **+ Add stocks** → pick `AAPL` → see the engine run.

First run for a ticker takes 10–30 seconds (cold EDGAR fetch). After
that it's cached in Firestore for 24 hours.

## Deploy to Firebase Hosting (App Hosting)

Firebase App Hosting supports Next.js natively, including API routes.

```bash
# Install Firebase CLI if you don't have it
npm install -g firebase-tools

# Log in and select your project
firebase login
firebase use --add

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy the web app
firebase deploy --only hosting
```

The first hosting deploy will prompt to enable App Hosting and link
the project. Once deployed your app is at `https://<project>.web.app`.

## Project structure

```
web/
├── app/
│   ├── layout.tsx                      # AuthProvider + fonts
│   ├── globals.css                     # Tailwind + verdict colors
│   ├── page.tsx                        # Landing
│   ├── pricing/page.tsx
│   ├── dashboard/page.tsx              # Sign-in gate + recents
│   ├── stock/[ticker]/page.tsx         # Verdict screen (hero)
│   ├── watchlist/page.tsx              # Index
│   ├── watchlist/[id]/page.tsx         # Detail (run-all button)
│   └── api/
│       ├── tickers/route.ts
│       ├── verdict/[ticker]/route.ts
│       └── watchlist/[/[id]]/route.ts
├── components/
│   ├── app-shell.tsx                   # Sidebar + top app bar
│   └── stock-picker-dialog.tsx         # Ticker multi-select modal
├── lib/
│   ├── edgar/                          # SEC EDGAR client + companyfacts
│   ├── analysis/                       # 3 math models + classifier
│   ├── market/yahoo.ts                 # Price snapshot
│   ├── firebase/
│   │   ├── client.ts                   # Browser SDK
│   │   ├── admin.ts                    # Server SDK + verifyAuth
│   │   ├── verdicts.ts                 # Firestore helpers
│   │   └── auth-context.tsx            # React AuthProvider
│   └── format.ts                       # Number/currency printers
├── tailwind.config.ts                  # Color tokens from Stitch
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .env.example
├── .firebaserc
└── README.md
```

## Notes & limitations

- **Not investment advice.** Research output only.
- **`yfinance` price source is for personal/research use** — replace
  with Polygon, Finnhub, or IEX before charging users (see
  `../TECH_STACK.md §3`).
- **First EDGAR fetch is slow** — 10–30 seconds for a ticker we've
  never seen. Subsequent fetches read from in-memory cache and the
  Firestore cache.
- **Verdict accuracy is bounded by XBRL tag mapping.** ~12,000 filers
  use slightly different tags for the same concept. The engine has
  fallback chains (`lib/edgar/companyfacts.ts → TAGS`) but isn't
  perfect on small-caps and financials. Audit before trusting.
- **No payments wired.** The pricing page is marketing-only.
