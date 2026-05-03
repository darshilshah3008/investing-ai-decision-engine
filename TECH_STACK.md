# Tech Stack — Current vs. Target

**Document type:** Engineering reference
**Audience:** the developer (you) deciding what to install and learn next
**Companion docs:** [`PROJECT_PROFILE.md`](PROJECT_PROFILE.md) (architecture),
[`REQUIREMENTS.md`](REQUIREMENTS.md) (PRD)

This document does one thing: for every layer of the system (frontend,
backend, database, LLM, devops), it states **what you have today**, **what
you need to build the v2 product**, **specific products with versions**,
and **monthly cost**. Use it as a shopping list.

---

## 1. Honest audit — what you have today

The current repo is **a single-process Python CLI**. There is no
frontend, no backend, no database, no LLM in the code, no auth, no
deployment.

| Layer        | Current state                                                       | Files                              |
|--------------|---------------------------------------------------------------------|------------------------------------|
| Language     | Python (no version pinned)                                          | `requirements.txt`                 |
| Libraries    | `requests`, `pandas`, `yfinance`, `numpy`, `python-dateutil`        | `requirements.txt`                 |
| Frontend     | **None** — outputs are CSVs                                         | `output/*.csv`                     |
| Backend      | **None** — flat scripts                                             | `src/sec_engine_full.py`           |
| Database     | **None** — flat-file CSVs in `output/`                              | `output/`                          |
| LLM in code  | **None.** The "LLM" today is a prompt you paste into Claude manually | `prompts/prompt_investing.txt`     |
| Auth         | **None**                                                            | —                                  |
| Tests        | **None**                                                            | —                                  |
| CI / CD      | **None**                                                            | —                                  |
| Deployment   | **Localhost only**                                                  | —                                  |
| Logging      | `print()` calls                                                     | `src/utils.py:9`                   |

This is fine — you're at the prototype stage. The audit just makes clear
that **almost everything in this document is something you will be
adding for the first time**, not replacing something existing.

---

## 2. Stack at a glance — phased

I recommend three phases. Each phase ships something usable. Don't try
to install everything at once.

| Layer       | Phase 0 (refactor)        | Phase 1 (MVP, paid users)              | Phase 2 (scale, multi-market)          |
|-------------|---------------------------|----------------------------------------|----------------------------------------|
| Frontend    | Streamlit                 | Streamlit + custom CSS                 | Next.js 15 + React + Tailwind + shadcn |
| Backend     | (Streamlit handles it)    | FastAPI                                | FastAPI + Celery workers               |
| Database    | SQLite                    | Postgres (managed)                     | Postgres + Redis + pgvector            |
| File store  | Local filesystem          | Local filesystem                       | Cloudflare R2                          |
| LLM         | None                      | Anthropic Claude (MD&A summaries only) | Claude + RAG over filings              |
| Auth        | None                      | Clerk or Supabase Auth                 | same                                   |
| Payments    | None                      | Stripe                                 | Stripe + Razorpay                      |
| Email       | None                      | Resend                                 | same                                   |
| Hosting     | Localhost                 | Streamlit Cloud or Railway             | Fly.io / Render + Cloudflare           |
| Monitoring  | `print`                   | Sentry (free tier)                     | Sentry + Grafana Cloud                 |
| **Cost**    | $0                        | **$25-60 / month**                     | **$200-500 / month** at ~1000 users    |

---

## 3. Frontend

### What it does

Renders the dropdown of tickers, shows the verdict screen with the
formula breakdown (REQUIREMENTS.md §5A), drives the user through
checkout. This is the only thing your users actually see, so the
quality bar is high.

### Phase 0/1: Streamlit

```
streamlit==1.39.0
streamlit-searchbox==0.1.13      # virtualized dropdown for ~12K tickers
streamlit-aggrid==1.0.5          # interactive verdict table
plotly==5.24.1                   # 10-year revenue / FCF / margin charts
```

