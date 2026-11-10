"use client";

import { allTools } from "@/lib/navigation";

export function ToolPlaceholder({ slug }: { slug: string }) {
  const tool = allTools.find((item) => item.slug === slug);
  if (!tool) return null;
  return (
    <section className="flex min-h-full flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900 sm:px-7">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{tool.title}</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-16 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
            <tool.icon className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{tool.title}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Coming Soon</p>
        </div>
      </div>
    </section>
  );
}
