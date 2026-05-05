"use client";

// Pricing page — adapted from Stitch screen (5) HTML.
// Pure marketing surface. Free tier links to /dashboard for sign-in.
// Paid tiers (Pro / Premium) open the waitlist dialog while payments
// are not yet wired.

import Link from "next/link";
import { useState } from "react";
import { PublicFooter } from "@/components/public-footer";
import { WaitlistDialog } from "@/components/waitlist-dialog";

type PlanKey = "free" | "pro" | "premium";

const PLANS: Array<{
  key: PlanKey;
  name: string;
  price: string;
  cta: string;
  highlight: boolean;
  features: { label: string; included: boolean }[];
}> = [
  {
    key: "free",
    name: "EXPLORER",
    price: "$0",
    cta: "Get started",
    highlight: false,
    features: [
      { label: "5 stock lookups / day", included: true },
      { label: "Revenue + EPS trend model", included: true },
      { label: "Graham Number model", included: true },
      { label: "Piotroski-Lite F-Score", included: true },
      { label: "Watchlists", included: false },
      { label: "Verdict caching", included: false },
      { label: "Daily auto-rerun", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    key: "pro",
    name: "PROFESSIONAL",
    price: "$15",
    cta: "Join Pro waitlist",
    highlight: true,
    features: [
      { label: "Unlimited stock lookups", included: true },
      { label: "All 9 fundamental models", included: true },
      { label: "Verdict caching (24h)", included: true },
      { label: "Custom scoring weights", included: true },
      { label: "5 watchlists", included: true },
      { label: "Weekly auto-rerun + email alerts", included: true },
      { label: "Downloadable PDF reports", included: true },
      { label: "API access", included: false },
    ],
  },
  {
    key: "premium",
    name: "INSTITUTIONAL",
    price: "$30",
    cta: "Join Premium waitlist",
    highlight: false,
    features: [
      { label: "Pro features +", included: true },
      { label: "Daily auto-rerun across all watchlists", included: true },
      { label: "API access (60 req/min)", included: true },
      { label: "Priority support", included: true },
      { label: "Multi-market when available", included: true },
      { label: "Custom model tuning", included: true },
      { label: "Real-time prices", included: true },
      { label: "Dedicated success manager", included: true },
    ],
  },
];

export default function PricingPage() {
  const [waitlistPlan, setWaitlistPlan] = useState<"pro" | "premium" | null>(null);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-14 bg-[#0A0E14]/80 backdrop-blur-md border-b border-[#1F2937] z-50 px-gutter flex items-center justify-between">
        <Link href="/" className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">memory</span>
          <span className="text-base font-black text-slate-50 tracking-tight">INVESTING AI</span>
        </Link>
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

      <main className="pt-32 pb-24 px-gutter container mx-auto">
        <div className="text-center mb-xl">
          <h1 className="text-display-lg font-display-lg text-on-surface mb-4">Pricing</h1>
          <p className="font-body-md text-on-surface-variant max-w-xl mx-auto">
            Pay only when the math helps you. Cancel any time. Each tier ships with the full
            audit trail — the math is never paywalled.
          </p>
          {/* Beta banner — paid plans not live yet */}
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-xs text-on-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>
              <strong className="text-primary">Public beta</strong> — paid plans launching soon.
              Free tier is open today; join the waitlist for founding-member pricing.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg max-w-6xl mx-auto">
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
                key={p.name}
                className={
                  "p-lg rounded-xl flex flex-col relative " +
                  (p.highlight
                    ? "bg-surface-container border-2 border-primary scale-105 shadow-2xl"
                    : "bg-surface-container-low border border-outline-variant")
                }
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-3 py-1 rounded-full font-label-caps text-[10px]">
                    MOST POPULAR
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
                <div className="font-display-lg text-display-lg mb-md">
                  {p.price}{" "}
                  <span className="text-xs font-body-sm text-on-surface-variant">/mo</span>
                </div>
                <ul className="space-y-sm mb-xl flex-grow">
                  {p.features.map((f, i) => (
                    <li
                      key={i}
                      className={
                        "flex items-center gap-2 text-sm " +
                        (f.included
                          ? p.highlight
                            ? "text-on-surface font-medium"
                            : "text-on-surface-variant"
                          : "text-on-surface-variant opacity-50")
                      }
                    >
                      <span
                        className={
                          "material-symbols-outlined text-[16px] " +
                          (f.included ? "text-secondary" : "text-on-surface-variant")
                        }
                      >
                        {f.included ? "check_circle" : "cancel"}
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>

                {p.key === "free" ? (
                  <Link href="/dashboard">{ctaInner}</Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWaitlistPlan(p.key as "pro" | "premium")}
                    className="w-full"
                  >
                    {ctaInner}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison heading */}
        <div className="mt-xl text-center max-w-3xl mx-auto">
          <h2 className="text-h2 font-h2 text-on-surface mb-2">Engine Capability Comparison</h2>
          <p className="text-body-sm text-on-surface-variant">
            All tiers ship with the same source of truth — every number traced to its 10-K
            accession number on SEC EDGAR. Higher tiers add scale, automation, and access.
          </p>
        </div>

        {/* Trust strip */}
        <div className="mt-xl pt-xl border-t border-outline-variant text-center">
          <p className="font-label-caps text-on-surface-variant text-xs">
            Filings sourced directly from{" "}
            <a
              href="https://www.sec.gov/edgar"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              SEC EDGAR
            </a>
            {" "}— free, public, audit-ready. Not investment advice.
          </p>
        </div>
      </main>
      <PublicFooter />

      <WaitlistDialog
        open={waitlistPlan !== null}
        plan={waitlistPlan}
        source="pricing"
        onClose={() => setWaitlistPlan(null)}
      />
    </>
  );
}
