# Business Case — Is This Worth Building as a Paid Product?

**Document type:** Honest assessment, written for the founder
**Audience:** you, before you commit 12 months
**Companion docs:** [`REQUIREMENTS.md`](REQUIREMENTS.md), [`PROTOTYPE.md`](PROTOTYPE.md),
[`PROJECT_PROFILE.md`](PROJECT_PROFILE.md), [`TECH_STACK.md`](TECH_STACK.md)

You asked the most important question last: **"Is it worth it for people
to buy this product?"** This document answers that — without
cheerleading and without doom-mongering. It's the read a sober angel
investor or experienced founder would give you before you commit a year
of nights and weekends.

---

## TL;DR

| Path                                                        | Verdict                              |
|-------------------------------------------------------------|--------------------------------------|
| **Build the prototype, use it yourself, ship to GitHub**    | **Strongly worth it.**               |
| **Add a payment wall, target $500-2,000 MRR side income**   | **Achievable in 12-18 months with focused effort.**  |
| **Quit your job and make this your full-time business**     | **High risk — see §6.**              |

The product can be built. The skills you'll learn are valuable. The
audience exists. But the market is mature and the path from "demo to
$10K MRR" is long and unforgiving for a solo founder. The honest
recommendation is at the bottom (§7).

---

## 1. The competitive landscape — who already exists

You are not entering an empty market. The "fundamental stock analysis
for retail investors" space has 8+ established players with deep
pockets. Real prices, real user bases, real brand equity:

| Product                | Market | Price (paid)                  | Estimated users   | Strengths                                      | Weaknesses                                  |
|------------------------|--------|-------------------------------|-------------------|------------------------------------------------|---------------------------------------------|
| **Tickertape**         | India  | ₹3,499/yr (~$42)              | 5M+ (mostly free) | Polished UX, Smallcase distribution, momentum  | Opaque "scorecard," no audit trail          |
| **Screener.in**        | India  | ₹3,000/yr (~$36)              | 2M+               | Cheap, fast, beloved by power users            | Raw numbers, no synthesized signal          |
| **Simply Wall St**     | Global | $14/mo                        | 500K+             | "Snowflake" visualization, polished mobile     | US/Aus tilt, methodology hidden             |
| **Seeking Alpha**      | US     | $239/yr Premium, $2,400 Pro   | 250K+ paying      | Editorial brand, analyst marketplace           | Editorial ≠ systematic; $$$                 |
| **Zacks Premium**      | US     | $249/yr                       | 100K+ paying      | 30-year brand, ranking system                  | Closed methodology, dated UI                |
| **Morningstar Investor** | US   | $249/yr                       | 200K+ paying      | Gold-standard fundamentals, "moat" research    | Slow to update, expensive                   |
| **Stock Rover**        | US     | $99-300/yr                    | ~50K              | Powerful screener, Excel-style tables          | Niche, US-only, dated UX                    |
| **GuruFocus**          | US     | $349-559/yr                   | ~30K paying       | Buffett-style metrics, value-investor focus    | Cluttered, expensive                        |
| **Finbox**             | Global | $19-59/mo                     | ~20K              | DCF modeling, factor screens                   | Niche, B2B-leaning                          |

### What this means for you

- **You are not the first to think of this.** Every angle you've sketched
  has at least one player addressing it.
- **The "show the math" pitch is differentiated**, but only against
  Tickertape and Simply Wall St — Screener.in already exposes raw
  numbers (just not synthesized verdicts), and GuruFocus / Stock Rover
  show formulas to power users.
- **Cross-market (US + India)** is a genuine gap — no listed competitor
  spans both at retail price points. This is your strongest wedge.

---

## 2. Bull case — concrete reasons people might pay

### 2.1 The market exists and is large

- India retail investing: **120M+ demat accounts** (vs. 36M pre-COVID)
- US self-directed investors: **~25M** active retail
- Tickertape Pro at ₹3,499 with 5M users → if 2% convert that's **₹35
  crore (~$4.2M) annual revenue** for a similar product
- Even capturing **0.05% of the addressable retail market** at $15/mo =
  **$112K MRR** — life-changing for a solo founder

### 2.2 The "show the math" wedge is real

Every existing player has one of two flaws:
- **Too opaque** (Tickertape, Simply Wall St, Zacks): users can't audit
- **Too raw** (Screener.in): users get numbers but not synthesis

