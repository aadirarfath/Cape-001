/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/bookings"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const base = "http://localhost";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
