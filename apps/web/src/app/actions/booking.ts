"use server";

import {
  bookAnyBarberInputSchema,
  bookAppointmentInputSchema,
  cancelBookingInputSchema,
  getDbErrorCode,
  updateMyProfileInputSchema,
  type DbErrorCode,
} from "@cape001/core";
import { createClient } from "@/lib/supabase/server";

// Every write goes through a database function (RPC) with the user's own session. Inputs are
// validated with the shared Zod schemas first; the database re-checks everything.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DbErrorCode | "INVALID_INPUT" | "UNKNOWN" };

function failure(error: { message?: string }): { ok: false; code: DbErrorCode | "UNKNOWN" } {
  const code = getDbErrorCode(error);
  if (!code) console.error("Unexpected database error", error);
  return { ok: false, code: code ?? "UNKNOWN" };
}

export type ConfirmBookingRequest = (
  | { barber: "specific"; input: unknown }
  | { barber: "any"; input: unknown }
) & {
  /** Sent only when the customer's profile has no name yet. */
  fullName?: string;
};

export async function confirmBooking(request: ConfirmBookingRequest): Promise<ActionResult<{ bookingId: string }>> {
  const supabase = await createClient();

  if (request.fullName !== undefined) {
    const nameInput = updateMyProfileInputSchema.safeParse({ p_full_name: request.fullName });
    if (!nameInput.success) return { ok: false, code: "INVALID_NAME" };

    const { error } = await supabase.rpc("update_my_profile", nameInput.data);
    if (error) return failure(error);
  }

  if (request.barber === "any") {
    const input = bookAnyBarberInputSchema.safeParse(request.input);
    if (!input.success) return { ok: false, code: "INVALID_INPUT" };

    const { data, error } = await supabase.rpc("book_any_barber", input.data);
    if (error) return failure(error);
    return { ok: true, data: { bookingId: data.id } };
  }

  const input = bookAppointmentInputSchema.safeParse(request.input);
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const { data, error } = await supabase.rpc("book_appointment", input.data);
  if (error) return failure(error);
  return { ok: true, data: { bookingId: data.id } };
}

export async function cancelBooking(rawInput: unknown): Promise<ActionResult<null>> {
  const input = cancelBookingInputSchema.safeParse(rawInput);
  if (!input.success) return { ok: false, code: "INVALID_INPUT" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", input.data);
  if (error) return failure(error);
  return { ok: true, data: null };
}
