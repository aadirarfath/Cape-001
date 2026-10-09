// notify-booking: sends Expo push notifications for new and cancelled bookings.
//
// Called by the bookings triggers in the booking_notifications migration (pg_net, after commit)
// with { event, booking_id } and an X-Webhook-Secret header. JWT verification is off for this
// function (supabase/config.toml); the shared secret is the only way in.
//
// Recipients come from booking_notification_tokens: the shop's owners and managers and the booked
// barber, minus whoever caused the event. Tokens Expo reports as DeviceNotRegistered are deleted.
//
// Environment:
//   NOTIFY_BOOKING_SECRET  required; must match the notify_booking_secret Vault secret
//   EXPO_ACCESS_TOKEN      optional; needed once "enhanced push security" is on in Expo
//   EXPO_PUSH_URL          optional; defaults to Expo's push API (overridden only in local tests)
// SUPABASE_URL and the secret/service-role key are injected by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildMessages,
  chunk,
  type ExpoMessage,
  type ExpoTicket,
  parseNotifyRequest,
  secretsMatch,
  shouldNotify,
  unregisteredTokens,
} from "./push.ts";

const DEFAULT_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The service-role key: the new secret key if present, else the legacy service_role JWT. */
function serviceKey(): string | undefined {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const key = (JSON.parse(secretKeys) as Record<string, string>).default;
      if (key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const response = await fetch(Deno.env.get("EXPO_PUSH_URL") || DEFAULT_EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    throw new Error(`Expo push API returned ${response.status}: ${await response.text()}`);
  }
  const { data } = (await response.json()) as { data?: ExpoTicket[] };
  return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const expectedSecret = Deno.env.get("NOTIFY_BOOKING_SECRET") ?? "";
  if (!expectedSecret) {
    console.error("notify-booking: NOTIFY_BOOKING_SECRET is not set");
    return json(500, { error: "not_configured" });
  }
  if (!secretsMatch(req.headers.get("X-Webhook-Secret"), expectedSecret)) {
    return json(401, { error: "unauthorized" });
  }

  const request = parseNotifyRequest(await req.json().catch(() => null));
  if (!request) {
    return json(400, { error: "invalid_request" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!supabaseUrl || !key) {
    console.error("notify-booking: SUPABASE_URL or the service key is missing");
    return json(500, { error: "not_configured" });
  }
  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, status, starts_at, shop:shops (name), barber:barbers (display_name), service:services (name)")
    .eq("id", request.booking_id)
    .maybeSingle();
  if (bookingError) {
    console.error("notify-booking: loading booking failed", bookingError);
    return json(500, { error: "booking_lookup_failed" });
  }
  if (!booking) {
    return json(404, { error: "booking_not_found" });
  }
  if (!shouldNotify(request.event, booking.status)) {
    return json(200, { sent: 0, skipped: "status_changed" });
  }

  const { data: recipients, error: tokensError } = await supabase.rpc("booking_notification_tokens", {
    p_booking_id: booking.id,
  });
  if (tokensError) {
    console.error("notify-booking: loading tokens failed", tokensError);
    return json(500, { error: "token_lookup_failed" });
  }

  const messages = buildMessages(
    request.event,
    {
      id: booking.id,
      status: booking.status,
      starts_at: booking.starts_at,
      // Embedded to-one relations; typed loosely because this function has no generated types.
      shop_name: (booking.shop as { name?: string } | null)?.name ?? "",
      barber_name: (booking.barber as { display_name?: string } | null)?.display_name ?? "",
      service_name: (booking.service as { name?: string } | null)?.name ?? "",
    },
    (recipients ?? []).map((r: { token: string }) => r.token),
  );
  if (messages.length === 0) {
    return json(200, { sent: 0 });
  }

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];
  for (const batch of chunk(messages)) {
    try {
      const tickets = await sendBatch(batch);
      sent += tickets.filter((t) => t.status === "ok").length;
      failed += tickets.filter((t) => t.status === "error").length;
      stale.push(...unregisteredTokens(batch, tickets));
      for (const ticket of tickets) {
        if (ticket.status === "error" && ticket.details?.error !== "DeviceNotRegistered") {
          console.warn("notify-booking: push ticket error", ticket.message, ticket.details);
        }
      }
    } catch (error) {
      failed += batch.length;
      console.error("notify-booking: sending failed", error);
    }
  }

  let removed = 0;
  if (stale.length > 0) {
    const { error, count } = await supabase
      .from("push_tokens")
      .delete({ count: "exact" })
      .in("token", stale);
    if (error) console.error("notify-booking: removing stale tokens failed", error);
    removed = count ?? 0;
  }

  return json(200, { sent, failed, removed });
});
