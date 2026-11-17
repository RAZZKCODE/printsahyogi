"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronDown, CircleAlert, CircleCheck, Copy, Headset, Lightbulb, LoaderCircle, LogIn, Mail,
  MessageCircle, MessageSquare, Send, ShieldCheck, Ticket
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/tools/auth/auth-store";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, emailLink, whatsappLink } from "@/lib/support";

type TicketRow = { id: string; subject: string; category: string; status: string; created_at: string; updated_at: string };
type MessageRow = { id: string; is_staff: boolean; message: string; created_at: string };

const CATEGORIES = [
  { value: "bug", label: "Tool not working / error" },
  { value: "payment", label: "Payment or wallet" },
  { value: "plan", label: "Plan or credits" },
  { value: "account", label: "Login or account" },
  { value: "general", label: "Something else" }
];

const FAQS = [
  { q: "My file will not upload. What should I try?", a: "Check the file type and size shown on the tool page. Try a smaller file, or export the image as JPG/PNG and upload again. For PDF tools, use an unlocked PDF (or enter its password when asked)." },
  { q: "Why is my print size different from the preview?", a: "In the print dialog choose the same paper size as your sheet, set Margins to None and Scale to 100% (turn off “Fit to page”). Print one test page before using photo paper." },
  { q: "What is the password of an Aadhaar PDF?", a: "First 4 letters of the name in CAPITALS + year of birth. Example: name RAJVEER, born 2004 → RAJV2004." },
  { q: "An export or download did not finish", a: "Keep the tab open until it finishes, and check your browser's downloads bar for a blocked download. If it still fails, try fewer photos at once and contact us with the tool name." },
  { q: "My payment went through but my plan/wallet didn't update", a: "Refresh My Account after a minute. If it still hasn't updated, raise a ticket under “Payment or wallet” with your transaction ID — never share your card number, UPI PIN or OTP." },
  { q: "Are my photos and documents uploaded to your server?", a: "No. Cropping, resizing and background removal run inside your browser. Your files stay on your device." }
];

const statusStyle: Record<string, string> = {
  open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
};
const fmt = (value: string) => new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const field = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function SupportPage() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const openAuth = useAuthStore((state) => state.openAuth);
  const [copied, setCopied] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) { setTickets([]); return; }
    setLoadingTickets(true);
    const { data } = await getSupabase().from("support_tickets").select("id, subject, category, status, created_at, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
    setTickets((data as TicketRow[]) ?? []);
    setLoadingTickets(false);
  }, [user]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable on http LAN — ignore */ }
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1500);
  };

  return <main className="min-h-full bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
    {/* Hero */}
    <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-700 px-4 pb-24 pt-10 text-white sm:px-8">
      <div aria-hidden="true" className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25"><Headset className="h-3.5 w-3.5" />Help &amp; Support</span>
        <h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">How can we help you today?</h1>
        <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">Chat with us on WhatsApp, send an email, or raise a ticket and track the reply right here.</p>
      </div>
    </section>

    <div className="relative mx-auto -mt-16 max-w-5xl px-4 pb-16 sm:px-8">
      {/* Contact cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`${card} flex flex-col p-5`}>
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/30"><MessageCircle className="h-6 w-6 fill-current" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Fastest reply</p>
              <h2 className="text-lg font-semibold">WhatsApp</h2>
              <button type="button" onClick={() => void copy(SUPPORT_WHATSAPP_DISPLAY, "wa")} className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300">{SUPPORT_WHATSAPP_DISPLAY}{copied === "wa" ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button>
            </div>
          </div>
          <a href={whatsappLink("Hi PrintSathi team, I need help with: ")} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-500 text-sm font-semibold text-white shadow-md transition hover:bg-green-600"><MessageCircle className="h-4 w-4 fill-current" />Chat on WhatsApp</a>
        </div>
        <div className={`${card} flex flex-col p-5`}>
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/30"><Mail className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">For detailed issues</p>
              <h2 className="text-lg font-semibold">Email</h2>
              <button type="button" onClick={() => void copy(SUPPORT_EMAIL, "mail")} className="mt-0.5 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300"><span className="truncate">{SUPPORT_EMAIL}</span>{copied === "mail" ? <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}</button>
            </div>
          </div>
          <a href={emailLink("PrintSathi support", "Hi PrintSathi team,\n\nTool name:\nWhat happened:\n\n")} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Mail className="h-4 w-4" />Send an email</a>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Ticket form / my tickets */}
        <div className="space-y-6">
          {!ready ? <div className={`${card} grid place-items-center p-10`}><LoaderCircle className="h-5 w-5 animate-spin text-slate-400" /></div>
            : user ? <TicketForm userId={user.id} onCreated={(id) => { void loadTickets(); setOpenTicket(id); }} />
            : <div className={`${card} p-6 text-center`}>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15"><Ticket className="h-6 w-6" /></span>
              <h2 className="mt-3 text-lg font-semibold">Raise a support ticket</h2>
              <p className="mt-1 text-sm text-slate-500">Log in to raise a ticket and see our replies here. Or reach us on WhatsApp / email above — no login needed.</p>
              <button type="button" onClick={() => openAuth("login")} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white"><LogIn className="h-4 w-4" />Log in to raise a ticket</button>
            </div>}

          {user && <section className={card}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-indigo-500" />My tickets</h2>{loadingTickets && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}</div>
            {tickets.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">You haven&apos;t raised any tickets yet.</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map((ticket) => <li key={ticket.id}>
                <button type="button" onClick={() => setOpenTicket(openTicket === ticket.id ? null : ticket.id)} aria-expanded={openTicket === ticket.id} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{ticket.subject}</span><span className="text-[11px] text-slate-400">Updated {fmt(ticket.updated_at)}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[ticket.status] ?? statusStyle.closed}`}>{ticket.status.replace("_", " ")}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${openTicket === ticket.id ? "rotate-180" : ""}`} />
                </button>
                {openTicket === ticket.id && <TicketThread ticket={ticket} userId={user.id} onReplied={() => void loadTickets()} />}
              </li>)}
            </ul>}
          </section>}
        </div>

        {/* FAQs */}
        <section className={`${card} p-5`}>
          <h2 className="font-semibold">Quick answers</h2>
          <p className="mt-1 text-sm text-slate-500">Most problems are solved by one of these.</p>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {FAQS.map((faq) => <details key={faq.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.a}</p>
            </details>)}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />We will never ask for your password, OTP, UPI PIN or full card number.</div>
        </section>
      </div>

      <Link href="/app/suggest-a-feature" className="group mt-6 flex items-center gap-4 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-5 transition hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Lightbulb className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Have an idea instead?</span><span className="block text-sm text-slate-500">Suggest a feature and help shape PrintSathi.</span></span>
        <ArrowRight className="h-5 w-5 text-indigo-500 transition group-hover:translate-x-1" />
      </Link>
    </div>
  </main>;
}

