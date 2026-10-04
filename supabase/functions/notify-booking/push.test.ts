// Unit tests for the notify-booking helpers. Run with `pnpm test:functions` (Node's test runner
// with built-in TypeScript type stripping; no Deno needed).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMessages,
  chunk,
  type ExpoMessage,
  formatBookingTime,
  parseNotifyRequest,
  secretsMatch,
  shouldNotify,
  unregisteredTokens,
} from "./push.ts";

const BOOKING_ID = "3f0c8f1e-2a4b-4c6d-8e9f-0a1b2c3d4e5f";

const booking = {
  id: BOOKING_ID,
  status: "confirmed",
  // 11:00 UTC = 16:30 IST
  starts_at: "2099-10-03T11:00:00Z",
  shop_name: "Fade Theory",
  barber_name: "Arjun",
  service_name: "Haircut",
};

describe("parseNotifyRequest", () => {
  it("accepts the trigger payload", () => {
    assert.deepEqual(parseNotifyRequest({ event: "created", booking_id: BOOKING_ID }), {
      event: "created",
      booking_id: BOOKING_ID,
    });
  });

  it("rejects unknown events, bad ids and non-objects", () => {
    assert.equal(parseNotifyRequest({ event: "completed", booking_id: BOOKING_ID }), null);
    assert.equal(parseNotifyRequest({ event: "created", booking_id: "1; drop table" }), null);
    assert.equal(parseNotifyRequest({ event: "created" }), null);
    assert.equal(parseNotifyRequest(null), null);
    assert.equal(parseNotifyRequest("created"), null);
  });
});

describe("secretsMatch", () => {
  it("matches only the exact secret", () => {
    assert.equal(secretsMatch("s3cret", "s3cret"), true);
    assert.equal(secretsMatch("s3cret!", "s3cret"), false);
    assert.equal(secretsMatch("s3cre", "s3cret"), false);
    assert.equal(secretsMatch("", "s3cret"), false);
    assert.equal(secretsMatch(null, "s3cret"), false);
  });

  it("never matches when no secret is configured", () => {
    assert.equal(secretsMatch("", ""), false);
  });
});

describe("shouldNotify", () => {
  it("sends created only for active bookings and cancelled only for cancelled ones", () => {
    assert.equal(shouldNotify("created", "confirmed"), true);
    assert.equal(shouldNotify("created", "pending"), true);
    assert.equal(shouldNotify("created", "cancelled"), false);
    assert.equal(shouldNotify("cancelled", "cancelled"), true);
    assert.equal(shouldNotify("cancelled", "confirmed"), false);
  });
});

describe("formatBookingTime", () => {
  it("shows the time in India Standard Time", () => {
    const text = formatBookingTime("2099-10-03T11:00:00Z");
    assert.match(text, /4:30/);
    assert.match(text, /pm/i);
    assert.match(text, /3 Oct/);
  });
});

describe("buildMessages", () => {
  it("builds one message per distinct token with IST time and no customer details", () => {
    const messages = buildMessages("created", booking, ["ExponentPushToken[a]", "ExponentPushToken[a]", "ExponentPushToken[b]"]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].title, "New booking");
    assert.match(messages[0].body, /^Haircut with Arjun · .*4:30/);
    assert.deepEqual(messages[0].data, { type: "booking", event: "created", bookingId: BOOKING_ID });
    assert.equal(messages[0].channelId, "bookings");
    assert.ok(messages[0].ttl > 60);
  });

  it("uses the cancellation title", () => {
    const [message] = buildMessages("cancelled", { ...booking, status: "cancelled" }, ["ExponentPushToken[a]"]);
    assert.equal(message.title, "Booking cancelled");
  });

  it("keeps a minimum TTL for appointments that already started", () => {
    const [message] = buildMessages("cancelled", { ...booking, starts_at: "2000-01-01T00:00:00Z" }, ["ExponentPushToken[a]"]);
    assert.equal(message.ttl, 60);
  });
});

describe("chunk", () => {
  it("splits into batches of 100", () => {
    const sizes = chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length);
    assert.deepEqual(sizes, [100, 100, 50]);
    assert.deepEqual(chunk([]), []);
  });
});

describe("unregisteredTokens", () => {
  it("returns tokens whose ticket says DeviceNotRegistered", () => {
    const messages = buildMessages("created", booking, [
      "ExponentPushToken[ok]",
      "ExponentPushToken[gone]",
      "ExponentPushToken[throttled]",
    ]) as ExpoMessage[];
    const tickets = [
      { status: "ok" as const, id: "1" },
      { status: "error" as const, message: "not registered", details: { error: "DeviceNotRegistered" } },
      { status: "error" as const, message: "slow down", details: { error: "MessageRateExceeded" } },
    ];
    assert.deepEqual(unregisteredTokens(messages, tickets), ["ExponentPushToken[gone]"]);
  });
});
