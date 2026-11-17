"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, Copy, Crown, Gift, IndianRupee,
  MessageCircle, Phone, PieChart, Plus, RefreshCw, Award, Share2, SlidersHorizontal,
  Sparkles, TrendingUp, UserCheck, Users, Wallet, Zap, CreditCard
} from "lucide-react";
import {
  CARD_TYPES, ELITE_LEVEL_COINS, FEATURE_KEYS, FEATURE_LIMITS, PLANS, REFERRAL_JOIN_COINS, REFERRAL_UPGRADE_COINS, TOP_UP_OPTIONS,
  dailyLimit, fetchCardActivity, fetchPaymentStatus, fetchTopUpPacks, startTopUp, type TopUpPack, planLabel, useAccountStore, type CardActivity
} from "@/tools/account/account-store";
import { CoinIcon, EmptyState, Modal, card, formatDate, inr } from "@/components/account/account-ui";

export type Notify = (text: string, tone?: "default" | "error" | "success") => void;

/* ───────────────────────── My Profile ───────────────────────── */

export function ProfileTab({ notify }: { notify: Notify }) {
  const { name, email, phone, phoneVerified, updateProfile } = useAccountStore();
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [saving, setSaving] = useState(false);
  const initials = (name.trim() || "U").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const validPhone = /^[6-9]\d{9}$/.test(draftPhone);

  return <section className={`${card} p-5 sm:p-6`}>
    <div className="flex flex-col gap-5 sm:flex-row">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-700 to-indigo-800 text-lg font-bold text-white">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold">{name}</p>
        <p className="text-sm text-slate-500">{email}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Full name</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={() => { if (draftName.trim() && draftName !== name) void updateProfile({ name: draftName.trim() }).then((result) => notify(result.ok ? "Name updated." : result.message, result.ok ? "success" : "error")); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email address</span>
            <input value={email} readOnly className="mt-1.5 h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" />
          </label>
          <div className="md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone number {phoneVerified && <span className="ml-1 normal-case text-emerald-600">· Verified</span>}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input inputMode="numeric" maxLength={10} value={draftPhone} onChange={(event) => setDraftPhone(event.target.value.replace(/\D/g, ""))} placeholder="Enter 10-digit mobile number" className="h-11 w-full max-w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
              <button type="button" disabled={!validPhone || draftPhone === phone || saving} onClick={() => { setSaving(true); void updateProfile({ phone: draftPhone }).then((result) => { setSaving(false); notify(result.ok ? "Phone number saved." : result.message, result.ok ? "success" : "error"); }); }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"><Phone className="h-4 w-4" />{saving ? "Saving…" : "Save phone"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

/* ───────────────────────── Card Dashboard ───────────────────────── */

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function emptyActivity(month: string): CardActivity {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  return { days: Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, total: 0, byType: {} })), daysInMonth, today: null };
}

export function CardDashboardTab({ notify }: { notify: Notify }) {
  const { userId, cardRate, setCardRate } = useAccountStore();
  const months = useMemo(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index); return monthKey(date); }), []);
  const [month, setMonth] = useState(months[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [draftRate, setDraftRate] = useState(String(cardRate));
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const [activity, setActivity] = useState<CardActivity>(() => emptyActivity(month));
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setRefreshing(true);
    fetchCardActivity(userId, month)
      .then((result) => { if (!cancelled) setActivity(result); })
      .catch((error: Error) => { if (!cancelled) notify(`Could not load analytics: ${error.message}`, "error"); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [month, notify, reloadKey, userId]);
  const todayCount = activity.today ? activity.days[activity.today - 1]?.total ?? 0 : 0;
  const monthTotal = activity.days.reduce((sum, day) => sum + day.total, 0);
  const byType = CARD_TYPES.map((type) => ({ type, count: activity.days.reduce((sum, day) => sum + (day.byType[type] ?? 0), 0) }));
  const maxType = Math.max(1, ...byType.map((item) => item.count));
  const top = [...byType].sort((a, b) => b.count - a.count)[0];
  const maxDay = Math.max(1, ...activity.days.map((day) => day.total));
  const monthTitle = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleString("en", { month: "long", year: "numeric" });
  const hovered = hoverDay ? activity.days[hoverDay - 1] : null;

  const stats = [
    { label: "Today", value: String(todayCount), caption: "Cards Created Today", icon: <CreditCard />, tone: "from-sky-50 text-sky-700 bg-sky-100 border-sky-100", valueTone: "" },
    { label: "Today Revenue", value: inr(todayCount * cardRate), caption: "Estimated Earnings Today", icon: <IndianRupee />, tone: "from-emerald-50 text-emerald-700 bg-emerald-100 border-emerald-100", valueTone: "text-emerald-600" },
    { label: "Monthly Total", value: String(monthTotal), caption: "Total Cards This Month", icon: <TrendingUp />, tone: "from-violet-50 text-violet-700 bg-violet-100 border-violet-100", valueTone: "" },
    { label: "Monthly Revenue", value: inr(monthTotal * cardRate), caption: "Total Revenue This Month", icon: <Award />, tone: "from-amber-50 text-amber-700 bg-amber-100 border-amber-100", valueTone: "text-amber-600" }
  ];

  return <div className="space-y-6">
    <section className={`${card} flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between`}>
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Sparkles className="h-5 w-5 text-amber-500" />Card Analytics &amp; Earnings</h2>
        <p className="mt-1 text-sm text-slate-500">Track your daily card processing volume and analyze your business revenue.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <select aria-label="Month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
            {months.map((key) => <option key={key} value={key}>{monthTitle(key)}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-400" />
        </label>
        <button type="button" onClick={() => { setDraftRate(String(cardRate)); setRateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><SlidersHorizontal className="h-4 w-4 text-sky-600" />Set Cost per Card</button>
        <button type="button" aria-label="Refresh data" title="Refresh data" onClick={() => setReloadKey((key) => key + 1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const [from, text, bg, border] = stat.tone.split(" ");
        return <section key={stat.label} className={`rounded-2xl border bg-gradient-to-br ${from} to-white p-5 shadow-sm dark:to-slate-900 dark:from-slate-900 ${border} dark:border-slate-800`}>
          <div className="flex items-start justify-between">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${bg} ${text} dark:bg-slate-800`}>{stat.label}</span>
            <span className={`${text} [&>svg]:h-5 [&>svg]:w-5`}>{stat.icon}</span>
          </div>
          <p className={`mt-4 text-3xl font-bold ${stat.valueTone}`}>{stat.value}</p>
          <p className="mt-1 text-xs text-slate-500">{stat.caption}</p>
        </section>;
      })}
    </div>

    <section className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
      <p className="flex items-center gap-3 text-sm"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950"><IndianRupee className="h-4 w-4" /></span><span><b className="font-serif">Current Rate Setting:</b> <span className="text-slate-600 dark:text-slate-300">Default {inr(cardRate)} per card print</span></span></p>
      <button type="button" onClick={() => { setDraftRate(String(cardRate)); setRateOpen(true); }} className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-400">Edit Pricing</button>
    </section>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-serif text-lg font-semibold"><BarChart3 className="h-5 w-5 text-sky-600" />Daily Creation &amp; Revenue Trend</h3>
            <p className="text-xs text-slate-500">Daily cards created and earnings for {month}</p>
          </div>
          <span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700">{hovered ? `Day ${hovered.day}: ${hovered.total} cards · ${inr(hovered.total * cardRate)}` : "Hover any day bar for details"}</span>
        </div>
        <div className="mt-6 flex h-56 items-end gap-[3px] border-b border-dashed border-slate-200 pb-1 dark:border-slate-700" onMouseLeave={() => setHoverDay(null)}>
          {activity.days.map((day) => <button key={day.day} type="button" aria-label={`Day ${day.day}: ${day.total} cards`} onMouseEnter={() => setHoverDay(day.day)} onFocus={() => setHoverDay(day.day)} onClick={() => setHoverDay(day.day)} className="group relative flex h-full flex-1 items-end">
            <span className={`block w-full rounded-t transition ${day.total ? "bg-gradient-to-t from-indigo-600 to-blue-500 group-hover:from-indigo-500 group-hover:to-sky-400" : "bg-slate-200 dark:bg-slate-700"} ${hoverDay === day.day ? "ring-2 ring-sky-300" : ""}`} style={{ height: day.total ? `${Math.max(4, day.total / maxDay * 100)}%` : 3 }} />
          </button>)}
        </div>
        <div className="mt-1 flex gap-[3px]">{activity.days.map((day) => <span key={day.day} className={`flex-1 text-center text-[9px] ${day.day === activity.today ? "font-bold text-sky-700" : "text-slate-400"} ${activity.daysInMonth > 20 && day.day % 2 === 0 ? "max-sm:invisible" : ""}`}>{day.day}</span>)}</div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Day 1</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-600" />Cards Created</span><span>Day {activity.daysInMonth}</span></div>
      </section>

      <section className={`${card} p-5`}>
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold"><PieChart className="h-5 w-5 text-violet-600" />Breakdown by Card Type</h3>
        <p className="text-xs text-slate-500">Distribution of processed cards by category</p>
        <ul className="mt-4 space-y-3">
          {byType.map((item) => <li key={item.type}>
            <div className="flex items-center justify-between text-sm"><span className="font-serif font-medium">{item.type}</span><span><b>{item.count} cards</b> <span className="text-xs text-slate-500">({inr(item.count * cardRate)})</span></span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500" style={{ width: `${item.count / maxType * 100}%` }} /></div>
          </li>)}
        </ul>
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700"><span>Most Processed Card:</span><span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{top && top.count > 0 ? top.type : "—"}</span></div>
      </section>
    </div>

    {rateOpen && <Modal title="Set Cost per Card" onClose={() => setRateOpen(false)}>
      <form onSubmit={(event) => { event.preventDefault(); const value = Number(draftRate); if (!Number.isFinite(value) || value < 0) { notify("Enter a valid amount.", "error"); return; } void setCardRate(value).then((result) => { notify(result.message, result.ok ? "success" : "error"); if (result.ok) setRateOpen(false); }); }}>
        <p className="mb-3 text-xs text-slate-500">How much you charge your customer for each card print. Used to estimate revenue.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">{[20, 30, 40, 50, 60, 100].map((value) => <button key={value} type="button" onClick={() => setDraftRate(String(value))} className={`h-8 rounded-md border px-3 text-xs ${Number(draftRate) === value ? "border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-700"}`}>₹{value}</button>)}</div>
        <label className="block text-sm">Cost in ₹<input autoFocus type="number" min="0" step="1" value={draftRate} onChange={(event) => setDraftRate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-transparent px-3 dark:border-slate-700" /></label>
        <button className="mt-4 h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Save</button>
      </form>
    </Modal>}
  </div>;
}

/* ───────────────────────── My Subscription ───────────────────────── */

export function SubscriptionTab({ notify, goTo }: { notify: Notify; goTo: (tab: string) => void }) {
  const { plan, planExpiresAt, usage, walletBalance, buyCredits, creditPacks } = useAccountStore();
  const [buyFor, setBuyFor] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const limit = dailyLimit(plan);
  const packs = buyFor ? creditPacks.filter((pack) => pack.featureKey === FEATURE_KEYS[buyFor]) : [];

  return <div className="space-y-8">
    <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className={`grid h-12 w-12 place-items-center rounded-xl ${plan === "free" ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"}`}><Crown className="h-6 w-6" /></span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current plan</p>
            <p className="font-serif text-2xl font-semibold">{planLabel(plan)} Plan</p>
            <p className="text-xs text-slate-500">{plan === "free" ? "1 credit per day on each card · ad-supported" : `Active till ${planExpiresAt ? formatDate(planExpiresAt) : "—"} · ${limit >= 999 ? "Unlimited" : limit} credits / day`}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => goTo("coins")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><CoinIcon className="h-4 w-4" />Redeem with coins</button>
          <a href="/app/plans" className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"><Zap className="h-4 w-4" />{plan === "free" ? "Upgrade" : "Change plan"}</a>
        </div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Zap className="h-5 w-5 fill-current" />Feature Usage &amp; Limits</h2>
          <p className="text-sm text-slate-500">Real-time resource allocation and consumption metrics.</p>
        </div>
        <button type="button" onClick={() => goTo("wallet")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-sm"><Wallet className="h-4 w-4" />Top Up Wallet</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_LIMITS.map((feature) => {
          const total = (limit >= 999 && feature !== "Background Removal" ? 999 : limit) + (usage[`bonus:${feature}`] ?? 0);
          const used = usage[feature] ?? 0;
          const remaining = Math.max(0, total - used);
          const percent = total ? Math.round(remaining / total * 100) : 0;
          return <article key={feature} className={`${card} p-5`}>
            <div className="flex items-center justify-between"><h3 className="font-serif text-sm font-semibold">{feature}</h3><span className="text-xs font-semibold">{total >= 999 ? "∞" : `${remaining} / ${total}`}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${percent > 30 ? "bg-green-500" : percent > 0 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${percent}%` }} /></div>
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-wider"><span className="text-slate-500">{percent === 100 ? "Full capacity" : percent === 0 ? "Exhausted" : "In use"}</span><span>{percent}% remaining</span></div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-right dark:border-slate-800"><button type="button" onClick={() => setBuyFor(feature)} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"><Plus className="h-3.5 w-3.5" />Add Credits</button></div>
          </article>;
        })}
      </div>
    </section>

    {buyFor && <Modal title={`Add credits · ${buyFor}`} onClose={() => setBuyFor(null)}>
      <p className="mb-3 text-xs text-slate-500">Paid from your wallet. Balance: <b>{inr(walletBalance)}</b></p>
      <div className="space-y-2">{packs.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No credit packs available right now.</p>}{packs.map((pack) => <button key={pack.id} type="button" disabled={!!buying} onClick={() => { setBuying(pack.id); void buyCredits(pack.id).then((result) => { setBuying(null); notify(result.message, result.ok ? "success" : "error"); if (result.ok) setBuyFor(null); }); }} className="disabled:opacity-60 flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm hover:border-violet-400 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-violet-950/30"><span><b>{pack.credits}</b> credits</span><span className="font-semibold">{buying === pack.id ? "…" : inr(pack.price)}</span></button>)}</div>
      <button type="button" onClick={() => { setBuyFor(null); goTo("wallet"); }} className="mt-4 w-full text-center text-xs font-semibold text-violet-600 hover:underline">Low balance? Top up wallet →</button>
    </Modal>}
  </div>;
}

/* ───────────────────────── Print Coins ───────────────────────── */

export function PrintCoinsTab({ notify, goTo }: { notify: Notify; goTo: (tab: string) => void }) {
  const { coins, coinTxns, plan, redeemPlan } = useAccountStore();
  const [confirm, setConfirm] = useState<typeof PLANS[number] | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const thisMonth = coinTxns.filter((txn) => txn.type === "earned" && new Date(txn.date).getMonth() === new Date().getMonth()).reduce((sum, txn) => sum + txn.amount, 0);
  const progress = Math.min(100, coins / ELITE_LEVEL_COINS * 100);

  return <div className="space-y-8">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-2xl bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 p-6 text-amber-950 shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[.15em] text-amber-900/80">Available balance</p>
        <p className="mt-3 flex items-center gap-3 text-5xl font-semibold"><CoinIcon className="h-14 w-14" />{coins}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => setHowOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow">How to Earn <ArrowRight className="h-4 w-4" /></button>
          <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-amber-400/60"><ArrowUpRight className="h-3.5 w-3.5" /></span>+{thisMonth} earned this month</span>
        </div>
      </section>
      <section className={`${card} p-6`}>
        <h3 className="font-serif text-lg font-semibold">Level Up Status</h3>
        <p className="mt-2 text-sm text-slate-500">{coins >= ELITE_LEVEL_COINS ? <>You have reached the <b className="text-amber-600">Elite</b> level! 🎉</> : <>You are only <b className="text-slate-900 dark:text-white">{ELITE_LEVEL_COINS - coins} PC</b> away from reaching the <b className="text-amber-600">Elite</b> level.</>}</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${Math.max(2, progress)}%` }} /></div>
        <div className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-wider"><span>Starter</span><span className="text-amber-600">Elite</span></div>
      </section>
    </div>

    <section>
      <h2 className="mb-4 font-serif text-xl font-semibold">Redeem for Memberships</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((item) => {
          const affordable = coins >= item.coins;
          const active = plan === item.id;
          return <article key={item.id} className={`${card} relative flex flex-col p-6 ${item.popular ? "ring-1 ring-amber-400 lg:-translate-y-1" : ""}`}>
            {item.popular && <span className="absolute -top-2.5 right-3 rounded bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Most popular</span>}
            <div className="flex items-start justify-between">
              <div><h3 className="font-serif text-2xl font-semibold">{item.name}</h3><p className="text-sm font-semibold text-orange-600">{item.coins} Coins</p></div>
              {item.id === "ultra" ? <Crown className="h-5 w-5 text-rose-400" /> : item.popular ? <CoinIcon className="h-5 w-5" /> : <span className="grid h-5 w-5 place-items-center rounded border border-slate-200 dark:border-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /></span>}
            </div>
            <ul className="mt-5 flex-1 space-y-3">{item.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm text-slate-600 dark:text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />{feature}</li>)}</ul>
            <button type="button" disabled={active} onClick={() => { if (!affordable) { notify(`You need ${item.coins - coins} more Print Coins for ${item.name}.`, "error"); return; } setConfirm(item); }} className={`mt-6 h-10 rounded-lg text-sm font-semibold transition ${active ? "cursor-default bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : affordable ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900" : item.popular ? "bg-slate-400 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{active ? "Current plan" : "Redeem Now"}</button>
          </article>;
        })}
      </div>
    </section>

    <section>
      <h2 className="mb-4 font-serif text-xl font-semibold">Recent Activity</h2>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-6 py-3">Activity</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-6 py-3 text-right">Amount</th></tr></thead>
          <tbody>
            {coinTxns.length === 0 ? <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">No recent activity found.</td></tr>
              : coinTxns.map((txn) => <tr key={txn.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-6 py-3">{txn.label}</td><td className="px-4 py-3 text-slate-500">{formatDate(txn.date)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${txn.type === "earned" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40"}`}>{txn.type === "earned" ? "Earned" : "Redeemed"}</span></td><td className={`px-6 py-3 text-right font-semibold ${txn.type === "earned" ? "text-emerald-600" : "text-rose-600"}`}>{txn.type === "earned" ? "+" : "−"}{txn.amount} PC</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {confirm && <Modal title={`Redeem ${confirm.name}?`} onClose={() => setConfirm(null)}>
      <p className="text-sm text-slate-600 dark:text-slate-300"><b>{confirm.coins} Print Coins</b> will be deducted. Your plan will change to <b>{confirm.name}</b> for {confirm.period === "year" ? "1 year" : "30 days"}.</p>
      <p className="mt-2 text-xs text-slate-500">Balance after: {coins - confirm.coins} PC</p>
      <div className="mt-5 flex gap-2"><button type="button" onClick={() => setConfirm(null)} className="h-10 flex-1 rounded-lg border border-slate-200 text-sm dark:border-slate-700">Cancel</button><button type="button" disabled={redeeming} onClick={() => { setRedeeming(true); void redeemPlan(confirm.id).then((result) => { setRedeeming(false); notify(result.message, result.ok ? "success" : "error"); setConfirm(null); }); }} className="disabled:opacity-60 h-10 flex-1 rounded-lg bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">{redeeming ? "Redeeming…" : "Confirm"}</button></div>
    </Modal>}

    {howOpen && <Modal title="How to earn Print Coins" onClose={() => setHowOpen(false)}>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3"><Gift className="h-5 w-5 shrink-0 text-emerald-600" /><span>Claim a friend&apos;s referral code → <b>+{REFERRAL_JOIN_COINS} PC</b></span></li>
        <li className="flex gap-3"><Users className="h-5 w-5 shrink-0 text-sky-600" /><span>A friend you invited buys their first plan → <b>+{REFERRAL_UPGRADE_COINS} PC</b></span></li>
      </ul>
      <button type="button" onClick={() => { setHowOpen(false); goTo("refer"); }} className="mt-5 h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white">Go to Refer &amp; Earn</button>
    </Modal>}
  </div>;
}

/* ───────────────────────── My Wallet ───────────────────────── */

const PAYMENT_MESSAGES: Record<string, { text: string; tone: "default" | "error" | "success" }> = {
  paid: { text: "Payment confirmed — your wallet has been topped up.", tone: "success" },
  observed: { text: "Payment received. Your wallet will be credited once it is verified with the bank.", tone: "default" },
  review: { text: "Your payment is under review. Contact support if it is not credited within 24 hours.", tone: "default" },
  failed: { text: "Payment failed. No money was added.", tone: "error" },
  expired: { text: "Payment session expired. Please try again.", tone: "error" },
  cancelled: { text: "Payment cancelled.", tone: "error" }
};
const FINAL_STATUSES = new Set(["paid", "failed", "expired", "cancelled"]);

export function WalletTab({ notify }: { notify: Notify }) {
  const { walletBalance, walletTxns, refills, refresh } = useAccountStore();
  const [packs, setPacks] = useState<TopUpPack[]>([]);
  const [selected, setSelected] = useState(1);
  const [paying, setPaying] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const options: Array<Omit<TopUpPack, "id"> & { id?: string }> = packs.length ? packs : TOP_UP_OPTIONS;
  const index = Math.min(selected, options.length - 1);
  const option = options[index];

  useEffect(() => { void fetchTopUpPacks().then(setPacks).catch(() => setPacks([])); }, []);

  // Back from the YouPI checkout with ?payment=<id>: poll briefly for the webhook result.
  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get("payment");
    if (!paymentId) return;
    let stopped = false;
    let tries = 0;
    const check = async () => {
      const status = await fetchPaymentStatus(paymentId);
      if (stopped) return;
      const message = status ? PAYMENT_MESSAGES[status] : undefined;
      if ((status && FINAL_STATUSES.has(status)) || tries >= 10) {
        if (message) notify(message.text, message.tone);
        setPendingNote(status === "observed" || status === "review" ? message?.text ?? null : null);
        if (status === "paid") void refresh();
        const url = new URL(window.location.href);
        url.searchParams.delete("payment");
        window.history.replaceState(null, "", url);
        return;
      }
      if (message) setPendingNote(message.text);
      tries += 1;
      setTimeout(() => void check(), 3000);
    };
    void check();
    return () => { stopped = true; };
  }, [notify, refresh]);

  const pay = async () => {
    if (!option.id) { notify("Top-up packs are still loading. Please try again.", "error"); return; }
    setPaying(true);
    const result = await startTopUp(option.id);
    if (!result.ok) { setPaying(false); notify(result.message, "error"); return; }
    window.location.assign(result.checkoutUrl);
  };

  return <div className="space-y-6">
    <h2 className="flex items-center gap-3 border-b border-slate-200 pb-4 font-serif text-2xl font-semibold dark:border-slate-800"><Wallet className="h-7 w-7 text-violet-600" />My Wallet</h2>
    {pendingNote && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{pendingNote}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section className="flex min-h-48 flex-col rounded-2xl bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-600 p-7 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-white/80">Wallet balance</p>
        <p className="mt-2 text-5xl font-bold">{inr(walletBalance)}</p>
        <p className="mt-auto pt-6 text-xs text-white/70">Use your balance to buy extra credits instantly.</p>
      </section>
      <section className={`${card} p-6`}>
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles className="h-5 w-5 text-amber-500" />Top Up Your Wallet</h3>
        <p className="mt-1 text-sm text-slate-500">Load once, buy credit refills instantly. Pay with any UPI app.</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {options.map((item, i) => <button key={item.id ?? item.pay} type="button" onClick={() => setSelected(i)} className={`relative rounded-xl border p-3 text-center transition ${index === i ? "border-violet-500 bg-violet-50/60 ring-1 ring-violet-500 dark:bg-violet-950/30" : "border-slate-200 hover:border-violet-300 dark:border-slate-700"}`}>
            {item.bonus && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-amber-950">+₹{item.bonus} Bonus</span>}
            <span className="block text-[10px] text-slate-500">{item.label}</span>
            <span className="block text-2xl font-bold">₹{item.pay}</span>
            <span className="block text-[10px] font-semibold text-emerald-600">Get ₹{item.get}</span>
          </button>)}
        </div>
        <button type="button" disabled={paying} onClick={() => void pay()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow disabled:opacity-60"><Plus className="h-4 w-4" />{paying ? "Opening UPI checkout…" : `Top Up ₹${option.pay} Now`}</button>
        <p className="mt-2 text-center text-[10px] text-slate-400">UPI checkout. Your wallet is credited once the payment is verified.</p>
      </section>
    </div>
<div className="grid gap-6 lg:grid-cols-2">
      <TxnList title="Wallet Statements" icon={<CalendarDays className="h-5 w-5 text-violet-600" />} empty="No transaction records found." items={walletTxns} />
      <TxnList title="Credit Refill History" icon={<Sparkles className="h-5 w-5 text-violet-600" />} empty="No refill history records found." items={refills} />
    </div>
  </div>;
}

function TxnList({ title, icon, empty, items }: { title: string; icon: React.ReactNode; empty: string; items: Array<{ id: string; date: number; label: string; amount: number; type: "credit" | "debit" }> }) {
  return <section className={card}>
    <h3 className="flex items-center gap-2 border-b border-slate-200 px-6 py-5 font-serif text-lg font-semibold dark:border-slate-800">{icon}{title}</h3>
    {items.length === 0 ? <p className="py-20 text-center text-sm text-slate-500">{empty}</p>
      : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{items.map((item) => <li key={item.id} className="flex items-center justify-between px-6 py-3 text-sm"><span><span className="block">{item.label}</span><span className="text-xs text-slate-500">{formatDate(item.date)}</span></span><span className={`font-semibold ${item.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>{item.type === "credit" ? "+" : "−"}{inr(item.amount)}</span></li>)}</ul>}
  </section>;
}

/* ───────────────────────── Refer & Earn ───────────────────────── */

export function ReferTab({ notify }: { notify: Notify }) {
  const { referralCode, referrals, claimedReferral, claimReferral } = useAccountStore();
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [origin, setOrigin] = useState("https://printsahyogi.com");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const link = `${origin}/?ref=${referralCode}`;
  const message = `PrintSathi se Aadhaar, PAN, Ayushman card crop & passport photo print bahut aasaan hai! Mera code ${referralCode} use karo aur ${REFERRAL_JOIN_COINS} Print Coins free pao: ${link}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const converted = referrals.filter((item) => item.upgraded).length;
  const earned = converted * REFERRAL_UPGRADE_COINS;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text; document.body.appendChild(area); area.select();
      try { document.execCommand("copy"); } finally { area.remove(); }
    }
    notify(`${label} copied!`, "success");
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "PrintSathi", text: message, url: link }); return; } catch { /* cancelled */ }
    }
    void copy(link, "Share link");
  };

  return <div className="space-y-6">
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm dark:border-emerald-900 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950"><Sparkles className="h-3.5 w-3.5" />Refer &amp; Earn program</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold">Invite friends, earn <span className="text-emerald-600">{REFERRAL_UPGRADE_COINS} Print Coins</span></h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Share PrintSathi with your fellow Cyber Cafe and CSC friends. They receive <b>{REFERRAL_JOIN_COINS} Print Coins</b> upon joining, and you earn <b>{REFERRAL_UPGRADE_COINS} Print Coins</b> the moment they purchase their first subscription plan!</p>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-56">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-green-500 text-sm font-semibold text-white shadow hover:bg-green-600"><MessageCircle className="h-4 w-4 fill-current" />Share on WhatsApp</a>
          <button type="button" onClick={() => void share()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><Share2 className="h-4 w-4" />Copy Share Link</button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 border-t border-emerald-100 pt-6 dark:border-emerald-900 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your referral code</p><p className="mt-1 font-mono text-xl font-bold tracking-[.2em]">{referralCode}</p></div>
          <button type="button" onClick={() => void copy(referralCode, "Referral code")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Copy className="h-4 w-4" />Copy</button>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pl-4 dark:border-slate-700 dark:bg-slate-900">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">{link}</span>
          <button type="button" onClick={() => void copy(link, "Link")} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"><Copy className="h-3.5 w-3.5" />Copy Link</button>
        </div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total friends invited" value={String(referrals.length)} caption="Joined via your link" icon={<Users />} tone="bg-sky-50 text-sky-600 dark:bg-sky-950" />
      <StatCard label="Converted to Pro" value={String(converted)} valueClass="text-emerald-600" caption={`${referrals.length - converted} pending upgrade`} icon={<UserCheck />} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950" />
      <StatCard label="Coins earned" value={`${earned}`} suffix="PC" valueClass="text-amber-600" caption={`Value: ₹${earned}`} icon={<CoinIcon className="h-6 w-6" />} tone="bg-white dark:bg-slate-800" />
    </div>

    <section className={`${card} flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between`}>
      <div>
        <p className="flex items-center gap-2 font-serif text-sm font-semibold"><Gift className="h-4 w-4 text-emerald-600" />Have a friend&apos;s referral code?</p>
        <p className="mt-0.5 text-xs text-slate-500">{claimedReferral ? <>You claimed <b className="font-mono">{claimedReferral}</b> — {REFERRAL_JOIN_COINS} coins added.</> : <>Claim their code to get <b>{REFERRAL_JOIN_COINS} Free Print Coins</b> immediately added to your wallet!</>}</p>
      </div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setClaiming(true); void claimReferral(code).then((result) => { setClaiming(false); notify(result.message, result.ok ? "success" : "error"); if (result.ok) setCode(""); }); }}>
        <input value={code} disabled={!!claimedReferral} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={12} placeholder="ENTER CODE (E.G. PS8X2K)" className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs uppercase tracking-wider outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 md:w-56" />
        <button disabled={!code || !!claimedReferral || claiming} className="h-10 shrink-0 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:bg-emerald-300 dark:disabled:bg-emerald-900">Claim {REFERRAL_JOIN_COINS} Coins</button>
      </form>
    </section>

    <section>
      <h2 className="mb-4 font-serif text-lg font-semibold">How PrintSathi Referral Works</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { n: 1, title: "Share Your Unique Link", text: "Send your link or code to cafe owners, CSC operators, and friends who print cards.", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
          { n: 2, title: `Friend Gets ${REFERRAL_JOIN_COINS} Print Coins`, text: `When your friend registers using your link, they immediately receive ${REFERRAL_JOIN_COINS} Print Coins to try features.`, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950" },
          { n: 3, title: `You Get ${REFERRAL_UPGRADE_COINS} Print Coins`, text: `When your friend buys their first subscription plan, ${REFERRAL_UPGRADE_COINS} Print Coins are instantly credited to your wallet!`, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950" }
        ].map((step) => <article key={step.n} className={`${card} p-5`}>
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step.tone}`}>{step.n}</span>
          <h3 className="mt-3 font-serif text-sm font-semibold">{step.title}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">{step.text}</p>
        </article>)}
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-lg font-semibold">Invited Friends Activity</h2><span className="text-xs text-slate-500">{referrals.length} friends</span></div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        {referrals.length === 0 ? <EmptyState icon={<Users />} title="No referrals yet" text="Share your link with your fellow CSC / cyber cafe operators via WhatsApp to start earning Print Coins!">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-green-500 px-4 text-xs font-semibold text-white hover:bg-green-600"><MessageCircle className="h-4 w-4 fill-current" />Share on WhatsApp</a>
        </EmptyState> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{referrals.map((friend) => <li key={friend.id} className="flex items-center justify-between px-5 py-3 text-sm"><span>{friend.name}<span className="block text-xs text-slate-500">Joined {formatDate(friend.joinedAt)}</span></span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${friend.upgraded ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{friend.upgraded ? `+${REFERRAL_UPGRADE_COINS} PC` : "Pending"}</span></li>)}</ul>}
      </div>
    </section>
  </div>;
}

function StatCard({ label, value, suffix, caption, icon, tone, valueClass = "" }: { label: string; value: string; suffix?: string; caption: string; icon: React.ReactNode; tone: string; valueClass?: string }) {
  return <section className={`${card} flex items-start justify-between p-5`}>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}{suffix && <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span>}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
    <span className={`grid h-11 w-11 place-items-center rounded-xl border border-slate-100 dark:border-slate-700 [&>svg]:h-5 [&>svg]:w-5 ${tone}`}>{icon}</span>
  </section>;
}

