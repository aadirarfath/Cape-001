import type { NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

// Nonce-based Content Security Policy, generated per request. Next.js reads the nonce from the
// request's CSP header and adds it to its own scripts; pages can read it from `x-nonce`.
// The other security headers are static and live in next.config.ts.

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = new URL(SUPABASE_URL).origin;

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes from React components; scripts are what the nonce protects.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabase}`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase}${isDev ? " ws:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    // Only once the API is served over HTTPS (not against local Supabase on http://127.0.0.1).
    ...(supabase.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except static assets and image optimisation.
      source: "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
