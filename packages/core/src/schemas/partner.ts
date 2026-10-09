import { z } from "zod";
import { indianMobileSchema } from "./auth";
import { uuidSchema, timestamptzSchema } from "./common";

// Inputs for the partner app (shop owners, managers and barbers). Column names match the
// tables; "p_" keys match the SQL function parameters, so parsed values go straight to
// supabase.from(...) or supabase.rpc(...).

/** Optional free text: trimmed, and empty becomes null so the column is cleared. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

// Barbers ------------------------------------------------------------------------------------

export const barberInputSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  bio: optionalText(500),
  is_active: z.boolean(),
});
export type BarberInput = z.infer<typeof barberInputSchema>;

/** invite_barber: the phone as typed ("98470 12345"), normalised to E.164. */
export const inviteBarberInputSchema = z.object({
  p_barber_id: uuidSchema,
  p_phone: indianMobileSchema,
});
export type InviteBarberInput = z.infer<typeof inviteBarberInputSchema>;

export const setBarberServicesInputSchema = z.object({
  p_barber_id: uuidSchema,
  p_service_ids: z.array(uuidSchema),
});
export type SetBarberServicesInput = z.infer<typeof setBarberServicesInputSchema>;

// Services -----------------------------------------------------------------------------------

/**
 * A price typed in rupees ("300", "₹ 1,250", "99.50"), converted to paise. Rupees with at most
 * two decimals, up to ₹1,00,000.
 */
export const rupeesToPaiseSchema = z
  .string()
  .transform((value) => value.replace(/[₹,\s]/g, ""))
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,2})?$/))
  .transform((value) => Math.round(Number(value) * 100))
  .pipe(z.number().int().min(0).max(10_000_000));

/** Paise as the rupee text shown in a price field: 30000 -> "300", 12550 -> "125.50". */
export function paiseToRupeesText(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: optionalText(500),
  duration_minutes: z.number().int().min(5).max(480),
  price_paise: z.number().int().min(0),
  is_active: z.boolean(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

// Working hours ------------------------------------------------------------------------------

/** Wall-clock time "HH:MM" (24-hour), in Asia/Kolkata. */
export const wallClockTimeSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);

export const workingHoursEntrySchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0 = Sunday, like extract(dow)
  start_time: wallClockTimeSchema,
  end_time: wallClockTimeSchema,
});
export type WorkingHoursEntry = z.infer<typeof workingHoursEntrySchema>;

export type WorkingHoursIssue = "END_BEFORE_START" | "OVERLAP";

/**
 * A barber's whole week for set_working_hours. Mirrors the database rules: end after start, and
 * no overlapping shifts on the same day. Issues carry the weekday in `path`.
 */
export const workingHoursSchema = z.array(workingHoursEntrySchema).superRefine((entries, ctx) => {
  entries.forEach((entry, index) => {
    if (entry.end_time <= entry.start_time) {
      ctx.addIssue({ code: "custom", message: "END_BEFORE_START", path: [index] });
    }
  });
  for (let weekday = 0; weekday <= 6; weekday++) {
    const shifts = entries
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => entry.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    shifts.slice(1).forEach((shift, i) => {
      const previous = shifts[i]; // the shift just before, in start-time order
      if (previous && shift.start_time < previous.end_time) {
        ctx.addIssue({ code: "custom", message: "OVERLAP", path: [shift.index] });
      }
    });
  }
});

// Time off -----------------------------------------------------------------------------------

export const timeOffInputSchema = z
  .object({
    barber_id: uuidSchema,
    shop_id: uuidSchema,
    starts_at: timestamptzSchema,
    ends_at: timestamptzSchema,
    reason: optionalText(200),
  })
  .refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
    message: "END_BEFORE_START",
    path: ["ends_at"],
  });
export type TimeOffInput = z.infer<typeof timeOffInputSchema>;

// Shop ---------------------------------------------------------------------------------------

export const pinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/);

/** Shop details owners and managers edit (booking settings: shopBookingSettingsSchema). */
export const shopDetailsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: optionalText(20),
  description: optionalText(1000),
  address_line: z.string().trim().min(3).max(200),
  area: optionalText(100),
  city: z.string().trim().min(2).max(100),
  postal_code: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(pinCodeSchema.nullable()),
});
export type ShopDetails = z.infer<typeof shopDetailsSchema>;

/** set_shop_location (longitude first, like PostGIS). */
export const setShopLocationInputSchema = z.object({
  p_shop_id: uuidSchema,
  p_lng: z.number().min(-180).max(180),
  p_lat: z.number().min(-90).max(90),
});
export type SetShopLocationInput = z.infer<typeof setShopLocationInputSchema>;

// Push tokens --------------------------------------------------------------------------------

export const pushTokenInputSchema = z.object({
  token: z.string().max(200).regex(/^Expo(nent)?PushToken\[[^\]]+\]$/),
  platform: z.enum(["android", "ios"]),
});
export type PushTokenInput = z.infer<typeof pushTokenInputSchema>;
