import crypto from "node:crypto";

/**
 * YouPI PG client (https://github.com/youpi-pg/YouPI-PG) — a self-hosted UPI gateway.
 * You run the YouPI Payment API yourself; this app only creates payments on it and
 * receives its signed webhooks.
 */

function config() {
  const apiUrl = process.env.YOUPI_API_URL?.replace(/\/+$/, "");
  const merchantId = process.env.YOUPI_MERCHANT_ID;
  const webhookSecret = process.env.YOUPI_WEBHOOK_SECRET;
  if (!apiUrl || !merchantId || !webhookSecret) {
    throw new Error("YOUPI_API_URL, YOUPI_MERCHANT_ID and YOUPI_WEBHOOK_SECRET must be set on the server.");
  }
  return { apiUrl, merchantId, webhookSecret };
}

export type YoupiPayment = { paymentId: string; orderId: string; amount: string; status: string; checkoutUrl: string };

export async function createYoupiPayment(input: { orderId: string; amountRupees: number; returnUrl: string; metadata?: Record<string, unknown> }): Promise<YoupiPayment> {
  const { apiUrl, merchantId } = config();
  const response = await fetch(`${apiUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Merchant-Id": merchantId },
    body: JSON.stringify({
      orderId: input.orderId,
      amount: input.amountRupees.toFixed(2),
      currency: "INR",
      returnUrl: input.returnUrl,
      metadata: input.metadata
    }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body?.checkoutUrl !== "string") {
    throw new Error(`YouPI create payment failed (${response.status}): ${body?.error ?? body?.message ?? "no checkoutUrl"}`);
  }
  return body as YoupiPayment;
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a.replace(/^sha256=/, ""), "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const MAX_SIGNATURE_AGE_MS = 2 * 60 * 60 * 1000; // YouPI retries the same signed body for up to 1 hour.

/**
 * Verify a webhook against the raw request body. Uses the V2 signature (timestamp bound)
 * when present, otherwise the V1 `sha256=<hmac(rawBody)>` header.
 */
export function verifyYoupiWebhook(rawBody: string, headers: Headers): boolean {
  const { webhookSecret } = config();
  const v2 = headers.get("x-gateway-signature-v2");
  const timestamp = headers.get("x-gateway-timestamp");
  if (v2 && timestamp) {
    const age = Date.now() - Number(timestamp);
    if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_MS || age < -5 * 60 * 1000) return false;
    const expected = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    return safeEqualHex(v2, expected);
  }
  const v1 = headers.get("x-gateway-signature");
  if (!v1) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(v1, expected);
}

export type YoupiWebhookPayload = {
  event: string;
  settlementState?: string;
  method?: string;
  orderId?: string;
  amount?: string;
  amountPaise?: number;
  currency?: string;
  utr?: string;
  paymentId?: string;
  deliveryId?: string;
};
