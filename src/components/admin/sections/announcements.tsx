"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { friendly, write } from "@/tools/admin/admin-api";
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, SectionHeader, Toggle, fmtDate, inputCls, panel, useToast } from "@/components/admin/admin-ui";

type Announcement = { id: string; title: string; message: string; kind: "banner" | "popup"; cta_label: string | null; cta_url: string | null; starts_at: string; ends_at: string | null; is_active: boolean; created_at: string };

function liveState(item: Announcement) {
  const now = Date.now();
  if (!item.is_active) return { label: "Off", tone: "slate" as const };
  if (new Date(item.starts_at).getTime() > now) return { label: "Scheduled", tone: "blue" as const };
  if (item.ends_at && new Date(item.ends_at).getTime() <= now) return { label: "Ended", tone: "amber" as const };
  return { label: "Live", tone: "green" as const };
}

export function AnnouncementsSection({ selfId }: { selfId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getSupabase().from("announcements").select("*").order("created_at", { ascending: false });
    if (err) setError(friendly(err.message));
    setRows((data as Announcement[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const after = (result: { ok: boolean; message: string }, close?: () => void) => {
    toast(result.ok ? "Saved." : result.message, result.ok);
    if (result.ok) { close?.(); void load(); }
  };

  return <div>
    <SectionHeader title="Announcements" description="Banners appear at the top of the app; popups show once per user." actions={<>
      <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />New announcement</Button>
      <Button onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </>} />
    {error && <div className="mb-4"><ErrorBox message={error} onRetry={() => void load()} /></div>}
    {loading && rows.length === 0 ? <Loading /> : rows.length === 0 ? <section className={panel}><Empty text="No announcements yet. Create one to show a banner or popup to all users." /></section> : <div className="grid gap-4 md:grid-cols-2">
      {rows.map((item) => {
        const state = liveState(item);
        return <article key={item.id} className={`${panel} flex flex-col p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Megaphone className="h-4 w-4" /></span><div><p className="font-semibold">{item.title}</p><p className="text-[11px] uppercase tracking-wider text-slate-400">{item.kind}</p></div></div>
            <Badge tone={state.tone}>{state.label}</Badge>
          </div>
          <p className="mt-3 flex-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
          {item.cta_label && <p className="mt-2 text-xs text-indigo-600">→ {item.cta_label} ({item.cta_url})</p>}
          <p className="mt-3 text-xs text-slate-400">{fmtDate(item.starts_at, true)} → {item.ends_at ? fmtDate(item.ends_at, true) : "no end"}</p>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs"><Toggle label="Active" checked={item.is_active} onChange={async (value) => after(await write(getSupabase().from("announcements").update({ is_active: value }).eq("id", item.id), { action: "announcement_toggle", table: "announcements", id: item.id, details: { is_active: value } }))} />Active</label>
            <div className="flex gap-1.5"><Button size="sm" onClick={() => setEditing(item)}><Pencil className="h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => { if (window.confirm(`Delete “${item.title}”?`)) after(await write(getSupabase().from("announcements").delete().eq("id", item.id), { action: "announcement_delete", table: "announcements", id: item.id, details: { title: item.title } })); }}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button></div>
          </div>
        </article>;
      })}
    </div>}
    {editing && <AnnouncementForm item={editing === "new" ? null : editing} selfId={selfId} onClose={() => setEditing(null)} onSaved={(result) => after(result, () => setEditing(null))} />}
  </div>;
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function AnnouncementForm({ item, selfId, onClose, onSaved }: { item: Announcement | null; selfId: string; onClose: () => void; onSaved: (result: { ok: boolean; message: string }) => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [message, setMessage] = useState(item?.message ?? "");
  const [kind, setKind] = useState<"banner" | "popup">(item?.kind ?? "banner");
  const [ctaLabel, setCtaLabel] = useState(item?.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(item?.cta_url ?? "");
  const [starts, setStarts] = useState(toLocalInput(item?.starts_at ?? new Date().toISOString()));
  const [ends, setEnds] = useState(toLocalInput(item?.ends_at ?? null));
  const [active, setActive] = useState(item?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    if (ctaUrl && !/^(\/|https:\/\/)/.test(ctaUrl.trim())) { setError("Button link must start with / or https://"); return; }
    if (ends && starts && new Date(ends) <= new Date(starts)) { setError("End time must be after the start time."); return; }
    setBusy(true);
    const row = { title: title.trim(), message: message.trim(), kind, cta_label: ctaLabel.trim() || null, cta_url: ctaUrl.trim() || null, starts_at: starts ? new Date(starts).toISOString() : new Date().toISOString(), ends_at: ends ? new Date(ends).toISOString() : null, is_active: active };
    const supabase = getSupabase();
    const result = item
      ? await write(supabase.from("announcements").update(row).eq("id", item.id), { action: "announcement_update", table: "announcements", id: item.id, details: row })
      : await write(supabase.from("announcements").insert({ ...row, created_by: selfId }), { action: "announcement_create", table: "announcements", id: row.title, details: row });
    setBusy(false);
    onSaved(result);
  };

  return <Modal title={item ? "Edit announcement" : "New announcement"} onClose={onClose} wide>
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Title"><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Diwali offer: 30% off Pro" /></Field></div>
      <div className="sm:col-span-2"><Field label="Message"><textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className={`${inputCls} h-auto py-2`} /></Field></div>
      <Field label="Type"><select value={kind} onChange={(event) => setKind(event.target.value as "banner" | "popup")} className={inputCls}><option value="banner">Banner (top of app)</option><option value="popup">Popup (once per user)</option></select></Field>
      <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Active</label>
      <Field label="Button text (optional)"><input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} maxLength={40} className={inputCls} placeholder="e.g. Upgrade now" /></Field>
      <Field label="Button link (optional)"><input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} className={inputCls} placeholder="/app/plans" /></Field>
      <Field label="Starts"><input type="datetime-local" value={starts} onChange={(event) => setStarts(event.target.value)} className={inputCls} /></Field>
      <Field label="Ends (optional)"><input type="datetime-local" value={ends} onChange={(event) => setEnds(event.target.value)} className={inputCls} /></Field>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>Save</Button></div>
    </form>
  </Modal>;
}
