"use client";

// Pricing page — honest two-tier layout (Free + Pro) with an explicit
// "Coming soon" roadmap. Free tier lists everything actually built and
// open today; Pro tier lists only what's truly tier-gated. Aspirational
// features go under Roadmap, never inside a tier card.

import Link from "next/link";
import { useState } from "react";
import { PublicFooter } from "@/components/public-footer";
import { WaitlistDialog } from "@/components/waitlist-dialog";

// ---- Plans -----------------------------------------------------------
// These reflect ACTUAL gated state of the codebase as of this commit.
// Free = anything not behind a `tier === "pro"` check anywhere in the app.
// Pro  = the two features that are truly Pro-gated server + client side.
// ---------------------------------------------------------------------

interface Plan {
  key: "free" | "pro";
  name: string;
  price: string;
  priceNote: string;
  cta: string;
  highlight: boolean;
  description: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: "free",
    name: "FREE",
    price: "$0",
    priceNote: "/forever during beta",
    cta: "Get started",
    highlight: false,
    description: "Everything you need to run the engine on any US-listed stock.",
    features: [
      "Unlimited stock lookups",
      "All 9 fundamental models across 4 pillars",
      "Sector-relative percentile rankings",
      "Source filing links — every score traces to a 10-K",
      "Catalysts, risks, sensitivity analysis",
      "News headlines (Google News)",
      "Watchlists with cost-basis P&L",
      "Dividend income forecast",
      "Compare tool (2–4 tickers side-by-side)",
      "Public methodology, fully audited",
    ],
  },
  {
    key: "pro",
    name: "PRO",
    price: "$15",
    priceNote: "/mo (when launched)",
    cta: "Join Pro waitlist",
    highlight: true,
    description: "Adds research scale and an AI assistant grounded in your portfolio.",
    features: [
      "Everything in Free, plus:",
      "SEC Universe — 358-stock filterable table (sector, cap, sortable, CSV export)",
      "AI chat assistant grounded in your actual portfolio data",
      "Founding-member pricing locked for life",
      "Early access to Roadmap features as they ship",
    ],
  },
];

// Honest roadmap — each item links to what would unlock it in product terms
// once paid plans are live. Not promised, not dated.
const ROADMAP = [
  {
    icon: "schedule",
    title: "Email alerts on verdict flips",
    body: "When a stock you watch flips BUY → HOLD → SELL after a new filing, you'll know.",
  },
  {
    icon: "picture_as_pdf",
    title: "PDF report export",
    body: "Download the verdict screen as an audit-ready PDF for your research files.",
  },
  {
    icon: "tune",
    title: "Custom pillar weights",
    body: "Backend already accepts custom weights — we'll add a UI so you can express your style (e.g., dial Quality up, Valuation down).",
  },
  {
    icon: "account_balance",
    title: "Sector-aware models",
    body: "Banks, REITs, and utilities don't fit Piotroski + ROIC + D/E. Sector-specific scoring on the way.",
  },
  {
    icon: "show_chart",
    title: "Backtest dashboard",
    body: "Published 5-year hit rate per pillar and per verdict bucket. Honest numbers, even if mediocre.",
  },
  {
    icon: "monitoring",
    title: "Income calendar",
    body: "Per-month dividend payment forecast across your watchlist + safety scoring per position.",
  },
];

