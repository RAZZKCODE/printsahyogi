"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Hourglass, MessageCircle, Sparkles, X } from "lucide-react";
import { allTools, LIVE_TOOLS, type ToolItem } from "@/lib/navigation";
import { SUPPORT_WHATSAPP } from "@/lib/support";

const SUGGESTED = ["passport-photo", "collage", "aadhaar-crop", "pan-card-resizer"];

/** Content shared by the popup and the full-page placeholder. */
export function ComingSoonContent({ tool, onClose, onNavigate }: { tool: ToolItem; onClose?: () => void; onNavigate?: () => void }) {
  const Icon = tool.icon;
  const liveTools = SUGGESTED.filter((slug) => LIVE_TOOLS.has(slug) && slug !== tool.slug).map((slug) => allTools.find((item) => item.slug === slug)).filter((item): item is ToolItem => !!item);
  const whatsapp = `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi PrintSathi team, I'm waiting for the "${tool.title}" tool. Please notify me when it launches!`)}`;

  return <div className="relative overflow-hidden rounded-3xl bg-white text-center shadow-2xl dark:bg-slate-900">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600" />
    <div aria-hidden="true" className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
    <div aria-hidden="true" className="absolute -right-8 top-6 h-28 w-28 rounded-full bg-fuchsia-300/40 blur-2xl" />
    {onClose && <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"><X className="h-4 w-4" /></button>}

    <div className="relative px-6 pb-6 pt-10 sm:px-8">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-white shadow-xl ring-4 ring-white/40 dark:bg-slate-800">
        <Icon className="h-9 w-9 text-indigo-600 dark:text-indigo-300" />
        <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg ring-4 ring-white dark:ring-slate-900"><Hourglass className="h-4 w-4 animate-[spin_3s_linear_infinite]" /></span>
      </div>

      <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"><Sparkles className="h-3.5 w-3.5" />Coming Soon</span>
      <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{tool.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">We&apos;re building this tool right now. It will be available very soon — stay tuned!</p>

      <div className="mx-auto mt-5 max-w-xs">
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400"><span>In development</span><span>Almost there</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500" /></div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition hover:bg-green-600"><MessageCircle className="h-4 w-4 fill-current" />Notify me on WhatsApp</a>
        {onClose && <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Got it</button>}
      </div>

      {liveTools.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try these tools meanwhile</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {liveTools.map((item) => {
            const ItemIcon = item.icon;
            return <Link key={item.slug} href={`/app/${item.slug}`} onClick={onNavigate} className="group flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-left text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><ItemIcon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </Link>;
          })}
        </div>
      </div>}
    </div>
  </div>;
}

export function ComingSoonDialog({ tool, onClose }: { tool: ToolItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${tool.title} coming soon`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="w-full max-w-md">
      <ComingSoonContent tool={tool} onClose={onClose} onNavigate={onClose} />
    </div>
  </div>;
}
