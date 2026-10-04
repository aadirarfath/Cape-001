#!/usr/bin/env node
// Approve a shop on the LOCAL Supabase stack, for testing the partner app's approval flow.
//
//   pnpm db:approve-shop              list shops waiting for approval
//   pnpm db:approve-shop <slug>       approve one
//
// Signs in as the seeded platform admin (supabase/seed.sql) with the anon key and calls
// approve_shop, exactly as an admin tool would. No service_role key, no SQL.
//
// It refuses to run unless the Supabase URL is localhost, 127.0.0.1, 192.168.x.x or 10.x.x.x
// (see local-url.mjs), so it can never approve anything in production.
//
// The URL and anon key come from `supabase status`; override with SUPABASE_URL and
// SUPABASE_ANON_KEY. Admin login: ADMIN_EMAIL / ADMIN_PASSWORD (default: the seeded admin).

import { execSync } from "node:child_process";
import { assertLocalSupabaseUrl } from "./local-url.mjs";

// The script ends by setting process.exitCode rather than calling process.exit(): exiting while
// fetch connections are still closing crashes Node on Windows (libuv UV_HANDLE_CLOSING).
class ScriptError extends Error {}

function localStackEnv() {
  try {
    const output = execSync("pnpm exec supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Object.fromEntries(
      output
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter(Boolean)
        .map(([, key, value]) => [key, value]),
    );
  } catch {
    return {};
  }
}

async function main() {
  const status = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? {} : localStackEnv();
  const supabaseUrl = process.env.SUPABASE_URL ?? status.API_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? status.ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new ScriptError("Local Supabase is not running. Start it with `pnpm db:start`.");
  }

  // The guard runs before any request is made.
  let base;
  try {
    base = assertLocalSupabaseUrl(supabaseUrl).origin;
  } catch (error) {
    throw new ScriptError(error.message);
  }

  const email = process.env.ADMIN_EMAIL ?? "admin@cape001.test";
  const password = process.env.ADMIN_PASSWORD ?? "password123";
  const slug = process.argv[2];

  async function request(path, { method = "GET", token, body } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token ?? anonKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.message ?? data?.msg ?? data?.error_description ?? `HTTP ${response.status}`);
    }
    return data;
  }

  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  const token = session.access_token;

  if (!slug) {
    const pending = await request(
      "/rest/v1/shops?select=name,slug,created_at&is_active=eq.false&order=created_at",
      { token },
    );
    if (pending.length === 0) {
      console.log("\n  No shops are waiting for approval.\n");
    } else {
      console.log("\n  Shops waiting for approval:\n");
      for (const shop of pending) console.log(`    ${shop.slug.padEnd(40)} ${shop.name}`);
      console.log("\n  Approve one with: pnpm db:approve-shop <slug>\n");
    }
    return;
  }

  const [shop] = await request(
    `/rest/v1/shops?select=id,name,is_active&slug=eq.${encodeURIComponent(slug)}`,
    { token },
  );
  if (!shop) {
    throw new ScriptError(`No shop with slug "${slug}". Run \`pnpm db:approve-shop\` to list pending shops.`);
  }
  if (shop.is_active) {
    console.log(`\n  "${shop.name}" is already approved.\n`);
    return;
  }

  await request("/rest/v1/rpc/approve_shop", { method: "POST", token, body: { p_shop_id: shop.id } });
  console.log(`\n  Approved "${shop.name}" (${slug}) on ${base}.\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof ScriptError ? error.message : `Failed: ${error.message}`;
  console.error(`\n  ${message}\n`);
  process.exitCode = 1;
}
