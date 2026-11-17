"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, User, UserPlus } from "lucide-react";
import { initialsOf, useAuthStore } from "@/tools/auth/auth-store";

/** Log in / Sign up buttons, or the user's avatar menu once logged in. */
export function AuthHeaderControl({ compact = false }: { compact?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const openAuth = useAuthStore((state) => state.openAuth);
  const logout = useAuthStore((state) => state.logout);
  const ready = useAuthStore((state) => state.ready);

  // Open signup automatically for referral links (?ref=CODE)
  useEffect(() => {
    if (!ready || user || compact) return;
    if (new URLSearchParams(window.location.search).get("ref")) openAuth("signup");
  }, [compact, openAuth, ready, user]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  if (!ready) return <span className={compact ? "h-8 w-8" : "h-9 w-40"} aria-hidden="true" />;

  if (!user) {
    if (compact) return <button type="button" onClick={() => openAuth("login")} aria-label="Log in" className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 text-xs font-semibold text-white shadow-sm"><LogIn className="h-4 w-4" />Log in</button>;
    return <div className="flex items-center gap-2">
      <button type="button" onClick={() => openAuth("login")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-700 transition hover:bg-white/80 dark:text-slate-200 dark:hover:bg-slate-800"><LogIn className="h-4 w-4" />Log in</button>
      <button type="button" onClick={() => openAuth("signup")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 px-4 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110"><UserPlus className="h-4 w-4" />Sign up free</button>
    </div>;
  }

  return <div ref={menuRef} className="relative">
    <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} title={user.name} className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition hover:bg-white/80 dark:hover:bg-slate-800">
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-xs font-bold text-white shadow-sm">
        {initialsOf(user.name)}<span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
      </span>
      {!compact && <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition ${menuOpen ? "rotate-180" : ""}`} />}
    </button>
    {menuOpen && <div role="menu" className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
      </div>
      <div className="p-1.5">
        <MenuLink href="/app/card-dashboard?tab=profile" icon={<User />} onClick={() => setMenuOpen(false)}>My Profile</MenuLink>
        <MenuLink href="/app/card-dashboard" icon={<LayoutDashboard />} onClick={() => setMenuOpen(false)}>Card Dashboard</MenuLink>
        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void logout(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><LogOut className="h-4 w-4" />Log out</button>
      </div>
    </div>}
  </div>;
}

function MenuLink({ href, icon, onClick, children }: { href: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return <Link href={href} role="menuitem" onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-slate-400">{icon}{children}</Link>;
}