**Why:** you can ship Tab 1 in 2-3 days. No build step, no separate
backend, hot reload on file save. Free hosting on Streamlit Cloud.

**Limitations to plan around:**
- No fine-grained UI control. Custom branding is hard.
- Not great for multi-page apps with complex state. OK for MVP, painful
  by user #500.
- Scales by spinning up entire Python processes. Not cheap at scale.

### Phase 2: Next.js + React

```
next@15
react@19
typescript@5.6
tailwindcss@4
@radix-ui/react-* + shadcn/ui    # accessible primitives + design system
recharts                          # charts
@tanstack/react-query             # server state
zustand                           # client state
zod                               # input validation
```

**Why:** at the point where you have paying users, want SEO landing
pages, custom branding, and faster load times, the Streamlit prototype
becomes the limit. Next.js + shadcn is the modern default and has the
largest ecosystem of free templates.

**When to migrate:** when you can name 3 specific Streamlit limitations
that are blocking revenue. Not before.

### Charts you will need

For each verdict screen:

- 10-year line chart: revenue, EPS, FCF, owner earnings (4 lines)
- Bar chart: ROIC vs WACC by year (10 bars × 2 colors)
- Heatmap or table: pillar scorecard with sub-scores
- Sensitivity table (no chart, just a styled table)

`plotly` covers all of these in Streamlit. `recharts` covers them in
Next.js.

---

## 4. Backend

### Phase 0: nothing separate

Streamlit *is* the backend. Your Python engine code runs in the same
process as the UI. SQLite file lives next to the app. Total backend
infrastructure: zero.

### Phase 1: FastAPI

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.9.0
sqlalchemy==2.0.35               # ORM
alembic==1.13.3                   # DB migrations
httpx==0.27.2                     # SEC EDGAR client (async)
```

**Why FastAPI specifically:**
- Native Pydantic integration — REQUIREMENTS.md §5A's Verdict schema
  becomes a `BaseModel` and is automatically validated on every endpoint
- Generates OpenAPI docs for free (Premium tier needs API access — §4.7
  of the PRD)
- Async out of the box — important for the EDGAR client where you'll
  parallelize 50+ HTTP calls per verdict run
- Same language as the engine. No serialization boundary.

### Background jobs

The Universe Builder (Tab 2) and watchlist auto-reruns are **not**
request/response — they run for hours. You need a worker queue.

```
arq==0.26.1            # async Redis job queue
                        # OR
