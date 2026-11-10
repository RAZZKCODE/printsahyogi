"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { useAppLocale } from "@/components/shared/app-providers";

const navItems = [
  { label: "navAadhaar", href: "/app/aadhaar-crop" },
  { label: "navAyushman", href: "/app/ayushman-crop" },
  { label: "navCompress", href: "/app/compress-image" },
  { label: "navCollage", href: "/app/collage" },
  { label: "navShop", href: "/app/shop" },
  { label: "navPricing", href: "#pricing" }
] as const;

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("landing");
  const { theme, setTheme } = useTheme();
  const { locale, changeLocale } = useAppLocale();

  return (
    <header id="top" className="sticky top-0 z-40 border-b border-sky-200/80 bg-gradient-to-r from-sky-100 via-cyan-50 to-sky-100 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="mx-auto flex h-[62px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="PrintSahyogi home">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-[10px] font-black text-white shadow-sm">PM</span>
          <span className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">PrintSahyogi</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 xl:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="whitespace-nowrap text-[13px] font-medium text-slate-700 transition-colors hover:text-cyan-800 dark:text-slate-200 dark:hover:text-cyan-300">{t(item.label)}</Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={t("toggleTheme")} aria-label={t("toggleTheme")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-white/80 text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button onClick={() => changeLocale(locale === "en" ? "hi" : "en")} title="English / हिन्दी" aria-label="English / हिन्दी" className="flex h-9 items-center gap-1 rounded-lg border border-sky-200 bg-white/80 px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <Languages className="h-4 w-4" /><span>{locale === "en" ? "EN" : "हि"}</span>
          </button>
          <Link href="/app" className="ml-1 inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">{t("openApp")}</Link>
          <span aria-label="Raj" title="Raj" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white shadow-sm">R</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 xl:hidden">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("toggleTheme")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button onClick={() => changeLocale(locale === "en" ? "hi" : "en")} aria-label="English / हिन्दी" className="flex h-9 items-center gap-1 rounded-lg border border-sky-200 bg-white/80 px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <Languages className="h-4 w-4" /><span>{locale === "en" ? "EN" : "हि"}</span>
          </button>
          <span aria-label="Raj" title="Raj" className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-[10px] font-semibold text-white">R</span>
          <button onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-white/80 dark:text-slate-100 dark:hover:bg-slate-800">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && <nav aria-label="Mobile navigation" className="absolute inset-x-0 top-full border-b border-sky-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900 xl:hidden">
        <div className="mx-auto flex max-w-screen-sm flex-col gap-1">
          {navItems.map((item) => <Link key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800">{t(item.label)}</Link>)}
          <Link href="/app" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white dark:bg-white dark:text-slate-900">{t("openApp")}</Link>
        </div>
      </nav>}
    </header>
  );
}

