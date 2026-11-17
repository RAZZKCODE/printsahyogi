"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";

/** Announcements created in the admin dashboard (/admin → Announcements). */
type Announcement = { id: string; title: string; message: string; kind: "banner" | "popup"; cta_label: string | null; cta_url: string | null; starts_at: string; ends_at: string | null; is_active: boolean };

const useAnnouncements = create<{ items: Announcement[]; loaded: boolean; load: () => Promise<void> }>()((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try {
      const { data } = await getSupabase().from("announcements").select("id, title, message, kind, cta_label, cta_url, starts_at, ends_at, is_active").order("created_at", { ascending: false }).limit(20);
      const now = Date.now();
      // RLS already hides inactive rows from normal users; admins see everything, so filter again here.
      set({ items: ((data as Announcement[]) ?? []).filter((item) => item.is_active && new Date(item.starts_at).getTime() <= now && (!item.ends_at || new Date(item.ends_at).getTime() > now)) });
    } catch { /* ignore — announcements are optional */ }
  }
}));

const read = (storage: "local" | "session", key: string) => { try { return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key); } catch { return null; } };
const store = (storage: "local" | "session", key: string) => { try { (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, "1"); } catch { /* ignore */ } };

function Cta({ item, onClick, className }: { item: Announcement; onClick?: () => void; className: string }) {
  if (!item.cta_label || !item.cta_url) return null;
  return item.cta_url.startsWith("/")
    ? <Link href={item.cta_url} onClick={onClick} className={className}>{item.cta_label}</Link>
    : <a href={item.cta_url} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>{item.cta_label}</a>;
}

/** Thin bar at the top of the app. Dismissed per browser session. */
export function AnnouncementBanner() {
  const items = useAnnouncements((state) => state.items);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => { void useAnnouncements.getState().load(); }, []);
  const banner = items.find((item) => item.kind === "banner" && !hidden.includes(item.id) && !read("session", `announcement-hidden:${item.id}`));
  if (!banner) return null;
  return <div role="region" aria-label="Announcement" className="relative flex shrink-0 items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-10 py-2 text-center text-xs text-white sm:text-sm">
    <Megaphone className="hidden h-4 w-4 shrink-0 sm:block" />
    <p className="min-w-0"><b>{banner.title}</b> <span className="text-white/90">{banner.message}</span></p>
    <Cta item={banner} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50" />
    <button type="button" aria-label="Dismiss announcement" onClick={() => { store("session", `announcement-hidden:${banner.id}`); setHidden((current) => [...current, banner.id]); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-white/20"><X className="h-4 w-4" /></button>
  </div>;
}

/** Popup shown once per user (per browser). */
export function AnnouncementPopup() {
  const items = useAnnouncements((state) => state.items);
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => { void useAnnouncements.getState().load(); const timer = window.setTimeout(() => setReady(true), 1200); return () => window.clearTimeout(timer); }, []);
  if (!ready || window.location.pathname.startsWith("/admin")) return null;
  const popup = items.find((item) => item.kind === "popup" && !closed.includes(item.id) && !read("local", `announcement-seen:${item.id}`));
  if (!popup) return null;
  const close = () => { store("local", `announcement-seen:${popup.id}`); setClosed((current) => [...current, popup.id]); };
  return <div className="fixed inset-0 z-[125] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={popup.title} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl dark:bg-slate-900">
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-8 text-white">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30"><Megaphone className="h-7 w-7" /></span>
        <h2 className="mt-4 text-xl font-bold">{popup.title}</h2>
      </div>
      <button type="button" aria-label="Close" onClick={close} className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
      <div className="p-6">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{popup.message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Cta item={popup} onClick={close} className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white" />
          <button type="button" onClick={close} className="h-10 rounded-xl border border-slate-200 text-sm font-medium dark:border-slate-700">{popup.cta_label ? "Maybe later" : "Got it"}</button>
        </div>
      </div>
    </div>
  </div>;
}
