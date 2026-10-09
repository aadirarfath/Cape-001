// Run with `pnpm test:scripts`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalSupabaseUrl, isLocalHostname } from "./local-url.mjs";

describe("isLocalHostname", () => {
  it("accepts localhost, loopback and private LAN addresses", () => {
    for (const host of ["localhost", "127.0.0.1", "192.168.29.89", "192.168.0.1", "10.0.0.5", "10.255.255.255"]) {
      assert.equal(isLocalHostname(host), true, host);
    }
  });

  it("refuses hosted projects, public IPs and look-alike hostnames", () => {
    for (const host of [
      "abcdefghijklmnop.supabase.co",
      "8.8.8.8",
      "192.169.1.1",
      "11.0.0.1",
      "172.16.0.1",
      "127.0.0.2",
      "10.example.com",
      "192.168.1.1.evil.com",
      "localhost.evil.com",
      "192.168.1.256",
      "192.168.01.1",
      "10.0.0",
      "",
    ]) {
      assert.equal(isLocalHostname(host), false, host);
    }
  });
});

describe("assertLocalSupabaseUrl", () => {
  it("passes local Supabase URLs", () => {
    assert.equal(assertLocalSupabaseUrl("http://127.0.0.1:54321").port, "54321");
    assert.equal(assertLocalSupabaseUrl("http://192.168.29.89:54321/").hostname, "192.168.29.89");
    assert.equal(assertLocalSupabaseUrl("http://localhost:54321").hostname, "localhost");
  });

  it("refuses production and malformed URLs", () => {
    assert.throws(() => assertLocalSupabaseUrl("https://abcdefghijklmnop.supabase.co"), /must never touch production/);
    // "10.0.0.1" is the username here; the real host is evil.com.
    assert.throws(() => assertLocalSupabaseUrl("http://10.0.0.1@evil.com"), /Refusing to run/);
    assert.throws(() => assertLocalSupabaseUrl("http://evil.com#@127.0.0.1"), /must never touch production/);
    assert.throws(() => assertLocalSupabaseUrl("http://user:pw@127.0.0.1:54321"), /credentials/);
    assert.throws(() => assertLocalSupabaseUrl("ftp://127.0.0.1"), /not an http/);
    assert.throws(() => assertLocalSupabaseUrl("not a url"), /Not a valid URL/);
    assert.throws(() => assertLocalSupabaseUrl(""), /Not a valid URL/);
  });
});
