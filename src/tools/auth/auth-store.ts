"use client";

/**
 * Authentication backed by Supabase Auth.
 * The session is stored by supabase-js; this store only mirrors the signed-in user
 * and drives the login modal.
 */
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { useAccountStore } from "@/tools/account/account-store";

export type AuthUser = { id: string; name: string; email: string; phone?: string; createdAt: number; provider: string };
export type AuthMode = "login" | "signup" | "forgot" | "update-password";
type Result = { ok: boolean; message: string };

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  modalOpen: boolean;
  mode: AuthMode;
  init: () => void;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  setMode: (mode: AuthMode) => void;
  login: (email: string, password: string) => Promise<Result>;
  signup: (input: { name: string; email: string; phone?: string; password: string; referral?: string }) => Promise<Result>;
  loginWithGoogle: () => Promise<Result>;
  resetPassword: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  logout: () => Promise<void>;
};

const normalize = (email: string) => email.trim().toLowerCase();

function toUser(session: Session | null): AuthUser | null {
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: String(meta.full_name || meta.name || user.email?.split("@")[0] || "User"),
    email: user.email ?? "",
    phone: meta.phone || user.phone || undefined,
    createdAt: new Date(user.created_at).getTime(),
    provider: String(user.app_metadata?.provider ?? "email")
  };
}

function friendlyError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (text.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the link.";
  if (text.includes("already registered")) return "An account with this email already exists. Please log in.";
  if (text.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (text.includes("provider is not enabled")) return "Google login is not enabled yet. Please use email for now.";
  return message;
}

let initialized = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  ready: false,
  modalOpen: false,
  mode: "login",

  init: () => {
    if (initialized || typeof window === "undefined") return;
    initialized = true;
    const supabase = getSupabase();
    const apply = (session: Session | null) => {
      const user = toUser(session);
      const previous = get().user;
      set({ user, ready: true });
      if (user && user.id !== previous?.id) void useAccountStore.getState().load(user.id);
      if (!user) useAccountStore.getState().clear();
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    supabase.auth.onAuthStateChange((event, session) => {
      // Defer so we never call Supabase inside the auth callback (avoids a supabase-js deadlock).
      window.setTimeout(() => {
        apply(session);
        if (event === "PASSWORD_RECOVERY") set({ modalOpen: true, mode: "update-password" });
      }, 0);
    });
  },

  openAuth: (mode = "login") => set({ modalOpen: true, mode }),
  closeAuth: () => set({ modalOpen: false }),
  setMode: (mode) => set({ mode }),

  login: async (rawEmail, password) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: normalize(rawEmail), password });
    if (error) return { ok: false, message: friendlyError(error.message) };
    set({ modalOpen: false });
    const user = toUser(data.session);
    return { ok: true, message: `Welcome back, ${(user?.name ?? "").split(" ")[0]}!` };
  },

  signup: async ({ name, email: rawEmail, phone, password, referral }) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: normalize(rawEmail),
      password,
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { full_name: name.trim(), phone: phone || undefined, referral_code: referral?.trim().toUpperCase() || undefined }
      }
    });
    if (error) return { ok: false, message: friendlyError(error.message) };
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) return { ok: false, message: "An account with this email already exists. Please log in." };
    const first = name.trim().split(" ")[0];
    if (!data.session) return { ok: true, message: `Almost done, ${first}! We sent a confirmation link to ${normalize(rawEmail)}. Open it to activate your account.` };
    set({ modalOpen: false });
    return { ok: true, message: `Account created. Welcome to PrintSathi, ${first}!` };
  },

  loginWithGoogle: async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    if (error) return { ok: false, message: friendlyError(error.message) };
    return { ok: true, message: "Redirecting to Google…" };
  },

  resetPassword: async (rawEmail) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(normalize(rawEmail), { redirectTo: window.location.origin + "/app" });
    if (error) return { ok: false, message: friendlyError(error.message) };
    return { ok: true, message: "If an account exists for this email, a password reset link is on its way." };
  },

  updatePassword: async (password) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) return { ok: false, message: friendlyError(error.message) };
    set({ modalOpen: false, mode: "login" });
    return { ok: true, message: "Password updated. You are logged in." };
  },

  logout: async () => {
    await getSupabase().auth.signOut();
    set({ user: null });
  }
}));

export function initialsOf(name: string) {
  return (name.trim() || "U").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}
