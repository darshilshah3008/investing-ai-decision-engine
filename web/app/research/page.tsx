"use client";

// /research — experimental features under development. Stub.

import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function ResearchPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="biotech"
        tagline="Research Labs"
        title="Experimental tools, exposed early"
        description="Research Labs is where new analytical features ship for early feedback before becoming core. Expect rough edges and breakages here in exchange for first-look access to ideas we're still validating."
        bullets={[
          "Sector-relative valuation — see if a stock is cheap vs. its sector median, not just absolute thresholds",
          "Engine fair-price band — Conservative / Base / Aggressive bands derived from FCF Yield + Graham math",
          "Quarterly earnings drift — track how each model's score for a holding has moved across the last 8 quarters",
          "Custom screening — build your own filter across the 500+ ticker universe",
        ]}
        primaryCta={{ label: "Back to Terminal", href: "/dashboard" }}
      />
    </AppShell>
  );
}
