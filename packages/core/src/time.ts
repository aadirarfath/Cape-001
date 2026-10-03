// Timestamps are stored as timestamptz in UTC and displayed in Asia/Kolkata.

export const APP_TIME_ZONE = "Asia/Kolkata";
export const APP_LOCALE = "en-IN";

/** Format a UTC instant (ISO string or Date) for display in India Standard Time. */
export function formatInAppTimeZone(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  locale: string = APP_LOCALE,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIME_ZONE }).format(date);
}

// Local calendar dates ("YYYY-MM-DD") in India Standard Time. These match the SQL functions,
// which take a local `date` and compare it with (now() at time zone 'Asia/Kolkata')::date.

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Asia/Kolkata calendar date of an instant, as "YYYY-MM-DD". */
export function localDateOf(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return localDateFormatter.format(date);
}

/** Today's date in Asia/Kolkata, as "YYYY-MM-DD". */
export function todayInAppTimeZone(now: Date = new Date()): string {
  return localDateOf(now);
}

/** Add whole days to a "YYYY-MM-DD" calendar date. */
export function addDaysToLocalDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The dates a customer can pick for a shop: today through today + maxDaysAhead (inclusive),
 * the same window book_appointment and get_available_slots allow.
 */
export function bookableDates(maxDaysAhead: number, now: Date = new Date()): string[] {
  const today = todayInAppTimeZone(now);
  return Array.from({ length: maxDaysAhead + 1 }, (_, i) => addDaysToLocalDate(today, i));
}

/** Format a "YYYY-MM-DD" calendar date (not an instant), e.g. "Sat, 3 Oct". */
export function formatLocalDate(
  localDate: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
  locale: string = APP_LOCALE,
): string {
  // Midday IST is safely inside the same calendar day.
  return formatInAppTimeZone(`${localDate}T12:00:00+05:30`, options, locale);
}

/** Whether a customer may still cancel: cancel_booking allows it until starts_at - cutoff. */
export function isBeforeCancellationCutoff(
  startsAt: string | Date,
  cutoffMinutes: number,
  now: Date = new Date(),
): boolean {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  return now.getTime() <= start.getTime() - cutoffMinutes * 60_000;
}
