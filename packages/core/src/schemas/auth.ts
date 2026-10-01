import { z } from "zod";

// Customer sign-in (phone OTP) and profile inputs.

/**
 * An Indian mobile number as typed by a customer ("98470 12345", "+91 98470 12345",
 * "098470 12345"), normalised to E.164 ("+919847012345") for Supabase Auth.
 */
export const indianMobileSchema = z
  .string()
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits;
  })
  .pipe(z.string().regex(/^[6-9][0-9]{9}$/))
  .transform((digits) => `+91${digits}`);

/** The 6-digit code from the SMS. */
export const otpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/));

/** Mirrors update_my_profile: trimmed, inner whitespace collapsed, 2–60 characters. */
export const fullNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2).max(60));

export const updateMyProfileInputSchema = z.object({
  p_full_name: fullNameSchema,
});
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileInputSchema>;
