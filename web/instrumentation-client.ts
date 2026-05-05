// Sentry browser initialization. Mirrors the server config and only
// activates when NEXT_PUBLIC_SENTRY_DSN is set.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Replay disabled by default to keep bundle weight + privacy footprint low.
    // Flip this on later when we want session replay for high-impact errors.
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    debug: false,
  });
}

// Forward client-side navigation errors. No-op if Sentry isn't initialized.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
