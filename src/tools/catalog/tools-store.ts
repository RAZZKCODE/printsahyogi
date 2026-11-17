"use client";

import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";
import { LIVE_TOOLS } from "@/lib/navigation";

/**
 * Tool availability from the `tools` table (managed in the admin dashboard).
 * A tool is live only if it is built in code (LIVE_TOOLS) AND switched on in the database,
 * so admins can take a tool offline but can't publish one that doesn't exist yet.
 */
type ToolsState = { disabled: Set<string>; loaded: boolean; load: () => Promise<void> };

let loading = false;

export const useToolsStore = create<ToolsState>()((set) => ({
  disabled: new Set(),
  loaded: false,
  load: async () => {
    if (loading) return;
    loading = true;
    try {
      const { data, error } = await getSupabase().from("tools").select("slug, is_live");
      if (!error && data) set({ disabled: new Set(data.filter((row) => !row.is_live).map((row) => row.slug as string)), loaded: true });
    } catch { /* offline or env missing — fall back to code defaults */ }
    loading = false;
  }
}));

/** Help pages must always stay reachable, whatever the database says. */
const ALWAYS_ON = new Set(["support", "suggest-a-feature"]);

export function isToolLive(slug: string, disabled: Set<string>) {
  if (ALWAYS_ON.has(slug)) return true;
  return LIVE_TOOLS.has(slug) && !disabled.has(slug);
}
