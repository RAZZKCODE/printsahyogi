"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/shared/sidebar";
import { SaleBanner } from "@/components/shared/sale-banner";
import { FloatingActions } from "@/components/shared/floating-actions";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh min-h-[520px] flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <SaleBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-11 shrink-0 items-center border-b border-slate-200 bg-white/90 px-3 dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
            <button onClick={() => setMobileOpen(true)} aria-label="Open tools menu" className="rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Menu className="h-4 w-4" /></button>
            <span className="ml-2 text-sm font-semibold text-slate-800 dark:text-white">PrintSahyogi</span>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <FloatingActions />
    </div>
  );
}

