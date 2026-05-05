// POST /api/waitlist
// Captures email + plan interest into a Firestore `waitlist` collection
// while payments are not yet wired. Server-side validation, lightweight
// IP-based rate limiting, deduplication on (email, plan).
//
// Body: { email: string, plan?: "pro" | "premium" | null, source?: string }

import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;

// Per-IP rate limiting bucket. In-memory only; this is best-effort —
// abuse beyond this just falls through to Firestore (which has its own
// quota). Good enough for soft-launch.
const buckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_REQUESTS_PER_WINDOW) {
    buckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  buckets.set(ip, arr);
  return false;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 },
    );
  }

  // Parse + validate
  let body: { email?: string; plan?: string; source?: string };
  try {
    body = (await req.json()) as { email?: string; plan?: string; source?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const plan =
    body.plan === "pro" || body.plan === "premium" ? body.plan : null;
  const source = (body.source ?? "unknown").slice(0, 64);

  // Persist
  const { db } = getAdmin();
  if (!db) {
    // Without Firestore admin we still can't drop the request silently.
    // Log to stdout so Vercel preserves the signup until env is fixed.
    console.error(
      `[waitlist] missing FIREBASE_SERVICE_ACCOUNT_JSON; signup not persisted:`,
      { email, plan, source, ip },
    );
    return NextResponse.json(
      { error: "Waitlist temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    // Dedupe on (email, plan) so refreshing the page or re-submitting
    // doesn't pollute the list.
    const existing = await db
      .collection("waitlist")
      .where("email", "==", email)
      .where("plan", "==", plan)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    await db.collection("waitlist").add({
      email,
      plan,
      source,
      createdAt: new Date().toISOString(),
      ip: ip.slice(0, 64),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    captureServerError(err, { route: "/api/waitlist", extra: { email, plan } });
    return NextResponse.json(
      { error: "Couldn't save your signup. Please try again." },
      { status: 500 },
    );
  }
}
