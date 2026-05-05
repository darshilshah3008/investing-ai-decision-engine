// Thin wrapper over Sentry so calls in route handlers don't have to
// import @sentry/nextjs everywhere. Falls back to console-only when
// Sentry isn't configured (no DSN), which is the default for local dev
// and the soft-launch period.

import * as Sentry from "@sentry/nextjs";

const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export function captureServerError(
  error: unknown,
  context?: { route?: string; extra?: Record<string, unknown> },
): void {
  // Always log to stdout — Vercel preserves this for the function-log
  // window, which is enough during the soft launch.
  const tag = context?.route ? `[${context.route}]` : "";
  console.error(`${tag} captured error:`, error, context?.extra ?? "");

  if (!sentryEnabled) return;
  try {
    Sentry.captureException(error, {
      tags: { route: context?.route ?? "unknown" },
      extra: context?.extra,
    });
  } catch {
    // never let observability take down the request
  }
}
