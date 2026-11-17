"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, MessageSquare, RefreshCw, Send } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly, write } from "@/tools/admin/admin-api";
import { Badge, Button, Drawer, Empty, ErrorBox, Loading, SectionHeader, Table, fmtDate, inputCls, panel, useToast } from "@/components/admin/admin-ui";

type Ticket = {
  id: string; subject: string; category: string; status: string; priority: string; assigned_to: string | null; created_at: string; updated_at: string;
  user: { full_name: string; email: string | null } | null;
  assignee: { full_name: string } | null;
};
type Message = { id: string; sender_id: string | null; is_staff: boolean; message: string; created_at: string };
type Suggestion = { id: string; title: string; description: string | null; status: string; admin_note: string | null; created_at: string; profiles: { full_name: string; email: string | null } | null };

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const SUGGESTION_STATUSES = ["new", "under_review", "planned", "done", "rejected"];
const statusTone = (status: string) => status === "open" || status === "new" ? "blue" : status === "in_progress" || status === "under_review" || status === "planned" ? "amber" : status === "rejected" ? "red" : "green";

export function SupportSection({ selfId }: { selfId: string }) {
  const [tab, setTab] = useState<"tickets" | "suggestions">("tickets");
  return <div>
    <SectionHeader title="Support & Feedback" description="Reply to tickets and triage feature suggestions." />
    <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:w-fit">
      <button type="button" onClick={() => setTab("tickets")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${tab === "tickets" ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-500"}`}><MessageSquare className="h-4 w-4" />Tickets</button>
      <button type="button" onClick={() => setTab("suggestions")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${tab === "suggestions" ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-500"}`}><Lightbulb className="h-4 w-4" />Suggestions</button>
    </div>
    {tab === "tickets" ? <Tickets selfId={selfId} /> : <Suggestions />}
  </div>;
}

function Tickets({ selfId }: { selfId: string }) {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let request = getSupabase().from("support_tickets")
      .select("id, subject, category, status, priority, assigned_to, created_at, updated_at, user:profiles!support_tickets_user_id_fkey(full_name, email), assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
      .order("updated_at", { ascending: false }).limit(200);
    if (filter === "active") request = request.in("status", ["open", "in_progress"]);
    else if (filter !== "all") request = request.eq("status", filter);
    const { data, error: err } = await request;
    if (err) setError(friendly(err.message));
    setRows((data as unknown as Ticket[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  return <section className={panel}>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
      {["active", "all", ...TICKET_STATUSES].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item.replace("_", " ")}</button>)}
      <Button size="sm" className="ml-auto" onClick={() => void load()} loading={loading}><RefreshCw className="h-3.5 w-3.5" /></Button>
    </div>
    {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No tickets here. 🎉" /> : <Table head={["Subject", "User", "Category", "Priority", "Status", "Updated"]}>
      {rows.map((row) => <tr key={row.id} onClick={() => setOpenId(row.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td className="px-4 py-3 font-medium">{row.subject}{row.assignee && <span className="block text-[11px] font-normal text-slate-400">Assigned: {row.assignee.full_name}</span>}</td>
        <td className="px-4 py-3"><p>{row.user?.full_name || "—"}</p><p className="text-xs text-slate-500">{row.user?.email}</p></td>
        <td className="px-4 py-3 capitalize">{row.category}</td>
        <td className="px-4 py-3"><Badge tone={row.priority === "high" ? "red" : row.priority === "low" ? "slate" : "blue"}>{row.priority}</Badge></td>
        <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{row.status.replace("_", " ")}</Badge></td>
        <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(row.updated_at, true)}</td>
      </tr>)}
    </Table>}
    {openId && <TicketDrawer ticketId={openId} selfId={selfId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
  </section>;
}

function TicketDrawer({ ticketId, selfId, onClose, onChanged }: { ticketId: string; selfId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [t, m] = await Promise.all([
      supabase.from("support_tickets").select("id, subject, category, status, priority, assigned_to, created_at, updated_at, user:profiles!support_tickets_user_id_fkey(full_name, email), assignee:profiles!support_tickets_assigned_to_fkey(full_name)").eq("id", ticketId).single(),
      supabase.from("support_messages").select("id, sender_id, is_staff, message, created_at").eq("ticket_id", ticketId).order("created_at")
    ]);
    if (t.error) { toast(friendly(t.error.message), false); return; }
    setTicket(t.data as unknown as Ticket);
    setMessages((m.data as Message[]) ?? []);
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [ticketId, toast]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (change: Partial<Pick<Ticket, "status" | "priority" | "assigned_to">>) => {
    const result = await write(getSupabase().from("support_tickets").update(change).eq("id", ticketId), { action: "ticket_update", table: "support_tickets", id: ticketId, details: change });
    toast(result.ok ? "Ticket updated." : result.message, result.ok);
    if (result.ok) { await load(); onChanged(); }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    const { error } = await getSupabase().from("support_messages").insert({ ticket_id: ticketId, sender_id: selfId, is_staff: true, message: text });
    if (error) toast(friendly(error.message), false);
    else {
      setReply("");
      if (ticket?.status === "open") await getSupabase().from("support_tickets").update({ status: "in_progress", assigned_to: ticket.assigned_to ?? selfId }).eq("id", ticketId);
      else await getSupabase().from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
      await load();
      onChanged();
    }
    setSending(false);
  };

  return <Drawer title={ticket?.subject ?? "Ticket"} onClose={onClose}>
    {!ticket ? <Loading /> : <div className="flex h-full flex-col">
      <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
        <p className="font-medium">{ticket.user?.full_name || "—"} <span className="font-normal text-slate-500">· {ticket.user?.email}</span></p>
        <p className="mt-0.5 text-xs text-slate-500">Opened {fmtDate(ticket.created_at, true)} · {ticket.category}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select aria-label="Status" value={ticket.status} onChange={(event) => void patch({ status: event.target.value })} className={inputCls}>{TICKET_STATUSES.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select>
          <select aria-label="Priority" value={ticket.priority} onChange={(event) => void patch({ priority: event.target.value })} className={inputCls}><option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option></select>
        </div>
        {ticket.assigned_to !== selfId && <Button size="sm" className="mt-2" onClick={() => void patch({ assigned_to: selfId })}>Assign to me</Button>}
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {messages.length === 0 ? <Empty text="No messages yet." /> : messages.map((item) => <div key={item.id} className={`flex ${item.is_staff ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${item.is_staff ? "rounded-br-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white" : "rounded-bl-sm bg-slate-100 dark:bg-slate-800"}`}>
            <p className="whitespace-pre-wrap break-words">{item.message}</p>
            <p className={`mt-1 text-[10px] ${item.is_staff ? "text-white/70" : "text-slate-400"}`}>{item.is_staff ? "Support" : "User"} · {fmtDate(item.created_at, true)}</p>
          </div>
        </div>)}
        <div ref={endRef} />
      </div>

      <form onSubmit={(event) => void send(event)} className="sticky bottom-0 mt-4 flex gap-2 border-t border-slate-200 bg-white pt-4 dark:border-slate-800 dark:bg-slate-900">
        <textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void send(event); }} rows={2} maxLength={5000} placeholder="Write a reply… (Ctrl+Enter to send)" className={`${inputCls} h-auto flex-1 resize-none py-2`} />
        <Button type="submit" variant="primary" loading={sending} disabled={!reply.trim()} className="self-end"><Send className="h-4 w-4" />Send</Button>
      </form>
    </div>}
  </Drawer>;
}

function Suggestions() {
  const toast = useToast();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let request = getSupabase().from("feature_suggestions").select("id, title, description, status, admin_note, created_at, profiles(full_name, email)").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") request = request.eq("status", filter);
    const { data, error: err } = await request;
    if (err) setError(friendly(err.message));
    const list = (data as unknown as Suggestion[]) ?? [];
    setRows(list);
    setNotes(Object.fromEntries(list.map((row) => [row.id, row.admin_note ?? ""])));
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const save = async (row: Suggestion, change: Partial<Pick<Suggestion, "status" | "admin_note">>) => {
    const result = await write(getSupabase().from("feature_suggestions").update(change).eq("id", row.id), { action: "suggestion_update", table: "feature_suggestions", id: row.id, details: change });
    toast(result.ok ? "Suggestion updated." : result.message, result.ok);
    if (result.ok) setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...change } : item));
  };

  return <section className={panel}>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
      {["all", ...SUGGESTION_STATUSES].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item.replace("_", " ")}</button>)}
      <Button size="sm" className="ml-auto" onClick={() => void load()} loading={loading}><RefreshCw className="h-3.5 w-3.5" /></Button>
    </div>
    {error ? <div className="p-4"><ErrorBox message={error} onRetry={() => void load()} /></div> : loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No suggestions yet." /> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => <li key={row.id} className="grid gap-3 p-4 md:grid-cols-[1fr_180px_260px]">
        <div className="min-w-0">
          <p className="font-medium">{row.title}</p>
          {row.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{row.description}</p>}
          <p className="mt-1.5 text-xs text-slate-400">{row.profiles?.full_name || row.profiles?.email || "Anonymous"} · {fmtDate(row.created_at)}</p>
        </div>
        <div><Badge tone={statusTone(row.status)}>{row.status.replace("_", " ")}</Badge><select aria-label="Status" value={row.status} onChange={(event) => void save(row, { status: event.target.value })} className={`${inputCls} mt-2`}>{SUGGESTION_STATUSES.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></div>
        <div className="flex gap-2"><input value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Admin note (internal)" className={inputCls} /><Button size="md" disabled={(notes[row.id] ?? "") === (row.admin_note ?? "")} onClick={() => void save(row, { admin_note: (notes[row.id] ?? "").trim() || null })}>Save</Button></div>
      </li>)}
    </ul>}
  </section>;
}
