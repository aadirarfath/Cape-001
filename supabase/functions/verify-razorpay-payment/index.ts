// verify-razorpay-payment: HMAC-SHA256 verifies the Razorpay callback, then
// marks the payment as captured and the booking as confirmed.
//
// Called by the client immediately after Razorpay Checkout succeeds.
// The webhook (razorpay-webhook) is the authoritative source; this call
// gives the user instant feedback.
//
// Environment:
//   RAZORPAY_KEY_SECRET  required (same secret used to sign the order)
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

/** HMAC-SHA256 of `message` with `secret`, as a hex string. */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison of two hex strings. */
function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "unauthorized" });
  }
  const userToken = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const svcKey = serviceKey();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!supabaseUrl || !svcKey || !keySecret) {
    console.error("verify-razorpay-payment: missing environment variables");
    return json(500, { error: "not_configured" });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json(401, { error: "unauthorized" });
  }

  let body: Record<string, string>;
  try {
    body = await req.json() as Record<string, string>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json(400, { error: "missing_fields" });
  }

  // Verify HMAC-SHA256: Razorpay signs order_id + "|" + payment_id with key_secret.
  const expectedSig = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!hexEqual(expectedSig, razorpay_signature)) {
    return json(400, { error: "invalid_signature" });
  }

  const adminClient = createClient(supabaseUrl, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the booking belongs to the caller and is in 'held' status.
  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, customer_id, status, hold_expires_at, price_paise")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking || booking.customer_id !== user.id) {
    return json(404, { error: "booking_not_found" });
  }
  if (booking.status === "confirmed") {
    // Already confirmed (webhook fired first) — idempotent success.
    return json(200, { confirmed: true });
  }
  if (booking.status !== "held") {
    return json(409, { error: "booking_not_held" });
  }
  if (booking.hold_expires_at && new Date(booking.hold_expires_at) <= new Date()) {
    return json(409, { error: "hold_expired" });
  }

  // Update payment row (idempotent: match existing order created during order creation).
  const { data: updatedPayment, error: payErr } = await adminClient
    .from("payments")
    .update({
      status: "captured",
      razorpay_payment_id,
      amount_paise: booking.price_paise,
    })
    .eq("razorpay_order_id", razorpay_order_id)
    .select("id")
    .maybeSingle();

  if (payErr) {
    console.error("verify-razorpay-payment: payment update failed", payErr);
  } else if (!updatedPayment) {
    // If order was not pre-created, insert the captured payment row.
    await adminClient.from("payments").insert({
      booking_id,
      amount_paise: booking.price_paise,
      currency: "INR",
      status: "captured",
      razorpay_order_id,
      razorpay_payment_id,
    });
  }

  // Confirm the booking.
  const { error: bookErr } = await adminClient
    .from("bookings")
    .update({ status: "confirmed", hold_expires_at: null })
    .eq("id", booking_id)
    .eq("status", "held"); // Guard: only update if still held.

  if (bookErr) {
    console.error("verify-razorpay-payment: booking update failed", bookErr);
    return json(500, { error: "booking_update_failed" });
  }

  return json(200, { confirmed: true });
});
