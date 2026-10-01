import { z } from "zod";
import { timestamptzSchema, uuidSchema } from "./common";

// Inputs for the booking and shop database functions. Keys match the SQL parameter names so a
// parsed value can be passed straight to supabase.rpc(...).

/** Local calendar date (Asia/Kolkata), e.g. "2026-10-03". */
export const localDateSchema = z.iso.date();

export const bookAppointmentInputSchema = z.object({
  p_barber_id: uuidSchema,
  p_service_id: uuidSchema,
  p_starts_at: timestamptzSchema,
  p_customer_notes: z.string().trim().max(500).optional(),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentInputSchema>;

export const cancelBookingInputSchema = z.object({
  p_booking_id: uuidSchema,
  p_reason: z.string().trim().max(500).optional(),
});
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

export const getAvailableSlotsInputSchema = z.object({
  p_barber_id: uuidSchema,
  p_service_id: uuidSchema,
  p_date: localDateSchema,
});
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsInputSchema>;

/** Longitude first, matching the SQL function and PostGIS. */
export const nearbyShopsInputSchema = z.object({
  p_lng: z.number().min(-180).max(180),
  p_lat: z.number().min(-90).max(90),
  p_radius_m: z.number().int().min(1).max(50_000).optional(),
});
export type NearbyShopsInput = z.infer<typeof nearbyShopsInputSchema>;

export const shopSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const createShopInputSchema = z.object({
  p_name: z.string().trim().min(2).max(100),
  p_slug: shopSlugSchema,
  p_lng: z.number().min(-180).max(180),
  p_lat: z.number().min(-90).max(90),
  p_address_line: z.string().trim().min(3).max(200),
  p_area: z.string().trim().max(100).optional(),
  p_city: z.string().trim().min(2).max(100).optional(),
  p_postal_code: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a 6-digit PIN code").optional(),
  p_phone: z.string().trim().max(20).optional(),
  p_description: z.string().trim().max(1000).optional(),
});
export type CreateShopInput = z.infer<typeof createShopInputSchema>;

/** Booking settings owners and managers can edit on their shop. */
export const shopBookingSettingsSchema = z.object({
  slot_interval_minutes: z.number().int().min(5).max(120),
  max_days_ahead: z.number().int().min(1).max(365),
  cancellation_cutoff_minutes: z.number().int().min(0).max(10_080),
});
export type ShopBookingSettings = z.infer<typeof shopBookingSettingsSchema>;
