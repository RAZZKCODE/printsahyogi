"use client";

import { X } from "lucide-react";

export const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export const inr = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatDate = (time: number) => new Date(time).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function DemoBadge() {
  return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Demo data</span>;
}

export function EmptyState({ icon, title, text, children }: { icon?: React.ReactNode; title?: string; text: string; children?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
    {title && <p className="font-serif text-base font-semibold">{title}</p>}
    <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
    {children}
  </div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`${card} w-full max-w-sm p-5`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-lg font-semibold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      {children}
    </div>
  </div>;
}

export function Toast({ text, tone = "default", onClose }: { text: string; tone?: "default" | "error" | "success"; onClose: () => void }) {
  const color = tone === "error" ? "bg-rose-600" : tone === "success" ? "bg-emerald-600" : "bg-slate-900";
  return <div role="status" className={`fixed bottom-5 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${color}`}>{text}<button type="button" aria-label="Dismiss" onClick={onClose}><X className="h-4 w-4" /></button></div>;
}

export function CoinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 font-serif font-bold text-amber-900 shadow-inner ring-1 ring-amber-600/40 ${className}`} style={{ fontSize: "60%" }}>P</span>;
}
