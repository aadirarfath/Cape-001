// Error codes raised by the database functions (book_appointment, cancel_booking, …).
// Postgres raises them as the error message with SQLSTATE P0001, so supabase-js surfaces
// them as `error.message`. Keep in sync with supabase/migrations.

export const DB_ERROR_CODES = [
  "NOT_AUTHENTICATED",
  "NOT_AUTHORIZED",
  "INVALID_REQUEST",
  "INVALID_LOCATION",
  "SLUG_TAKEN",
  "SHOP_NOT_FOUND",
  "SHOP_UNAVAILABLE",
  "INVALID_BARBER",
  "INVALID_SERVICE",
  "SERVICE_NOT_OFFERED",
  "SLOT_IN_PAST",
  "TOO_FAR_AHEAD",
  "OUTSIDE_WORKING_HOURS",
  "INVALID_TIME",
  "BARBER_UNAVAILABLE",
  "BOOKING_LIMIT_REACHED",
  "SLOT_TAKEN",
  "BOOKING_NOT_FOUND",
  "BOOKING_NOT_CANCELLABLE",
  "CANCELLATION_WINDOW_PASSED",
  "INVALID_STATUS_TRANSITION",
  "LAST_OWNER",
  "INVALID_NAME",
  "INVALID_PHONE",
  "PHONE_ALREADY_INVITED",
  "BARBER_ALREADY_LINKED",
  "INVALID_WORKING_HOURS",
  // Seat reservation
  "SHOW_NOT_FOUND",
  "SEAT_NOT_FOUND",
  "SEAT_TAKEN",
  "SEAT_LIMIT_REACHED",
  "HOLD_EXPIRED",
  // Shop management
  "TOO_MANY_PENDING_SHOPS",
  // DPDP Act Account Deletion
  "CANNOT_DELETE_SHOP_OWNER",
  // No-show policy
  "TOO_MANY_NO_SHOWS",
] as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

/** Returns the database error code carried by a Supabase/PostgREST error, if it is one of ours. */
export function getDbErrorCode(error: { message?: string } | null | undefined): DbErrorCode | null {
  const message = error?.message;
  return message && (DB_ERROR_CODES as readonly string[]).includes(message)
    ? (message as DbErrorCode)
    : null;
}
