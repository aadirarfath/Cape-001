// PaymentProvider interface and types for the seat-reservation payment flow.
// The Razorpay implementation lives in razorpay.ts; a mock lives in payment-mock.ts.
// Edge Functions import the Razorpay implementation directly.
// Client code only imports the types and schemas from this file.

import { z } from "zod";
import { uuidSchema } from "./schemas/common";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface CreateOrderParams {
  /** Amount in paise (integer, > 0). */
  amount_paise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
}

export interface VerifySignatureParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RefundParams {
  payment_id: string;
  /** Amount in paise. Omit for full refund. */
  amount_paise?: number;
  notes?: Record<string, string>;
}

export interface RefundResult {
  refund_id: string;
  payment_id: string;
  amount_paise: number;
  status: string;
}

/** Provider-agnostic payment operations used by the Edge Functions and API routes. */
export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifySignature(params: VerifySignatureParams): boolean | Promise<boolean>;
  refund(params: RefundParams): Promise<RefundResult>;
}

// ---------------------------------------------------------------------------
// Zod schemas for the Edge Function request bodies
// ---------------------------------------------------------------------------

/** POST /create-razorpay-order */
export const createOrderRequestSchema = z.object({
  booking_id: uuidSchema,
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

/** POST /verify-razorpay-payment */
export const verifyPaymentRequestSchema = z.object({
  booking_id: uuidSchema,
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyPaymentRequest = z.infer<typeof verifyPaymentRequestSchema>;

/** POST /razorpay-webhook  (Razorpay's webhook payload — minimal shape) */
export const razorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string(),
          amount: z.number(),
          status: z.string(),
        }),
      })
      .optional(),
  }),
});
export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>;
