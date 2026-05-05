"use client";

// WaitlistDialog — modal that captures an email + plan interest and POSTs
// to /api/waitlist. Used from the pricing page CTAs while payments are
// not yet wired.

import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  plan: "pro" | "premium" | null;
  source: string;
  onClose: () => void;
}

export function WaitlistDialog({ open, plan, source, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset form whenever dialog opens.
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setSubmitting(false);
    setDone(false);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const planLabel =
    plan === "pro" ? "Pro" : plan === "premium" ? "Premium" : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan, source }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          (data && data.error) || `Couldn't sign up (HTTP ${r.status}).`,
        );
      }
      setDone(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-24 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Join the waitlist"
    >
      <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <span className="font-label-caps text-on-surface-variant uppercase tracking-[0.1em]">
              {planLabel ? `${planLabel} waitlist` : "Waitlist"}
            </span>
            <button
              aria-label="Close"
              onClick={onClose}
              className="material-symbols-outlined text-on-surface-variant hover:text-on-surface"
            >
              close
            </button>
          </div>
          <h2 className="font-h1 text-h1 tracking-tight mb-2">
            {done ? "You're on the list." : "Get early access"}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {done
              ? "We'll email you the moment paid plans go live, and offer founding-member pricing for everyone on this list."
              : `Paid plans are launching shortly. Drop your email and we'll let you know the moment ${planLabel ?? "Pro"} goes live — with founding-member pricing for everyone on the list.`}
          </p>
        </div>

        {!done ? (
          <form onSubmit={submit} className="px-6 py-5">
            <label htmlFor="waitlist-email" className="block text-xs text-on-surface-variant mb-1.5">
              Email
            </label>
            <input
              ref={inputRef}
              id="waitlist-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary disabled:opacity-50"
            />
            {error && (
              <div className="mt-3 bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs px-3 py-2 rounded">
                {error}
              </div>
            )}
            <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
              We&apos;ll only use your email to notify you about launch and send one
              onboarding note. No marketing spam.
            </p>
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="mt-5 w-full bg-primary text-on-primary py-2.5 rounded-lg font-label-caps disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              {submitting ? "Submitting…" : "Join the waitlist"}
            </button>
          </form>
        ) : (
          <div className="px-6 py-6 text-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/15 border border-secondary/30 mb-3">
              <span className="material-symbols-outlined text-secondary text-[24px]">
                check_circle
              </span>
            </span>
            <button
              onClick={onClose}
              className="block w-full mt-2 border border-outline-variant rounded-lg py-2.5 text-sm hover:bg-surface-container-high"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
