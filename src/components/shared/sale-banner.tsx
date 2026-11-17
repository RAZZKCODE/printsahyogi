"use client";

import { useEffect, useState } from "react";
import { Clock3, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const OFFER_DURATION = 24 * 60 * 60;

export function SaleBanner() {
  const t = useTranslations("shell");
  const [visible, setVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_DURATION);

  useEffect(() => {
    const storageKey = "papermitra-offer-deadline";
    const existingDeadline = Number(window.localStorage.getItem(storageKey));
    const deadline = Number.isFinite(existingDeadline) && existingDeadline > Date.now()
      ? existingDeadline
      : Date.now() + OFFER_DURATION * 1000;
    window.localStorage.setItem(storageKey, String(deadline));
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = Math.floor(secondsLeft / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((secondsLeft % 3600) / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  if (!visible) return null;

  return (
    <div className="relative z-30 flex min-h-10 items-center justify-center gap-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 px-8 py-2 text-center text-[10px] font-semibold text-white sm:gap-2 sm:px-10 sm:text-sm">
      <Sparkles className="hidden h-4 w-4 sm:block" />
      <span className="min-w-0 truncate">{t("offer")}</span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/15 px-1.5 py-1 text-[9px] sm:px-2 sm:text-xs">
        <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {hours}:{minutes}:{seconds}
      </span>
      <Link href="/#pricing" className="hidden shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-900 hover:bg-slate-100 sm:inline-flex">{t("claimOffer")}</Link>
      <button onClick={() => setVisible(false)} aria-label="Dismiss offer" className="absolute right-3 rounded p-1 hover:bg-white/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
