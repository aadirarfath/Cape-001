/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/bookings"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