function TicketForm({ userId, onCreated }: { userId: string; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 10) { setStatus({ ok: false, text: "Add a subject (3+ characters) and describe the problem (10+ characters)." }); return; }
    setBusy(true);
    setStatus(null);
    const supabase = getSupabase();
    const { data, error } = await supabase.from("support_tickets").insert({ user_id: userId, subject: subject.trim(), category }).select("id").single();
    if (error || !data) { setBusy(false); setStatus({ ok: false, text: "Could not create the ticket. Please try WhatsApp or email instead." }); return; }
    const { error: messageError } = await supabase.from("support_messages").insert({ ticket_id: data.id, sender_id: userId, is_staff: false, message: message.trim() });
    setBusy(false);
    if (messageError) { setStatus({ ok: false, text: "Ticket created, but your message didn't save. Open it below and add it again." }); onCreated(data.id); return; }
    setSubject(""); setMessage("");
    setStatus({ ok: true, text: "Ticket raised! We'll reply here — you can also follow up on WhatsApp." });
    onCreated(data.id);
  };

  return <form onSubmit={(event) => void submit(event)} className={`${card} p-5 sm:p-6`}>
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Ticket className="h-5 w-5 text-indigo-500" />Raise a support ticket</h2>
    <p className="mt-1 text-sm text-slate-500">Tell us what happened. Our team replies right here.</p>
    <label className="mt-5 block text-sm font-medium">What do you need help with?
      <select value={category} onChange={(event) => setCategory(event.target.value)} className={field}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
    </label>
    <label className="mt-4 block text-sm font-medium">Subject
      <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} placeholder="e.g. Aadhaar crop is not detecting the card" className={field} />
    </label>
    <label className="mt-4 block text-sm font-medium">Describe the problem
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={5000} placeholder="Which tool, what you expected, and what happened instead. Include any error message." className={field} />
    </label>
    <p className="mt-1.5 text-xs text-slate-400">Don&apos;t include Aadhaar numbers, passwords, OTPs or card details.</p>
    {status && <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${status.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>{status.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}{status.text}</p>}
    <button type="submit" disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 disabled:opacity-60 sm:w-auto sm:px-6">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit ticket</button>
  </form>;
}

function TicketThread({ ticket, userId, onReplied }: { ticket: TicketRow; userId: string; onReplied: () => void }) {
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("support_messages").select("id, is_staff, message, created_at").eq("ticket_id", ticket.id).order("created_at");
    setMessages((data as MessageRow[]) ?? []);
    window.setTimeout(() => endRef.current?.scrollIntoView({ block: "nearest" }), 30);
  }, [ticket.id]);

  useEffect(() => { void load(); }, [load]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await getSupabase().from("support_messages").insert({ ticket_id: ticket.id, sender_id: userId, is_staff: false, message: reply.trim() });
    setBusy(false);
    if (!error) { setReply(""); await load(); onReplied(); }
  };

  const closed = ticket.status === "closed";
  return <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
    {messages === null ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin text-slate-400" /> : <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
      {messages.length === 0 && <p className="text-center text-xs text-slate-500">No messages yet.</p>}
      {messages.map((item) => <div key={item.id} className={`flex ${item.is_staff ? "justify-start" : "justify-end"}`}>
        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${item.is_staff ? "rounded-bl-sm bg-white shadow-sm dark:bg-slate-800" : "rounded-br-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white"}`}>
          <p className="whitespace-pre-wrap break-words">{item.message}</p>
          <p className={`mt-1 text-[10px] ${item.is_staff ? "text-slate-400" : "text-white/70"}`}>{item.is_staff ? "PrintSathi Support" : "You"} · {fmt(item.created_at)}</p>
        </div>
      </div>)}
      <div ref={endRef} />
    </div>}
    {closed ? <p className="mt-3 text-center text-xs text-slate-500">This ticket is closed. Raise a new one if you still need help.</p>
      : <form onSubmit={(event) => void send(event)} className="mt-3 flex gap-2">
        <input value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} placeholder="Write a reply…" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900" />
        <button type="submit" disabled={busy || !reply.trim()} aria-label="Send reply" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>}
  </div>;
}
