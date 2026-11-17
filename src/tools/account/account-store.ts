"use client";

/**
 * Account data loaded from Supabase for the signed-in user.
 * Reads go straight to tables (protected by row level security); anything that moves
 * coins or wallet money goes through server-side RPC functions.
 */
import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";

export type PlanId = "free" | "pro" | "pro-plus" | "ultra" | "pro-yearly" | "pro-plus-yearly";

export type WalletTxn = { id: string; date: number; label: string; amount: number; type: "credit" | "debit" };
export type CoinTxn = { id: string; date: number; label: string; amount: number; type: "earned" | "redeemed" };
export type Referral = { id: string; name: string; joinedAt: number; upgraded: boolean };
export type CreditPack = { id: string; featureKey: string; credits: number; price: number };
type Result = { ok: boolean; message: string };

export const CARD_TYPES = [
  "Aadhaar Card", "PAN Card", "Ayushman Card", "Voter ID Card", "e-Shram Card",
  "ABHA Card", "Health Card (PHC)", "Ration Card", "MahaSarathi Card"
] as const;
export type CardType = typeof CARD_TYPES[number];

/** Feature label shown in the UI → `features.key` in the database. */
export const FEATURE_KEYS: Record<string, string> = {
  "Background Removal": "bg_removal",
  "Aadhar Auto Crop": "aadhaar_crop",
  "Ayushman Auto Crop": "ayushman_crop",
  "Pan Auto Crop": "pan_crop",
  "Phc Auto Crop": "phc_crop",
  "Voter Auto Crop": "voter_crop",
  "Eshram Auto Crop": "eshram_crop",
  "Abha Auto Crop": "abha_crop",
  "Ration Auto Crop": "ration_crop",
  "Maha Auto Crop": "maha_crop"
};
export const FEATURE_LIMITS = Object.keys(FEATURE_KEYS);
const LABEL_BY_KEY = Object.fromEntries(Object.entries(FEATURE_KEYS).map(([label, key]) => [key, label]));

export const PLANS: Array<{ id: Exclude<PlanId, "free">; name: string; coins: number; price: number; period: "month" | "year"; popular?: boolean; features: string[]; dailyCredits: number }> = [
  { id: "pro", name: "Pro", coins: 69, price: 69, period: "month", dailyCredits: 10, features: ["10 Credits / Day per Card — 90 Total", "10 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"] },
  { id: "pro-plus", name: "Pro Plus", coins: 99, price: 99, period: "month", popular: true, dailyCredits: 30, features: ["30 Credits / Day per Card — 270 Total", "30 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"] },
  { id: "ultra", name: "Ultra", coins: 149, price: 149, period: "month", dailyCredits: 999, features: ["Unlimited Credits / Day on All Cards", "40 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"] },
  { id: "pro-yearly", name: "Pro Yearly", coins: 599, price: 599, period: "year", dailyCredits: 20, features: ["20 Credits / Day per Card — 180 Total", "20 Credits / Day on Background Removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"] },
  { id: "pro-plus-yearly", name: "Pro Plus Yearly", coins: 899, price: 899, period: "year", dailyCredits: 40, features: ["40 Credits / Day per Card — 360 Total", "40 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"] }
];

export const TOP_UP_OPTIONS = [
  { label: "Starter", pay: 19, get: 19 },
  { label: "Popular", pay: 49, get: 49 },
  { label: "Super Saver", pay: 99, get: 109, bonus: 10 }
];

export type TopUpPack = { id: string; label: string; pay: number; get: number; bonus?: number };

/** Active wallet top-up packs from the database (the server charges these exact amounts). */
export async function fetchTopUpPacks(): Promise<TopUpPack[]> {
  const { data, error } = await getSupabase().from("topup_packs").select("id, label, pay_amount, credit_amount").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const pay = Number(row.pay_amount);
    const get = Number(row.credit_amount);
    return { id: row.id, label: row.label, pay, get, bonus: get > pay ? Math.round((get - pay) * 100) / 100 : undefined };
  });
}