A product that does **both** — synthesizes a Buy/Hold/Sell *and* shows
the formula — has nobody serving it well in the $15-30/mo retail price
band. Morningstar does it but costs $249/yr and looks like 2008.

### 2.3 The long-term-investor niche is underserved

Day-trader tools (TradingView, Trendlyne, Streak) are saturated. The
buy-and-hold / Buffett-style audience is older, more patient, has more
disposable income, and is currently choosing between:
- Free Yahoo Finance + Excel (works but tedious)
- Morningstar (expensive, dated)
- Manual reading of 10-Ks (free but full afternoon per company)

A modern, fast, formula-visible tool sits in real white space here.

### 2.4 The data moat is free

SEC EDGAR is free, comprehensive, and re-distributable. You don't need
a $50K/year Bloomberg deal to compete on US fundamental analysis. This
is the single biggest reason a solo founder can credibly enter this
space — most other industries have data acquisition costs that lock out
bootstrappers.

### 2.5 Cross-border NRI investors are a unique audience

Indians living abroad ($30B+ annual remittances; many invest in both US
and Indian markets) currently use 3+ tools. None of the listed
competitors serves this audience well. **This is your sharpest wedge.**

---

## 3. Bear case — concrete reasons people might not

### 3.1 The "show the math" pitch may be a niche feature

Hard truth: **most retail investors don't actually want to read
formulas.** They want a single number / signal / star rating. The audit
trail is a feature for ~10-20% of the market — sophisticated DIY
investors. The other 80%+ are perfectly happy with Tickertape's
black-box scorecard.

You're optimizing for the long tail of fundamentals nerds. That's a
real audience, but it's smaller than your earlier docs imply.

### 3.2 Distribution is brutal for a solo founder

| Channel               | Cost / hardness                                    |
|-----------------------|----------------------------------------------------|
| **SEO** for "stock analysis tool" | Dominated by Tickertape, Screener.in, Investopedia. 12-18 months to rank, and you're competing with VC-backed content teams. |
| **Google Ads**        | "stock analysis" CPC: **$5-15**. At 2% conversion to free + 5% to paid = $5-15K to acquire a paying $180/yr user. **Negative unit economics** for the first 18 months. |
| **Reddit / Twitter / X** | Possible — but slow, requires consistent content output, anti-self-promotion norms |
| **YouTube**           | Highest-leverage channel for finance content but production-heavy |
| **Cold outreach**     | Doesn't work for B2C retail at this price point    |

You'll spend 70%+ of your time on distribution, not product. This is
the honest reality of indie SaaS.

### 3.3 Long-term-investor engagement is *low*

Buffett-style investors check their tools **monthly or quarterly**, not
daily. Low engagement → high churn risk → low willingness to pay
recurring.

Math: a user who consults the tool 4 times a year for 30 minutes per
session = 2 hours of value per year. At $15/mo ($180/yr), that's $90
per hour-of-use. Day-trading tools win on engagement and can charge
more. Long-term tools fight uphill on subscription willingness-to-pay.

### 3.4 Compliance overhead is non-trivial and ongoing

