# Investing AI Decision Engine — repo guide

A long-term-investor research tool: pull every 10-K and 10-Q from SEC EDGAR,
run 9 fundamental models, produce a Buy / Hold / Sell verdict with the math
visible. Live at <https://investing-ai-decision-engine.vercel.app>.

This file is loaded automatically into every Claude Code session in this
repo. Read it once at the start of a session — it captures conventions
that aren't in the code.

---

## Where things live

```
/                                        ← repo root (this file)
├── src/                                  ← v1 Python CLI engine (legacy reference, NOT deployed)
├── output/                               ← v1 CSVs (gitignored)
├── prompts/                              ← v1 LLM prompts (legacy)
├── REQUIREMENTS.md                       ← full PRD (long-term spec)
├── PROJECT_PROFILE.md                    ← tech blueprint
├── PROTOTYPE.md                          ← original $0 scope (superseded — we shipped well past it)
├── BUSINESS_CASE.md                      ← honest market analysis
├── TECH_STACK.md                         ← layer-by-layer choices
├── STITCH_PROMPT.md                      ← UI generation prompt for Stitch
└── web/                                  ← THE ACTUAL PRODUCT (Next.js 15 + Firebase)
    ├── app/
    │   ├── page.tsx                      ← landing
    │   ├── pricing/, methodology/         ← public marketing
    │   ├── dashboard/                    ← signed-in home
    │   ├── stock/[ticker]/               ← verdict screen (the hero)
    │   ├── universe/                     ← Pro-tier full SEC table
    │   ├── watchlist/, watchlist/[id]/   ← saved sets + portfolio analysis
    │   └── api/
    │       ├── tickers, verdict/[ticker], verdicts, universe
    │       ├── watchlist[/id], me, news/[ticker]
    │       ├── chat                      ← Pro-tier Claude assistant
    │       └── admin/seed-universe       ← cron-triggered batch seeder
    ├── lib/
    │   ├── analysis/                     ← 9 math models + classifier + types
    │   ├── edgar/                        ← SEC EDGAR client (rate-limited 8 req/s)
    │   ├── firebase/                     ← admin + client SDKs, users, verdicts cache
    │   ├── market/yahoo.ts               ← Yahoo crumb-auth fetch
    │   ├── news/google-news-rss.ts       ← RSS headlines
    │   ├── anthropic/                    ← Claude SDK + system prompt
    │   └── format.ts                     ← shared formatters (scores, money, dates)
    ├── components/
    │   ├── app-shell.tsx                 ← sidebar + top bar (signed-in shell)
    │   ├── verdict-filter.tsx            ← dashboard signal counters
    │   ├── stock-picker-dialog.tsx
    │   ├── chat-assistant.tsx            ← floating Pro-tier chat
    │   └── public-footer.tsx             ← landing/pricing footer
    ├── scripts/seed-universe.mjs         ← local universe seeder
    └── firestore.rules                   ← security rules (read-public verdicts, per-user watchlists)
```

---

## Tech stack (versions matter — Yahoo + Firebase APIs drift)

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.15 |
| UI | React + TypeScript + Tailwind 3 | 19 / 5.6 / 3.4 |
| Auth | Firebase Auth (Google sign-in) | firebase 11 / firebase-admin 12 |
| DB | Firestore | Spark (free tier) |
| LLM | Anthropic Claude Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Hosting | Vercel | Hobby (free tier) |
| Cron | GitHub Actions weekly | free |
| Filings | SEC EDGAR (XBRL companyfacts) | rate-limited 8 req/s |
| Market data | Yahoo Finance (chart + quoteSummary w/ crumb auth) | unofficial |
| News | Google News RSS | free, designed for syndication |

---

## How the engine works

9 models in 4 pillars, all emitting continuous scores in `[-1, +1]` with confidence in `[0, 1]`.

| Pillar (weight) | Models |
|---|---|
| Quality (30%) | Piotroski-Lite F-Score · Capital Efficiency (ROIC) · Margin Trend |
| Growth (25%) | Multi-Year CAGR · Quarterly Trend |
| Valuation (30%) | FCF Yield · Earnings Yield vs Treasury · Graham Number |
| Sustainability (15%) | Debt Sustainability |

