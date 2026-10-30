// process-push-receipts: Scheduled Edge Function for Expo push receipts and retries.
//
// 1. Receipts: Fetches Expo receipts for tickets created >= 15 minutes ago.
//    Deletes DeviceNotRegistered tokens from push_tokens and logs credential errors.
// 2. Retries: Processes failed notification sends with exponential backoff (up to 5 attempts).
//
// Called on a schedule or via POST with X-Webhook-Secret / service-role key.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  calculateBackoffSeconds,
  chunk,
  extractSuccessfulTickets,
  findCredentialErrors,
  secretsMatch,
  unregisteredTokensFromReceipts,
  type ExpoMessage,
  type ExpoReceipt,
  type ExpoTicket,
} from "../notify-booking/push.ts";

const DEFAULT_EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const DEFAULT_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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
    } catch {
      // fall through
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

async function fetchReceipts(ticketIds: string[]): Promise<Record<string, ExpoReceipt>> {
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const response = await fetch(Deno.env.get("EXPO_RECEIPTS_URL") || DEFAULT_EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ ids: ticketIds }),
  });
  if (!response.ok) {
    throw new Error(`Expo receipts API returned ${response.status}: ${await response.text()}`);
  }
  const { data } = (await response.json()) as { data?: Record<string, ExpoReceipt> };
  return data ?? {};
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
  if (req.method !== "POST" && req.method !== "GET") {
    return json(405, { error: "method_not_allowed" });
  }

  const expectedSecret = Deno.env.get("NOTIFY_BOOKING_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization");
  const webhookSecret = req.headers.get("X-Webhook-Secret");
  const key = serviceKey();

  const isAuthorized =
    (expectedSecret && webhookSecret && secretsMatch(webhookSecret, expectedSecret)) ||
    (key && authHeader?.replace("Bearer ", "") === key);

  if (!isAuthorized) {
    return json(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !key) {
    return json(500, { error: "not_configured" });
  }
  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Process receipts for tickets created at least 15 minutes ago
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pendingTickets, error: ticketsErr } = await supabase
    .from("push_notification_tickets")
    .select("id, ticket_id, token, created_at")
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .limit(300);

  let receiptsChecked = 0;
  let tokensRemoved = 0;

  if (!ticketsErr && pendingTickets && pendingTickets.length > 0) {
    const ticketMap: Record<string, string> = {};
    const ticketIds: string[] = [];
    for (const t of pendingTickets) {
      ticketMap[t.ticket_id] = t.token;
      ticketIds.push(t.ticket_id);
    }

    try {
      const receipts = await fetchReceipts(ticketIds);
      receiptsChecked = Object.keys(receipts).length;

      // Handle DeviceNotRegistered tokens
      const staleTokens = unregisteredTokensFromReceipts(receipts, ticketMap);
      if (staleTokens.length > 0) {
        const { count } = await supabase
          .from("push_tokens")
          .delete({ count: "exact" })
          .in("token", staleTokens);
        tokensRemoved = count ?? 0;
      }

      // Log credential or configuration errors
      const credentialErrors = findCredentialErrors(receipts);
      for (const err of credentialErrors) {
        console.error("process-push-receipts: push credential error in receipt", err);
      }

      // Mark processed tickets as checked
      const checkedTicketIds = Object.keys(receipts);
      if (checkedTicketIds.length > 0) {
        await supabase
          .from("push_notification_tickets")
          .update({ status: "checked" })
          .in("ticket_id", checkedTicketIds);
      }
    } catch (receiptErr) {
      console.error("process-push-receipts: failed fetching receipts", receiptErr);
    }
  }

  // 2. Process retries with exponential backoff
  const now = new Date().toISOString();
  const { data: retries, error: retriesErr } = await supabase
    .from("push_notification_retries")
    .select("id, message, attempt_count")
    .eq("status", "pending")
    .lte("next_retry_at", now)
    .limit(50);

  let retriesSuccess = 0;
  let retriesFailed = 0;

  if (!retriesErr && retries && retries.length > 0) {
    for (const retry of retries) {
      const msg = retry.message as unknown as ExpoMessage;
      try {
        const tickets = await sendBatch([msg]);
        const okTickets = extractSuccessfulTickets([msg], tickets);
        if (okTickets.length > 0) {
          await supabase.from("push_notification_tickets").insert(okTickets);
        }

        await supabase
          .from("push_notification_retries")
          .update({ status: "succeeded" })
          .eq("id", retry.id);
        retriesSuccess++;
      } catch (err) {
        const nextAttempt = (retry.attempt_count ?? 1) + 1;
        if (nextAttempt >= 5) {
          await supabase
            .from("push_notification_retries")
            .update({ status: "failed", last_error: String(err), attempt_count: nextAttempt })
            .eq("id", retry.id);
          retriesFailed++;
        } else {
          const nextRetryAt = new Date(
            Date.now() + calculateBackoffSeconds(nextAttempt) * 1000,
          ).toISOString();
          await supabase
            .from("push_notification_retries")
            .update({
              attempt_count: nextAttempt,
              next_retry_at: nextRetryAt,
              last_error: String(err),
            })
            .eq("id", retry.id);
        }
      }
    }
  }

  return json(200, {
    receiptsChecked,
    tokensRemoved,
    retriesSuccess,
    retriesFailed,
  });
});
