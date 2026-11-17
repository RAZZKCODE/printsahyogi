"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, Crown, Languages, LogIn, LogOut, Moon, Printer, Search, Sparkles, Sun, X } from "lucide-react";
import { initialsOf, useAuthStore } from "@/tools/auth/auth-store";
import { toolGroups, type ToolItem } from "@/lib/navigation";
import { isToolLive, useToolsStore } from "@/tools/catalog/tools-store";
import { ComingSoonDialog } from "@/components/shared/coming-soon-dialog";
import { useAppLocale } from "@/components/shared/app-providers";

type SidebarProps = { mobileOpen: boolean; onMobileClose: () => void };

const groupTranslation: Record<string, string> = {
  "PHOTO TOOLS": "photoTools",
  "CARD CROP & PRINT": "cardCrop",
  "PRINT & PDF": "printPdf",
  MORE: "more"
};

/** Per-group accent colours: icon tile, active pill and heading dot. */
const groupTheme: Record<string, { tile: string; dot: string; active: string }> = {
  "PHOTO TOOLS": { tile: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500", active: "from-violet-600 to-fuchsia-500 shadow-violet-500/30" },
  "CARD CROP & PRINT": { tile: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", active: "from-sky-600 to-cyan-500 shadow-sky-500/30" },
  "PRINT & PDF": { tile: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500", active: "from-amber-500 to-orange-500 shadow-amber-500/30" },
  MORE: { tile: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", active: "from-emerald-600 to-teal-500 shadow-emerald-500/30" }
};
const fallbackTheme = groupTheme.MORE;

const NEW_TOOLS = new Set(["collage", "postcard-photo", "pan-card-resizer"]);
const COLLAPSED_GROUPS_KEY = "printsathi-sidebar-groups";

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [soonTool, setSoonTool] = useState<ToolItem | null>(null);
  const disabledTools = useToolsStore((state) => state.disabled);
  useEffect(() => { void useToolsStore.getState().load(); }, []);
  const user = useAuthStore((state) => state.user);
  const openAuth = useAuthStore((state) => state.openAuth);
  const logout = useAuthStore((state) => state.logout);
  const authReady = useAuthStore((state) => state.ready);
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const t = useTranslations("shell");
  const { theme, setTheme } = useTheme();
  const { locale, changeLocale } = useAppLocale();

  useEffect(() => {
    try { const saved = window.localStorage.getItem(COLLAPSED_GROUPS_KEY); if (saved) setClosedGroups(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  // Ctrl/Cmd + K focuses tool search
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCollapsed(false);
        window.setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleGroup = (title: string) => setClosedGroups((current) => {
    const next = current.includes(title) ? current.filter((item) => item !== title) : [...current, title];
    try { window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return toolGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.title.toLowerCase().includes(query)) }))
      .filter((group) => group.items.length > 0);
  }, [search]);

  const isActive = (slug: string) => pathname === `/app/${slug}` || pathname.startsWith(`/app/${slug}/`);
  const hide = collapsed ? "md:hidden" : "";

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onMobileClose} className="fixed bottom-0 left-0 right-0 top-10 z-40 bg-slate-950/50 backdrop-blur-[2px] md:hidden" />}
      <aside className={`fixed bottom-0 left-0 top-10 z-50 flex w-[264px] flex-col overflow-hidden border-r border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 transition-[transform,width] duration-200 dark:border-slate-800 dark:bg-slate-950 md:relative md:bottom-auto md:top-auto md:translate-x-0 md:shadow-none ${collapsed ? "md:w-[76px]" : "md:w-[240px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* soft decorative glow */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-sky-300/40 via-violet-300/30 to-transparent blur-3xl dark:from-sky-500/10 dark:via-violet-500/10" />

        {/* Brand */}
        <div className={`relative flex h-14 shrink-0 items-center px-3 ${collapsed ? "md:justify-center" : "justify-between"}`}>
          <Link href="/app/collage" onClick={(event) => { if (collapsed && window.matchMedia("(min-width: 768px)").matches) { event.preventDefault(); setCollapsed(false); return; } onMobileClose(); }} className="flex min-w-0 items-center gap-2.5" title={collapsed ? "Expand sidebar" : "PrintSathi"}>
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <Printer className="h-[18px] w-[18px]" strokeWidth={2.2} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
            </span>
            <span className={`min-w-0 leading-none ${hide}`}>
              <span className="block truncate bg-gradient-to-r from-slate-900 to-indigo-700 bg-clip-text text-[16px] font-extrabold tracking-tight text-transparent dark:from-white dark:to-sky-300">PrintSathi</span>
              <span className="mt-1 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">Print tools for CSC &amp; cafés</span>
            </span>
          </Link>
          <button onClick={() => setCollapsed((value) => !value)} className={`hidden h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white md:grid ${collapsed ? "md:hidden" : ""}`} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button onClick={onMobileClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden" aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>

        {/* Search */}
        <div className={`relative px-3 pb-2 ${collapsed ? "md:px-2" : ""}`}>
          <label className={`group flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-slate-400 transition focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-indigo-500 ${collapsed ? "md:cursor-pointer md:justify-center md:px-0" : ""}`} onClick={() => { if (collapsed) { setCollapsed(false); window.setTimeout(() => searchRef.current?.focus(), 50); } }}>
            <Search className="h-4 w-4 shrink-0 group-focus-within:text-indigo-500" />
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} placeholder={t("search")} aria-label={t("search")} className={`min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 ${hide}`} />
            {search ? <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className={`rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 ${hide}`}><X className="h-3 w-3" /></button>
              : <kbd className={`hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[9px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 sm:inline ${hide}`}>Ctrl K</kbd>}
          </label>
        </div>

        {/* Navigation */}
        <nav aria-label="Tools" className="relative min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 scrollbar-thin">
          {filteredGroups.map((group) => {
            const accent = groupTheme[group.title] ?? fallbackTheme;
            const open = !!search || collapsed || !closedGroups.includes(group.title);
            return (
              <section key={group.title} className="mb-2">
                <button type="button" onClick={() => toggleGroup(group.title)} aria-expanded={open} className={`flex w-full items-center gap-2 rounded-md px-2 pb-1.5 pt-3 text-left ${hide}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{t(groupTranslation[group.title] as never)}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{group.items.length}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>
                {collapsed && <div className="mx-auto my-2 hidden h-px w-8 bg-slate-200 dark:bg-slate-800 md:block" />}
                <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.slug);
                        const soon = !isToolLive(item.slug, disabledTools);
                        const itemClass = `group relative mb-0.5 flex min-h-[38px] items-center gap-2.5 rounded-xl px-1.5 py-1 text-[12.5px] leading-tight transition-all duration-150 ${active ? `bg-gradient-to-r ${accent.active} font-semibold text-white shadow-lg` : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"} ${collapsed ? "md:justify-center md:px-0 md:hover:translate-x-0" : ""} ${soon ? "w-full text-left opacity-75 hover:opacity-100" : ""}`;
                        const inner = <>
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${active ? "bg-white/20 text-white" : `${accent.tile} group-hover:scale-105`}`}>
                            <Icon className="h-[15px] w-[15px]" />
                          </span>
                          <span className={`min-w-0 flex-1 ${hide}`}>
                            <span className="block truncate">{item.title}</span>
                            {item.subtitle && <span className={`block truncate text-[9.5px] font-normal ${active ? "text-white/80" : "text-slate-400"}`}>{item.subtitle}</span>}
                          </span>
                          {NEW_TOOLS.has(item.slug) && <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide ${active ? "bg-white/25 text-white" : "bg-gradient-to-r from-pink-500 to-rose-500 text-white"} ${hide}`}>New</span>}
                          {soon && <span className={`rounded-full bg-amber-100 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ${hide}`}>Soon</span>}
                          {collapsed && NEW_TOOLS.has(item.slug) && <span className="absolute right-2 top-1.5 hidden h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950 md:block" />}
                        </>;
                        return soon
                          ? <button key={item.slug} type="button" onClick={() => setSoonTool(item)} title={collapsed ? `${item.title} (Coming soon)` : undefined} className={itemClass}>{inner}</button>
                          : <Link key={item.slug} href={`/app/${item.slug}`} onClick={onMobileClose} title={collapsed ? item.title : undefined} aria-current={active ? "page" : undefined} className={itemClass}>{inner}</Link>;
                    })}
                  </div>
                </div>
              </section>
            );
          })}
          {filteredGroups.length === 0 && <div className="px-3 py-8 text-center"><Search className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs text-slate-500">No tools found for “{search}”</p></div>}
        </nav>

        {/* Footer */}
        <div className={`relative shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-800 ${collapsed ? "md:px-2" : ""}`}>
          <Link href="/app/plans" onClick={onMobileClose} title={t("claimTrial")} className={`group relative mb-3 block overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-3 text-white shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40 ${collapsed ? "md:grid md:h-10 md:place-items-center md:p-0" : ""}`}>
            <span aria-hidden="true" className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-xl transition group-hover:scale-125" />
            <span className={`relative flex items-center gap-2 ${collapsed ? "md:hidden" : ""}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20"><Crown className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-bold">{t("claimTrial")}</span>
                <span className="block text-[10px] text-white/85">Unlock all premium tools</span>
              </span>
              <Sparkles className="ml-auto h-4 w-4 shrink-0 opacity-80" />
            </span>
            <Crown className={`relative hidden h-4 w-4 ${collapsed ? "md:block" : ""}`} />
          </Link>

          <div className={`flex items-center justify-between gap-1 rounded-xl bg-slate-50 p-1.5 dark:bg-slate-900 ${collapsed ? "md:flex-col md:bg-transparent md:p-0" : ""}`}>
            {authReady && user ? <div className={`flex min-w-0 items-center gap-1 ${collapsed ? "md:flex-col" : ""}`}>
              <Link href="/app/card-dashboard?tab=profile" onClick={onMobileClose} title={`${user.name} · My Account`} className={`flex min-w-0 items-center gap-2 rounded-lg p-0.5 transition hover:bg-white dark:hover:bg-slate-800 ${collapsed ? "md:flex-col" : ""}`}>
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-xs font-bold text-white shadow-sm">
                  {initialsOf(user.name)}<span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
                </span>
                <span className={`min-w-0 leading-tight ${hide}`}>
                  <span className="block max-w-[92px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{user.name}</span>
                  <span className="mt-0.5 inline-block rounded-full bg-slate-200/80 px-1.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t("freePlan")}</span>
                </span>
              </Link>
              <button type="button" onClick={() => { if (window.confirm("Log out of PrintSathi?")) void logout(); }} title="Log out" aria-label="Log out" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><LogOut className="h-4 w-4" /></button>
            </div>
              : <button type="button" onClick={() => { openAuth("login"); onMobileClose(); }} title="Log in / Sign up" className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg p-0.5 text-left transition hover:bg-white dark:hover:bg-slate-800 ${collapsed ? "md:flex-col md:flex-none" : ""}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"><LogIn className="h-4 w-4" /></span>
                <span className={`min-w-0 leading-tight ${hide}`}>
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">Log in</span>
                  <span className="block text-[10px] text-slate-500">or create account</span>
                </span>
              </button>}
            <div className={`flex items-center gap-1 ${collapsed ? "md:flex-col" : ""}`}>
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`${t("theme")}: ${theme === "dark" ? t("dark") : t("light")}`} title={t("theme")} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-amber-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-300">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button onClick={() => changeLocale(locale === "en" ? "hi" : "en")} aria-label={`${t("language")}: ${locale === "en" ? "English" : "हिन्दी"}`} title={locale === "en" ? "English / हिन्दी" : "हिन्दी / English"} className="flex h-8 items-center gap-1 rounded-lg px-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-white hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800">
                <Languages className="h-3.5 w-3.5" /><span>{locale === "en" ? "EN" : "हि"}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      {soonTool && <ComingSoonDialog tool={soonTool} onClose={() => setSoonTool(null)} />}
    </>
  );
}