export default function PricingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <>
      {/* Top nav — desktop full nav, mobile single CTA */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-[#0A0E14]/80 backdrop-blur-md border-b border-[#1F2937] z-50 px-4 md:px-gutter flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">memory</span>
          <span className="text-sm md:text-base font-black text-slate-50 tracking-tight">
            INVESTING AI
          </span>
        </Link>

        {/* Mobile-only: methodology icon + Try free */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            href="/methodology"
            className="material-symbols-outlined text-slate-400 hover:text-primary"
            aria-label="Methodology"
            title="Methodology"
          >
            menu_book
          </Link>
          <Link
            href="/dashboard"
            className="bg-primary text-on-primary px-3 py-1.5 font-sans text-[11px] uppercase tracking-widest font-bold rounded-sm active:scale-95 transition-transform"
          >
            Try free
          </Link>
        </div>

        {/* Desktop / tablet (md+): full nav */}
        <div className="hidden md:flex items-center gap-lg">
          <Link
            href="/pricing"
            className="text-primary font-sans text-xs uppercase tracking-widest font-bold"
          >
            Pricing
          </Link>
          <Link
            href="/methodology"
            className="text-slate-400 font-sans text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
          >
            Methodology
          </Link>
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

      <main className="pt-24 md:pt-32 pb-16 md:pb-24 px-4 md:px-gutter container mx-auto">
        {/* Hero */}
        <div className="text-center mb-10 md:mb-xl">
          <h1 className="text-3xl md:text-display-lg font-display-lg text-on-surface mb-3 md:mb-4">
            Free during public beta
          </h1>
          <p className="text-sm md:text-base font-body-md text-on-surface-variant max-w-xl mx-auto px-2 leading-relaxed">
            The full engine — every model, every traceable score, watchlists, dividend
            forecast — is free today. Pro adds Universe + AI assistant when paid plans
            launch. Founding-member pricing for everyone on the waitlist.
          </p>

          {/* Beta banner */}
          <div className="inline-flex items-start sm:items-center gap-2 mt-5 md:mt-6 px-3 md:px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-[11px] md:text-xs text-on-surface text-left max-w-xl">
            <span className="w-1.5 h-1.5 mt-1 sm:mt-0 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span>
              <strong className="text-primary">Public beta</strong> — paid plans not live
              yet. Free tier is fully open. Roadmap below shows what Pro will unlock.
            </span>
          </div>
        </div>

        {/* Plan cards — 2 tiers, stack on mobile + tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-lg max-w-md md:max-w-2xl lg:max-w-5xl mx-auto">
          {PLANS.map((p) => {
            const ctaInner = (
              <span
                className={
                  "block w-full py-3 text-center rounded-lg font-label-caps transition-colors " +
                  (p.highlight
                    ? "bg-primary text-on-primary hover:brightness-110"
                    : "border border-outline-variant hover:bg-surface-container")
                }
              >
                {p.cta.toUpperCase()}
              </span>
            );

            return (
              <div
                key={p.key}
                className={
                  "p-6 md:p-lg rounded-xl flex flex-col relative " +
                  (p.highlight
                    ? "bg-surface-container border-2 border-primary lg:scale-[1.02] shadow-2xl"
                    : "bg-surface-container-low border border-outline-variant")
                }
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-3 py-1 rounded-full font-label-caps text-[10px] whitespace-nowrap">
                    COMING SOON
                  </div>
                )}
                <span
                  className={
                    "font-label-caps mb-2 " +
                    (p.highlight ? "text-primary" : "text-on-surface-variant")
                  }
                >
                  {p.name}
                </span>
                <div className="mb-2">
                  <span className="font-display-lg text-display-lg">{p.price}</span>{" "}
                  <span className="text-xs font-body-sm text-on-surface-variant">
                    {p.priceNote}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-6">{p.description}</p>
                <ul className="space-y-2.5 mb-8 flex-grow">
                  {p.features.map((f, i) => (
                    <li
                      key={i}
                      className={
                        "flex items-start gap-2 text-sm " +
                        (p.highlight
                          ? "text-on-surface font-medium"
                          : "text-on-surface-variant")
                      }
                    >
                      <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0 text-secondary">
                        check_circle
                      </span>
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                {p.key === "free" ? (
                  <Link href="/dashboard">{ctaInner}</Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWaitlistOpen(true)}
                    className="w-full"
                  >
                    {ctaInner}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Roadmap — honest about what's not built */}
        <section className="mt-16 md:mt-24 max-w-5xl mx-auto">
          <div className="text-center mb-8 md:mb-10 max-w-3xl mx-auto px-2">
            <span className="font-label-caps text-on-surface-variant uppercase tracking-[0.15em] text-[10px] md:text-xs mb-2 block">
              Roadmap
            </span>
            <h2 className="text-2xl md:text-h2 font-h2 text-on-surface mb-2">
              What Pro will unlock
            </h2>
            <p className="text-sm md:text-body-sm text-on-surface-variant leading-relaxed">
              Honest list of what isn&apos;t built yet. No specific dates — paid plans launch
              when these are real, not before. Waitlist members get early access as each
              one ships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {ROADMAP.map((r) => (
              <div
                key={r.title}
                className="p-5 md:p-6 bg-surface-container-low border border-outline-variant rounded-xl flex gap-4"
              >
                <span className="material-symbols-outlined text-primary text-[24px] flex-shrink-0 mt-0.5">
                  {r.icon}
                </span>
                <div>
                  <h3 className="font-h2 text-base text-on-surface mb-1">{r.title}</h3>
                  <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
                    {r.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <div className="mt-16 md:mt-xl pt-10 md:pt-xl border-t border-outline-variant text-center max-w-3xl mx-auto px-2">
          <p className="font-label-caps text-on-surface-variant text-[11px] md:text-xs leading-relaxed">
            Filings sourced directly from{" "}
            <a
              href="https://www.sec.gov/edgar"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              SEC EDGAR
            </a>{" "}
            — free, public, audit-ready. Not investment advice.
          </p>
        </div>
      </main>
      <PublicFooter />

      <WaitlistDialog
        open={waitlistOpen}
        plan="pro"
        source="pricing"
        onClose={() => setWaitlistOpen(false)}
      />
    </>
  );
}
