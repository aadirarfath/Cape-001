// Unit tests for razorpay-webhook helpers.
// Run with `pnpm test:functions` (Node's built-in test runner, TS type-stripping).
//
// We extract the pure logic (signature verification, event routing) into
// standalone helpers so they can be tested without a real Supabase instance.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

// ---------------------------------------------------------------------------
// Helpers duplicated here for unit testing (the edge function uses Web Crypto).
// ---------------------------------------------------------------------------

function hmacSha256HexNode(secret: string, message: string | Buffer): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function verifyWebhookSignature(secret: string, body: string, received: string): boolean {
  const expected = hmacSha256HexNode(secret, body);
  return hexEqual(expected, received);
}

function verifyPaymentSignature(keySecret: string, order_id: string, payment_id: string, sig: string): boolean {
  const expected = hmacSha256HexNode(keySecret, `${order_id}|${payment_id}`);
  return hexEqual(expected, sig);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "webhook_secret_123";
const KEY_SECRET = "key_secret_456";

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = hmacSha256HexNode(WEBHOOK_SECRET, body);
    assert.equal(verifyWebhookSignature(WEBHOOK_SECRET, body, sig), true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = hmacSha256HexNode("wrong_secret", body);
    assert.equal(verifyWebhookSignature(WEBHOOK_SECRET, body, sig), false);
  });

  it("rejects an empty signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    assert.equal(verifyWebhookSignature(WEBHOOK_SECRET, body, ""), false);
  });

  it("rejects a truncated signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = hmacSha256HexNode(WEBHOOK_SECRET, body).slice(0, 32);
    assert.equal(verifyWebhookSignature(WEBHOOK_SECRET, body, sig), false);
  });
});

describe("verifyPaymentSignature (verify-razorpay-payment)", () => {
  const order_id = "order_testABC123";
  const payment_id = "pay_testXYZ789";

  it("accepts a correctly signed callback", () => {
    const sig = hmacSha256HexNode(KEY_SECRET, `${order_id}|${payment_id}`);
    assert.equal(verifyPaymentSignature(KEY_SECRET, order_id, payment_id, sig), true);
  });

  it("rejects a callback with wrong order/payment ids", () => {
    const sig = hmacSha256HexNode(KEY_SECRET, `${order_id}|${payment_id}`);
    assert.equal(verifyPaymentSignature(KEY_SECRET, "order_wrong", payment_id, sig), false);
    assert.equal(verifyPaymentSignature(KEY_SECRET, order_id, "pay_wrong", sig), false);
  });

  it("rejects a replayed signature with different ids", () => {
    const original = hmacSha256HexNode(KEY_SECRET, `order_A|pay_A`);
    assert.equal(verifyPaymentSignature(KEY_SECRET, "order_B", "pay_B", original), false);
  });
});

describe("webhook idempotency (logic)", () => {
  // Simulate the state check the webhook does before updating.
  function handleCaptureEvent(currentPaymentStatus: string): { action: string } {
    if (currentPaymentStatus === "captured" || currentPaymentStatus === "refunded") {
      return { action: "noop" };
    }
    return { action: "confirm" };
  }

  it("is a no-op when payment is already captured", () => {
    assert.deepEqual(handleCaptureEvent("captured"), { action: "noop" });
  });

  it("is a no-op when payment is already refunded", () => {
    assert.deepEqual(handleCaptureEvent("refunded"), { action: "noop" });
  });

  it("confirms a newly captured payment", () => {
    assert.deepEqual(handleCaptureEvent("created"), { action: "confirm" });
  });
});

describe("auto-refund logic", () => {
  function shouldAutoRefund(bookingStatus: string, holdExpiresAt: string | null): boolean {
    if (bookingStatus === "expired") return true;
    if (!holdExpiresAt) return false;
    return new Date(holdExpiresAt) <= new Date();
  }

  it("auto-refunds an expired booking", () => {
    assert.equal(shouldAutoRefund("expired", null), true);
  });

  it("auto-refunds when hold_expires_at is in the past", () => {
    assert.equal(shouldAutoRefund("held", "2000-01-01T00:00:00Z"), true);
  });

  it("does not auto-refund a valid held booking", () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    assert.equal(shouldAutoRefund("held", future), false);
  });

  it("does not auto-refund a confirmed booking", () => {
    assert.equal(shouldAutoRefund("confirmed", null), false);
  });
});