/** Ask the server to create a YouPI UPI payment for a pack; resolves to the checkout URL. */
export async function startTopUp(packId: string): Promise<{ ok: true; checkoutUrl: string } | { ok: false; message: string }> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please log in first." };
  try {
    const response = await fetch("/api/payments/youpi/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ packId })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.checkoutUrl) return { ok: false, message: body.message ?? "Could not start payment." };
    return { ok: true, checkoutUrl: body.checkoutUrl };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

/** Current status of one of the user's own payments (row level security limits it to theirs). */
export async function fetchPaymentStatus(paymentId: string): Promise<string | null> {
  const { data } = await getSupabase().from("payments").select("status").eq("id", paymentId).maybeSingle();
  return data?.status ?? null;
}

export const ELITE_LEVEL_COINS = 500;
export const REFERRAL_JOIN_COINS = 10;
export const REFERRAL_UPGRADE_COINS = 30;

type AccountData = {
  userId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  plan: PlanId;
  planExpiresAt: number | null;
  cardRate: number;
  walletBalance: number;
  walletTxns: WalletTxn[];
  refills: WalletTxn[];
  coins: number;
  coinTxns: CoinTxn[];
  referralCode: string;
  claimedReferral: string | null;
  referrals: Referral[];
  usage: Record<string, number>;
  creditPacks: CreditPack[];
};

type AccountState = AccountData & {
  load: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  updateProfile: (patch: { name?: string; phone?: string }) => Promise<Result>;
  setCardRate: (rate: number) => Promise<Result>;
  redeemPlan: (planId: Exclude<PlanId, "free">) => Promise<Result>;
  buyCredits: (packId: string) => Promise<Result>;
  claimReferral: (code: string) => Promise<Result>;
};

const empty: AccountData = {
  userId: null,
  status: "idle",
  error: null,
  name: "",
  email: "",
  phone: "",
  phoneVerified: false,
  plan: "free",
  planExpiresAt: null,
  cardRate: 50,
  walletBalance: 0,
  walletTxns: [],
  refills: [],
  coins: 0,
  coinTxns: [],
  referralCode: "",
  claimedReferral: null,
  referrals: [],
  usage: {},
  creditPacks: []
};

const time = (value: string | null) => (value ? new Date(value).getTime() : 0);
const startOfToday = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date.toISOString(); };

async function callRpc(name: string, args: Record<string, unknown>): Promise<Result> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) return { ok: false, message: error.message };
  return data as Result;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  ...empty,

  load: async (userId) => {
    set({ userId, status: get().userId === userId && get().status === "ready" ? "ready" : "loading", error: null });
    const supabase = getSupabase();
    const [profile, wallet, payments, coins, referrals, myReferral, usage, credits, packs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("wallet_transactions").select("id, direction, amount, label, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("payments").select("id, amount, wallet_credit, provider, created_at, paid_at").eq("user_id", userId).eq("status", "paid").order("created_at", { ascending: false }).limit(100),
      supabase.from("coin_transactions").select("id, direction, amount, label, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("referrals").select("id, referred_name, created_at, upgraded").eq("referrer_id", userId).order("created_at", { ascending: false }),
      supabase.from("referrals").select("code").eq("referred_id", userId).maybeSingle(),
      supabase.from("usage_logs").select("feature_key, credits_used").eq("user_id", userId).gte("created_at", startOfToday()),
      supabase.from("user_feature_credits").select("feature_key, bonus_credits").eq("user_id", userId),
      supabase.from("credit_packs").select("id, feature_key, credits, price").eq("is_active", true).order("sort_order")
    ]);

    if (get().userId !== userId) return; // user switched while loading
    if (profile.error || !profile.data) {
      set({ status: "error", error: profile.error?.message ?? "Profile not found." });
      return;
    }

    const p = profile.data;
    const usageMap: Record<string, number> = {};
    for (const row of usage.data ?? []) {
      const label = LABEL_BY_KEY[row.feature_key ?? ""];
      if (label) usageMap[label] = (usageMap[label] ?? 0) + row.credits_used;
    }
    for (const row of credits.data ?? []) {
      const label = LABEL_BY_KEY[row.feature_key];
      if (label) usageMap[`bonus:${label}`] = row.bonus_credits;
    }

    set({
      status: "ready",
      name: p.full_name || p.email?.split("@")[0] || "User",
      email: p.email ?? "",
      phone: p.phone ?? "",
      phoneVerified: p.phone_verified,
      plan: (p.plan_expires_at && time(p.plan_expires_at) < Date.now() ? "free" : p.plan_id) as PlanId,
      planExpiresAt: p.plan_expires_at ? time(p.plan_expires_at) : null,
      cardRate: Number(p.card_rate),
      walletBalance: Number(p.wallet_balance),
      coins: p.coins,
      referralCode: p.referral_code,
      walletTxns: (wallet.data ?? []).map((row) => ({ id: row.id, date: time(row.created_at), label: row.label, amount: Number(row.amount), type: row.direction })),
      refills: (payments.data ?? []).map((row) => ({ id: row.id, date: time(row.paid_at ?? row.created_at), label: `Paid ₹${Number(row.amount)} via ${row.provider === "razorpay" ? "Razorpay" : row.provider === "youpi" ? "UPI" : row.provider}`, amount: Number(row.wallet_credit || row.amount), type: "credit" as const })),
      coinTxns: (coins.data ?? []).map((row) => ({ id: row.id, date: time(row.created_at), label: row.label, amount: row.amount, type: row.direction })),
      referrals: (referrals.data ?? []).map((row) => ({ id: row.id, name: row.referred_name || "Friend", joinedAt: time(row.created_at), upgraded: row.upgraded })),
      claimedReferral: myReferral.data?.code ?? null,
      usage: usageMap,
      creditPacks: (packs.data ?? []).map((row) => ({ id: row.id, featureKey: row.feature_key, credits: row.credits, price: Number(row.price) }))
    });
  },

  refresh: async () => {
    const { userId } = get();
    if (userId) await get().load(userId);
  },

  clear: () => set(empty),

  updateProfile: async (patch) => {
    const { userId } = get();
    if (!userId) return { ok: false, message: "Please log in first." };
    const update: Record<string, string> = {};
    if (patch.name !== undefined) update.full_name = patch.name;
    if (patch.phone !== undefined) update.phone = patch.phone;
    const supabase = getSupabase();
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) return { ok: false, message: error.message };
    // Keep the auth metadata in sync so the header/sidebar show the new name.
    if (patch.name !== undefined) await supabase.auth.updateUser({ data: { full_name: patch.name } });
    set({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.phone !== undefined ? { phone: patch.phone, phoneVerified: false } : {}) });
    return { ok: true, message: "Profile updated." };
  },

  setCardRate: async (cardRate) => {
    const { userId } = get();
    if (!userId) return { ok: false, message: "Please log in first." };
    const { error } = await getSupabase().from("profiles").update({ card_rate: cardRate }).eq("id", userId);
    if (error) return { ok: false, message: error.message };
    set({ cardRate });
    return { ok: true, message: "Card rate updated." };
  },

  redeemPlan: async (planId) => {
    const result = await callRpc("redeem_plan", { p_plan_id: planId });
    if (result.ok) await get().refresh();
    return result;
  },

  buyCredits: async (packId) => {
    const result = await callRpc("buy_credit_pack", { p_pack_id: packId });
    if (result.ok) await get().refresh();
    return result;
  },

  claimReferral: async (code) => {
    const result = await callRpc("claim_referral", { p_code: code });
    if (result.ok) await get().refresh();
    return result;
  }
}));

