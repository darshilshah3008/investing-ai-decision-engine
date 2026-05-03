"use client";

// Auth context for client components. Wraps Firebase Auth with React
// state so any component can call `useAuth()` to get the current user.

import {
  type User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getFirebase } from "./client";

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  configured: false,
  async signInWithGoogle() {},
  async signOut() {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth } = getFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = !!auth;

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, [auth]);

  const value = useMemo<AuthState>(() => {
    return {
      user,
      loading,
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
  }, [user, loading, configured, auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
