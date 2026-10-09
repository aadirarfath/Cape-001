// Guard for local-only developer scripts: is this Supabase URL on this machine or the LAN?
// Hosted Supabase projects (https://<ref>.supabase.co) and any other public host are refused.

function isOctet(part) {
  return /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255;
}

/** True for localhost, 127.0.0.1, 192.168.x.x and 10.x.x.x (IPv4 literals only). */
export function isLocalHostname(hostname) {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every(isOctet)) return false;
  return (parts[0] === "192" && parts[1] === "168") || parts[0] === "10";
}

/** Throws unless `url` is an http(s) URL whose host is local (see isLocalHostname). */
export function assertLocalSupabaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${JSON.stringify(url)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Refusing to run: ${url} is not an http(s) URL.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("Refusing to run: the Supabase URL must not contain credentials.");
  }
  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(
      `Refusing to run against ${parsed.hostname}: this script only works with a local Supabase ` +
        "(localhost, 127.0.0.1, 192.168.x.x or 10.x.x.x). It must never touch production.",
    );
  }
  return parsed;
}
