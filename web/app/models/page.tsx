"use client";

// /models — overview of the 9 fundamental models. Stub for now; the
// methodology page already covers the math, so this page links there
// while a richer per-model UI is under construction.

import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function ModelsPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="analytics"
        tagline="Models"
        title="Per-model dashboards are on the way"
        description="A dedicated workspace for exploring each of the 9 fundamental models — backtest curves, distribution of scores across the universe, and the ability to dial individual model weights for your own scoring profile. For now, the full math behind every model lives on the Methodology page, and you can see scores in action on any verdict screen."
        bullets={[
          "Score-distribution histograms for each model across the 500+ tracked tickers",
          "Per-model backtest curves vs. S&P 500 (rolling 5-year)",
          "Custom weights — promote or demote a pillar to match your investing style",
          "Drill-down: see which tickers each model is most positive / negative on",
        ]}
        primaryCta={{ label: "Read the methodology", href: "/methodology" }}
      />
    </AppShell>
  );
}