export function planLabel(plan: PlanId) {
  return plan === "free" ? "Free" : PLANS.find((item) => item.id === plan)?.name ?? "Free";
}

export function dailyLimit(plan: PlanId) {
  return plan === "free" ? 1 : PLANS.find((item) => item.id === plan)?.dailyCredits ?? 1;
}

export type CardActivity = {
  days: Array<{ day: number; total: number; byType: Record<string, number> }>;
  daysInMonth: number;
  today: number | null;
};

/** Cards processed per day for a month (YYYY-MM), read from `usage_logs`. */
export async function fetchCardActivity(userId: string, month: string): Promise<CardActivity> {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const from = new Date(year, monthIndex - 1, 1);
  const to = new Date(year, monthIndex, 1);
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === monthIndex;

  const { data, error } = await getSupabase()
    .from("usage_logs")
    .select("card_type, quantity, created_at")
    .eq("user_id", userId)
    .not("card_type", "is", null)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .limit(10000);
  if (error) throw new Error(error.message);

  const days = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, total: 0, byType: {} as Record<string, number> }));
  for (const row of data ?? []) {
    const day = days[new Date(row.created_at).getDate() - 1];
    if (!day || !row.card_type) continue;
    day.total += row.quantity;
    day.byType[row.card_type] = (day.byType[row.card_type] ?? 0) + row.quantity;
  }
  return { days, daysInMonth, today: isCurrent ? now.getDate() : null };
}
