"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { LIVE_TOOLS } from "@/lib/navigation";
import { friendly, write } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Loading, SectionHeader, Table, Toggle, inputCls, panel, useToast } from "@/components/admin/admin-ui";

type Tool = { slug: string; title: string; subtitle: string | null; group_name: string; feature_key: string | null; is_live: boolean; is_premium: boolean; sort_order: number };

export function ToolsSection() {
  const toast = useToast();
  const [tools, setTools] = useState<Tool[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [toolsRes, usageRes] = await Promise.all([
      supabase.from("tools").select("*").order("sort_order"),
      supabase.from("usage_logs").select("tool_slug, quantity").gte("created_at", since).not("tool_slug", "is", null).limit(10000)
    ]);
    if (toolsRes.error) setError(friendly(toolsRes.error.message));
    setTools((toolsRes.data as Tool[]) ?? []);
    const tally: Record<string, number> = {};
    for (const row of (usageRes.data as Array<{ tool_slug: string; quantity: number }>) ?? []) tally[row.tool_slug] = (tally[row.tool_slug] ?? 0) + row.quantity;
    setUsage(tally);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = async (tool: Tool, patch: Partial<Tool>) => {
    setSavingSlug(tool.slug);
    const result = await write(getSupabase().from("tools").update(patch).eq("slug", tool.slug), { action: "tool_update", table: "tools", id: tool.slug, details: patch });
    setSavingSlug(null);
    toast(result.ok ? `${tool.title} updated.` : result.message, result.ok);
    if (result.ok) setTools((current) => current.map((item) => item.slug === tool.slug ? { ...item, ...patch } : item));
  };

  const groups = Array.from(new Set(tools.map((tool) => tool.group_name)));

  return <div>
    <SectionHeader title="Tools" description="Switch tools on or off for users. Turned-off tools show a “Coming Soon” popup in the sidebar." actions={<Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    {error && <div className="mb-4"><ErrorBox message={error} onRetry={() => void load()} /></div>}
    {loading && tools.length === 0 ? <Loading /> : tools.length === 0 ? <Empty text="No tools in the database." /> : <div className="space-y-6">
      {groups.map((group) => <section key={group} className={panel}>
        <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800">{group}</h2>
        <Table head={["Tool", "Status", "Uses (30d)", "Premium", "Order", "Live"]}>
          {tools.filter((tool) => tool.group_name === group).map((tool) => {
            const built = LIVE_TOOLS.has(tool.slug);
            const effective = built && tool.is_live;
            return <tr key={tool.slug}>
              <td className="px-4 py-3"><p className="font-medium">{tool.title}</p><p className="font-mono text-[11px] text-slate-400">/app/{tool.slug}</p></td>
              <td className="px-4 py-3">{!built ? <Badge tone="amber">Not built yet</Badge> : effective ? <Badge tone="green">Live</Badge> : <Badge tone="red">Turned off</Badge>}</td>
              <td className="px-4 py-3 text-sm">{usage[tool.slug] ?? 0}</td>
              <td className="px-4 py-3"><Toggle label="Premium" checked={tool.is_premium} disabled={savingSlug === tool.slug} onChange={(value) => void update(tool, { is_premium: value })} /></td>
              <td className="px-4 py-3"><input type="number" defaultValue={tool.sort_order} onBlur={(event) => { const value = Math.trunc(Number(event.target.value)); if (value !== tool.sort_order) void update(tool, { sort_order: value }); }} className={`${inputCls} h-8 w-20`} /></td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><Toggle label="Live" checked={tool.is_live} disabled={savingSlug === tool.slug || (!built && !tool.is_live)} onChange={(value) => void update(tool, { is_live: value })} />{!built && <span className="text-[11px] text-slate-400">Build it first</span>}</div></td>
            </tr>;
          })}
        </Table>
      </section>)}
    </div>}
  </div>;
}
