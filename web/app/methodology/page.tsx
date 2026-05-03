// Public methodology page — explains how the engine works, what data
// powers it, and what the limitations are. The page a skeptical reader
// goes to before deciding whether to trust the verdicts.

import Link from "next/link";

export const metadata = {
  title: "Methodology — Investing AI Decision Engine",
  description:
    "How the Investing AI Decision Engine produces Buy / Hold / Sell verdicts: the data sources, the 9 fundamental models, the synthesis math, and what we deliberately don't do.",
};

export default function MethodologyPage() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-14 bg-[#0A0E14]/80 backdrop-blur-md border-b border-[#1F2937] z-50 px-gutter flex items-center justify-between">
        <Link href="/" className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">memory</span>
          <span className="text-base font-black text-slate-50 tracking-tight">
            INVESTING AI
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-lg">
          <Link
            href="/methodology"
            className="text-primary font-sans text-xs uppercase tracking-widest font-bold"
          >
            Methodology
          </Link>
          <Link
            href="/pricing"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-gutter container mx-auto max-w-3xl">
        <span className="font-label-caps text-primary mb-2 block">METHODOLOGY</span>
        <h1 className="text-display-lg font-display-lg text-on-surface mb-4">
          How the engine works.
        </h1>
        <p className="font-body-md text-on-surface-variant mb-12 text-lg leading-relaxed">
          Every Buy / Hold / Sell verdict is a deterministic computation over public
          SEC filings. No black-box ML, no analyst opinions in the math, no
          hand-tuning. This page documents the data, the models, the synthesis,
          and the limitations.
        </p>

        <Section title="Data sources">
          <p>
            <strong>SEC EDGAR</strong> is the source of truth for fundamentals. The
            engine pulls every 10-K (annual) and 10-Q (quarterly) filing a company
            has submitted, going back as far as EDGAR holds them — typically
            10-25 years. The XBRL company-facts feed gives us structured numeric
            access to ~150 fields per company including revenue, net income,
            operating cash flow, capex, debt, equity, EPS, and shares
            outstanding.
          </p>
          <p>
            <strong>Yahoo Finance (quoteSummary)</strong> supplies real-time
            market data: price, market cap, dividend yield, beta, P/E, sector,
            industry, 52-week range, and moving averages. Required for valuation
            models that compare price against fundamentals.
          </p>
          <p>
            <strong>Google News RSS</strong> supplies headline links shown on the
            verdict screen. Headlines are <em>display only</em> — they never
            enter the verdict math. We syndicate Google's RSS feed (designed for
            this) and never reproduce article body text.
          </p>
        </Section>

        <Section title="The 9 fundamental models">
          <p>
            Every stock is scored by 9 independent models grouped into 4 pillars.
            Each model emits a continuous score in <code>[-1, +1]</code> and a
            confidence in <code>[0, 1]</code>. Lower confidence (e.g. when a data
            field is missing) reduces that model's vote in synthesis.
          </p>

          <PillarBlock
            name="Quality"
            weight="30%"
            tone="The business itself — profitable, well-run, durable?"
          >
            <ModelEntry
              name="Piotroski-Lite F-Score"
              math="Sum of {Net income > 0, OCF > 0, OCF > NI, no dilution, LTD declining}, mapped to [-1,+1]"
              source="Piotroski (2000) original 9 of which we use 5 with reliable XBRL tags"
            />
            <ModelEntry
              name="Capital Efficiency (ROIC)"
              math="ROIC ≈ NI / (Equity + LTD − Cash); 5-year median, tanh-scaled around 12%"
              source="Standard return-on-capital formula"
            />
            <ModelEntry
              name="Margin Trend"
              math="60% × tanh((OperatingMargin − 12%) / 12%) + 40% × tanh(ΔGrossMargin_3y / 3pp)"
              source="Catches deteriorating businesses early; both level and trend"
            />
          </PillarBlock>

          <PillarBlock
            name="Growth"
            weight="25%"
            tone="Are the fundamentals actually compounding?"
          >
            <ModelEntry
              name="Multi-Year CAGR"
              math="3-year + 5-year CAGRs of revenue and FCF, averaged, tanh-scaled around 5%"
              source="Compound annual growth — robust to single-quarter noise"
            />
            <ModelEntry
              name="Quarterly Trend"
              math="Average of revenue and EPS Q-o-Q up-ratio across last 4 quarters"
              source="Catches near-term acceleration / deceleration"
            />
          </PillarBlock>

          <PillarBlock
            name="Valuation"
            weight="30%"
            tone="Cheap or expensive vs. what you're getting?"
          >
            <ModelEntry
              name="FCF Yield"
              math="(OCF − Capex) / MarketCap; tanh-scaled around 4% (≈ Treasury yield)"
              source="Most robust valuation metric — works for buyback-heavy companies where Graham fails"
            />
            <ModelEntry
              name="Earnings Yield vs Treasury"
              math="NI/MCap − 4% (assumed risk-free rate); tanh around ±4pp"
              source="Inverse P/E framed against the actual cost of capital"
            />
            <ModelEntry
              name="Graham Number"
              math="√(22.5 × EPS × BVPS); MoS = 1 − Price/GN; confidence halved when buybacks > 20% in 5y"
              source="Benjamin Graham's defensive-investor formula (1973). Down-weighted because BVPS is misleading for buyback-heavy modern companies."
            />
          </PillarBlock>

          <PillarBlock
            name="Sustainability"
            weight="15%"
            tone="Will it survive a recession?"
          >
            <ModelEntry
              name="Debt Sustainability"
              math="avg(tanh((4 − NetDebt/OCF)/3), tanh((IntCov − 5)/5), tanh((1 − D/E)/1))"
              source="Three balance-sheet stress tests, averaged"
            />
          </PillarBlock>
        </Section>

        <Section title="Synthesis">
          <p>
            Each pillar's score is a confidence-weighted average of its models:
          </p>
          <pre className="bg-surface-container-lowest border border-outline-variant rounded p-4 my-4 text-xs font-data-md text-primary overflow-x-auto">
{`pillar_score = Σ (model.score × model.weight × model.confidence)
              ÷ Σ (model.weight × model.confidence)

total = 0.30·quality + 0.25·growth + 0.30·valuation + 0.15·sustainability

verdict =
  BUY   if total ≥ +0.30
  SELL  if total ≤ −0.20
  HOLD  otherwise`}
          </pre>
          <p>
            Pillar weights reflect a value-tilted long-term-investor bias: valuation
            and quality each get 30% because they're what drive long-term returns;
            sustainability gets 15% (you can survive without it but you can't compound
            if you go bankrupt).
          </p>
          <p>
            <strong>Determinism:</strong> the same inputs always produce the same
            output. There's no LLM in the verdict path, no random seeds, no
            third-party opinions. If you re-run a stock 10 times with no new
            filings, you'll get the same score 10 times.
          </p>
        </Section>

        <Section title="What the engine deliberately does NOT do">
          <ul>
            <li>
              <strong>No analyst opinions in the math.</strong> Bloomberg /
              Zacks / Seeking Alpha price targets and ratings are excluded by
              design. The whole point is that you can audit every input — analyst
              consensus is opaque and survivorship-biased.
            </li>
            <li>
              <strong>No technical analysis.</strong> No RSI, MACD, moving-average
              crossovers, candlestick patterns. The engine is for long-term
              fundamentals — different problem.
            </li>
            <li>
              <strong>No news sentiment in the score.</strong> Headlines are shown
              on the verdict screen as context, but they don't change the score.
            </li>
            <li>
              <strong>No personalization to your situation.</strong> The engine
              gives the same verdict to every user. It doesn't know your tax
              bracket, your time horizon, your risk tolerance, or your existing
              positions. Adjusting verdicts to user context would push us into
              regulated investment-advice territory.
            </li>
            <li>
              <strong>No price predictions.</strong> The engine doesn't forecast
              what a stock will do. It scores the underlying business based on
              filings — whether the price reflects that fairly is a separate
              question.
            </li>
          </ul>
        </Section>

        <Section title="Honest limitations">
          <p>
            <strong>XBRL tag mapping.</strong> ~12,000 SEC filers each use slightly
            different XBRL tags. We use fallback chains (e.g., <code>Revenues</code>
            {" → "}<code>RevenueFromContractWithCustomerExcludingAssessedTax</code>),
            but unusual filings still slip through and produce zero scores
            on some models. A "Low conf" badge appears on those models.
          </p>
          <p>
            <strong>Financial firms.</strong> Banks, insurers, and REITs have
            balance sheets that don't fit the standard model assumptions
            (Altman Z, debt ratios). Verdicts on these names are less reliable —
            treat as informational only.
          </p>
          <p>
            <strong>Buyback-heavy companies.</strong> Graham Number understates
            intrinsic value for companies that have aggressively bought back
            shares (AAPL, MSFT). The engine automatically halves Graham's
            confidence when share count has dropped {">"}20% in 5 years.
          </p>
          <p>
            <strong>No forward-looking data.</strong> The engine is rear-view —
            it scores what the company HAS done, not what it WILL do. Sudden
            business changes (acquisitions, regulatory shifts, technology
            disruptions) won't show up until they appear in filings.
          </p>
          <p>
            <strong>Yahoo's free data is unstable.</strong> Yahoo Finance is the
            source for market cap, dividend yield, and beta. Yahoo periodically
            rate-limits or restructures their endpoints. Production deployments
            should use a paid data vendor (Polygon, Finnhub, or similar) for
            reliability and commercial licensing.
          </p>
        </Section>

        <Section title="Track record + accuracy">
          <p>
            We don't claim a track record. The engine is too new for one to mean
            anything statistically — and even if it had 5 years of history, "the
            engine signaled BUY on AAPL in 2019" isn't predictive evidence; it's
            survivorship bias.
          </p>
          <p>
            What we <em>can</em> claim: every score on every page is reproducible.
            Click into any verdict, expand any model card, and you'll see every
            input number with a link to the exact 10-K accession number on EDGAR.
            If our extraction is wrong, you can verify it against the original
            filing.
          </p>
        </Section>

        <Section title="Not investment advice">
          <p>
            This is research software. It produces decision-support output, not
            recommendations tailored to your situation. Read the math, audit the
            inputs, form your own thesis. If you make money or lose money based
            on what you see here, that's on you.
          </p>
          <p>
            The engine is provided as-is, with no warranty of accuracy. See the{" "}
            <Link href="/" className="text-primary hover:underline">
              landing page
            </Link>{" "}
            for the full disclaimer.
          </p>
        </Section>

        <div className="mt-16 pt-8 border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
          <Link href="/dashboard" className="text-primary hover:underline">
            ← Back to the app
          </Link>
          <span>
            Engine version 5 · Last methodology update: 2026-05-03
          </span>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-h1 text-h1 text-on-surface mb-4 border-b border-outline-variant pb-3">
        {title}
      </h2>
      <div className="space-y-4 text-on-surface-variant text-base leading-relaxed [&>p]:text-on-surface-variant [&>ul]:text-on-surface-variant [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&_strong]:text-on-surface [&_code]:bg-surface-container-low [&_code]:px-1 [&_code]:rounded [&_code]:font-data-md [&_code]:text-primary [&_code]:text-sm">
        {children}
      </div>
    </section>
  );
}

function PillarBlock({
  name,
  weight,
  tone,
  children,
}: {
  name: string;
  weight: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 border-l-2 border-primary/40 pl-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-h2 text-h2 text-on-surface">
          {name} <span className="text-primary text-sm ml-2">{weight}</span>
        </h3>
      </div>
      <p className="text-sm italic mb-3">{tone}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ModelEntry({
  name,
  math,
  source,
}: {
  name: string;
  math: string;
  source: string;
}) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded p-3">
      <p className="font-data-md text-on-surface text-sm mb-2">{name}</p>
      <p className="font-data-sm text-primary text-xs mb-1.5 break-words">
        {math}
      </p>
      <p className="text-xs text-on-surface-variant">{source}</p>
    </div>
  );
}
