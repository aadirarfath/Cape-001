// create-razorpay-order: verifies the hold is valid, reads the price from the DB,
// calls Razorpay Orders API, stores the razorpay_order_id on the payments row,
// and returns the order_id + key_id to the client.
//
// Environment:
//   RAZORPAY_KEY_ID      required
//   RAZORPAY_KEY_SECRET  required
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY injected by Supabase

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  // Authenticate the calling user via the Authorization header.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "unauthorized" });
  }
  const userToken = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const svcKey = serviceKey();
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!supabaseUrl || !svcKey || !keyId || !keySecret) {
    console.error("create-razorpay-order: missing environment variables");
    return json(500, { error: "not_configured" });
  }

  // Use the user's JWT to get their uid for validation.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json(401, { error: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const booking_id = (body as Record<string, unknown>)?.booking_id;
  if (typeof booking_id !== "string" || !booking_id) {
    return json(400, { error: "booking_id required" });
  }

  // Load the booking with service-role key (bypasses RLS) to verify ownership and status.
  const adminClient = createClient(supabaseUrl, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: booking, error: bookingError } = await adminClient
    .from("bookings")
    .select("id, customer_id, status, hold_expires_at, seat_id, price_paise, seats(price_paise)")
    .eq("id", booking_id)
    .maybeSingle();

  if (bookingError) {
    console.error("create-razorpay-order: booking lookup failed", bookingError);
    return json(500, { error: "booking_lookup_failed" });
  }
  if (!booking) {
    return json(404, { error: "booking_not_found" });
  }
  if (booking.customer_id !== user.id) {
    return json(403, { error: "forbidden" });
  }
  if (booking.status !== "held") {
    return json(409, { error: "booking_not_held" });
  }
  if (booking.hold_expires_at && new Date(booking.hold_expires_at) <= new Date()) {
    return json(409, { error: "hold_expired" });
  }

  // Amount comes from the DB, never from the client.
  const amount_paise: number = booking.price_paise as number;

  // Create Razorpay order.
  const razorpayAuth = btoa(`${keyId}:${keySecret}`);
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${razorpayAuth}`,
    },
    body: JSON.stringify({
      amount: amount_paise,
      currency: "INR",
      receipt: booking_id.slice(0, 40),
      notes: { booking_id },
    }),
  });

  if (!rzpRes.ok) {
    const text = await rzpRes.text();
    console.error("create-razorpay-order: Razorpay API error", rzpRes.status, text);
    return json(502, { error: "payment_provider_error" });
  }

  const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };

  // Upsert the payments row so we have a record of the order.
  const { error: paymentError } = await adminClient
    .from("payments")
    .upsert(
      {
        booking_id,
        amount_paise,
        currency: "INR",
        status: "created",
        razorpay_order_id: rzpOrder.id,
      },
      { onConflict: "razorpay_order_id", ignoreDuplicates: true },
    );

  if (paymentError) {
    console.error("create-razorpay-order: failed to store payment row", paymentError);
    // Non-fatal: the order was created; client can still proceed.
  }

  return json(200, {
    order_id: rzpOrder.id,
    amount_paise: rzpOrder.amount,
    currency: rzpOrder.currency,
    key_id: keyId,
  });
});
