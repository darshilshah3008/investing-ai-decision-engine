"use client";

// ComingSoon — placeholder content for routes that exist in the sidebar
// nav but aren't built yet. Keeps the feel of a complete product while
// being honest that the feature is upcoming.

import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  icon: string;
  title: string;
  tagline: string;
  description: string;
  bullets?: string[];
  primaryCta?: { label: string; href: string };
  children?: ReactNode;
}

export function ComingSoon({
  icon,
  title,
  tagline,
  description,
  bullets,
  primaryCta,
  children,
}: Props) {
  return (
    <div className="pt-12 px-6 md:px-8 pb-16 max-w-3xl mx-auto">
      <div className="text-center">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/30 mb-4">
          <span className="material-symbols-outlined text-primary text-[28px]">
            {icon}
          </span>
        </span>
        <span className="block font-label-caps text-on-surface-variant uppercase tracking-[0.15em] mb-2">
          {tagline}
        </span>
        <h1 className="font-h1 text-h1 mb-3">{title}</h1>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-xl mx-auto mb-8">
          {description}
        </p>
      </div>

      {bullets && bullets.length > 0 && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-6 max-w-xl mx-auto mb-8">
          <p className="font-label-caps text-on-surface-variant uppercase tracking-wider text-[10px] mb-3">
            What&apos;s coming
          </p>
          <ul className="space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">
                  check_circle
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-center">
        {primaryCta && (
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps hover:brightness-110"
          >
            {primaryCta.label}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        )}
      </div>

      {children && <div className="mt-10">{children}</div>}
    </div>
  );
}
