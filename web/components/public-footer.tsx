// Footer used on all public marketing-style pages.

import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="py-12 border-t border-[#1F2937] px-gutter">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start gap-lg mb-8">
          <div className="flex flex-col gap-2 max-w-md">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary">memory</span>
              <span className="text-base font-black text-slate-50 tracking-tight">
                INVESTING AI
              </span>
            </div>
            <p className="font-label-caps text-on-surface-variant text-[10px]">
              RESEARCH, NOT ADVICE.
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-2">
              This is decision-support software. Verdicts are deterministic
              computations over public SEC filings — not personalized advice.
              Past performance doesn't predict future results. Read the
              methodology before relying on any output.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12 text-xs">
            <div className="flex flex-col gap-2">
              <p className="font-label-caps text-on-surface mb-1">PRODUCT</p>
              <Link href="/dashboard" className="text-on-surface-variant hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/universe" className="text-on-surface-variant hover:text-primary transition-colors">
                Universe
              </Link>
              <Link href="/pricing" className="text-on-surface-variant hover:text-primary transition-colors">
                Pricing
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-label-caps text-on-surface mb-1">RESOURCES</p>
              <Link href="/methodology" className="text-on-surface-variant hover:text-primary transition-colors">
                Methodology
              </Link>
              <a
                href="https://www.sec.gov/edgar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
              >
                SEC EDGAR
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </a>
              <a
                href="https://github.com/darshilshah3008/investing-ai-decision-engine"
                target="_blank"
                rel="noopener noreferrer"
                className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
              >
                GitHub
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1F2937] pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[10px] text-on-surface-variant">
          <p className="leading-relaxed max-w-3xl">
            <strong className="text-on-surface">Disclaimer:</strong> Nothing on this site
            constitutes financial, investment, tax, or legal advice. The engine output is
            for educational and research purposes only. Markets carry risk. Consult a
            licensed advisor before making investment decisions. We are not registered as
            investment advisors with the SEC or any state regulator.
          </p>
          <p className="font-data-sm whitespace-nowrap">
            © 2026 · Engine v5
          </p>
        </div>
      </div>
    </footer>
  );
}
