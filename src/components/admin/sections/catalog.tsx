"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly, write } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, SectionHeader, Table, Toggle, inputCls, inr, panel, useToast } from "@/components/admin/admin-ui";

type Plan = { id: string; name: string; price: number; coin_cost: number; period: "free" | "month" | "year"; duration_days: number; daily_card_credits: number; daily_bg_removal_credits: number; unlimited_cards: boolean; features: string[]; is_popular: boolean; is_active: boolean; sort_order: number };
type TopUp = { id: string; label: string; pay_amount: number; credit_amount: number; is_active: boolean; sort_order: number };
type CreditPack = { id: string; feature_key: string; credits: number; price: number; is_active: boolean; sort_order: number };
type Feature = { key: string; label: string };

export function CatalogSection() {
  const toast = useToast();
  const [tab, setTab] = useState<"plans" | "topups" | "credits">("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPlan, setEditPlan] = useState<Plan | "new" | null>(null);
  const [editTopup, setEditTopup] = useState<TopUp | "new" | null>(null);
  const [editPack, setEditPack] = useState<CreditPack | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const [p, t, c, f] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("topup_packs").select("*").order("sort_order"),
      supabase.from("credit_packs").select("*").order("feature_key").order("sort_order"),
      supabase.from("features").select("key, label").order("sort_order")
    ]);
    const err = p.error || t.error || c.error || f.error;
    if (err) setError(friendly(err.message));
    setPlans((p.data as Plan[]) ?? []);
    setTopups((t.data as TopUp[]) ?? []);
    setPacks((c.data as CreditPack[]) ?? []);
    setFeatures((f.data as Feature[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const after = (result: { ok: boolean; message: string }, close?: () => void) => {
    toast(result.ok ? "Saved." : result.message, result.ok);
    if (result.ok) { close?.(); void load(); }
  };

  const quickToggle = async (table: "plans" | "topup_packs" | "credit_packs", id: string, column: string, value: boolean) => {
    after(await write(getSupabase().from(table).update({ [column]: value }).eq(table === "plans" ? "id" : "id", id), { action: `${table}_update`, table, id, details: { [column]: value } }));
  };

  const remove = async (table: "topup_packs" | "credit_packs", id: string, label: string) => {
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    after(await write(getSupabase().from(table).delete().eq("id", id), { action: `${table}_delete`, table, id, details: { label } }));
  };

  const featureLabel = (key: string) => features.find((item) => item.key === key)?.label ?? key;

  return <div>
    <SectionHeader title="Plans & Packs" description="Prices and limits shown to users. Changes go live immediately." actions={<>
      {tab === "plans" && <Button variant="primary" onClick={() => setEditPlan("new")}><Plus className="h-4 w-4" />New plan</Button>}
      {tab === "topups" && <Button variant="primary" onClick={() => setEditTopup("new")}><Plus className="h-4 w-4" />New top-up pack</Button>}
      {tab === "credits" && <Button variant="primary" onClick={() => setEditPack("new")}><Plus className="h-4 w-4" />New credit pack</Button>}
      <Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </>} />
    <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:w-fit">{([["plans", "Membership plans"], ["topups", "Wallet top-ups"], ["credits", "Credit packs"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${tab === id ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-500"}`}>{label}</button>)}</div>

    {error && <div className="mb-4"><ErrorBox message={error} onRetry={() => void load()} /></div>}
    <section className={panel}>
      {loading && plans.length === 0 ? <Loading /> : <>
        {tab === "plans" && (plans.length === 0 ? <Empty text="No plans yet." /> : <Table head={["Plan", "Price", "Coins", "Duration", "Daily credits", "Popular", "Active", ""]}>
          {plans.map((plan) => <tr key={plan.id}>
            <td className="px-4 py-3"><p className="font-semibold">{plan.name}</p><p className="font-mono text-[11px] text-slate-400">{plan.id}</p></td>
            <td className="px-4 py-3 font-medium">{inr(plan.price)}</td>
            <td className="px-4 py-3">{plan.coin_cost} PC</td>
            <td className="px-4 py-3 text-xs">{plan.period === "free" ? "Forever" : `${plan.duration_days} days`}</td>
            <td className="px-4 py-3 text-xs">{plan.unlimited_cards ? "Unlimited" : plan.daily_card_credits} cards · {plan.daily_bg_removal_credits} BG</td>
            <td className="px-4 py-3"><Toggle label="Popular" checked={plan.is_popular} onChange={(value) => void quickToggle("plans", plan.id, "is_popular", value)} /></td>
            <td className="px-4 py-3"><Toggle label="Active" checked={plan.is_active} disabled={plan.id === "free"} onChange={(value) => void quickToggle("plans", plan.id, "is_active", value)} /></td>
            <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => setEditPlan(plan)}><Pencil className="h-3.5 w-3.5" />Edit</Button></td>
          </tr>)}
        </Table>)}

        {tab === "topups" && (topups.length === 0 ? <Empty text="No top-up packs yet." /> : <Table head={["Label", "User pays", "Wallet gets", "Bonus", "Order", "Active", ""]}>
          {topups.map((pack) => <tr key={pack.id}>
            <td className="px-4 py-3 font-semibold">{pack.label}</td>
            <td className="px-4 py-3">{inr(pack.pay_amount)}</td>
            <td className="px-4 py-3 font-medium">{inr(pack.credit_amount)}</td>
            <td className="px-4 py-3">{Number(pack.credit_amount) > Number(pack.pay_amount) ? <Badge tone="amber">+{inr(Number(pack.credit_amount) - Number(pack.pay_amount))}</Badge> : "—"}</td>
            <td className="px-4 py-3 text-xs">{pack.sort_order}</td>
            <td className="px-4 py-3"><Toggle label="Active" checked={pack.is_active} onChange={(value) => void quickToggle("topup_packs", pack.id, "is_active", value)} /></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1.5"><Button size="sm" onClick={() => setEditTopup(pack)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" aria-label="Delete" onClick={() => void remove("topup_packs", pack.id, pack.label)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button></div></td>
          </tr>)}
        </Table>)}

        {tab === "credits" && (packs.length === 0 ? <Empty text="No credit packs yet. Users see these under “Add Credits”." /> : <Table head={["Feature", "Credits", "Price", "Per credit", "Order", "Active", ""]}>
          {packs.map((pack) => <tr key={pack.id}>
            <td className="px-4 py-3 font-medium">{featureLabel(pack.feature_key)}</td>
            <td className="px-4 py-3">{pack.credits}</td>
            <td className="px-4 py-3 font-medium">{inr(pack.price)}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{inr(Number(pack.price) / pack.credits)}</td>
            <td className="px-4 py-3 text-xs">{pack.sort_order}</td>
            <td className="px-4 py-3"><Toggle label="Active" checked={pack.is_active} onChange={(value) => void quickToggle("credit_packs", pack.id, "is_active", value)} /></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1.5"><Button size="sm" onClick={() => setEditPack(pack)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" aria-label="Delete" onClick={() => void remove("credit_packs", pack.id, `${pack.credits} credits pack`)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button></div></td>
          </tr>)}
        </Table>)}
      </>}
    </section>

    {editPlan && <PlanForm plan={editPlan === "new" ? null : editPlan} onClose={() => setEditPlan(null)} onSaved={(result) => after(result, () => setEditPlan(null))} />}
    {editTopup && <TopUpForm pack={editTopup === "new" ? null : editTopup} onClose={() => setEditTopup(null)} onSaved={(result) => after(result, () => setEditTopup(null))} />}
    {editPack && <CreditPackForm pack={editPack === "new" ? null : editPack} features={features} onClose={() => setEditPack(null)} onSaved={(result) => after(result, () => setEditPack(null))} />}
  </div>;
}

type Saved = (result: { ok: boolean; message: string }) => void;

function PlanForm({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: Saved }) {
  const [form, setForm] = useState({
    id: plan?.id ?? "", name: plan?.name ?? "", price: String(plan?.price ?? 0), coin_cost: String(plan?.coin_cost ?? 0), period: plan?.period ?? "month",
    duration_days: String(plan?.duration_days ?? 30), daily_card_credits: String(plan?.daily_card_credits ?? 10), daily_bg_removal_credits: String(plan?.daily_bg_removal_credits ?? 10),
    unlimited_cards: plan?.unlimited_cards ?? false, features: (plan?.features ?? []).join("\n"), is_popular: plan?.is_popular ?? false, is_active: plan?.is_active ?? true, sort_order: String(plan?.sort_order ?? 10)
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = form.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!id || !form.name.trim()) return;
    setBusy(true);
    const row = {
      name: form.name.trim(), price: Number(form.price) || 0, coin_cost: Math.trunc(Number(form.coin_cost) || 0), period: form.period,
      duration_days: form.period === "free" ? 0 : Math.max(1, Math.trunc(Number(form.duration_days) || 30)),
      daily_card_credits: Math.trunc(Number(form.daily_card_credits) || 0), daily_bg_removal_credits: Math.trunc(Number(form.daily_bg_removal_credits) || 0),
      unlimited_cards: form.unlimited_cards, features: form.features.split("\n").map((line) => line.trim()).filter(Boolean),
      is_popular: form.is_popular, is_active: form.is_active, sort_order: Math.trunc(Number(form.sort_order) || 0)
    };
    const supabase = getSupabase();
    const result = plan
      ? await write(supabase.from("plans").update(row).eq("id", plan.id), { action: "plan_update", table: "plans", id: plan.id, details: row })
      : await write(supabase.from("plans").insert({ id, ...row }), { action: "plan_create", table: "plans", id, details: row });
    setBusy(false);
    onSaved(result);
  };
  return <Modal title={plan ? `Edit ${plan.name}` : "New plan"} onClose={onClose} wide>
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Plan ID" hint="Lowercase, e.g. pro-max. Can't be changed later."><input value={form.id} disabled={!!plan} onChange={(event) => set("id", event.target.value)} className={inputCls} required /></Field>
      <Field label="Name"><input value={form.name} onChange={(event) => set("name", event.target.value)} className={inputCls} required /></Field>
      <Field label="Price (₹)"><input type="number" min={0} step="0.01" value={form.price} onChange={(event) => set("price", event.target.value)} className={inputCls} /></Field>
      <Field label="Coin cost (PC)"><input type="number" min={0} value={form.coin_cost} onChange={(event) => set("coin_cost", event.target.value)} className={inputCls} /></Field>
      <Field label="Period"><select value={form.period} disabled={plan?.id === "free"} onChange={(event) => set("period", event.target.value)} className={inputCls}><option value="month">Monthly</option><option value="year">Yearly</option><option value="free">Free</option></select></Field>
      <Field label="Duration (days)"><input type="number" min={0} value={form.duration_days} disabled={form.period === "free"} onChange={(event) => set("duration_days", event.target.value)} className={inputCls} /></Field>
      <Field label="Daily card credits"><input type="number" min={0} value={form.daily_card_credits} onChange={(event) => set("daily_card_credits", event.target.value)} className={inputCls} /></Field>
      <Field label="Daily BG removal credits"><input type="number" min={0} value={form.daily_bg_removal_credits} onChange={(event) => set("daily_bg_removal_credits", event.target.value)} className={inputCls} /></Field>
      <div className="sm:col-span-2"><Field label="Features (one per line)"><textarea rows={4} value={form.features} onChange={(event) => set("features", event.target.value)} className={`${inputCls} h-auto py-2`} /></Field></div>
      <Field label="Sort order"><input type="number" value={form.sort_order} onChange={(event) => set("sort_order", event.target.value)} className={inputCls} /></Field>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.unlimited_cards} onChange={(event) => set("unlimited_cards", event.target.checked)} className="h-4 w-4 accent-indigo-600" />Unlimited card credits</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_popular} onChange={(event) => set("is_popular", event.target.checked)} className="h-4 w-4 accent-indigo-600" />Mark as most popular</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} disabled={plan?.id === "free"} onChange={(event) => set("is_active", event.target.checked)} className="h-4 w-4 accent-indigo-600" />Active (visible to users)</label>
      </div>
      <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save plan</Button></div>
    </form>
  </Modal>;
}

function TopUpForm({ pack, onClose, onSaved }: { pack: TopUp | null; onClose: () => void; onSaved: Saved }) {
  const [label, setLabel] = useState(pack?.label ?? "");
  const [pay, setPay] = useState(String(pack?.pay_amount ?? ""));
  const [credit, setCredit] = useState(String(pack?.credit_amount ?? ""));
  const [order, setOrder] = useState(String(pack?.sort_order ?? 10));
  const [active, setActive] = useState(pack?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim() || !(Number(pay) > 0) || !(Number(credit) > 0)) return;
    setBusy(true);
    const row = { label: label.trim(), pay_amount: Number(pay), credit_amount: Number(credit), sort_order: Math.trunc(Number(order) || 0), is_active: active };
    const supabase = getSupabase();
    const result = pack
      ? await write(supabase.from("topup_packs").update(row).eq("id", pack.id), { action: "topup_update", table: "topup_packs", id: pack.id, details: row })
      : await write(supabase.from("topup_packs").insert(row), { action: "topup_create", table: "topup_packs", id: row.label, details: row });
    setBusy(false);
    onSaved(result);
  };
  return <Modal title={pack ? "Edit top-up pack" : "New top-up pack"} onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <Field label="Label"><input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} className={inputCls} placeholder="e.g. Super Saver" required /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="User pays (₹)"><input type="number" min={1} step="0.01" value={pay} onChange={(event) => setPay(event.target.value)} className={inputCls} required /></Field><Field label="Wallet gets (₹)" hint="Higher than pay = bonus"><input type="number" min={1} step="0.01" value={credit} onChange={(event) => setCredit(event.target.value)} className={inputCls} required /></Field></div>
      <Field label="Sort order"><input type="number" value={order} onChange={(event) => setOrder(event.target.value)} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Active</label>
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save</Button></div>
    </form>
  </Modal>;
}

function CreditPackForm({ pack, features, onClose, onSaved }: { pack: CreditPack | null; features: Feature[]; onClose: () => void; onSaved: Saved }) {
  const [feature, setFeature] = useState(pack?.feature_key ?? features[0]?.key ?? "");
  const [credits, setCredits] = useState(String(pack?.credits ?? ""));
  const [price, setPrice] = useState(String(pack?.price ?? ""));
  const [order, setOrder] = useState(String(pack?.sort_order ?? 10));
  const [active, setActive] = useState(pack?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!feature || !(Number(credits) > 0) || Number(price) < 0) return;
    setBusy(true);
    const row = { feature_key: feature, credits: Math.trunc(Number(credits)), price: Number(price) || 0, sort_order: Math.trunc(Number(order) || 0), is_active: active };
    const supabase = getSupabase();
    const result = pack
      ? await write(supabase.from("credit_packs").update(row).eq("id", pack.id), { action: "credit_pack_update", table: "credit_packs", id: pack.id, details: row })
      : await write(supabase.from("credit_packs").insert(row), { action: "credit_pack_create", table: "credit_packs", id: feature, details: row });
    setBusy(false);
    onSaved(result);
  };
  return <Modal title={pack ? "Edit credit pack" : "New credit pack"} onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <Field label="Feature"><select value={feature} onChange={(event) => setFeature(event.target.value)} className={inputCls}>{features.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Credits"><input autoFocus type="number" min={1} value={credits} onChange={(event) => setCredits(event.target.value)} className={inputCls} required /></Field><Field label="Price (₹)"><input type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={inputCls} required /></Field></div>
      <Field label="Sort order"><input type="number" value={order} onChange={(event) => setOrder(event.target.value)} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Active</label>
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save</Button></div>
    </form>
  </Modal>;
}
