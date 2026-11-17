"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Loading, Pagination, SectionHeader, Table, fmtDate, inputCls, panel } from "@/components/admin/admin-ui";

type Log = { id: number; action: string; target_table: string | null; target_id: string | null; details: Record<string, unknown>; created_at: string; profiles: { full_name: string; email: string | null } | null };
const PAGE = 50;

export function AuditSection() {
  const [rows, setRows] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [table, setTable] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let request = getSupabase().from("admin_audit_logs").select("id, action, target_table, target_id, details, created_at, profiles(full_name, email)", { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (table !== "all") request = request.eq("target_table", table);
    const { data, error: err, count } = await request;
    if (err) setError(friendly(err.message));
    setRows((data as unknown as Log[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, table]);

  useEffect(() => { void load(); }, [load]);

  return <div>
    <SectionHeader title="Audit Log" description="Every change made from this dashboard. Entries can't be edited or deleted." actions={<Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    <section className={panel}>
      <div className="border-b border-slate-100 p-3 dark:border-slate-800">
        <select value={table} onChange={(event) => { setTable(event.target.value); setPage(0); }} className={`${inputCls} sm:w-56`}>
          <option value="all">All areas</option>
          {["profiles", "payments", "plans", "tools", "topup_packs", "credit_packs", "announcements", "app_settings", "support_tickets", "feature_suggestions"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No admin activity yet." /> : <Table head={["When", "Admin", "Action", "Target", "Details"]}>
        {rows.map((row) => <tr key={row.id} className="align-top">
          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(row.created_at, true)}</td>
          <td className="px-4 py-3"><p className="text-sm">{row.profiles?.full_name || "—"}</p><p className="text-xs text-slate-500">{row.profiles?.email}</p></td>
          <td className="px-4 py-3"><Badge tone="violet">{row.action.replace(/_/g, " ")}</Badge></td>
          <td className="px-4 py-3 text-xs"><span className="text-slate-500">{row.target_table}</span><span className="block max-w-[160px] truncate font-mono" title={row.target_id ?? ""}>{row.target_id}</span></td>
          <td className="px-4 py-3 text-xs">
            <button type="button" onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="text-indigo-600 hover:underline">{expanded === row.id ? "Hide" : "Show"}</button>
            {expanded === row.id && <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 font-mono text-[11px] dark:bg-slate-800">{JSON.stringify(row.details, null, 2)}</pre>}
          </td>
        </tr>)}
      </Table>}
      <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </section>
  </div>;
}
