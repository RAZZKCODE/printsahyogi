"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Boxes, CreditCard, Gift, LayoutDashboard, LifeBuoy, LoaderCircle, LogIn, Megaphone, Menu,
  Moon, ScrollText, Settings, ShieldAlert, ShieldCheck, Sun, Users, Wrench, X
} from "lucide-react";
import { useTheme } from "next-themes";
import { getSupabase } from "@/lib/supabase/client";
import { initialsOf, useAuthStore } from "@/tools/auth/auth-store";
import type { Role } from "@/tools/admin/admin-api";
import { Button, ToastProvider } from "@/components/admin/admin-ui";
import { OverviewSection } from "@/components/admin/sections/overview";
import { UsersSection } from "@/components/admin/sections/users";
import { PaymentsSection } from "@/components/admin/sections/payments";
import { CatalogSection } from "@/components/admin/sections/catalog";
import { ToolsSection } from "@/components/admin/sections/tools";
import { SupportSection } from "@/components/admin/sections/support";
import { AnnouncementsSection } from "@/components/admin/sections/announcements";
import { ReferralsSection } from "@/components/admin/sections/referrals";
import { SettingsSection } from "@/components/admin/sections/settings";
import { AuditSection } from "@/components/admin/sections/audit";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "catalog", label: "Plans & Packs", icon: Boxes },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "support", label: "Support & Feedback", icon: LifeBuoy },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "referrals", label: "Referrals", icon: Gift },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "audit", label: "Audit Log", icon: ScrollText }
] as const;
export type SectionId = typeof SECTIONS[number]["id"];

type Gate = { state: "loading" } | { state: "anonymous" } | { state: "denied"; email: string } | { state: "error"; message: string } | { state: "ok"; role: Role; userId: string };

export function AdminApp() {
  const authReady = useAuthStore((state) => state.ready);
  const user = useAuthStore((state) => state.user);
  const openAuth = useAuthStore((state) => state.openAuth);
  const logout = useAuthStore((state) => state.logout);
  const { theme, setTheme } = useTheme();
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [section, setSection] = useState<SectionId>("overview");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && SECTIONS.some((item) => item.id === requested)) setSection(requested as SectionId);
  }, []);

  const checkRole = useCallback(async () => {
    if (!authReady) return;
    if (!user) { setGate({ state: "anonymous" }); return; }
    setGate({ state: "loading" });
    const { data, error } = await getSupabase().from("profiles").select("role, is_blocked").eq("id", user.id).single();
    if (error) { setGate({ state: "error", message: error.message }); return; }
    if (data.is_blocked || (data.role !== "admin" && data.role !== "super_admin")) { setGate({ state: "denied", email: user.email }); return; }
    setGate({ state: "ok", role: data.role as Role, userId: user.id });
  }, [authReady, user]);

  useEffect(() => { void checkRole(); }, [checkRole]);

  const go = (next: SectionId) => {
    setSection(next);
    setMobileNav(false);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  if (gate.state !== "ok") return <GateScreen gate={gate} onLogin={() => openAuth("login")} onLogout={() => void logout()} onRetry={() => void checkRole()} />;

  const isSuper = gate.role === "super_admin";
  const nav = <nav className="flex flex-col gap-0.5 p-3">
    {SECTIONS.map((item) => {
      const Icon = item.icon;
      const active = section === item.id;
      return <button key={item.id} type="button" onClick={() => go(item.id)} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
        <Icon className="h-4 w-4" />{item.label}
      </button>;
    })}
  </nav>;

  return <ToastProvider>
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <button type="button" aria-label="Open menu" onClick={() => setMobileNav(true)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"><Menu className="h-5 w-5" /></button>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white"><ShieldCheck className="h-4 w-4" /></span>
        <div className="leading-tight"><p className="text-sm font-bold">PrintSathi Admin</p><p className="text-[10px] text-slate-500">{isSuper ? "Super admin" : "Admin"}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/app" className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex"><ArrowLeft className="h-3.5 w-3.5" />Back to app</Link>
          <button type="button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <span title={user?.email} className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-xs font-bold text-white">{initialsOf(user?.name ?? "A")}</span>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">{nav}</aside>
        {mobileNav && <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/50" />
          <aside className="relative h-full w-64 overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800"><span className="text-sm font-bold">Admin menu</span><button type="button" aria-label="Close menu" onClick={() => setMobileNav(false)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
            {nav}
          </aside>
        </div>}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {section === "overview" && <OverviewSection go={go} />}
            {section === "users" && <UsersSection isSuper={isSuper} selfId={gate.userId} />}
            {section === "payments" && <PaymentsSection />}
            {section === "catalog" && <CatalogSection />}
            {section === "tools" && <ToolsSection />}
            {section === "support" && <SupportSection selfId={gate.userId} />}
            {section === "announcements" && <AnnouncementsSection selfId={gate.userId} />}
            {section === "referrals" && <ReferralsSection />}
            {section === "settings" && <SettingsSection />}
            {section === "audit" && <AuditSection />}
          </div>
        </main>
      </div>
    </div>
  </ToastProvider>;
}

function GateScreen({ gate, onLogin, onLogout, onRetry }: { gate: Gate; onLogin: () => void; onLogout: () => void; onRetry: () => void }) {
  return <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate-50 to-indigo-50 p-4 dark:from-slate-950 dark:to-slate-900">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {gate.state === "loading" && <><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" /><p className="mt-3 text-sm text-slate-500">Checking admin access…</p></>}
      {gate.state === "anonymous" && <>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg"><ShieldCheck className="h-7 w-7" /></span>
        <h1 className="mt-5 text-2xl font-bold">PrintSathi Admin</h1>
        <p className="mt-2 text-sm text-slate-500">Log in with an admin account to continue.</p>
        <Button variant="primary" className="mt-6 w-full" onClick={onLogin}><LogIn className="h-4 w-4" />Log in</Button>
      </>}
      {gate.state === "denied" && <>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15"><ShieldAlert className="h-7 w-7" /></span>
        <h1 className="mt-5 text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500"><b>{gate.email}</b> is not an admin. Ask a super admin to give you access.</p>
        <div className="mt-6 flex gap-2"><Link href="/app" className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Back to app</Link><Button className="flex-1" onClick={onLogout}>Switch account</Button></div>
      </>}
      {gate.state === "error" && <>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15"><ShieldAlert className="h-7 w-7" /></span>
        <h1 className="mt-5 text-xl font-bold">Could not check access</h1>
        <p className="mt-2 break-words text-sm text-slate-500">{gate.message}</p>
        <Button className="mt-6" onClick={onRetry}>Try again</Button>
      </>}
    </div>
  </div>;
}
