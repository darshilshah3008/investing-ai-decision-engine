"use client";

// Watchlist index page — lists the current user's watchlists, with a
// "+ New watchlist" button that creates one on the fly.

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/firebase/auth-context";

interface WatchlistEntry {
  id: string;
  name: string;
  tickers: string[];
}

export default function WatchlistIndexPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const [watchlists, setWatchlists] = useState<WatchlistEntry[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch("/api/watchlist", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { watchlists: [] }))
        .then((data: { watchlists: WatchlistEntry[] }) =>
          setWatchlists(data.watchlists ?? []),
        );
    });
  }, [user]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `Watchlist ${watchlists.length + 1}`,
          tickers: [],
        }),
      });
      if (r.ok) {
        const { id } = (await r.json()) as { id: string };
        window.location.href = `/watchlist/${id}`;
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="pt-6 px-8 pb-12 text-on-surface-variant">Loading…</div>
      </AppShell>
    );
  }
  if (configured && !user) {
    return (
      <AppShell>
        <div className="pt-20 px-8 pb-12 max-w-md mx-auto text-center">
          <h1 className="font-h1 text-h1 mb-4">Sign in to manage watchlists</h1>
          <button
            onClick={() => signInWithGoogle().catch((e) => alert(String(e)))}
            className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-caps hover:brightness-110"
          >
            Sign in with Google
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pt-6 px-8 pb-12 max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="font-label-caps text-label-caps text-indigo-400 mb-1 block">
              SAVED WATCHLISTS
            </span>
            <h1 className="font-h1 text-h1 text-slate-50">Your Watchlists</h1>
          </div>
          <button
            onClick={create}
            disabled={creating}
            className="bg-primary text-on-primary px-4 py-2 flex items-center gap-2 font-body-md font-semibold hover:opacity-90 active:scale-[0.98] transition-all rounded-lg disabled:opacity-50"
          >
            <span className="material-symbols-outlined">add</span>
            {creating ? "Creating…" : "New watchlist"}
          </button>
        </div>

        {watchlists.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-4xl block mb-3">
              list_alt
            </span>
            <p className="text-on-surface-variant text-sm mb-4">
              No watchlists yet. Create one to group stocks you want to track over time.
            </p>
            <button
              onClick={create}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-caps hover:brightness-110"
            >
              Create your first watchlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {watchlists.map((wl) => (
              <Link
                href={`/watchlist/${wl.id}`}
                key={wl.id}
                className="bg-surface-container border border-outline-variant p-5 rounded-xl hover:border-indigo-500/50 transition-colors"
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-h2 text-h2 text-slate-100">{wl.name}</h3>
                  <span className="text-xs font-data-md text-secondary">
                    {wl.tickers.length} assets
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wl.tickers.length === 0 ? (
                    <span className="text-xs text-on-surface-variant italic">
                      Empty — open to add stocks
                    </span>
                  ) : (
                    wl.tickers.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-data-sm bg-surface-container-highest px-2 py-1 rounded border border-outline-variant text-slate-300"
                      >
                        {t}
                      </span>
                    ))
                  )}
                  {wl.tickers.length > 6 && (
                    <span className="text-[11px] font-data-sm bg-surface-container-highest px-2 py-1 rounded border border-outline-variant text-slate-300">
                      +{wl.tickers.length - 6}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
