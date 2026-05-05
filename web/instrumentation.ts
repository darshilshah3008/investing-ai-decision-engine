// Sentry server + edge initialization. Activated when
// NEXT_PUBLIC_SENTRY_DSN is set in the environment; otherwise no-op so
// local dev and the soft-launch period both work without a Sentry account.
//
// To turn it on: create a free Sentry project, paste its DSN into
// NEXT_PUBLIC_SENTRY_DSN in Vercel env vars, and redeploy.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      // Conservative sample rate for the soft launch — enough to catch
      // patterns without burning the free-tier quota.
      tracesSampleRate: 0.1,
      // Don't ship debug breadcrumbs from console in production.
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      debug: false,
    });
  }
}

// Forward Next.js request errors to Sentry. No-op if Sentry isn't initialized.
export const onRequestError = Sentry.captureRequestError;
