// Per-user document helpers. Stores the user's subscription tier and
// any other future per-user state.
//
// Schema:
//   users/{uid}: {
//     email: string,
//     displayName?: string,
//     photoURL?: string,
//     tier: "free" | "pro",
//     createdAt: number,
//     lastLoginAt: number,
//   }

import { getAdmin } from "./admin";

export type UserTier = "free" | "pro";

export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  createdAt: number;
  lastLoginAt: number;
}

/**
 * Idempotently ensure a `users/{uid}` doc exists. Called on every sign-in.
 * Defaults new users to the "free" tier. Won't downgrade an existing pro user.
 */
export async function ensureUserDoc(args: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserDoc> {
  const { db } = getAdmin();
  if (!db) throw new Error("Firebase admin not configured");
  const ref = db.collection("users").doc(args.uid);
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    const newDoc: Omit<UserDoc, "uid"> = {
      email: args.email,
      displayName: args.displayName,
      photoURL: args.photoURL,
      tier: "free",
      createdAt: now,
      lastLoginAt: now,
    };
    await ref.set(newDoc);
    return { uid: args.uid, ...newDoc };
  }

  // Existing user — refresh display fields + lastLoginAt, preserve tier
  const existing = snap.data() as Omit<UserDoc, "uid">;
  await ref.update({
    email: args.email ?? existing.email,
    displayName: args.displayName ?? existing.displayName,
    photoURL: args.photoURL ?? existing.photoURL,
    lastLoginAt: now,
  });
  return {
    uid: args.uid,
    ...existing,
    lastLoginAt: now,
  };
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const { db } = getAdmin();
  if (!db) return null;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return { uid, ...(snap.data() as Omit<UserDoc, "uid">) };
}

export async function getUserTier(uid: string): Promise<UserTier> {
  const doc = await getUserDoc(uid);
  return doc?.tier ?? "free";
}
