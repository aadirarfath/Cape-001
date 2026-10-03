import { createServerClient } from "@supabase/ssr";
import type { Database } from "@cape001/db";
import { type NextRequest, NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Refreshes the Supabase session cookies. `requestHeaders` carries the CSP nonce through to
 * rendering, so every response created here must forward them.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // request.cookies.set updates the Cookie header on `request.headers`; copy it across.
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) requestHeaders.set("cookie", cookieHeader);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it validates (and if needed,
  // refreshes) the session.
  await supabase.auth.getClaims();

  return response;
}
