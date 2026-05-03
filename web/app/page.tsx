// Landing page — adapted from Stitch screen (1) HTML.
// Hot-links the AI-generated illustrations from Google's CDN.

import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      {/* Top app bar (landing variant — different from authenticated AppShell) */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-[#0A0E14]/80 backdrop-blur-md border-b border-[#1F2937] z-50 px-gutter flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">memory</span>
          <span className="text-base font-black text-slate-50 tracking-tight">INVESTING AI</span>
        </div>
        <div className="hidden md:flex items-center gap-lg">
          <Link
            href="/pricing"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Pricing
          </Link>
          <a
            href="https://github.com/"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Docs
          </a>
          <Link
            href="/dashboard"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="bg-primary text-on-primary px-4 py-2 font-sans text-xs uppercase tracking-widest font-bold rounded-sm active:scale-95 transition-transform"
          >
            Try free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="pt-32 pb-24 px-gutter container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container border border-outline-variant rounded-full mb-lg">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-caps text-on-surface-variant">V2.4 MODEL LIVE</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-background mb-md leading-tight max-w-xl">
              See the math behind every stock decision.
            </h1>
            <p className="font-body-md text-on-surface-variant mb-lg max-w-lg leading-relaxed">
              Our engine reads every 10-K and 10-Q a company has filed with the SEC, runs three
              fundamental scoring models, and shows you the formula behind every Buy / Hold / Sell
              — with every input number traced to its source filing.
            </p>
            <div className="flex flex-wrap gap-md">
              <Link
                href="/dashboard"
                className="bg-primary text-on-primary px-8 py-4 font-label-caps text-sm rounded-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              >
                TRY IT FREE
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <Link
                href="/pricing"
                className="border border-outline text-on-background px-8 py-4 font-label-caps text-sm rounded-lg hover:bg-surface-container transition-all flex items-center gap-2"
              >
                SEE PRICING
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
              </Link>
            </div>
          </div>

          {/* Hero right: AAPL verdict mockup */}
          <div className="lg:col-span-6 relative">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-gutter tonal-layer verdict-glow-buy">
              <div className="flex justify-between items-start mb-lg">
                <div>
                  <div className="flex items-center gap-2 mb-xs">
                    <span className="font-data-lg text-data-lg">AAPL</span>
                    <span className="font-body-sm text-on-surface-variant text-xs opacity-70">
                      Apple Inc.
                    </span>
                  </div>
                  <div className="font-display-lg text-display-lg text-on-background">
                    $189.43 <span className="text-secondary text-sm font-data-md">+1.24%</span>
                  </div>
                </div>
                <div className="bg-secondary text-on-secondary px-4 py-1 font-label-caps text-lg rounded-sm">
                  BUY
                </div>
              </div>
              <div className="space-y-md">
                <div className="p-sm bg-surface-container-low border border-outline-variant rounded-lg">
                  <div className="flex justify-between items-center mb-xs">
                    <span className="font-label-caps text-on-surface-variant">MODEL CONFIDENCE</span>
                    <span className="font-data-sm text-secondary">94.2%</span>
                  </div>
                  <div className="h-1 w-full bg-surface-container-highest overflow-hidden">
                    <div className="h-full bg-secondary w-[94.2%]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-sm">
                  <div className="p-sm bg-[#0A1420] border border-outline-variant rounded-sm">
                    <span className="font-label-caps text-on-surface-variant block mb-1">
                      DCF FAIR VALUE
                    </span>
                    <span className="font-data-md text-on-background">$214.50</span>
                  </div>
                  <div className="p-sm bg-[#0A1420] border border-outline-variant rounded-sm">
                    <span className="font-label-caps text-on-surface-variant block mb-1">
                      EV/EBITDA
                    </span>
                    <span className="font-data-md text-on-background">18.4x</span>
                  </div>
                </div>
                <div className="p-sm bg-surface-container-highest/30 border-l-2 border-primary">
                  <span className="font-label-caps text-primary block mb-1">
                    ENGINE INSIGHT
                  </span>
                  <p className="font-body-sm text-xs leading-tight">
                    Services revenue margin expansion exceeding baseline by 240bps. Cash flow yield
                    suggests undervaluation despite macro headwinds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Value props */}
      <section className="py-24 bg-surface-container-lowest border-y border-[#1F2937]">
        <div className="container mx-auto px-gutter">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {[
              {
                icon: "functions",
                title: "Every score is a formula",
                body: 'No "black box" algorithms. Click any metric to see the specific SEC filing line and the math used to calculate it.',
              },
              {
                icon: "history_edu",
                title: "Built for long-termers",
                body: "We ignore the noise of high-frequency trading. Our engine focuses on multi-year fundamental stability and moat strength.",
              },
              {
                icon: "verified_user",
                title: "Sources you can audit",
                body: "Direct integration with SEC EDGAR. Full source attribution on every data point — every number links back to its 10-K accession number.",
              },
            ].map((v) => (
              <div
                key={v.title}
                className="p-lg bg-surface-container border border-outline-variant rounded-lg hover:border-primary/50 transition-colors"
              >
                <span className="material-symbols-outlined text-primary mb-md">{v.icon}</span>
                <h3 className="font-h2 text-h2 mb-sm">{v.title}</h3>
                <p className="font-body-sm text-on-surface-variant">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works (with hot-linked Stitch images) */}
      <section className="py-24 px-gutter container mx-auto">
        <div className="text-center mb-xl">
          <span className="font-label-caps text-primary">THE PIPELINE</span>
          <h2 className="font-h1 text-h1 mt-sm">Institutional analysis at scale</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
          {[
            {
              step: "01",
              title: "Ingestion",
              body: "Our engine pulls every 10-K and 10-Q filing for the company you select directly from SEC EDGAR.",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpS5Wzyefm6yGlbWsLZMbUSe_D_3qUaz72VwV8srOsa6C4Bdi6Zq5ZP-rgFCOVYcZKkbVKtGOYeNzq2zjKhur5tPSEkdx40Nmb6GTeeLOU_oV_sjsFsBpufMvbGOn19gdTKnd3zjIIVlbkhysSPQnP-aN3TRccmZ-jxCORrSNvLA6BL4gpGzVxcOLy-6ltQBulePdTUsWc_-FdgtK7sL7s9V3r9c-9Or-DHkENazVgmlagB9t2-tcIYk7RHQ1BFmq3yE_cb0C9mJQ",
            },
            {
              step: "02",
              title: "Modeling",
              body: "Three fundamental valuation models — Revenue & EPS Trend, Piotroski-Lite, Graham Number — score every ticker on Quality, Growth, and Valuation.",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAuB3pRSPs15UwJ8kt61j-F4xqS3dQbT8UgiOlWefATlzd8kOdxmvqkm0EDKYCHFmeJTnF8qt9vB76nTkUP-_hi5exBbZ1h5puNjpTCTaK-ZUD9ckI2EpTACM8zj21Ac8Z2FXm6_fW-_FrE7SQfb90Mw6Z9bElCNnmFx4d2pOB2_ZdQIJq2unuYArAaZwG-q3VcG8q2_M4Hw6z7BgxRNYCceacoDj3jCNBQpmbzibTtGaqWkykmPzSYe5KB03cKe_yOFpDr8VoZilY",
            },
            {
              step: "03",
              title: "Verdict",
              body: "The engine produces a final Buy / Hold / Sell decision with a transparency report showing exactly which factors led to the score.",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnhNiX3eUU0CrDJ0qMgM5fG6_65P8vqxcJ9Y4Lw93uTgllg5GcvSu12eLPrJEazzMdSP9mvorMh4Ho8aFXcJ39fCTw6Mdruj_4zYzGQGoMSST3mt5zN4VnsuVPH3nHXAYGBNI4ebtOHZEohqrpHV57DZB2gG9ROcjL-Gva-kIiaud4K_zDj965QlqKxDfHSjJwp6-EKMij17HSkY_HMwIsfcRLRRvHpdw4550hUbHsIORYn88b9YZYS5pCYYzI1dLFb7pm61k7l3s",
            },
          ].map((step) => (
            <div key={step.step} className="relative group">
              <div className="aspect-video bg-surface-container-high rounded-xl mb-md overflow-hidden border border-outline-variant">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={step.title}
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  src={step.img}
                />
              </div>
              <div className="flex gap-md">
                <div className="font-display-lg text-primary/30">{step.step}</div>
                <div>
                  <h4 className="font-h2 text-h2 mb-2">{step.title}</h4>
                  <p className="font-body-sm text-on-surface-variant">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-24 bg-[#050F1B]">
        <div className="container mx-auto px-gutter">
          <div className="text-center mb-xl">
            <h2 className="font-h1 text-h1 mb-sm">Institutional tools for everyone</h2>
            <p className="font-body-md text-on-surface-variant">
              Choose the plan that fits your portfolio size.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg max-w-5xl mx-auto">
            <PricingTeaser
              name="EXPLORER"
              price="$0"
              features={["5 stock lookups/day", "Basic models", "—"]}
              cta="GET STARTED"
              highlight={false}
            />
            <PricingTeaser
              name="PROFESSIONAL"
              price="$15"
              features={["Unlimited lookups", "All models", "Real-time filing alerts", "Full math transparency"]}
              cta="GO PRO"
              highlight
            />
            <PricingTeaser
              name="INSTITUTIONAL"
              price="$30"
              features={["Pro features + API", "Custom model tuning", "Priority inference"]}
              cta="CONTACT SALES"
              highlight={false}
            />
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-[#1F2937] px-gutter">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-lg">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary">memory</span>
                <span className="text-base font-black text-slate-50 tracking-tight">
                  INVESTING AI
                </span>
              </div>
              <p className="font-label-caps text-on-surface-variant text-[10px]">
                RESEARCH, NOT ADVICE.
              </p>
            </div>
            <div className="flex gap-lg font-label-caps text-[12px] text-on-surface-variant">
              <a className="hover:text-primary transition-colors" href="#">PRIVACY</a>
              <a className="hover:text-primary transition-colors" href="#">TERMS</a>
              <a
                className="hover:text-primary transition-colors flex items-center gap-1"
                href="https://github.com/"
              >
                GITHUB
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
            <div className="font-data-sm text-[10px] text-outline">
              © 2026 DECISION ENGINE V2.4.0
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function PricingTeaser({
  name,
  price,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  features: string[];
  cta: string;
  highlight: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "p-lg bg-surface-container border-2 border-primary rounded-xl flex flex-col relative scale-105 shadow-2xl"
          : "p-lg bg-surface-container-low border border-outline-variant rounded-xl flex flex-col"
      }
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-3 py-1 rounded-full font-label-caps text-[10px]">
          MOST POPULAR
        </div>
      )}
      <span
        className={`font-label-caps mb-2 ${highlight ? "text-primary" : "text-on-surface-variant"}`}
      >
        {name}
      </span>
      <div className="font-display-lg text-display-lg mb-md">
        {price}{" "}
        <span className="text-xs font-body-sm text-on-surface-variant">/mo</span>
      </div>
      <ul className="space-y-sm mb-xl flex-grow">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-center gap-2 text-on-surface-variant text-sm"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        className={
          highlight
            ? "w-full py-3 bg-primary text-on-primary rounded-lg font-label-caps hover:brightness-110 transition-colors"
            : "w-full py-3 border border-outline-variant rounded-lg font-label-caps hover:bg-surface-container transition-colors"
        }
      >
        {cta}
      </button>
    </div>
  );
}
