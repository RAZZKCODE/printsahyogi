"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly, safeSearch, write } from "@/tools/admin/admin-api";
import { Button, Empty, ErrorBox, Loading, Pagination, SearchInput, SectionHeader, Table, fmtDate, inputCls, inr, panel, useToast } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/admin/sections/overview";

type Payment = {
  id: string; user_id: string; purpose: string; amount: number; wallet_credit: number; plan_id: string | null; provider: string;
  provider_order_id: string | null; provider_payment_id: string | null; status: string; created_at: string; paid_at: string | null;
  profiles: { full_name: string; email: string | null } | null;
};
const PAGE = 25;

export function PaymentsSection() {
  const toast = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sum, setSum] = useState(0);

  useEffect(() => { const timer = window.setTimeout(() => { setQuery(safeSearch(search)); setPage(0); }, 350); return () => window.clearTimeout(timer); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let request = getSupabase().from("payments").select("*, profiles!inner(full_name, email)", { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (status !== "all") request = request.eq("status", status);
    if (purpose !== "all") request = request.eq("purpose", purpose);
    if (query) request = request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`, { referencedTable: "profiles" });
    const { data, error: err, count } = await request;
    if (err) setError(friendly(err.message));
    const list = (data as unknown as Payment[]) ?? [];
    setRows(list);
    setTotal(count ?? 0);
    setSum(list.filter((row) => row.status === "paid").reduce((acc, row) => acc + Number(row.amount), 0));
    setLoading(false);
  }, [page, purpose, query, status]);

  useEffect(() => { void load(); }, [load]);

  const setPaymentStatus = async (row: Payment, next: string) => {
    if (next === row.status) return;
    if (!window.confirm(`Mark this ${inr(row.amount)} payment as "${next}"?\n\nThis only updates the record. Process any real refund in your payment gateway, and adjust the user's wallet separately if needed.`)) return;
    const result = await write(getSupabase().from("payments").update({ status: next, ...(next === "paid" && !row.paid_at ? { paid_at: new Date().toISOString() } : {}) }).eq("id", row.id), { action: "payment_status", table: "payments", id: row.id, details: { from: row.status, to: next } });
    toast(result.ok ? "Payment updated." : result.message, result.ok);
    if (result.ok) void load();
  };

  return <div>
    <SectionHeader title="Payments" description="All Razorpay orders and their status." actions={<Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    <section className={panel}>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by user name or email" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className={`${inputCls} sm:w-36`}><option value="all">All statuses</option><option value="paid">Paid</option><option value="created">Created</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>
        <select value={purpose} onChange={(event) => { setPurpose(event.target.value); setPage(0); }} className={`${inputCls} sm:w-40`}><option value="all">All purposes</option><option value="wallet_topup">Wallet top-up</option><option value="plan">Plan</option><option value="credits">Credits</option></select>
        <span className="text-xs text-slate-500 sm:ml-auto">Paid on this page: <b className="text-slate-800 dark:text-slate-100">{inr(sum)}</b></span>
      </div>
      {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No payments found." /> : <Table head={["User", "Purpose", "Amount", "Gateway IDs", "Created", "Status"]}>
        {rows.map((row) => <tr key={row.id}>
          <td className="px-4 py-3"><p className="font-medium">{row.profiles?.full_name || "—"}</p><p className="text-xs text-slate-500">{row.profiles?.email}</p></td>
          <td className="px-4 py-3 capitalize">{row.purpose.replace(/_/g, " ")}{row.plan_id && <span className="block text-xs text-slate-500">{row.plan_id}</span>}{Number(row.wallet_credit) > 0 && <span className="block text-xs text-slate-500">credit {inr(row.wallet_credit)}</span>}</td>
          <td className="px-4 py-3 font-semibold">{inr(row.amount)}</td>
          <td className="px-4 py-3 font-mono text-[11px] text-slate-500"><span className="block max-w-[180px] truncate" title={row.provider_order_id ?? ""}>{row.provider_order_id || "—"}</span><span className="block max-w-[180px] truncate" title={row.provider_payment_id ?? ""}>{row.provider_payment_id || ""}</span></td>
          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(row.created_at, true)}{row.paid_at && <span className="block">paid {fmtDate(row.paid_at, true)}</span>}</td>
          <td className="px-4 py-3"><div className="flex items-center gap-2"><StatusBadge status={row.status} /><select aria-label="Change status" value={row.status} onChange={(event) => void setPaymentStatus(row, event.target.value)} className="h-7 rounded-md border border-slate-200 bg-transparent px-1 text-[11px] dark:border-slate-700"><option value="created">created</option><option value="paid">paid</option><option value="failed">failed</option><option value="refunded">refunded</option></select></div></td>
        </tr>)}
      </Table>}
      <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </section>
  </div>;
}