```
pillar_score = Σ (model.score × model.weight × model.confidence)
              ÷ Σ (model.weight × model.confidence)

total = 0.30·quality + 0.25·growth + 0.30·valuation + 0.15·sustainability

verdict =
  BUY   if total ≥ +0.30
  SELL  if total ≤ −0.20
  HOLD  otherwise
```

All formulas are documented in `web/app/methodology/page.tsx` (public-facing) and `lib/analysis/*.ts` (code).

---

## Schema versions (cache invalidation)

`lib/firebase/verdicts.ts` defines `CURRENT_SCHEMA_VERSION`. Bump it when the verdict shape changes; older cached docs get rejected and recomputed on next read. Critical pattern — without it, schema changes crash the UI on stale Firestore reads.

| Version | Change |
|---|---|
| 1 | Legacy bucketed scores (subScore -2..+2) |
| 2 | Continuous + 9-model engine (chunk 4) |
| 3 | + dividendYield, sector, beta on marketSnapshot |
| 4 | Yahoo crumb auth fixed (v3 docs had null marketCap/yields) |
| 5 | + 52W high/low, 50d/200d MA, trailing+forward P/E, business summary |

**When you change `lib/analysis/types.ts → VerdictDoc.marketSnapshot` or `lib/analysis/classifier.ts`, bump the version.**

---

## Tier system

`users/{uid}` doc has `tier: "free" | "pro"`. Defaults to "free" on first sign-in (auto-created by `/api/me`).

Server-side gates (defense in depth):
- `/api/chat` returns 403 unless tier === "pro"
- `/api/admin/seed-universe` checks ADMIN_SEED_TOKEN header

Client-side gates:
- `useAuth().tier` is read from `/api/me` on auth state change
- AppShell sidebar shows lock icon on Pro-only nav items
- `/universe` shows ProGate component for free users
- ChatAssistant shows upgrade CTA for free users

Promote a user manually: Firebase Console → Firestore → `users/{uid}` → edit `tier` field to `"pro"`. Server admin SDK is the only writer (Firestore rules deny client writes to that field).

---

## Commands

All run from `web/` directory unless noted.

```bash
cd web
npm install                                                 # ~60s, 548 packages
NODE_OPTIONS="--max_old_space_size=8192" npm run build      # production build (Windows needs heap bump)
npm run dev                                                 # localhost:3000

# Firebase
npx firebase-tools login                                    # one-time
npx firebase-tools deploy --only firestore:rules            # rule deploy
npx firebase-tools projects:list                            # verify auth + project

# Seed universe locally (S&P 500 by default)
node scripts/seed-universe.mjs --limit=20                   # quick test
node scripts/seed-universe.mjs                              # full S&P 500
node scripts/seed-universe.mjs --all                        # full ~12K SEC universe (~6 hours)
```

---

## Conventions

- **Push directly to main.** Vercel auto-deploys on every push to main. No PRs, no review for solo work.
- **Use git push origin HEAD:main** since we work on Claude worktree branches.
- **Heap size**: builds on Windows crash without `NODE_OPTIONS="--max_old_space_size=8192"`. Always include it.
- **LF→CRLF warnings** are normal Windows behavior — ignore.
- **Score formatting**: always use `formatScoreContinuous` from `lib/format.ts`. Never raw `.toFixed()`.
- **Score colors**: use `scoreColorClass(n)` for the green/red gradient — same on every page so users learn the visual language.
- **Schema bumps**: when changing VerdictDoc, bump `CURRENT_SCHEMA_VERSION` AND the structural check in `getCachedVerdict`.
- **Cost discipline**: chat assistant uses Claude Haiku 4.5, max 800 output tokens, last 12 messages. Don't switch to Sonnet/Opus without good reason.
- **Tier checks**: server-side ALWAYS, client-side for UX. Never trust the client.

---

## Things to NEVER do

