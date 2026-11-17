"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, CreditCard, Gift, IndianRupee, LifeBuoy, Lightbulb, RefreshCw, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Loading, SectionHeader, fmtDate, inr, panel } from "@/components/admin/admin-ui";
import type { SectionId } from "@/components/admin/admin-app";

type Daily = { day: string; signups: number; revenue: number; usage: number };
type Stats = {
  users_total: number; users_new_period: number; users_new_today: number; users_blocked: number; users_paid: number;
  revenue_total: number; revenue_period: number; revenue_today: number; wallet_outstanding: number; coins_outstanding: number;
  usage_period: number; tickets_open: number; suggestions_new: number; referrals_total: number;
  plan_breakdown: Record<string, number>; daily: Daily[]; top_tools: Array<{ slug: string; count: number }>;
};
type RecentUser = { id: string; full_name: string; email: string | null; plan_id: string; created_at: string };
type RecentPayment = { id: string; amount: number; purpose: string; status: string; created_at: string; profiles: { full_name: string; email: string | null } | null };

const RANGES = [7, 30, 90];

export function OverviewSection({ go }: { go: (section: SectionId) => void }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<RecentUser[]>([]);
  const [payments, setPayments] = useState<RecentPayment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"signups" | "revenue" | "usage">("signups");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const [statsRes, usersRes, paymentsRes] = await Promise.all([
      supabase.rpc("admin_stats", { p_days: days }),
      supabase.from("profiles").select("id, full_name, email, plan_id, created_at").order("created_at", { ascending: false }).limit(6),
      supabase.from("payments").select("id, amount, purpose, status, created_at, profiles(full_name, email)").order("created_at", { ascending: false }).limit(6)
    ]);
    if (statsRes.error) setError(friendly(statsRes.error.message));
    else setStats(statsRes.data as Stats);
    setUsers((usersRes.data as RecentUser[]) ?? []);
    setPayments((paymentsRes.data as unknown as RecentPayment[]) ?? []);
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const kpis = stats ? [
    { label: "Total users", value: stats.users_total.toLocaleString("en-IN"), sub: `+${stats.users_new_today} today`, icon: Users, tone: "from-sky-500 to-indigo-500", onClick: () => go("users") },
    { label: `New users (${days}d)`, value: stats.users_new_period.toLocaleString("en-IN"), sub: `${stats.users_blocked} blocked`, icon: UserPlus, tone: "from-violet-500 to-fuchsia-500", onClick: () => go("users") },
    { label: `Revenue (${days}d)`, value: inr(stats.revenue_period), sub: `${inr(stats.revenue_today)} today · ${inr(stats.revenue_total)} all-time`, icon: IndianRupee, tone: "from-emerald-500 to-teal-500", onClick: () => go("payments") },
    { label: "Paid subscribers", value: stats.users_paid.toLocaleString("en-IN"), sub: `${stats.users_total ? Math.round(stats.users_paid / stats.users_total * 100) : 0}% of users`, icon: TrendingUp, tone: "from-amber-500 to-orange-500", onClick: () => go("users") },
    { label: "Wallet balances", value: inr(stats.wallet_outstanding), sub: "Held across all users", icon: Wallet, tone: "from-indigo-500 to-blue-600" },
    { label: "Print Coins", value: stats.coins_outstanding.toLocaleString("en-IN"), sub: `${stats.referrals_total} referrals`, icon: Coins, tone: "from-yellow-500 to-amber-500", onClick: () => go("referrals") },
    { label: `Tool uses (${days}d)`, value: stats.usage_period.toLocaleString("en-IN"), sub: "Cards & photos processed", icon: CreditCard, tone: "from-cyan-500 to-sky-600", onClick: () => go("tools") },
    { label: "Open tickets", value: String(stats.tickets_open), sub: `${stats.suggestions_new} new suggestions`, icon: LifeBuoy, tone: "from-rose-500 to-pink-500", onClick: () => go("support") }
  ] : [];

  const daily = stats?.daily ?? [];
  const max = Math.max(1, ...daily.map((item) => Number(item[metric])));
  const planEntries = Object.entries(stats?.plan_breakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const planTotal = planEntries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const toolMax = Math.max(1, ...(stats?.top_tools ?? []).map((tool) => tool.count));

  return <div>
    <SectionHeader title="Overview" description="Live numbers from your Supabase database." actions={<>
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">{RANGES.map((range) => <button key={range} type="button" onClick={() => setDays(range)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${days === range ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`}>{range}d</button>)}</div>
      <Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </>} />

    {error && <div className="mb-5"><ErrorBox message={error} onRetry={() => void load()} /></div>}
    {loading && !stats ? <Loading /> : stats && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return <button key={kpi.label} type="button" onClick={kpi.onClick} disabled={!kpi.onClick} className={`${panel} group p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md`}>
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p>
              <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${kpi.tone} text-white shadow-sm`}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{kpi.sub}</p>
          </button>;
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className={`${panel} p-5 xl:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Daily trend</h2>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-800">{(["signups", "revenue", "usage"] as const).map((item) => <button key={item} type="button" onClick={() => setMetric(item)} className={`rounded-md px-2.5 py-1 font-medium capitalize ${metric === item ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-500"}`}>{item}</button>)}</div>
          </div>
          <div className="mt-6 flex h-52 items-end gap-[3px]">
            {daily.map((item) => {
              const value = Number(item[metric]);
              return <div key={item.day} className="group relative flex h-full flex-1 items-end">
                <span className={`block w-full rounded-t ${value ? "bg-gradient-to-t from-indigo-600 to-violet-400" : "bg-slate-200 dark:bg-slate-800"}`} style={{ height: value ? `${Math.max(3, value / max * 100)}%` : 3 }} />
                <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">{fmtDate(item.day)}: {metric === "revenue" ? inr(value) : value}</span>
              </div>;
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{fmtDate(daily[0]?.day)}</span><span>{fmtDate(daily[daily.length - 1]?.day)}</span></div>
        </section>

        <section className={`${panel} p-5`}>
          <h2 className="font-semibold">Users by plan</h2>
          {planEntries.length === 0 ? <Empty text="No users yet." /> : <ul className="mt-4 space-y-3">
            {planEntries.map(([plan, count]) => <li key={plan}>
              <div className="flex justify-between text-sm"><span className="font-medium capitalize">{plan.replace(/-/g, " ")}</span><span className="text-slate-500">{count} · {Math.round(count / planTotal * 100)}%</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${count / planTotal * 100}%` }} /></div>
            </li>)}
          </ul>}
          <h2 className="mt-6 font-semibold">Top tools ({days}d)</h2>
          {(stats.top_tools ?? []).length === 0 ? <p className="mt-2 text-xs text-slate-500">No usage logged yet.</p> : <ul className="mt-3 space-y-2">
            {stats.top_tools.map((tool) => <li key={tool.slug} className="text-xs"><div className="flex justify-between"><span>{tool.slug}</span><span className="font-semibold">{tool.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${tool.count / toolMax * 100}%` }} /></div></li>)}
          </ul>}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="font-semibold">Latest signups</h2><Button size="sm" variant="ghost" onClick={() => go("users")}>View all</Button></div>
          {users.length === 0 ? <Empty text="No users yet." /> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{users.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0"><span className="block truncate font-medium">{item.full_name || "—"}</span><span className="block truncate text-xs text-slate-500">{item.email}</span></span>
            <span className="text-right"><Badge tone={item.plan_id === "free" ? "slate" : "violet"}>{item.plan_id}</Badge><span className="mt-0.5 block text-[11px] text-slate-400">{fmtDate(item.created_at)}</span></span>
          </li>)}</ul>}
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="font-semibold">Latest payments</h2><Button size="sm" variant="ghost" onClick={() => go("payments")}>View all</Button></div>
          {payments.length === 0 ? <Empty text="No payments yet." /> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{payments.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0"><span className="block truncate font-medium">{item.profiles?.full_name || item.profiles?.email || "—"}</span><span className="block text-xs capitalize text-slate-500">{item.purpose.replace(/_/g, " ")}</span></span>
            <span className="text-right"><span className="block font-semibold">{inr(item.amount)}</span><StatusBadge status={item.status} /></span>
          </li>)}</ul>}
        </section>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400"><Gift className="h-3.5 w-3.5" /><Lightbulb className="h-3.5 w-3.5" />Click any card to jump to its section.</p>
    </>}
  </div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "paid" ? "green" : status === "failed" ? "red" : status === "refunded" ? "amber" : "slate";
  return <Badge tone={tone}>{status}</Badge>;
}
