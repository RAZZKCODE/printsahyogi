"use client";

import { getSupabase } from "@/lib/supabase/client";

export type Role = "user" | "admin" | "super_admin";
export type RpcResult = { ok: boolean; message: string };

/** Escape characters that have meaning inside a PostgREST `or()` / `ilike` filter. */
export function safeSearch(text: string) {
  return text.trim().replace(/[%_,()*\\:"']/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

/** Append a row to admin_audit_logs (RLS: admins may insert their own entries). */
export async function audit(action: string, targetTable: string, targetId: string, details: Record<string, unknown> = {}) {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("admin_audit_logs").insert({ admin_id: data.user.id, action, target_table: targetTable, target_id: targetId, details });
}

/** Call an admin RPC that returns { ok, message }. Network / permission errors become a failed result. */
export async function adminRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) return { ok: false, message: friendly(error.message) };
  return (data as RpcResult) ?? { ok: false, message: "No response from server." };
}

export function friendly(message: string) {
  const text = message.toLowerCase();
  if (text.includes("admin access required") || text.includes("permission denied") || text.includes("row-level security")) return "You don't have admin permission for this action.";
  if (text.includes("could not find the function") || text.includes("schema cache")) return "Admin database functions are missing. Run migration 20261117000005_admin_rpcs.sql in Supabase.";
  if (text.includes("only a super admin")) return "Only a super admin can change roles.";
  if (text.includes("violates foreign key")) return "This item is still used elsewhere, so it can't be deleted. Deactivate it instead.";
  if (text.includes("duplicate key")) return "An item with this ID already exists.";
  return message;
}

/** Throw-on-error helper for simple table writes, with an audit entry on success. */
export async function write<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, log?: { action: string; table: string; id: string; details?: Record<string, unknown> }): Promise<RpcResult> {
  const { error } = await promise;
  if (error) return { ok: false, message: friendly(error.message) };
  if (log) await audit(log.action, log.table, log.id, log.details);
  return { ok: true, message: "Saved." };
}