| Item                                          | Cost                                |
|-----------------------------------------------|-------------------------------------|
| SEBI Research Analyst registration (India)    | ~₹6L upfront + ₹50K/year ongoing    |
| US legal review (publisher's exemption)       | $5-10K initial                      |
| Lawyer-reviewed T&C / privacy / disclaimers   | $2-5K initial                       |
| Annual SEBI / SEC compliance audit            | ~$3-5K/year                         |
| Pre-launch + ongoing recurring                | **~$15-25K first year**             |

This eats 10-20% of revenue at low scale. Not a deal-breaker, but plan
for it.

### 3.5 Accuracy risk → reputation risk

The 12-model engine reads XBRL across ~12,000 different filers, each
using slightly different taxonomies. **Wrong number → wrong verdict →
user loses real money → angry user / refund / one-star review.**

Industry-specific edge cases (banks, REITs, insurers, ADRs, holding
companies) require non-trivial special handling. The acceptance
criterion of "98% extraction accuracy on 50 sampled stocks" is *not*
the same as 98% accuracy on the full universe of 12K. Real-world
accuracy at scale will be lower.

### 3.6 Market is mature

In a mature market, marginal users are hard to win — the easy customers
already chose a tool 3 years ago. Switching costs are real (saved
watchlists, learned UI, paid annual subscriptions). You're not hunting
greenfield demand; you're poaching from incumbents.

### 3.7 Solo founder, part-time = unrealistic for SaaS

The PROJECT_PROFILE roadmap assumes 25 hours/week. Real SaaS at this
ambition needs:
- **Product:** 15-20 h/week
- **Customer support:** 5-15 h/week (scales with users)
- **Marketing / content:** 10-15 h/week
- **Legal / ops / billing:** 2-5 h/week

That's 30-50 h/week. Sustainable nights-and-weekends caps at ~20.
Something gives — usually marketing, which is the thing you can least
afford to skip.

---

## 4. The financial reality — three honest scenarios

Math assumes US Pro tier at $15/mo. Costs include infra + LLM + Stripe
fees + compliance amortized.

### Scenario A: "Side project that pays for itself" (most likely)

After 12 months of consistent part-time effort:

| Metric                | Value                              |
|-----------------------|-----------------------------------|
| Free signups          | 2,000                              |
| Free → Pro conversion | 3% (industry: 1-7%)                |
| Paying users          | 60                                 |
| MRR                   | **$900**                           |
| Annual revenue        | **$10,800**                        |
| Costs / year          | ~$3,500 (infra + tools + part of compliance) |
| Net to founder        | **~$7,300/year**                   |
| Hourly rate (at 20h/wk) | **$7/hr**                        |

This is the realistic outcome. **You'd earn more freelancing.**

### Scenario B: "Profitable side income" (achievable with focus)

After 18-24 months of consistent effort + content marketing investment:

| Metric                | Value                              |
|-----------------------|-----------------------------------|
| Free signups          | 8,000                              |
| Conversion            | 5% (above industry)                |
| Paying users          | 400                                |
| MRR                   | **$6,000**                         |
| Annual revenue        | **$72,000**                        |
| Costs / year          | ~$10,000                           |
| Net to founder        | **~$62,000/year**                  |

Achievable, but requires being good at product **and** distribution.
Most solo founders are good at one, not both.

### Scenario C: "Real business" (low probability)

After 36 months + you cracked one of: organic SEO, viral YouTube
finance content, or a B2B angle (white-label for advisors):

| Metric                | Value                              |
|-----------------------|-----------------------------------|
| Paying users          | 2,500                              |
| MRR                   | **$37,500**                        |
| Annual revenue        | **$450K**                          |
| Costs / year          | ~$60K (infra, contractor, compliance) |
| Net to founder        | **~$390K/year**                    |

Probability honestly: **5-15%** without external capital or co-founder.
30-50% with the right co-founder (sales / marketing complement).

### What's missing from these numbers

- **Opportunity cost** of your time. If you're a senior engineer earning
  $100-200K, every hour on this is an hour not earning that.
- **Failure rate.** ~80% of indie SaaS shut down within 24 months.
- **Founder burnout.** The middle 12 months of any indie SaaS are
  brutal — visible progress is slow, signups are sparse, and you can't
  yet quit your day job.

---

## 5. What would have to be true for this to work

A useful exercise: list the leading indicators. If these hit during the
prototype phase, the product has legs. If they don't, the bear case is
playing out.

| Leading indicator                                              | Threshold                   |
|----------------------------------------------------------------|-----------------------------|
| Friends / Reddit / Twitter testers who use it >2× without prompting | ≥ 5 users                |
| Unprompted "would you pay for this?" → yes                      | ≥ 3 users                   |
| Users who voluntarily expand the formula cards                  | ≥ 30% of sessions           |
| Time spent on verdict screen                                    | ≥ 90 seconds                |
| Search-engine traffic to demo                                   | ≥ 100 visits/month organic by month 6 |
| Free-to-paid conversion when you flip on payments               | ≥ 3%                        |
| Day-30 retention                                                | ≥ 25%                       |
| NPS from first 50 users                                         | ≥ 30                        |

**Run the prototype for 90 days against these benchmarks before
investing real money in compliance, paid acquisition, or LLM features.**
If 5+ indicators are red, pivot or shelve. If 5+ are green, you have a
real signal worth pressing into.

---

## 6. Three honest paths forward

### Path 1 — *Portfolio piece + personal tool* (lowest risk, highest learning)

Build the prototype as specified in [PROTOTYPE.md](PROTOTYPE.md). Use
it for your own investing. Open-source on GitHub with a clean README.

**Outcome:**
- Strong portfolio piece (Python, EDGAR, financial math, Streamlit, eventually FastAPI)
- Demonstrable to employers / clients (~$15-30K boost in next salary negotiation)
- Personal tool that saves you 4-8 hours/quarter on your own research
- Zero compliance burden — open-source educational tools sit firmly inside the publisher's exemption

**Time:** 2-4 weekends.
**Money risk:** $0.
**Probability of being "worth it":** ~95%.

### Path 2 — *Indie SaaS side project* (moderate risk, moderate upside)

Build the prototype, validate against §5 leading indicators for 90 days,
**then** add Clerk + Stripe and start charging $15/mo. Aim for
Scenario B: 400 paying users, $60K/year net income within 24 months.

**Outcome (if leading indicators are green):**
- Realistic side income while keeping day job
- Skills + revenue that compound

**Outcome (if indicators are red):**
- You've shipped the prototype anyway → still got Path 1 benefits
- Wasted 30-40 hours on payment integration that could've gone elsewhere

**Time:** 4-8 months part-time.
**Money risk:** $50-200/month infra + ~$15K compliance investment.
**Probability of Scenario B outcome:** ~25-35% with focused effort.

### Path 3 — *Full-time venture* (highest risk)

Quit your day job. Find a co-founder strong on distribution. Raise
$50-150K friends-and-family or angel. Try to build the multi-market
platform from REQUIREMENTS.md inside 18 months.

**Outcome (Scenario C):** $400K/year solo founder income, possibly an
acquisition target for Smallcase / Zerodha / fintech aggregator.

**Outcome (more likely):** burn capital, ship product, fail to crack
distribution, shut down at 18-24 months. Industry-standard.

**I do not recommend this path** unless you can name 3 unfair
advantages you have that the listed competitors don't.

---

## 7. My honest recommendation

**Do Path 1 first. Treat the prototype as a 4-weekend project to learn
+ build a portfolio piece + scratch your own itch.**

Then, ONLY if at the end of those 4 weekends:
- You've genuinely enjoyed the build
- You've used the tool for your own investing and it changed a decision
- You've shown it to 5+ friends who were intrigued (not just polite)
- The §5 leading indicators look promising

…then enter Path 2. Add payments, stand up content marketing, start
acquiring users. Give yourself a hard 18-month deadline; if MRR isn't
≥ $1,500 by then, return the prototype to "personal tool + portfolio
piece" status without shame.

**Do not jump to Path 3.** A solo founder going full-time on a mature
B2C SaaS market without VC backing or a strong distribution co-founder
is a well-documented failure pattern. Plenty of indie SaaS founders
have made $10-50K MRR side businesses; almost none have built
$5M+ ARR companies solo in this space.

---

## 8. Will people *actually* pay? My honest answer.

**Some people, yes — but fewer than the optimistic case implies, and
not enough to support you full-time without scale you don't yet have
the distribution to reach.**

Specifically:
- **0.5-2%** of long-term retail investors who actively read 10-Ks will
  *love* this product
- **A subset of those** (~15-30%) will pay $15/mo for it
- **A small subset of those** (~5-15%) will stay subscribed for 12+ months
- The funnel multiplies down to roughly **0.05% of the long-term
  retail audience as your reachable, paying, retained customer base**

For India's 120M demat accounts × 0.05% = **60K maximum theoretical
TAM at retail**. Your realistic share is 1-3% of that = **600 to
1,800 paying users** = **$8-30K MRR** — Scenario B territory.

That's a real outcome and a real business. Just not a venture-scale
one without significant pivots (B2B advisors, white-label, content
empire, etc.).

---

## 9. The single most important question

Before you invest a year in this, answer this honestly:

> *"If I built this, used it for 6 months, and the answer was 'nobody
> wanted to pay for it' — would I still be glad I built it?"*

If yes: **Path 1 is a no-brainer. Build the prototype.**

If no: **don't start.** Build something else where the building itself
is the reward, or where the market is less mature.

The prototype is cheap. The opportunity cost of 12 months chasing a
mature market is not. Be honest with yourself about which question
you're really asking.

---

*This document is deliberately direct. The kindest thing I can tell
you is the truth — not the hype. If the analysis above changed your
mind toward "let's just do Path 1," that's a successful planning
exercise. You've saved a year and learned what you needed to learn.*
