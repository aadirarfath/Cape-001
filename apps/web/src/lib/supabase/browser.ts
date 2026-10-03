import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@cape001/db";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Supabase client for Client Components. Uses the anon key and the user's session cookies. */
export function createClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