celery==5.4.0          # the heavyweight, more docs, more complexity
```

**Recommendation:** start with `arq`. Smaller surface area, async-native,
fits the existing httpx-based code. Migrate to Celery only if you
outgrow it (probably never).

### Scheduled tasks

```
apscheduler==3.10.4   # in-process cron (good enough for now)
```

For watchlist weekly reruns. When you hit multiple servers and need
distributed scheduling, switch to a Redis-backed `arq cron` or
`celery-beat`.

---

## 5. Database

### Phase 0: SQLite

It's a file. No infrastructure. Python ships with the driver. Good for
millions of rows. If your laptop doesn't crash running the engine,
SQLite won't either.

```python
import sqlite3                     # stdlib
sqlmodel==0.0.22                  # type-safe ORM on top of SQLAlchemy
```

Schema in PROJECT_PROFILE.md §8 (`tickers`, `filings`, `analysis_runs`,
`watchlists`).

### Phase 1: Postgres (managed)

When you have multiple users, you cannot run on SQLite (write locks,
no network access). Switch to Postgres.

| Provider          | Free tier             | Paid start | Notes                                              |
|-------------------|----------------------|------------|----------------------------------------------------|
| **Neon**          | 0.5 GB storage, 1 DB | $19/mo     | Best DX, branchable databases, serverless scales to zero |
| Supabase          | 500 MB, 2 GB egress  | $25/mo     | Includes auth + storage; useful one-stop shop     |
| Railway           | $5 credit/mo         | usage-based | Simplest deployment if you also host the app there |
| AWS RDS           | none                 | ~$15/mo    | Old standby, more ops work                         |

**Recommendation: Neon.** Branchable DBs are amazing for testing
schema changes. Free tier is enough for the first 50-100 users.

### Phase 2: Add Redis

For caching, rate-limiting, and the `arq` job queue.

| Provider          | Free tier        | Paid start | Notes                              |
|-------------------|-----------------|------------|------------------------------------|
| **Upstash**       | 10K commands/day | $0.20/100K | Serverless, scales to zero         |
| Redis Cloud       | 30 MB           | $7/mo      | Official Redis, better support     |
| Railway add-on    | included        | usage      | If you're already on Railway       |

### Phase 2: Vector DB (when you add filings RAG)

For embedding 10-K / 10-Q text and answering "what's their China
exposure?" questions:

- **`pgvector`** as a Postgres extension — Neon supports it natively.
  No separate service, no separate bill. **Recommended.**
- Pinecone, Weaviate, Qdrant — only if you outgrow pgvector (millions of
  documents).

### File storage

- **Phase 0/1:** local filesystem under `data/corpus/`. Filings are
  small (~100 KB each); 10K filings = 1 GB. Fine for one machine.
- **Phase 2:** Cloudflare R2. S3-compatible, **zero egress fees**, $0.015/GB.
  Storing 5 years of all SEC 10-K/10-Q (~50 GB) costs $0.75/month. The
  zero-egress is what makes R2 better than S3 for this use case — you'll
  read these filings repeatedly.

---

## 6. LLM — what you'd actually use it for

### What you have now

The file `prompts/prompt_investing.txt` is **not an LLM integration**.
It's a prompt template you paste into Claude.ai or ChatGPT manually,
along with your CSV outputs, to get a written analysis. The Python code
makes zero LLM calls.

### Where an LLM helps in v2 (and where it doesn't)

The most consequential design choice: **the verdict and the math do not
use an LLM.** Determinism, auditability, and compliance all break the
moment Claude or GPT-4 generates an investment claim. Every BUY / HOLD /
SELL number must be a deterministic computation.

The LLM is useful for *qualitative* work that complements the math:

| Task                                        | LLM | Deterministic | Notes                                            |
|---------------------------------------------|-----|---------------|--------------------------------------------------|
| Compute Piotroski score                     | ✗   | ✓             | Pure math                                        |
| Render the per-model breakdown card         | ✗   | ✓             | Template-based text-from-numbers                 |
| Summarize the 10-K Risk Factors section     | ✓   | ✗             | This is what LLMs are good at                    |
| Summarize MD&A in 3 bullets                 | ✓   | ✗             | Premium tier feature                             |
| "What's their China exposure?" Q&A          | ✓   | ✗             | RAG over filings, Premium tier                   |
| Generate the plain-English thesis sentence  | ?   | ✓ (template)  | Use the template by default; LLM polish optional |
| Explain why P/E is high                     | ✓   | partial       | Mixed — quote the filing, summarize with LLM    |

### Recommended provider: Anthropic Claude

```
anthropic==0.39.0               # official Python SDK
```

**Models:**
- **`claude-haiku-4-5-20251001`** for high-volume tasks (MD&A summaries,
  basic extraction). Cheapest, fastest, fine for these jobs.
- **`claude-sonnet-4-6`** for harder tasks (Q&A over filings,
  multi-document reasoning). Default choice.
- **`claude-opus-4-7`** when you need the deepest reasoning. Sparingly,
  for things like generating the auto-thesis on a complex conglomerate.

**Cost:** under $0.05 per verdict for Sonnet usage; under $0.01 with
Haiku. At 1,000 paid users running 10 verdicts/month each = 10K verdicts
× $0.05 = $500/month LLM cost at scale, fully covered by Pro-tier
margins.

**Why Claude over GPT-4:**
- 200K context window (Sonnet) and 1M (Opus) — you can fit a whole
  10-K in a single call. GPT-4o is 128K.
- **Prompt caching** — cache the 10-K text once, reuse it across
  multiple Q&A turns. ~90% cost reduction on repeat queries.
- Better at refusing to give specific investment advice — fewer
  compliance-risky outputs to filter.

OpenAI / Gemini are perfectly fine alternatives. No religious wars.
What matters: pick one, build, switch later if needed (the prompts are
~95% portable).

### RAG architecture (Phase 2 only)

When you build "ask anything about this company's 10-Ks":

1. On filing download, chunk the 10-K text into ~500-token segments
   with section headers preserved.
2. Embed each chunk with **Voyage `voyage-3-large`** (~$0.06 per 1M
   tokens) or OpenAI `text-embedding-3-small` ($0.02 per 1M).
3. Store embeddings in Postgres `pgvector` indexed by `(cik, accession,
   chunk_id)`.
4. On user query: embed query, top-k similarity search restricted to
   the company's filings, send results + query to Claude Sonnet, return
   cited answer.

Estimated cost: $0.10 per Q&A turn after caching. Premium-tier feature.

### Embeddings — specific recommendation

```
voyage-ai==0.3.1          # Anthropic's recommended embedding partner
                           # OR
