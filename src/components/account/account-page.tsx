"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Gift, LayoutGrid, LoaderCircle, Lock, LogIn, UserPlus, Wallet } from "lucide-react";
import { useAuthStore } from "@/tools/auth/auth-store";
import { useAccountStore } from "@/tools/account/account-store";
import { CardDashboardTab, PrintCoinsTab, ProfileTab, ReferTab, SubscriptionTab, WalletTab, type Notify } from "@/components/account/account-tabs";
import { CoinIcon, Toast } from "@/components/account/account-ui";

const TABS = [
  { id: "profile", label: "My Profile", icon: null, active: "text-slate-900 border-slate-900 dark:text-white dark:border-white" },
  { id: "dashboard", label: "Card Dashboard", icon: <LayoutGrid className="h-4 w-4" />, active: "text-blue-600 border-blue-600" },
  { id: "subscription", label: "My Subscription", icon: null, active: "text-slate-900 border-slate-900 dark:text-white dark:border-white" },
  { id: "coins", label: "Print Coins", icon: <CoinIcon className="h-4 w-4" />, active: "text-amber-600 border-amber-600" },
  { id: "wallet", label: "My Wallet", icon: <Wallet className="h-4 w-4" />, active: "text-violet-600 border-violet-600" },
  { id: "refer", label: "Refer & Earn", icon: <Gift className="h-4 w-4 text-emerald-600" />, active: "text-emerald-600 border-emerald-600" }
] as const;
type TabId = typeof TABS[number]["id"];

export function AccountPage({ defaultTab = "dashboard" }: { defaultTab?: TabId }) {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((state) => state.user);
  const authReady = useAuthStore((state) => state.ready);
  const accountStatus = useAccountStore((state) => state.status);
  const accountError = useAccountStore((state) => state.error);
  const refreshAccount = useAccountStore((state) => state.refresh);
  const openAuth = useAuthStore((state) => state.openAuth);
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [toast, setToast] = useState<{ text: string; tone: "default" | "error" | "success" } | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && TABS.some((item) => item.id === requested)) setTab(requested as TabId);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const goTo = useCallback((next: string) => {
    if (!TABS.some((item) => item.id === next)) return;
    setTab(next as TabId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const notify: Notify = useCallback((text, tone = "default") => setToast({ text, tone }), []);

  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">My Account</h1>
    </div>
    <nav aria-label="Account sections" className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex w-max min-w-full gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((item) => <button key={item.id} role="tab" type="button" aria-selected={tab === item.id} onClick={() => goTo(item.id)} className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 font-serif text-sm transition ${tab === item.id ? `${item.active} font-semibold` : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>{item.icon}{item.label}</button>)}
      </div>
    </nav>
    <div className="mt-6">
      {!mounted || !authReady || (user && (accountStatus === "loading" || accountStatus === "idle")) ? <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-slate-400" /></div> : !user ? <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"><Lock className="h-6 w-6" /></span>
        <h2 className="mt-5 font-serif text-2xl font-semibold">Log in to view your account</h2>
        <p className="mt-2 text-sm text-slate-500">See your card dashboard, subscription, Print Coins, wallet and referrals.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => openAuth("login")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25"><LogIn className="h-4 w-4" />Log in</button>
          <button type="button" onClick={() => openAuth("signup")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><UserPlus className="h-4 w-4" />Create account</button>
        </div>
      </div> : accountStatus === "error" ? <div className="mx-auto max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900 dark:bg-slate-900">
        <CircleAlert className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-3 font-serif text-xl font-semibold">Could not load your account</h2>
        <p className="mt-1 text-sm text-slate-500">{accountError}</p>
        <button type="button" onClick={() => void refreshAccount()} className="mt-5 h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Try again</button>
      </div> : <>
        {tab === "profile" && <ProfileTab notify={notify} />}
        {tab === "dashboard" && <CardDashboardTab notify={notify} />}
        {tab === "subscription" && <SubscriptionTab notify={notify} goTo={goTo} />}
        {tab === "coins" && <PrintCoinsTab notify={notify} goTo={goTo} />}
        {tab === "wallet" && <WalletTab notify={notify} />}
        {tab === "refer" && <ReferTab notify={notify} />}
      </>}
    </div>
    {toast && <Toast text={toast.text} tone={toast.tone} onClose={() => setToast(null)} />}
  </div>;
}
