"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Coins, Copy, Crown, Download, RefreshCw, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { adminRpc, friendly, safeSearch, write, type Role } from "@/tools/admin/admin-api";
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Loading, Modal, Pagination, SearchInput, SectionHeader, Table, fmtDate, inputCls, inr, panel, useToast } from "@/components/admin/admin-ui";

type Profile = {
  id: string; full_name: string; email: string | null; phone: string | null; phone_verified: boolean; role: Role;
  plan_id: string; plan_expires_at: string | null; wallet_balance: number; coins: number; card_rate: number;
  referral_code: string; is_blocked: boolean; auth_provider: string; created_at: string; last_seen_at: string | null;
};
type Plan = { id: string; name: string; duration_days: number; period: string };
const PAGE = 20;
const COLUMNS = "id, full_name, email, phone, phone_verified, role, plan_id, plan_expires_at, wallet_balance, coins, card_rate, referral_code, is_blocked, auth_provider, created_at, last_seen_at";

export function UsersSection({ isSuper, selfId }: { isSuper: boolean; selfId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { setQuery(safeSearch(search)); setPage(0); }, 350); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { void getSupabase().from("plans").select("id, name, duration_days, period").order("sort_order").then(({ data }) => setPlans((data as Plan[]) ?? [])); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let request = getSupabase().from("profiles").select(COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (query) request = request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,referral_code.ilike.%${query}%`);
    if (plan !== "all") request = request.eq("plan_id", plan);
    if (status === "blocked") request = request.eq("is_blocked", true);
    if (status === "active") request = request.eq("is_blocked", false);
    if (status === "admins") request = request.in("role", ["admin", "super_admin"]);
    const { data, error: err, count } = await request;
    if (err) setError(friendly(err.message));
    setRows((data as Profile[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, plan, query, status]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    let request = getSupabase().from("profiles").select(COLUMNS).order("created_at", { ascending: false }).limit(5000);
    if (query) request = request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,referral_code.ilike.%${query}%`);
    if (plan !== "all") request = request.eq("plan_id", plan);
    const { data, error: err } = await request;
    if (err || !data) { toast(friendly(err?.message ?? "Export failed"), false); return; }
    const header = ["name", "email", "phone", "plan", "plan_expires_at", "wallet", "coins", "role", "blocked", "referral_code", "joined"];
    const lines = (data as Profile[]).map((row) => [row.full_name, row.email, row.phone, row.plan_id, row.plan_expires_at, row.wallet_balance, row.coins, row.role, row.is_blocked, row.referral_code, row.created_at].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = `printsathi-users-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Exported ${data.length} users.`);
  };

  return <div>
    <SectionHeader title="Users" description={`${total.toLocaleString("en-IN")} users match your filters.`} actions={<>
      <Button onClick={() => void exportCsv()}><Download className="h-4 w-4" />Export CSV</Button>
      <Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </>} />
    <section className={panel}>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone, referral code" />
        <select value={plan} onChange={(event) => { setPlan(event.target.value); setPage(0); }} className={`${inputCls} sm:w-40`}><option value="all">All plans</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className={`${inputCls} sm:w-40`}><option value="all">All users</option><option value="active">Active</option><option value="blocked">Blocked</option><option value="admins">Admins</option></select>
      </div>
      {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No users found." /> : <Table head={["User", "Plan", "Wallet", "Coins", "Role", "Joined", ""]}>
        {rows.map((row) => <tr key={row.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelected(row)}>
          <td className="px-4 py-3"><p className="font-medium">{row.full_name || "—"} {row.is_blocked && <Badge tone="red">Blocked</Badge>}</p><p className="text-xs text-slate-500">{row.email}{row.phone ? ` · ${row.phone}` : ""}</p></td>
          <td className="px-4 py-3"><Badge tone={row.plan_id === "free" ? "slate" : "violet"}>{row.plan_id}</Badge>{row.plan_expires_at && <p className="mt-0.5 text-[11px] text-slate-400">till {fmtDate(row.plan_expires_at)}</p>}</td>
          <td className="px-4 py-3 font-medium">{inr(row.wallet_balance)}</td>
          <td className="px-4 py-3">{row.coins}</td>
          <td className="px-4 py-3">{row.role === "user" ? <span className="text-xs text-slate-500">user</span> : <Badge tone="blue">{row.role.replace("_", " ")}</Badge>}</td>
          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(row.created_at)}</td>
          <td className="px-4 py-3 text-right"><Button size="sm" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>Manage</Button></td>
        </tr>)}
      </Table>}
      <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </section>
    {selected && <UserDrawer key={selected.id} userId={selected.id} plans={plans} isSuper={isSuper} selfId={selfId} onClose={() => setSelected(null)} onChanged={() => void load()} />}
  </div>;
}

