"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { ChevronLeft, Languages, Moon, Search, Sun, X, Zap } from "lucide-react";
import { toolGroups } from "@/lib/navigation";
import { useAppLocale } from "@/components/shared/app-providers";

type SidebarProps = { mobileOpen: boolean; onMobileClose: () => void };

const groupTranslation: Record<string, string> = {
  "PHOTO TOOLS": "photoTools",
  "CARD CROP & PRINT": "cardCrop",
  "PRINT & PDF": "printPdf",
  MORE: "more"
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = usePathname();
  const t = useTranslations("shell");
  const { theme, setTheme } = useTheme();
  const { locale, changeLocale } = useAppLocale();

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return toolGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.title.toLowerCase().includes(query)) }))
      .filter((group) => group.items.length > 0);
  }, [search]);

  const isActive = (slug: string) => pathname === `/app/${slug}` || pathname.startsWith(`/app/${slug}/`);

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onMobileClose} className="fixed bottom-0 left-0 right-0 top-10 z-40 bg-slate-950/40 md:hidden" />}
      <aside className={`fixed bottom-0 left-0 top-10 z-50 flex w-[248px] flex-col border-r border-sky-200/70 bg-gradient-to-b from-sky-100 via-sky-100 to-cyan-100 shadow-sm transition-transform duration-200 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 md:relative md:bottom-auto md:top-auto md:z-50 md:translate-x-0 ${collapsed ? "md:w-[76px]" : "md:w-[224px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex h-12 shrink-0 items-center border-b border-sky-200/70 px-3 dark:border-slate-700 ${collapsed ? "md:justify-center" : "justify-between"}`}>
          <Link href="/app/collage" onClick={onMobileClose} className="flex min-w-0 items-center gap-2.5" title="PrintSahyogi">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-[10px] font-black text-white shadow-sm">PM</span>
            <span className={`truncate text-[15px] font-bold tracking-tight text-slate-800 dark:text-white ${collapsed ? "md:hidden" : ""}`}>PrintSahyogi</span>
          </Link>
          <button onClick={() => setCollapsed((value) => !value)} className="hidden rounded-md p-1.5 text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700 md:block" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button onClick={onMobileClose} className="rounded-md p-1.5 text-slate-600 hover:bg-white/70 dark:text-slate-300 md:hidden" aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>

        <div className={`px-2.5 py-2 ${collapsed ? "md:px-2" : ""}`}>
          <label className={`flex h-8 items-center gap-2 rounded-md border border-sky-200 bg-white/90 px-2 text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 ${collapsed ? "md:justify-center md:border-0 md:bg-transparent md:shadow-none" : ""}`}>
            <Search className="h-4 w-4 shrink-0" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} className={`min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 ${collapsed ? "md:hidden" : ""}`} />
          </label>
        </div>

        <nav aria-label="Tools" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
          {filteredGroups.map((group) => (
            <section key={group.title} className="mb-3">
              <h2 className={`px-2 pb-1 pt-2 text-[10px] font-bold tracking-[0.08em] text-slate-500 dark:text-slate-400 ${collapsed ? "md:hidden" : ""}`}>{t(groupTranslation[group.title] as never)}</h2>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.slug);
                return (
                  <Link key={item.slug} href={`/app/${item.slug}`} onClick={onMobileClose} title={collapsed ? item.title : undefined} aria-current={active ? "page" : undefined}
                    className={`group relative mb-0.5 flex min-h-8 items-center gap-2.5 rounded-md px-2 text-[12px] leading-tight transition-colors ${active ? "bg-white/85 font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-slate-700/70"} ${collapsed ? "md:justify-center md:px-0" : ""}`}>
                    {active && <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-slate-900 dark:bg-sky-300" />}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-slate-800 dark:text-sky-200" : "text-slate-600 dark:text-slate-300"}`} />
                    <span className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                      <span className="block truncate">{item.title}</span>
                      {item.subtitle && !collapsed && <span className="block truncate text-[9px] font-normal text-slate-500">({item.subtitle})</span>}
                    </span>
                  </Link>
                );
              })}
            </section>
          ))}
          {filteredGroups.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">No tools found</p>}
        </nav>

        <div className={`shrink-0 border-t border-sky-200/70 p-2.5 dark:border-slate-700 ${collapsed ? "md:px-2" : ""}`}>
          <Link href="/app/plans" onClick={onMobileClose} className={`mb-2 flex h-8 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 text-xs font-bold text-white shadow-sm hover:brightness-105 ${collapsed ? "md:px-0" : ""}`}>
            <Zap className="h-3.5 w-3.5 fill-current" /><span className={collapsed ? "md:hidden" : ""}>{t("claimTrial")}</span>
          </Link>
          <div className={`flex items-center justify-between gap-1 ${collapsed ? "md:flex-col" : ""}`}>
            <div className={`flex min-w-0 items-center gap-2 ${collapsed ? "md:flex-col" : ""}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">R</span>
              <span className={`min-w-0 leading-tight ${collapsed ? "md:hidden" : ""}`}>
                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">Raj</span>
                <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{t("freePlan")}</span>
              </span>
            </div>
            <div className={`flex items-center gap-1 ${collapsed ? "md:flex-col" : ""}`}>
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`${t("theme")}: ${theme === "dark" ? t("dark") : t("light")}`} title={t("theme")} className="rounded-md border border-sky-200 bg-white/70 p-1.5 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button onClick={() => changeLocale(locale === "en" ? "hi" : "en")} aria-label={`${t("language")}: ${locale === "en" ? "English" : "हिन्दी"}`} title={locale === "en" ? "English / हिन्दी" : "हिन्दी / English"} className="flex h-[29px] items-center gap-1 rounded-md border border-sky-200 bg-white/70 px-1.5 text-[10px] font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Languages className="h-3.5 w-3.5" /><span>{locale === "en" ? "EN" : "हि"}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

