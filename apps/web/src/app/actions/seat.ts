"use server";

import {
  createOrderRequestSchema,
  getDbErrorCode,
  holdSeatInputSchema,
  holdSeatsInputSchema,
  verifyPaymentRequestSchema,
  type DbErrorCode,
} from "@cape001/core";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./booking";

function failure(error: { message?: string }): { ok: false; code: DbErrorCode | "UNKNOWN" } {
  const code = getDbErrorCode(error);
  if (!code) console.error("Unexpected database error", error);
  return { ok: false, code: code ?? "UNKNOWN" };
}

/** Hold a single seat for 10 minutes */
export async function holdSeat(showId: string, seatId: string): Promise<ActionResult<{ bookingId: string }>> {
  const input = holdSeatInputSchema.safeParse({ p_show_id: showId, p_seat_id: seatId });
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_seat", input.data);
  if (error) return failure(error);
  if (!data?.id) return { ok: false, code: "UNKNOWN" };
  return { ok: true, data: { bookingId: data.id } };
}

/** Hold multiple seats in a single all-or-nothing transaction */
export async function holdSeats(showId: string, seatIds: string[]): Promise<ActionResult<{ bookingIds: string[] }>> {
  const input = holdSeatsInputSchema.safeParse({ p_show_id: showId, p_seat_ids: seatIds });
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_seats", input.data);
  if (error) return failure(error);
  return { ok: true, data: { bookingIds: (data ?? []).map((b) => b.id) } };
}

/** Create a Razorpay order for a held booking */
export async function createRazorpayOrder(bookingId: string): Promise<ActionResult<{
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}>> {
  const input = createOrderRequestSchema.safeParse({ booking_id: bookingId });
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: { booking_id: input.data.booking_id },
  });

  if (error || !data) {
    if (error && typeof error === "object" && "context" in error) {
      try {
        const body = await (error as { context?: { json: () => Promise<{ error?: string }> } }).context?.json();
        if (body?.error === "hold_expired") return { ok: false, code: "HOLD_EXPIRED" };
      } catch {
        // fall through
      }
    }
    return { ok: false, code: "UNKNOWN" };
  }

  return {
    ok: true,
    data: {
      orderId: data.order_id,
      amountPaise: data.amount_paise,
      currency: data.currency,
      keyId: data.key_id,
    },
  };
}

/** Verify a Razorpay payment after checkout success */
export async function verifyRazorpayPayment(params: {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<ActionResult<{ confirmed: boolean }>> {
  const input = verifyPaymentRequestSchema.safeParse({
    booking_id: params.bookingId,
    razorpay_order_id: params.razorpayOrderId,
    razorpay_payment_id: params.razorpayPaymentId,
    razorpay_signature: params.razorpaySignature,
  });
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: input.data,
  });

  if (error) {
    if (error && typeof error === "object" && "context" in error) {
      try {
        const body = await (error as { context?: { json: () => Promise<{ error?: string }> } }).context?.json();
        if (body?.error === "hold_expired") return { ok: false, code: "HOLD_EXPIRED" };
      } catch {
        // fall through
      }
    }
    return { ok: false, code: "UNKNOWN" };
  }

  return { ok: true, data: { confirmed: data?.confirmed ?? true } };
}
