// GET /api/me
// Returns the current user's profile + tier. Auto-creates the
// users/{uid} doc on first call (idempotent — safe to call repeatedly).
//
// Auth required. Send the Firebase ID token in the Authorization header.

import { verifyAuth } from "@/lib/firebase/admin";
import { ensureUserDoc } from "@/lib/firebase/users";
import { getAdmin } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Pull email/displayName/photoURL from the auth record so we can
  // populate the users doc without trusting client-supplied values.
  const { auth } = getAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Firebase admin not configured" }, { status: 500 });
  }

  try {
    const userRecord = await auth.getUser(uid);
    const userDoc = await ensureUserDoc({
      uid,
      email: userRecord.email ?? null,
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
    });
    return NextResponse.json({ user: userDoc });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
