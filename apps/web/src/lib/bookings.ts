import "server-only";
import type { createClient } from "@/lib/supabase/server";

// The customer's own bookings. RLS limits rows to bookings where customer_id = auth.uid().

export const BOOKING_SELECT = `
  id, starts_at, ends_at, status, price_paise, duration_minutes, customer_notes, created_at,
  shop:shops (name, slug, address_line, area, city, phone, cancellation_cutoff_minutes),
  service:services (name),
  barber:barbers (display_name)
` as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getMyBooking(supabase: Supabase, id: string) {
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyBookings(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("customer_id", userId)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export type MyBooking = NonNullable<Awaited<ReturnType<typeof getMyBooking>>>;

/** Active and not yet over. */
export function isUpcoming(booking: Pick<MyBooking, "status" | "ends_at">, now: Date = new Date()) {
  return (booking.status === "pending" || booking.status === "confirmed") && new Date(booking.ends_at) > now;
}
