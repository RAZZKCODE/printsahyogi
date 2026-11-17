import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verifyYoupiWebhook, type YoupiWebhookPayload } from "@/lib/payments/youpi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Non-final YouPI events → our `payments.status`. */
const STATUS_BY_EVENT: Record<string, string> = {
  OBSERVED_SUCCESS: "observed", // bank alert seen, not yet reconciled against a bank statement
  MANUAL_REVIEW: "review",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled"
};

/**
 * YouPI webhook. Configure YouPI to POST here: https://<your-site>/api/payments/youpi/webhook
 * Wallets are credited only on a RECONCILED UPI event, as the YouPI docs require.
 */
export async function POST(request: Request) {
  const rawBody = await request.text(); // verify the exact bytes before parsing
  if (!verifyYoupiWebhook(rawBody, request.headers)) {
    return NextResponse.json({ ok: false, message: "invalid signature" }, { status: 401 });
  }

  let payload: YoupiWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const event = payload.event ?? request.headers.get("x-gateway-event") ?? "UNKNOWN";
  const deliveryId = request.headers.get("x-gateway-delivery-id") ?? payload.deliveryId ?? `${event}:${payload.orderId}:${payload.paymentId}`;
  const orderId = payload.orderId && UUID.test(payload.orderId) ? payload.orderId : null;

  const { data: seen } = await supabase.from("payment_webhook_events").select("delivery_id").eq("delivery_id", deliveryId).maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  let outcome = "ignored";
  if (!orderId) {
    outcome = "unknown_order";
  } else if (event === "RECONCILED") {
    const amountPaise = typeof payload.amountPaise === "number" ? payload.amountPaise : Math.round(Number(payload.amount) * 100);
    if (payload.method !== "UPI" || payload.settlementState !== "RECONCILED") outcome = "not_settled";
    else if (payload.currency && payload.currency !== "INR") outcome = "wrong_currency";
    else if (!Number.isFinite(amountPaise)) outcome = "bad_amount";
    else {
      const { data, error } = await supabase.rpc("complete_topup_payment", {
        p_payment_id: orderId,
        p_amount_paise: amountPaise,
        p_utr: payload.utr ?? null,
        p_provider_payment_id: payload.paymentId ?? null
      });
      if (error) {
        console.error("[youpi] complete payment failed", error);
        return NextResponse.json({ ok: false }, { status: 500 }); // let YouPI retry
      }
      outcome = data?.outcome ?? "unknown";
    }
  } else if (STATUS_BY_EVENT[event]) {
    // Never downgrade a payment that is already paid.
    await supabase.from("payments").update({ status: STATUS_BY_EVENT[event], utr: payload.utr ?? undefined }).eq("id", orderId).neq("status", "paid");
    outcome = `status:${STATUS_BY_EVENT[event]}`;
  }

  await supabase.from("payment_webhook_events").upsert(
    { delivery_id: deliveryId, event, order_id: payload.orderId ?? null, payment_id: orderId, outcome, payload },
    { onConflict: "delivery_id", ignoreDuplicates: true }
  );
  return NextResponse.json({ ok: true, outcome });
}
