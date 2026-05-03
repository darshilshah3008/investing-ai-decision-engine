"use client";

// Auth context for client components. Wraps Firebase Auth with React
// state so any component can call `useAuth()` to get the current user
// and their subscription tier.

import {
  type User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFirebase } from "./client";
import type { UserTier } from "./users";

interface AuthState {
  user: User | null;
  loading: boolean;
  tier: UserTier;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  tier: "free",
  configured: false,
  async signInWithGoogle() {},
  async signOut() {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth } = getFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<UserTier>("free");
  const [loading, setLoading] = useState(true);
  const configured = !!auth;

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Hit /api/me with the user's ID token. This auto-creates their
        // users/{uid} doc on first sign-in and returns the tier.
        try {
          const token = await u.getIdToken();
          const resp = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const data = (await resp.json()) as { user: { tier: UserTier } };
            setTier(data.user.tier);
          }
        } catch {
          /* keep default 'free' */
        }
      } else {
        setTier("free");
      }
    });
  }, [auth]);

  const value = useMemo<AuthState>(() => {
    return {
      user,
      loading,
      tier,
      configured,
      async signInWithGoogle() {
        if (!auth) {
          throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
        }
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      },
      async signOut() {
        if (auth) await fbSignOut(auth);
      },
    };
  }, [user, loading, tier, configured, auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
