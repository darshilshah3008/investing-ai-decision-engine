"use client";

// AppShell — the left sidebar + top app bar layout used by every
// authenticated page (dashboard, verdict, watchlist).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  proOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Terminal" },
  { href: "/watchlist", icon: "list_alt", label: "Watchlists" },
  { href: "/compare", icon: "compare_arrows", label: "Compare" },
  { href: "/universe", icon: "public", label: "Universe", proOnly: true },
  { href: "/models", icon: "analytics", label: "Models" },
  { href: "/research", icon: "biotech", label: "Research Labs" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, tier } = useAuth();
  const isPro = tier === "pro";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auto-close the mobile drawer on route change so the new page is visible.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop — visible only when drawer is open below md */}
      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden"
        />
      )}

      {/* Left navigation drawer — fixed on desktop, slide-over on mobile */}
      <aside
        className={
          "fixed left-0 top-0 h-full flex flex-col h-screen w-64 border-r border-[#1F2937] bg-[#131922] z-50 transition-transform duration-200 ease-out md:translate-x-0 " +
          (mobileNavOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <Link href="/" className="p-6 block">
          <span className="text-lg font-bold tracking-tighter text-slate-100 uppercase">
            Decision Engine
          </span>
        </Link>
        <nav className="flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const locked = item.proOnly && !isPro;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "text-indigo-400 font-semibold border-r-2 border-indigo-500 bg-[#1A2230]/50 py-3 px-4 flex items-center gap-3 cursor-pointer"
                    : "text-slate-400 py-3 px-4 flex items-center gap-3 hover:bg-[#1A2230] hover:text-slate-100 transition-colors duration-150 cursor-pointer active:scale-[0.98] transition-transform"
                }
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-sans text-sm tracking-tight font-medium flex-1">{item.label}</span>
                {locked && (
                  <span
                    className="material-symbols-outlined text-[14px] text-slate-600"
                    title="Pro tier only"
                  >
                    lock
                  </span>
                )}
                {item.proOnly && isPro && (
                  <span className="text-[8px] font-bold uppercase tracking-tighter text-secondary bg-secondary/15 px-1 rounded">
                    Pro
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-6 border-t border-[#1F2937]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold overflow-hidden">
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span>{(user?.displayName ?? user?.email ?? "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-100 truncate">
                {user?.displayName ?? user?.email ?? "Guest"}
              </p>
              <p className="text-[10px] text-indigo-400">
                {isPro ? "Pro Plan Active" : "Free Plan"}
              </p>
            </div>
            {user && (
              <button
                aria-label="Sign out"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="material-symbols-outlined text-slate-500 hover:text-slate-100 text-[18px]"
              >
                logout
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500">v2.4.0</p>
        </div>
      </aside>

      {/* Top app bar */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-14 px-4 md:px-6 flex items-center justify-between z-40 bg-[#0A0E14]/80 backdrop-blur-md border-b border-[#1F2937]">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden material-symbols-outlined text-slate-300 hover:text-slate-100"
          >
            menu
          </button>
          <span className="material-symbols-outlined text-indigo-500">memory</span>
          <h1 className="text-sm md:text-base font-black text-slate-50 tracking-tight truncate">
            <span className="hidden sm:inline">Investing AI Decision Engine</span>
            <span className="sm:hidden">Decision Engine</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="hidden sm:inline font-sans text-xs uppercase tracking-widest font-bold text-slate-400">
            Market Open
          </span>
          <a
            href="mailto:darshilshah3008@gmail.com?subject=Decision%20Engine%20feedback"
            className="material-symbols-outlined text-slate-400 hover:text-indigo-400 transition-colors focus:ring-1 focus:ring-indigo-500 outline-none"
            title="Send feedback"
            aria-label="Send feedback"
          >
            forum
          </a>
          <Link
            href="/dashboard"
            className="material-symbols-outlined text-slate-400 hover:text-indigo-400 transition-colors focus:ring-1 focus:ring-indigo-500 outline-none"
            title="Search"
            aria-label="Search"
          >
            search
          </Link>
        </div>
      </header>

      {/* Main canvas */}
      <main className="ml-0 md:ml-64 pb-24 mt-14">{children}</main>
    </>
  );
}
