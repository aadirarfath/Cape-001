// Pure helpers for notify-booking: no Deno or network APIs, so they run under both the Edge
// Runtime and `node --test` (see push.test.ts).

// Mirrors APP_TIME_ZONE / APP_LOCALE in @cape001/core. Edge Functions are bundled from
// supabase/functions only, so the shared package can't be imported here.
export const APP_TIME_ZONE = "Asia/Kolkata";
export const APP_LOCALE = "en-IN";

/** Android notification channel; the partner app creates it before registering a token. */
export const ANDROID_CHANNEL_ID = "bookings";

/** Expo accepts at most 100 messages per request. */
export const EXPO_MAX_BATCH = 100;

export type BookingEvent = "created" | "cancelled";

export interface NotifyRequest {
  event: BookingEvent;
  booking_id: string;
}

export interface BookingSummary {
  id: string;
  status: string;
  starts_at: string;
  shop_name: string;
  barber_name: string;
  service_name: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: "booking"; event: BookingEvent; bookingId: string };
  sound: "default";
  priority: "high";
  channelId: string;
  ttl: number;
}

export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Notification text. Kept short: it shows on the lock screen, so no customer details.
const MESSAGES = {
  created: { title: "New booking", body: "{service} with {barber} · {time}" },
  cancelled: { title: "Booking cancelled", body: "{service} with {barber} · {time}" },
} satisfies Record<BookingEvent, { title: string; body: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the trigger's JSON body ({ event, booking_id }); null if it isn't one. */
export function parseNotifyRequest(value: unknown): NotifyRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const { event, booking_id } = value as Record<string, unknown>;
  if (event !== "created" && event !== "cancelled") return null;
  if (typeof booking_id !== "string" || !UUID_RE.test(booking_id)) return null;
  return { event, booking_id };
}

/** Compares two secrets without leaking where they differ through timing. */
export function secretsMatch(given: string | null, expected: string): boolean {
  if (given === null || expected === "") return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

/** e.g. "Sat, 4 Oct, 4:30 pm" in India Standard Time. */
export function formatBookingTime(startsAt: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Whether the booking still matches the event. pg_net delivers after commit, but a booking can
 * change again before the function runs; a "created" push for a booking that has since been
 * cancelled is pointless, and a "cancelled" push must only go out for a cancelled booking.
 */
export function shouldNotify(event: BookingEvent, status: string): boolean {
  return event === "cancelled" ? status === "cancelled" : status === "confirmed" || status === "pending";
}

export function buildMessages(event: BookingEvent, booking: BookingSummary, tokens: string[]): ExpoMessage[] {
  const text = MESSAGES[event];
  const body = fill(text.body, {
    service: booking.service_name,
    barber: booking.barber_name,
    time: formatBookingTime(booking.starts_at),
  });
  return [...new Set(tokens)].map((to) => ({
    to,
    title: text.title,
    body,
    data: { type: "booking", event, bookingId: booking.id },
    sound: "default",
    priority: "high",
    channelId: ANDROID_CHANNEL_ID,
    // A new-booking alert is useless once the appointment has passed.
    ttl: Math.max(60, Math.floor((new Date(booking.starts_at).getTime() - Date.now()) / 1000)),
  }));
}

export function chunk<T>(items: T[], size: number = EXPO_MAX_BATCH): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Tokens Expo reported as no longer registered (tickets are in the same order as messages). */
export function unregisteredTokens(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((ticket, i) =>
    ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" && messages[i]
      ? [messages[i].to]
      : [],
  );
}
