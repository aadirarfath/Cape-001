import type {
  CreateOrderParams,
  CreateOrderResult,
  PaymentProvider,
  RefundParams,
  RefundResult,
  VerifySignatureParams,
} from "./payment";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/** Constant-time equality check for two hex strings. */
export function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Universal HMAC-SHA256 calculation using Web Crypto API.
 * Works seamlessly in Node.js 18+, Deno, Cloudflare Workers, Next.js Edge/Node, and modern browsers.
 */
export async function hmacSha256Hex(secret: string, message: string | Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secret);
  const msgBytes = typeof message === "string" ? enc.encode(message) : message;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes as unknown as BufferSource);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: RazorpayConfig) {
    if (!config.keyId || !config.keySecret) {
      throw new Error("RazorpayPaymentProvider: keyId and keySecret are required.");
    }
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = (config.baseUrl ?? "https://api.razorpay.com").replace(/\/+$/, "");
    this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  get publicConfig(): { key_id: string } {
    return { key_id: this.keyId };
  }

  private authHeader(): string {
    const credentials = `${this.keyId}:${this.keySecret}`;
    if (typeof btoa === "function") {
      return `Basic ${btoa(credentials)}`;
    }
    const buf = (globalThis as unknown as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer;
    if (buf) {
      return `Basic ${buf.from(credentials).toString("base64")}`;
    }
    throw new Error("No base64 encoding function available");
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    if (!Number.isInteger(params.amount_paise) || params.amount_paise <= 0) {
      throw new Error("amount_paise must be a positive integer");
    }

    const payload: Record<string, unknown> = {
      amount: params.amount_paise,
      currency: params.currency ?? "INR",
    };
    if (params.receipt) payload.receipt = params.receipt.slice(0, 40);
    if (params.notes) payload.notes = params.notes;

    const res = await this.fetchFn(`${this.baseUrl}/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Razorpay createOrder failed (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      order_id: data.id,
      amount_paise: data.amount,
      currency: data.currency,
      key_id: this.keyId,
    };
  }

  async verifySignature(params: VerifySignatureParams): Promise<boolean> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return false;
    }
    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = await hmacSha256Hex(this.keySecret, message);
    return hexEqual(expected, razorpay_signature);
  }

  async verifyWebhookSignature(body: string | Uint8Array, signature: string): Promise<boolean> {
    if (!this.webhookSecret) {
      throw new Error("RazorpayPaymentProvider: webhookSecret is not configured.");
    }
    if (!signature) return false;
    const expected = await hmacSha256Hex(this.webhookSecret, body);
    return hexEqual(expected, signature);
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (!params.payment_id) {
      throw new Error("payment_id is required for refund");
    }

    const payload: Record<string, unknown> = {};
    if (params.amount_paise !== undefined) {
      if (!Number.isInteger(params.amount_paise) || params.amount_paise <= 0) {
        throw new Error("amount_paise must be a positive integer if provided");
      }
      payload.amount = params.amount_paise;
    }
    if (params.notes) payload.notes = params.notes;

    const res = await this.fetchFn(`${this.baseUrl}/v1/payments/${params.payment_id}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Razorpay refund failed (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as {
      id: string;
      payment_id: string;
      amount: number;
      status: string;
    };

    return {
      refund_id: data.id,
      payment_id: data.payment_id ?? params.payment_id,
      amount_paise: data.amount,
      status: data.status,
    };
  }
}