type Activity = { wallet: Array<{ id: string; direction: string; amount: number; label: string; created_at: string }>; coins: Array<{ id: string; direction: string; amount: number; label: string; created_at: string }>; payments: Array<{ id: string; amount: number; purpose: string; status: string; created_at: string }>; usage: Array<{ id: number; tool_slug: string | null; feature_key: string | null; quantity: number; created_at: string }>; referrals: number };

function UserDrawer({ userId, plans, isSuper, selfId, onClose, onChanged }: { userId: string; plans: Plan[]; isSuper: boolean; selfId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [user, setUser] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [tab, setTab] = useState<"wallet" | "coins" | "payments" | "usage">("wallet");
  const [dialog, setDialog] = useState<"wallet" | "coins" | "plan" | "edit" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [profile, wallet, coins, payments, usage, referrals] = await Promise.all([
      supabase.from("profiles").select(COLUMNS).eq("id", userId).single(),
      supabase.from("wallet_transactions").select("id, direction, amount, label, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("coin_transactions").select("id, direction, amount, label, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("payments").select("id, amount, purpose, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("usage_logs").select("id, tool_slug, feature_key, quantity, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId)
    ]);
    if (profile.error) { toast(friendly(profile.error.message), false); return; }
    setUser(profile.data as Profile);
    setActivity({ wallet: wallet.data ?? [], coins: coins.data ?? [], payments: payments.data ?? [], usage: (usage.data as Activity["usage"]) ?? [], referrals: referrals.count ?? 0 });
  }, [toast, userId]);

  useEffect(() => { void load(); }, [load]);

  const done = async (result: { ok: boolean; message: string }) => {
    toast(result.message, result.ok);
    if (result.ok) { setDialog(null); await load(); onChanged(); }
  };

  const toggleBlock = async () => {
    if (!user) return;
    if (user.id === selfId) { toast("You can't block yourself.", false); return; }
    if (!window.confirm(user.is_blocked ? `Unblock ${user.full_name || user.email}?` : `Block ${user.full_name || user.email}? They won't be able to use admin features or paid tools.`)) return;
    setBusy(true);
    await done(await write(getSupabase().from("profiles").update({ is_blocked: !user.is_blocked }).eq("id", user.id), { action: user.is_blocked ? "user_unblock" : "user_block", table: "profiles", id: user.id }));
    setBusy(false);
  };

  const changeRole = async (role: Role) => {
    if (!user || role === user.role) return;
    if (user.id === selfId) { toast("You can't change your own role.", false); return; }
    if (!window.confirm(`Change role of ${user.full_name || user.email} to ${role}?`)) return;
    await done(await write(getSupabase().from("profiles").update({ role }).eq("id", user.id), { action: "role_change", table: "profiles", id: user.id, details: { from: user.role, to: role } }));
  };

  if (!user || !activity) return <Drawer title="User details" onClose={onClose}><Loading /></Drawer>;

  return <Drawer title={user.full_name || user.email || "User"} onClose={onClose}>
    <div className="flex items-start gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-lg font-bold text-white">{(user.full_name || user.email || "U").slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{user.full_name || "—"}</p>
        <p className="truncate text-sm text-slate-500">{user.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={user.plan_id === "free" ? "slate" : "violet"}>{user.plan_id}</Badge>
          {user.role !== "user" && <Badge tone="blue">{user.role.replace("_", " ")}</Badge>}
          {user.is_blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Active</Badge>}
          <Badge>{user.auth_provider}</Badge>
        </div>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-3">
      <Stat label="Wallet" value={inr(user.wallet_balance)} />
      <Stat label="Coins" value={`${user.coins} PC`} />
      <Stat label="Referrals" value={String(activity.referrals)} />
    </div>

    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
      <Info label="Phone" value={user.phone ? `${user.phone}${user.phone_verified ? " ✓" : ""}` : "—"} />
      <Info label="Plan expires" value={fmtDate(user.plan_expires_at)} />
      <Info label="Card rate" value={inr(user.card_rate)} />
      <Info label="Referral code" value={<button type="button" onClick={() => { void navigator.clipboard?.writeText(user.referral_code); toast("Code copied."); }} className="inline-flex items-center gap-1 font-mono">{user.referral_code}<Copy className="h-3 w-3" /></button>} />
      <Info label="Joined" value={fmtDate(user.created_at, true)} />
      <Info label="Last seen" value={fmtDate(user.last_seen_at, true)} />
    </dl>

    <div className="mt-5 grid grid-cols-2 gap-2">
      <Button onClick={() => setDialog("plan")}><Crown className="h-4 w-4" />Change plan</Button>
      <Button onClick={() => setDialog("wallet")}><Wallet className="h-4 w-4" />Adjust wallet</Button>
      <Button onClick={() => setDialog("coins")}><Coins className="h-4 w-4" />Adjust coins</Button>
      <Button onClick={() => setDialog("edit")}><UserCheck className="h-4 w-4" />Edit details</Button>
      <Button variant={user.is_blocked ? "default" : "danger"} loading={busy} onClick={() => void toggleBlock()} className="col-span-2"><Ban className="h-4 w-4" />{user.is_blocked ? "Unblock user" : "Block user"}</Button>
    </div>

    <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-indigo-500" />Role</p>
      <select value={user.role} disabled={!isSuper || user.id === selfId} onChange={(event) => void changeRole(event.target.value as Role)} className={`${inputCls} mt-2`}>
        <option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
      </select>
      <p className="mt-1.5 text-[11px] text-slate-400">{isSuper ? (user.id === selfId ? "You can't change your own role." : "Admins can open this dashboard. Super admins can also change roles.") : "Only a super admin can change roles."}</p>
    </div>

    <div className="mt-6">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">{(["wallet", "coins", "payments", "usage"] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold capitalize ${tab === item ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}>{item}</button>)}</div>
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {tab === "wallet" && (activity.wallet.length ? activity.wallet.map((row) => <Row key={row.id} label={row.label} date={row.created_at} value={`${row.direction === "credit" ? "+" : "−"}${inr(row.amount)}`} positive={row.direction === "credit"} />) : <Empty text="No wallet transactions." />)}
        {tab === "coins" && (activity.coins.length ? activity.coins.map((row) => <Row key={row.id} label={row.label} date={row.created_at} value={`${row.direction === "earned" ? "+" : "−"}${row.amount} PC`} positive={row.direction === "earned"} />) : <Empty text="No coin transactions." />)}
        {tab === "payments" && (activity.payments.length ? activity.payments.map((row) => <Row key={row.id} label={`${row.purpose.replace(/_/g, " ")} · ${row.status}`} date={row.created_at} value={inr(row.amount)} positive={row.status === "paid"} />) : <Empty text="No payments." />)}
        {tab === "usage" && (activity.usage.length ? activity.usage.map((row) => <Row key={row.id} label={row.tool_slug || row.feature_key || "tool"} date={row.created_at} value={`×${row.quantity}`} />) : <Empty text="No usage logged." />)}
      </ul>
    </div>

    {dialog === "wallet" && <AdjustDialog title="Adjust wallet" unit="₹" hint="Use a negative number to deduct (e.g. -20)." onClose={() => setDialog(null)} onSubmit={async (amount, reason) => done(await adminRpc("admin_adjust_wallet", { p_user: user.id, p_amount: amount, p_reason: reason }))} />}
    {dialog === "coins" && <AdjustDialog title="Adjust Print Coins" unit="PC" integer hint="Use a negative number to remove coins." onClose={() => setDialog(null)} onSubmit={async (amount, reason) => done(await adminRpc("admin_adjust_coins", { p_user: user.id, p_amount: Math.trunc(amount), p_reason: reason }))} />}
    {dialog === "plan" && <PlanDialog plans={plans} current={user.plan_id} onClose={() => setDialog(null)} onSubmit={async (planId, days) => done(await adminRpc("admin_set_plan", { p_user: user.id, p_plan_id: planId, p_days: days }))} />}
    {dialog === "edit" && <EditDialog user={user} onClose={() => setDialog(null)} onSubmit={async (patch) => done(await write(getSupabase().from("profiles").update(patch).eq("id", user.id), { action: "user_edit", table: "profiles", id: user.id, details: patch }))} />}
  </Drawer>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-[11px] text-slate-500">{label}</dt><dd className="mt-0.5 truncate font-medium">{value}</dd></div>;
}
function Row({ label, date, value, positive }: { label: string; date: string; value: string; positive?: boolean }) {
  return <li className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0"><span className="block truncate capitalize">{label}</span><span className="text-[11px] text-slate-400">{fmtDate(date, true)}</span></span><span className={`shrink-0 font-semibold ${positive === undefined ? "" : positive ? "text-emerald-600" : "text-rose-600"}`}>{value}</span></li>;
}

function AdjustDialog({ title, unit, hint, integer, onClose, onSubmit }: { title: string; unit: string; hint: string; integer?: boolean; onClose: () => void; onSubmit: (amount: number, reason: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const value = Number(amount);
  return <Modal title={title} onClose={onClose}>
    <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); if (!value || !reason.trim()) return; setBusy(true); await onSubmit(value, reason.trim()); setBusy(false); }}>
      <Field label={`Amount (${unit})`} hint={hint}><input autoFocus type="number" step={integer ? 1 : 0.01} value={amount} onChange={(event) => setAmount(event.target.value)} className={inputCls} placeholder={integer ? "e.g. 50 or -10" : "e.g. 100 or -20"} /></Field>
      <Field label="Reason (shown to the user)"><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Refund for failed print" /></Field>
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy} disabled={!value || !reason.trim()}>{value < 0 ? "Deduct" : "Add"}</Button></div>
    </form>
  </Modal>;
}

