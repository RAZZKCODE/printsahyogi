"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Search, X } from "lucide-react";

export const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
export const inputCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950";

export const inr = (value: number | string | null | undefined) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const fmtDate = (value: string | null | undefined, withTime = false) => value
  ? new Date(value).toLocaleString("en-IN", withTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" })
  : "—";

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; ok: boolean };
const ToastContext = createContext<(text: string, ok?: boolean) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, ok = true) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, ok }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);
  return <ToastContext.Provider value={push}>
    {children}
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => <div key={toast.id} role="status" className={`pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${toast.ok ? "bg-emerald-600" : "bg-rose-600"}`}>
        {toast.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}<span className="flex-1">{toast.text}</span>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

/* ---------- Primitives ---------- */
export function Button({ variant = "default", size = "md", loading, className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost"; size?: "sm" | "md"; loading?: boolean }) {
  const styles = {
    default: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    primary: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20 hover:brightness-110",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }[variant];
  return <button type="button" {...props} disabled={props.disabled || loading} className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm"} ${styles} ${className}`}>
    {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{children}
  </button>;
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "red" | "amber" | "blue" | "violet"; children: React.ReactNode }) {
  const styles = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    blue: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}</label>;
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
  </button>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block w-full sm:w-72">
    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputCls} pl-9`} />
  </label>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`${panel} w-full ${wide ? "max-w-2xl" : "max-w-md"} p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      {children}
    </div>
  </div>;
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-[140] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800"><h2 className="truncate text-base font-semibold">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </aside>
  </div>;
}

export function SectionHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />{label}</div>;
}

export function Empty({ text }: { text: string }) {
  return <p className="py-14 text-center text-sm text-slate-500">{text}</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex flex-col items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
    <p className="flex items-center gap-2 font-medium"><CircleAlert className="h-4 w-4" />{message}</p>
    {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
  </div>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
    <span>{total === 0 ? "No results" : `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} of ${total}`}</span>
    <div className="flex gap-1.5"><Button size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button><Button size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</Button></div>
  </div>;
}

/** Table wrapper with horizontal scroll on small screens. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-sm">
      <thead><tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800">{head.map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
    </table>
  </div>;
}
