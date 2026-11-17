"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CircleAlert, CircleCheck, Headset, Lightbulb, LoaderCircle, LogIn, Mail, MessageCircle, Rocket, Send, Sparkles
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/tools/auth/auth-store";
import { emailLink, whatsappLink } from "@/lib/support";

type Suggestion = { id: string; title: string; description: string | null; status: string; admin_note: string | null; created_at: string };

const CATEGORIES = ["New tool", "Photo tools", "Card crop & print", "Print & PDF", "Account & plans", "Something else"];
const IDEAS = ["Voter ID card crop", "Bulk Aadhaar PDF to sheet", "Signature on photo", "Hindi language for all tools"];
const DRAFT_KEY = "printsathi-feature-draft";

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Received", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  under_review: { label: "Under review", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  planned: { label: "Planned 🎯", cls: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  done: { label: "Live ✅", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  rejected: { label: "Not planned", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" }
};
const field = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-950";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function SuggestFeaturePage() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const openAuth = useAuthStore((state) => state.openAuth);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<Suggestion[]>([]);

  // Restore an unsent draft (per browser)
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null") as { title?: string; idea?: string; category?: string } | null;
      if (saved?.title) setTitle(saved.title.slice(0, 200));
      if (saved?.idea) setIdea(saved.idea.slice(0, 5000));
      if (saved?.category && CATEGORIES.includes(saved.category)) setCategory(saved.category);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, idea, category })); } catch { /* ignore */ }
  }, [title, idea, category]);

  const loadMine = useCallback(async () => {
    if (!user) { setMine([]); return; }
    const { data } = await getSupabase().from("feature_suggestions").select("id, title, description, status, admin_note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setMine((data as Suggestion[]) ?? []);
  }, [user]);
  useEffect(() => { void loadMine(); }, [loadMine]);

  const valid = title.trim().length >= 3 && idea.trim().length >= 10;
  const shareText = `Feature idea for PrintSathi\n\nCategory: ${category}\nIdea: ${title.trim()}\n\n${idea.trim()}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) { setStatus({ ok: false, text: "Give your idea a name (3+ characters) and describe it (10+ characters)." }); return; }
    if (!user) { openAuth("login"); return; }
    setBusy(true);
    setStatus(null);
    const { error } = await getSupabase().from("feature_suggestions").insert({ user_id: user.id, title: title.trim(), description: `[${category}] ${idea.trim()}` });
    setBusy(false);
    if (error) { setStatus({ ok: false, text: "Could not send your idea. Please send it on WhatsApp or email instead." }); return; }
    setTitle(""); setIdea("");
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setStatus({ ok: true, text: "Thank you! Your idea reached the PrintSathi team. Track its status below." });
    void loadMine();
  };

  return <main className="min-h-full bg-gradient-to-b from-amber-50/60 via-white to-orange-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
    <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-4 pb-24 pt-10 text-white sm:px-8">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold ring-1 ring-white/30"><Lightbulb className="h-3.5 w-3.5" />Suggest a Feature</span>
        <h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">What should we build next?</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">Tell us the tool or shortcut that would make your daily print work faster. The best ideas get built first.</p>
      </div>
    </section>

    <div className="relative mx-auto -mt-16 grid max-w-5xl items-start gap-6 px-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <form onSubmit={(event) => void submit(event)} className={`${card} p-5 sm:p-6`}>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-amber-500" />Share your idea</h2>
          <p className="mt-1 text-sm text-slate-500">A little detail helps us understand exactly what you need.</p>

          <label className="mt-5 block text-sm font-medium">Give it a name
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="e.g. Voter ID card auto crop" className={field} />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">{IDEAS.map((item) => <button key={item} type="button" onClick={() => setTitle(item)} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{item}</button>)}</div>

          <label className="mt-4 block text-sm font-medium">Which part of PrintSathi?
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={field}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="mt-4 block text-sm font-medium">How would it help you?
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} rows={6} maxLength={5000} placeholder="What job are you trying to finish? What feels slow today? What result do you need?" className={field} />
          </label>
          <div className="mt-1.5 flex justify-between text-xs text-slate-400"><span>Your draft is saved on this device automatically.</span><span className="tabular-nums">{idea.length}/5000</span></div>

          {status && <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${status.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>{status.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}{status.text}</p>}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={busy || !ready} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:brightness-110 disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : user ? <Send className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{user ? "Submit idea" : "Log in & submit"}
            </button>
            <a href={valid ? whatsappLink(shareText) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!valid} onClick={(event) => { if (!valid) { event.preventDefault(); setStatus({ ok: false, text: "Write your idea first, then send it on WhatsApp." }); } }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 text-sm font-semibold text-green-700 hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"><MessageCircle className="h-4 w-4 fill-current" />Send on WhatsApp</a>
            <a href={valid ? emailLink(`Feature idea: ${title.trim()}`, shareText) : undefined} aria-disabled={!valid} onClick={(event) => { if (!valid) { event.preventDefault(); setStatus({ ok: false, text: "Write your idea first, then send it by email." }); } }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Mail className="h-4 w-4" />Email</a>
          </div>
        </form>

        {user && <section className={card}>
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold dark:border-slate-800"><Rocket className="h-4 w-4 text-orange-500" />My ideas</h2>
          {mine.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Your submitted ideas and their status will appear here.</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {mine.map((item) => {
              const badge = STATUS[item.status] ?? STATUS.new;
              return <li key={item.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3"><p className="min-w-0 font-medium">{item.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span></div>
                <p className="mt-0.5 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </li>;
            })}
          </ul>}
        </section>}
      </div>

      <aside className="space-y-5">
        <section className={`${card} p-5`}>
          <h2 className="font-semibold">How it works</h2>
          <ol className="mt-4 space-y-4">
            {[["Share", "Tell us the tool or improvement you want."], ["We review", "The team reads every idea and updates its status."], ["We build", "Popular ideas are built first — you'll see them go Live."]].map(([heading, text], index) => <li key={heading} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white">{index + 1}</span>
              <span><span className="block text-sm font-semibold">{heading}</span><span className="block text-sm text-slate-500">{text}</span></span>
            </li>)}
          </ol>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="font-semibold">A great suggestion includes</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">{["The job you're trying to finish", "What feels slow or difficult today", "An example of the result you need"].map((item) => <li key={item} className="flex gap-2"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}</li>)}</ul>
          <p className="mt-3 text-xs text-slate-400">Please leave out personal documents and ID numbers.</p>
        </section>
        <Link href="/app/support" className="group flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-5 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15"><Headset className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Something not working?</span><span className="block text-xs text-slate-500">Get help from Support instead.</span></span>
          <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
        </Link>
      </aside>
    </div>
  </main>;
}
