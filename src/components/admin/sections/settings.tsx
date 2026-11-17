"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly, write } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, SectionHeader, Toggle, fmtDate, inputCls, panel, useToast } from "@/components/admin/admin-ui";

type Setting = { key: string; value: unknown; description: string | null; is_public: boolean; updated_at: string };

const asText = (value: unknown) => typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);

export function SettingsSection() {
  const toast = useToast();
  const [rows, setRows] = useState<Setting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getSupabase().from("app_settings").select("key, value, description, is_public, updated_at").order("key");
    if (err) setError(friendly(err.message));
    const list = (data as Setting[]) ?? [];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((row) => [row.key, asText(row.value)])));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (row: Setting, patch: Partial<Setting>) => {
    setSaving(row.key);
    const result = await write(getSupabase().from("app_settings").update(patch).eq("key", row.key), { action: "setting_update", table: "app_settings", id: row.key, details: { from: row.value, ...patch } });
    setSaving(null);
    toast(result.ok ? `${row.key} saved.` : result.message, result.ok);
    if (result.ok) void load();
  };

  const saveValue = (row: Setting) => {
    const text = drafts[row.key] ?? "";
    let value: unknown;
    try { value = JSON.parse(text); } catch { toast(`“${row.key}” must be valid JSON — e.g. 10, true, "text" or {"a":1}.`, false); return; }
    void save(row, { value });
  };

  return <div>
    <SectionHeader title="Settings" description="App-wide values used by the database and the app. Public settings are readable by everyone." actions={<>
      <Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />New setting</Button>
      <Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </>} />
    {error && <div className="mb-4"><ErrorBox message={error} onRetry={() => void load()} /></div>}
    <section className={panel}>
      {loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <Empty text="No settings yet." /> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const isBool = typeof row.value === "boolean";
          const dirty = (drafts[row.key] ?? "") !== asText(row.value);
          return <li key={row.key} className="grid gap-3 p-4 md:grid-cols-[1fr_280px_auto] md:items-center">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-semibold">{row.key}{row.is_public ? <Badge tone="blue">public</Badge> : <Badge>private</Badge>}{row.key === "maintenance_mode" && row.value === true && <Badge tone="red">ON</Badge>}</p>
              {row.description && <p className="mt-0.5 text-xs text-slate-500">{row.description}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">Updated {fmtDate(row.updated_at, true)}</p>
            </div>
            {isBool ? <div className="flex items-center gap-2"><Toggle label={row.key} checked={row.value === true} disabled={saving === row.key} onChange={(value) => void save(row, { value })} /><span className="text-sm">{row.value ? "On" : "Off"}</span></div>
              : <div className="flex gap-2"><input value={drafts[row.key] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") saveValue(row); }} className={`${inputCls} font-mono`} /><Button disabled={!dirty} loading={saving === row.key} onClick={() => saveValue(row)}>Save</Button></div>}
            <label className="flex items-center gap-2 text-xs text-slate-500"><Toggle label="Public" checked={row.is_public} disabled={saving === row.key} onChange={(value) => void save(row, { is_public: value })} />Public</label>
          </li>;
        })}
      </ul>}
    </section>
    {adding && <NewSetting existing={rows.map((row) => row.key)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />}
  </div>;
}

function NewSetting({ existing, onClose, onSaved }: { existing: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanKey) { setError("Key is required."); return; }
    if (existing.includes(cleanKey)) { setError("This key already exists."); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { setError('Value must be valid JSON, e.g. 10, true, "text".'); return; }
    setBusy(true);
    const result = await write(getSupabase().from("app_settings").insert({ key: cleanKey, value: parsed, description: description.trim() || null, is_public: isPublic }), { action: "setting_create", table: "app_settings", id: cleanKey, details: { value: parsed } });
    setBusy(false);
    toast(result.ok ? "Setting created." : result.message, result.ok);
    if (result.ok) onSaved();
  };
  return <Modal title="New setting" onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <Field label="Key" hint="lowercase_with_underscores"><input autoFocus value={key} onChange={(event) => setKey(event.target.value)} className={`${inputCls} font-mono`} /></Field>
      <Field label="Value (JSON)" hint='Examples: 10 · true · "Hello" · {"a": 1}'><input value={value} onChange={(event) => setValue(event.target.value)} className={`${inputCls} font-mono`} /></Field>
      <Field label="Description"><input value={description} onChange={(event) => setDescription(event.target.value)} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Public (readable by the app without login)</label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Create</Button></div>
    </form>
  </Modal>;
}
