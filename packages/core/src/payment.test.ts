import { describe, expect, it } from "vitest";
import {
  hexEqual,
  hmacSha256Hex,
  RazorpayPaymentProvider,
} from "./razorpay";
import { MockPaymentProvider } from "./payment-mock";

describe("hexEqual", () => {
  it("returns true for identical hex strings", () => {
    expect(hexEqual("abcdef123456", "abcdef123456")).toBe(true);
    expect(hexEqual("", "")).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(hexEqual("abcdef", "abcdef12")).toBe(false);
  });

  it("returns false for different content", () => {
    expect(hexEqual("abcdef12", "abcdef13")).toBe(false);
  });
});

describe("hmacSha256Hex", () => {
  it("computes accurate SHA256 HMAC for string inputs", async () => {
    const sig = await hmacSha256Hex("test_secret", "hello world");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    // Verified independently
    const expected = "c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029";
    expect(sig).toBe(expected);
  });

  it("computes accurate SHA256 HMAC for Uint8Array inputs", async () => {
    const raw = new TextEncoder().encode("hello world");
    const sig = await hmacSha256Hex("test_secret", raw);
    expect(sig).toBe("c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029");
  });
});

describe("RazorpayPaymentProvider", () => {
  const KEY_ID = "rzp_test_key123";
  const KEY_SECRET = "secret_xyz789";
  const WEBHOOK_SECRET = "webhook_sec_abc";

  it("creates order via API", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      expect(url.toString()).toBe("https://api.razorpay.com/v1/orders");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.amount).toBe(50000);
      expect(body.currency).toBe("INR");
      return new Response(
        JSON.stringify({
          id: "order_1234567890",
          amount: 50000,
          currency: "INR",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = new RazorpayPaymentProvider({
      keyId: KEY_ID,
      keySecret: KEY_SECRET,
      webhookSecret: WEBHOOK_SECRET,
      fetchFn: mockFetch as typeof fetch,
    });

    const res = await provider.createOrder({
      amount_paise: 50000,
      receipt: "rcpt_1",
    });

    expect(res).toEqual({
      order_id: "order_1234567890",
      amount_paise: 50000,
      currency: "INR",
      key_id: KEY_ID,
    });
  });

  it("verifies payment signature accurately", async () => {
    const provider = new RazorpayPaymentProvider({
      keyId: KEY_ID,
      keySecret: KEY_SECRET,
      webhookSecret: WEBHOOK_SECRET,
    });

    const order_id = "order_abc";
    const payment_id = "pay_xyz";
    const validSig = await hmacSha256Hex(KEY_SECRET, `${order_id}|${payment_id}`);

    const isValid = await provider.verifySignature({
      razorpay_order_id: order_id,
      razorpay_payment_id: payment_id,
      razorpay_signature: validSig,
    });
    expect(isValid).toBe(true);

    const isInvalid = await provider.verifySignature({
      razorpay_order_id: order_id,
      razorpay_payment_id: payment_id,
      razorpay_signature: "bad_signature",
    });
    expect(isInvalid).toBe(false);
  });

  it("verifies webhook signature accurately", async () => {
    const provider = new RazorpayPaymentProvider({
      keyId: KEY_ID,
      keySecret: KEY_SECRET,
      webhookSecret: WEBHOOK_SECRET,
    });

    const body = JSON.stringify({ event: "payment.captured" });
    const validSig = await hmacSha256Hex(WEBHOOK_SECRET, body);

    expect(await provider.verifyWebhookSignature(body, validSig)).toBe(true);
    expect(await provider.verifyWebhookSignature(body, "wrong_sig")).toBe(false);
  });

  it("processes refund", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      expect(url.toString()).toBe("https://api.razorpay.com/v1/payments/pay_123/refund");
      return new Response(
        JSON.stringify({
          id: "rfnd_999",
          payment_id: "pay_123",
          amount: 50000,
          status: "processed",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = new RazorpayPaymentProvider({
      keyId: KEY_ID,
      keySecret: KEY_SECRET,
      fetchFn: mockFetch as typeof fetch,
    });

    const refund = await provider.refund({
      payment_id: "pay_123",
      amount_paise: 50000,
    });

    expect(refund).toEqual({
      refund_id: "rfnd_999",
      payment_id: "pay_123",
      amount_paise: 50000,
      status: "processed",
    });
  });
});

describe("MockPaymentProvider", () => {
  it("creates and stores mock orders", async () => {
    const mock = new MockPaymentProvider();
    const res = await mock.createOrder({ amount_paise: 75000 });
    expect(res.order_id).toBe("order_mock_1");
    expect(res.amount_paise).toBe(75000);
    expect(mock.orders.has("order_mock_1")).toBe(true);
  });

  it("handles mock refunds and signature toggling", async () => {
    const mock = new MockPaymentProvider();
    expect(mock.verifySignature({ razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" })).toBe(true);

    mock.mockSignatureValid = false;
    expect(mock.verifySignature({ razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" })).toBe(false);

    const refund = await mock.refund({ payment_id: "pay_xyz", amount_paise: 75000 });
    expect(refund.refund_id).toBe("rfnd_mock_1");
    expect(refund.status).toBe("processed");
  });
});