- **Never scrape paywalled sources** (Bloomberg, Zacks, Seeking Alpha) — REQUIREMENTS.md §5B. ToS + DMCA + CFAA exposure. Yahoo + Google News RSS are the legal sources we use.
- **Never reproduce news article bodies** — only headlines + link out. RSS is for syndication.
- **Never add analyst opinions to engine math** — display only. The "filings-only verdict" is the differentiator.
- **Never let the chat assistant predict prices or recommend buy/sell** — system prompt forbids it; if you change the prompt, keep that boundary.
- **Never store credentials in code** — env vars only. Especially never log `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ADMIN_SEED_TOKEN`.
- **Never drop schema-version checks** — they prevent UI crashes on stale caches.
- **Never auto-redeploy after env-var changes** — Vercel doesn't either; manual redeploy needed. Code changes auto-deploy on push.

---

## Live deployment

| Resource | URL |
|---|---|
| Production app | <https://investing-ai-decision-engine.vercel.app> |
| GitHub repo | <https://github.com/darshilshah3008/investing-ai-decision-engine> |
| Vercel project | `darshil-shahs-projects-6b390c7e/investing-ai-decision-engine` |
| Firebase project | `investing-ai-engine` |
| GitHub Actions cron | weekly Mon 06:00 UTC, S&P 500 in 20-ticker batches |

### Required env vars (in Vercel)

- `SEC_USER_AGENT` — `"Name <email>"` (SEC requires real email)
- `NEXT_PUBLIC_FIREBASE_*` × 6 (client SDK config)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — full JSON pasted as one line
- `ADMIN_SEED_TOKEN` — random 64-char hex (also in GitHub Actions secrets)
- `ANTHROPIC_API_KEY` — `sk-ant-api03-...` (Pro chat)

---

## Outstanding work / known gaps

- **Compare-stocks tool** — deferred; would be a `/compare` page that takes 2-4 tickers and renders side-by-side pillar tables
- **Skeleton loaders** — currently using "—" or "Loading…" text; lower priority polish
- **Mobile responsive review** — not formally tested; verdict screen is dense
- **Universe re-seed** — schema bumps invalidate cache; run GitHub Actions workflow after schema bumps to keep `/universe` populated
- **Analyst consensus panel** — designed (REQUIREMENTS.md §5B) but not built; would use Yahoo's `financialData` module
- **Engine fair-price band** — designed; would surface existing Graham/FCF math more prominently
- **Cost basis P&L** — built, but doesn't account for shares vs cash invested in equal increments (assumes you bought at one price)
- **Sector-relative valuation** — currently absolute thresholds; would improve to compare P/E vs sector median

---

## Architecture decisions worth knowing

1. **Verdict cache via schema version, not TTL alone.** Cache hits are explicit at the schema level — older versions are rejected even within TTL.
2. **No separate Firebase Functions.** Next.js API routes act as the EDGAR proxy. One codebase, one deploy.
3. **Yahoo crumb auth in `lib/market/yahoo.ts`.** Fc.yahoo.com cookie + getcrumb endpoint, cached 1 hour. Without it, quoteSummary returns 401.
4. **Sparse Firestore writes.** Watchlist `weights`, `costBasis` only store entries with positive values — keeps docs tidy when users add/remove tickers.
5. **In-process verdict cache (`memoryCache` in `edgarFetchJson`)** + Firestore cache + schema version = three layers. Memory is fastest but ephemeral; Firestore survives restarts.
6. **The chat assistant context is built server-side from real Firestore data.** The user's portfolio is fetched on every chat request — never trust client-supplied portfolio data, since the system prompt's accuracy depends on it.
7. **Universe seed is paginated.** `/api/admin/seed-universe` caps at 25 tickers/call (60s Vercel timeout). The GitHub Actions workflow walks ~500 S&P names in 20-ticker batches.

---

## Quick orientation for a new session

1. Read `~/.claude/projects/E--Github-Investing-App-investing-ai-decision-engine/memory/current_state.md` for what's been done
2. Read `~/.claude/projects/.../memory/next_session_punchlist.md` for what to pick up
3. `cd web` and start working — the Next.js app is the deployed product; everything else is reference docs

If unsure where something lives, search the file map at the top of this doc. Each `lib/` subdirectory has a clear single responsibility.
