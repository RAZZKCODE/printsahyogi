import { NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/supabase/server";
import { createYoupiPayment } from "@/lib/payments/youpi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a wallet top-up: body `{ packId }` → `{ checkoutUrl }`. The amount comes from `topup_packs`, never the browser. */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, message: "Please log in first." }, { status: 401 });

  const { packId } = (await request.json().catch(() => ({}))) as { packId?: string };
  if (!packId) return NextResponse.json({ ok: false, message: "Choose a top-up pack." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: created, error } = await supabase.rpc("create_topup_payment", { p_user: user.id, p_pack_id: packId });
  if (error || !created?.ok) {
    return NextResponse.json({ ok: false, message: created?.message ?? error?.message ?? "Could not start payment." }, { status: 400 });
  }

  const paymentId = created.payment_id as string;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
  try {
    const payment = await createYoupiPayment({
      orderId: paymentId,
      amountRupees: Number(created.amount),
      returnUrl: `${siteUrl}/app/card-dashboard?tab=wallet&payment=${paymentId}`,
      metadata: { userId: user.id, purpose: "wallet_topup" }
    });
    await supabase.from("payments").update({ provider_order_id: paymentId, provider_payment_id: payment.paymentId, checkout_url: payment.checkoutUrl }).eq("id", paymentId);
    return NextResponse.json({ ok: true, paymentId, checkoutUrl: payment.checkoutUrl });
  } catch (cause) {
    await supabase.from("payments").update({ status: "failed", metadata: { error: String(cause) } }).eq("id", paymentId);
    console.error("[youpi] create payment failed", cause);
    return NextResponse.json({ ok: false, message: "Payment gateway is unavailable. Please try again shortly." }, { status: 502 });
  }
}
