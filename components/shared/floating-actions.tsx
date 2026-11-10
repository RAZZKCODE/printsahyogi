"use client";

import Link from "next/link";
import { MessageCircle, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";

export function FloatingActions() {
  const t = useTranslations("shell");
  return (
    <div className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <a href="https://wa.me/" target="_blank" rel="noreferrer" aria-label={t("whatsapp")} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#20b968] text-white shadow-lg transition-transform hover:scale-105">
        <MessageCircle className="h-5 w-5 fill-white/15" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">1</span>
      </a>
      <Link href="/app/support" className="flex h-9 items-center gap-2 rounded-full bg-slate-950 px-3.5 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950">
        <MessageSquareText className="h-4 w-4" />{t("support")}
      </Link>
    </div>
  );
}
