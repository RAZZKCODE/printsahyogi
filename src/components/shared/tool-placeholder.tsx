"use client";

import { allTools } from "@/lib/navigation";
import { ComingSoonContent } from "@/components/shared/coming-soon-dialog";

/** Shown when someone opens a not-yet-built tool by URL. */
export function ToolPlaceholder({ slug }: { slug: string }) {
  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) return null;
  return <section className="flex min-h-full items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/40 px-4 py-12 dark:from-slate-950 dark:to-slate-900">
    <div className="w-full max-w-md"><ComingSoonContent tool={tool} /></div>
  </section>;
}