function PlanDialog({ plans, current, onClose, onSubmit }: { plans: Plan[]; current: string; onClose: () => void; onSubmit: (planId: string, days: number | null) => Promise<void> }) {
  const [planId, setPlanId] = useState(current);
  const plan = plans.find((item) => item.id === planId);
  const [days, setDays] = useState(String(plan?.duration_days || 30));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDays(String(plans.find((item) => item.id === planId)?.duration_days || 30)); }, [planId, plans]);
  const isFree = plan?.period === "free";
  return <Modal title="Change plan" onClose={onClose}>
    <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); setBusy(true); await onSubmit(planId, isFree ? null : Math.max(1, Number(days) || 30)); setBusy(false); }}>
      <Field label="Plan"><select value={planId} onChange={(event) => setPlanId(event.target.value)} className={inputCls}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      {!isFree && <Field label="Valid for (days)" hint="Starts today. Replaces any active subscription."><input type="number" min={1} value={days} onChange={(event) => setDays(event.target.value)} className={inputCls} /></Field>}
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save plan</Button></div>
    </form>
  </Modal>;
}

function EditDialog({ user, onClose, onSubmit }: { user: Profile; onClose: () => void; onSubmit: (patch: Partial<Profile>) => Promise<void> }) {
  const [name, setName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [verified, setVerified] = useState(user.phone_verified);
  const [rate, setRate] = useState(String(user.card_rate));
  const [busy, setBusy] = useState(false);
  return <Modal title="Edit user details" onClose={onClose}>
    <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); setBusy(true); await onSubmit({ full_name: name.trim(), phone: phone.trim() || null, phone_verified: verified, card_rate: Math.max(0, Number(rate) || 0) }); setBusy(false); }}>
      <Field label="Full name"><input value={name} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
      <Field label="Phone"><input value={phone} inputMode="numeric" maxLength={10} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Phone verified</label>
      <Field label="Card rate (₹ per card)"><input type="number" min={0} value={rate} onChange={(event) => setRate(event.target.value)} className={inputCls} /></Field>
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save</Button></div>
    </form>
  </Modal>;
}
