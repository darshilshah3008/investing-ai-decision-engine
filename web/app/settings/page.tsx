"use client";

// /settings — basic account view. Functional minimum: see your email +
// tier, sign out, request account deletion, send feedback. Subscription
// management (cancel, change card, etc.) lives here once payments ship.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/firebase/auth-context";

const SUPPORT_EMAIL = "darshilshah3008@gmail.com";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, tier, loading, configured } = useAuth();
  const isPro = tier === "pro";

  if (loading) {
    return (
      <AppShell>
        <div className="pt-20 px-8 text-on-surface-variant">Loading…</div>
      </AppShell>
    );
  }

  if (configured && !user) {
    return (
      <AppShell>
        <div className="pt-20 px-8 text-on-surface-variant max-w-xl mx-auto text-center">
          <p className="mb-4">Sign in to manage your account.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps hover:brightness-110"
          >
            Go to sign in
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-10 px-6 md:px-8 pb-16 max-w-2xl mx-auto">
        <div className="mb-8">
          <span className="block font-label-caps text-on-surface-variant uppercase tracking-[0.15em] mb-2">
            Settings
          </span>
          <h1 className="font-h1 text-h1">Account</h1>
        </div>

        {/* Account info */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-5 mb-5">
          <h2 className="font-label-caps text-on-surface-variant uppercase tracking-wider text-[10px] mb-3">
            Profile
          </h2>
          <div className="space-y-3">
            <Row
              label="Display name"
              value={user?.displayName ?? "—"}
            />
            <Row
              label="Email"
              value={user?.email ?? "—"}
            />
            <Row
              label="Plan"
              value={
                <span
                  className={
                    "inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase " +
                    (isPro
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-surface-container-highest text-on-surface-variant border border-outline-variant")
                  }
                >
                  {isPro ? "Pro" : "Free"}
                </span>
              }
            />
          </div>
        </section>

        {/* Subscription / upgrade */}
        {!isPro && (
          <section className="bg-surface-container border border-primary/30 rounded-xl p-5 mb-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
                workspace_premium
              </span>
              <div className="flex-1">
                <h2 className="font-h2 text-base mb-1">Upgrade coming soon</h2>
                <p className="text-sm text-on-surface-variant mb-3">
                  Pro plan is launching shortly with the chat assistant, the full
                  Universe view, weekly auto-runs, and PDF exports. Join the
                  waitlist on the pricing page to get early access.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-caps text-xs hover:brightness-110"
                >
                  See plans
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Help + feedback */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-5 mb-5">
          <h2 className="font-label-caps text-on-surface-variant uppercase tracking-wider text-[10px] mb-3">
            Help & feedback
          </h2>
          <div className="space-y-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Decision Engine feedback")}`}
              className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                  forum
                </span>
                <span className="text-sm">Send feedback</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[14px] group-hover:text-primary">
                open_in_new
              </span>
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Bug report")}`}
              className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                  bug_report
                </span>
                <span className="text-sm">Report a bug</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[14px] group-hover:text-primary">
                open_in_new
              </span>
            </a>
            <Link
              href="/methodology"
              className="flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                  menu_book
                </span>
                <span className="text-sm">Read the methodology</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[14px] group-hover:text-primary">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>

        {/* Account actions */}
        <section className="bg-surface-container border border-outline-variant rounded-xl p-5 mb-5">
          <h2 className="font-label-caps text-on-surface-variant uppercase tracking-wider text-[10px] mb-3">
            Account
          </h2>
          <div className="space-y-2">
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="flex items-center gap-3 w-full text-left py-2 px-3 -mx-3 rounded hover:bg-surface-container-high transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                logout
              </span>
              Sign out
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Account deletion request")}&body=${encodeURIComponent("Please delete the account and all associated data for this email address.")}`}
              className="flex items-center gap-3 w-full text-left py-2 px-3 -mx-3 rounded hover:bg-surface-container-high transition-colors text-sm text-tertiary"
            >
              <span className="material-symbols-outlined text-tertiary text-[18px]">
                delete_forever
              </span>
              Request account deletion
            </a>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
            Self-serve subscription management arrives with payments. Until
            then, account deletion goes through email and is processed within
            7 days.
          </p>
        </section>

        <p className="text-[10px] text-on-surface-variant text-center">
          v2.4.0 · Engine v5
        </p>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="text-sm text-on-surface text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