openai==1.55.0             # if you also use GPT
```

---

## 7. Tooling

These aren't user-facing but they're what you install on your laptop.

```
# Package manager
uv                            # 10x faster than pip, drop-in replacement

# Linting / formatting
ruff                          # replaces black + flake8 + isort

# Type checking
mypy                          # or pyright

# Testing
pytest
pytest-cov
pytest-asyncio
responses                     # HTTP mocking for EDGAR client tests
hypothesis                    # property-based tests for the math

# Logging
loguru                        # replaces stdlib logging; one-line setup

# Configuration
pydantic-settings             # env vars → typed config object
python-dotenv                 # read .env files in dev
```

### CI: GitHub Actions

Free for public repos. One workflow file (`.github/workflows/ci.yml`):
lint, type-check, test on every PR. Required to keep the engine green
as you add models.

### Pre-commit hooks

```
pre-commit==4.0.1
```

Runs ruff + mypy on `git commit`. Cheaper than waiting for CI to fail.

---

## 8. Auth, payments, email — the SaaS commodity layer

These are solved problems. Don't build them.

### Auth: Clerk or Supabase Auth

| Provider          | Free tier   | Paid start | Notes                                                        |
|-------------------|------------|------------|--------------------------------------------------------------|
| **Clerk**         | 10K MAU    | $25/mo     | Best DX. React + Next.js components. Magic links, OAuth.    |
| Supabase Auth     | 50K MAU    | included with DB | Tied to Supabase ecosystem; cheaper if you're on Supabase already |
| Auth.js (NextAuth)| free        | self-host   | Free but you own the password reset flows, MFA, etc. More work. |

**Recommendation: Clerk.** Higher up-front cost; saves you weeks of
auth-flow grunt work that has zero competitive value.

### Payments: Stripe + Razorpay

```
stripe==11.1.1                # US/global
razorpay==1.4.2                # India
```

PCI compliance is on them, not you. Don't store card numbers. Webhook
handlers in FastAPI to update subscription status in your DB.

### Email: Resend

```
resend==2.4.0
```

Modern, developer-first, $0 for 100 emails/day. Use for:
- Welcome / onboarding
- Verdict-change alerts (Pro tier)
- Subscription receipts

Postmark and SendGrid are alternatives. All work fine.

---

## 9. Hosting & infrastructure

### Phase 0 / 1 (laptop or free tier)

- **App:** Streamlit Community Cloud — free, public-only, fine for
  early users; or Railway $5 credit/month
- **DB:** Neon free tier (0.5 GB)
- **Cache:** Upstash free tier
- **File storage:** local until ~50 users
- **DNS / CDN:** Cloudflare free

### Phase 2 (paid users)

| Provider           | What                          | Monthly cost (~1K users) |
|--------------------|-------------------------------|--------------------------|
| **Fly.io** or **Render** | App hosting (FastAPI + Streamlit-or-Next) | $25-50          |
| **Vercel**         | Next.js frontend (Phase 2)    | $20 (Pro)                |
| **Neon**           | Postgres                      | $19                      |
| **Upstash**        | Redis                         | $5-15                    |
| **Cloudflare R2**  | Filing corpus storage         | $1-5                     |
| **Sentry**         | Error tracking                | $0 (free tier 5K events) |
| **Better Stack**   | Status page + uptime          | $25                      |
| **Cloudflare**     | DNS, CDN, DDoS                | $0                       |
| **Resend**         | Email                         | $0-20                    |
| **Stripe / Razorpay** | Payments                   | 2.9% + 30¢ per txn       |
| **Anthropic API**  | LLM (when shipped)            | $50-200 depending on usage |
| **Subtotal infra** |                               | **~$150-350**            |

### What I'd skip

- Don't run your own Postgres on a VPS. Use Neon.
- Don't roll your own auth. Use Clerk.
- Don't write your own job queue. Use arq.
- Don't build your own status page. Use Better Stack.

These cost a few dollars and save weeks each.

---

## 10. Skills you'll need to learn

Honest list, in order of priority:

| Topic                          | Required by    | Time to learn |
|--------------------------------|----------------|---------------|
| Pydantic v2 typed models       | Phase 0        | 4 hours       |
| Streamlit basics               | Phase 0        | 4 hours       |
| pytest + fixtures              | Phase 0        | 6 hours       |
| FastAPI + async                | Phase 1        | 1-2 days      |
| SQLAlchemy + Alembic           | Phase 1        | 1 day         |
| Stripe webhooks + idempotency  | Phase 1        | 1 day         |
| Anthropic SDK + prompt caching | Phase 1        | 4 hours       |
| Docker basics                  | Phase 2        | 1 day         |
| Next.js + shadcn/ui            | Phase 2        | 1 week        |
| pgvector + RAG patterns        | Phase 2        | 2-3 days      |

If any of these is unfamiliar, that section's adoption slows. None of
them are research-level; all are well-documented.

---

## 11. Decisions for you to make

These pick a fork in the road; each materially changes what you build:

1. **Streamlit-only forever, or migrate to Next.js eventually?** Affects
   whether you bother making the Phase 0 Streamlit code clean.
2. **Self-host or managed everything?** Managed = $50-100/mo more, saves
   ~10 hours/week of ops. At your stage, managed is the right answer.
3. **Anthropic Claude or OpenAI GPT?** Mostly aesthetic. Pick one.
   Switching later costs ~1 day of prompt edits.
4. **Clerk auth ($25/mo) or roll-your-own (free)?** Clerk every time at
   your scale.
5. **Neon Postgres or Supabase (DB + Auth bundle)?** Supabase is simpler
   if you want one vendor; Neon is better DB + Clerk auth.

---

## 12. Final shopping list — Phase 0 only

If you do nothing else, install these and start. Everything else can
wait.

```bash
# .env
SEC_USER_AGENT="Your Name <you@example.com>"

# pyproject.toml dependencies
python = "^3.11"
streamlit = "^1.39"
streamlit-searchbox = "^0.1"
httpx = "^0.27"
pandas = "^2.2"
pyarrow = "^17"
pydantic = "^2.9"
pydantic-settings = "^2.6"
yfinance = "^0.2"
loguru = "^0.7"
plotly = "^5.24"
sqlmodel = "^0.0.22"

# Dev
pytest = "^8"
pytest-cov = "^5"
ruff = "^0.7"
mypy = "^1.13"
responses = "^0.25"
```

**Cost so far: $0/month.** You can ship Phase 0 and demo it to friends
without paying anyone for anything.

Add the LLM, Postgres, Clerk, Stripe, Resend, and a host **only when
you actually start charging users.**
