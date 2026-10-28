// razorpay-webhook: handles payment.captured and payment.failed events from Razorpay.
//
// Verifies X-Razorpay-Signature against the webhook secret (distinct from key_secret).
// Idempotent: re-processing the same payment_id is a no-op.
// Auto-refund: if a payment.captured arrives for an already-expired booking, the
// payment is refunded immediately via the Razorpay Refunds API.
//
// Environment:
//   RAZORPAY_WEBHOOK_SECRET   required — set in Razorpay dashboard → Webhooks
//   RAZORPAY_KEY_ID           required — for refund API auth
//   RAZORPAY_KEY_SECRET       required — for refund API auth
//   SUPABASE_URL / service key injected by Supabase

import { createClient } from "npm:@supabase/supabase-js@2";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serviceKey(): string | undefined {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const key = (JSON.parse(secretKeys) as Record<string, string>).default;
      if (key) return key;
    } catch { /* fall through */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

/** HMAC-SHA256 of `body` bytes with `secret`, returned as a hex string. */
async function hmacSha256Hex(secret: string, body: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function issueRefund(
  payment_id: string,
  amount: number,
  keyId: string,
  keySecret: string,
): Promise<void> {
  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ amount, notes: { reason: "hold_expired" } }),
  });
  if (!res.ok) {
    throw new Error(
      `Razorpay refund failed for ${payment_id}: ${res.status} ${await res.text()}`,
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const svcKey = serviceKey();

  if (!webhookSecret || !keyId || !keySecret || !supabaseUrl || !svcKey) {
    console.error("razorpay-webhook: missing environment variables");
    return json(500, { error: "not_configured" });
  }

  // Verify webhook signature.
  const rawBody = new Uint8Array(await req.arrayBuffer());
  const receivedSig = req.headers.get("X-Razorpay-Signature") ?? "";
  const expectedSig = await hmacSha256Hex(webhookSecret, rawBody);
  if (!hexEqual(expectedSig, receivedSig)) {
    return json(401, { error: "invalid_signature" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const event = payload.event as string | undefined;
  const paymentEntity = (
    payload?.payload as Record<string, unknown> | undefined
  )?.payment as Record<string, unknown> | undefined;
  const entity = paymentEntity?.entity as Record<string, unknown> | undefined;

  if (!entity) {
    // Not a payment event we care about.
    return json(200, { received: true });
  }

  const razorpay_payment_id = entity.id as string;
  const razorpay_order_id = entity.order_id as string;
  const amount_paise = entity.amount as number;

  const adminClient = createClient(supabaseUrl, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event === "payment.captured") {
    // Look up the booking via the payments row.
    const { data: payment } = await adminClient
      .from("payments")
      .select("id, booking_id, status")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (!payment) {
      console.warn("razorpay-webhook: payment row not found for order", razorpay_order_id);
      return json(200, { received: true });
    }

    // Idempotency: skip if already processed.
    if (payment.status === "captured" || payment.status === "refunded") {
      return json(200, { received: true, idempotent: true });
    }

    // Load booking status.
    const { data: booking } = await adminClient
      .from("bookings")
      .select("id, status, hold_expires_at")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (!booking) {
      return json(200, { received: true });
    }

    if (booking.status === "expired" || (booking.hold_expires_at && new Date(booking.hold_expires_at) <= new Date())) {
      // Hold has expired — auto-refund.
      try {
        await issueRefund(razorpay_payment_id, amount_paise, keyId, keySecret);
        await adminClient
          .from("payments")
          .update({
            status: "refunded",
            razorpay_payment_id,
            amount_paise,
            provider_payload: payload,
          })
          .eq("id", payment.id);
        console.log("razorpay-webhook: auto-refunded expired hold", payment.booking_id);
      } catch (err) {
        console.error("razorpay-webhook: auto-refund failed", err);
        return json(500, { error: "refund_failed" });
      }
      return json(200, { received: true, auto_refunded: true });
    }

    // Normal capture: update payment + confirm booking.
    await adminClient
      .from("payments")
      .update({
        status: "captured",
        razorpay_payment_id,
        amount_paise,
        provider_payload: payload,
      })
      .eq("id", payment.id);

    await adminClient
      .from("bookings")
      .update({ status: "confirmed", hold_expires_at: null })
      .eq("id", payment.booking_id)
      .in("status", ["held", "confirmed"]);

    return json(200, { received: true, confirmed: true });
  }

  if (event === "payment.failed") {
    // Mark payment as failed; leave booking in 'held' so pg_cron expires it.
    const { data: payment } = await adminClient
      .from("payments")
      .select("id")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (payment) {
      await adminClient
        .from("payments")
        .update({
          status: "failed",
          razorpay_payment_id,
          provider_payload: payload,
        })
        .eq("id", payment.id);
    }
    return json(200, { received: true });
  }

  // Unknown event — acknowledge and ignore.
  return json(200, { received: true });
});
