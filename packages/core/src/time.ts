// Timestamps are stored as timestamptz in UTC and displayed in Asia/Kolkata.

export const APP_TIME_ZONE = "Asia/Kolkata";
export const APP_LOCALE = "en-IN";

/** Format a UTC instant (ISO string or Date) for display in India Standard Time. */
export function formatInAppTimeZone(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone: APP_TIME_ZONE }).format(date);
}
