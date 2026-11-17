"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Loading, Pagination, SectionHeader, Table, fmtDate, panel } from "@/components/admin/admin-ui";

type Referral = {
  id: string; code: string; join_coins_awarded: number; upgraded: boolean; upgrade_coins_awarded: number; created_at: string; upgraded_at: string | null;
  referrer: { full_name: string; email: string | null } | null;
  referred: { full_name: string; email: string | null } | null;
};
const PAGE = 25;

export function ReferralsSection() {
  const [rows, setRows] = useState<Referral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "upgraded" | "pending">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaders, setLeaders] = useState<Array<{ name: string; count: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    let request = supabase.from("referrals")
      .select("id, code, join_coins_awarded, upgraded, upgrade_coins_awarded, created_at, upgraded_at, referrer:profiles!referrals_referrer_id_fkey(full_name, email), referred:profiles!referrals_referred_id_fkey(full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (filter === "upgraded") request = request.eq("upgraded", true);
    if (filter === "pending") request = request.eq("upgraded", false);
    const [{ data, error: err, count }, all] = await Promise.all([
      request,
      supabase.from("referrals").select("referrer:profiles!referrals_referrer_id_fkey(full_name, email)").limit(2000)
    ]);
    if (err) setError(friendly(err.message));
    setRows((data as unknown as Referral[]) ?? []);
    setTotal(count ?? 0);
    const tally = new Map<string, number>();
    for (const row of (all.data as unknown as Array<{ referrer: { full_name: string; email: string | null } | null }>) ?? []) {
      const name = row.referrer?.full_name || row.referrer?.email || "Unknown";
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    setLeaders(Array.from(tally.entries()).map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count).slice(0, 5));
    setLoading(false);
  }, [filter, page]);

  useEffect(() => { void load(); }, [load]);

  return <div>
    <SectionHeader title="Referrals" description="Who invited whom, and the coins that were awarded." actions={<Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    {leaders.length > 0 && <div className="mb-5 grid gap-3 sm:grid-cols-5">{leaders.map((leader, index) => <div key={leader.name} className={`${panel} p-4`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">#{index + 1} referrer</p><p className="mt-1 truncate font-semibold">{leader.name}</p><p className="text-sm text-emerald-600">{leader.count} invites</p></div>)}</div>}
    <section className={panel}>
      <div className="flex gap-1 border-b border-slate-100 p-3 dark:border-slate-800">{(["all", "upgraded", "pending"] as const).map((item) => <button key={item} type="button" onClick={() => { setFilter(item); setPage(0); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item}</button>)}</div>
      {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No referrals yet." /> : <Table head={["Referrer", "New user", "Code", "Coins", "Status", "Joined"]}>
        {rows.map((row) => <tr key={row.id}>
          <td className="px-4 py-3"><p className="font-medium">{row.referrer?.full_name || "—"}</p><p className="text-xs text-slate-500">{row.referrer?.email}</p></td>
          <td className="px-4 py-3"><p className="font-medium">{row.referred?.full_name || "—"}</p><p className="text-xs text-slate-500">{row.referred?.email}</p></td>
          <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
          <td className="px-4 py-3 text-xs">+{row.join_coins_awarded} to new user{row.upgrade_coins_awarded > 0 && <span className="block text-emerald-600">+{row.upgrade_coins_awarded} to referrer</span>}</td>
          <td className="px-4 py-3">{row.upgraded ? <Badge tone="green">Upgraded</Badge> : <Badge>Pending</Badge>}</td>
          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(row.created_at)}</td>
        </tr>)}
      </Table>}
      <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </section>
  </div>;
}
