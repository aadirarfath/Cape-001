import { describe, expect, it } from "vitest";
import { formatDistance, formatPricePaise } from "./format";
import { fullNameSchema, indianMobileSchema, otpCodeSchema } from "./schemas";

describe("formatPricePaise", () => {
  it("drops paise for whole rupees", () => {
    expect(formatPricePaise(30000)).toBe("₹300");
    expect(formatPricePaise(12550)).toBe("₹125.50");
    expect(formatPricePaise(15000000)).toBe("₹1,50,000");
  });
});

describe("formatDistance", () => {
  it("uses metres below 1 km and kilometres above", () => {
    expect(formatDistance(448)).toBe("450 m");
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(2345)).toBe("2.3 km");
    expect(formatDistance(12_600)).toBe("13 km");
  });
});

describe("indianMobileSchema", () => {
  it.each(["9847012345", "98470 12345", "+91 98470 12345", "919847012345", "098470-12345"])(
    "normalises %s to E.164",
    (input) => {
      expect(indianMobileSchema.parse(input)).toBe("+919847012345");
    },
  );

  it.each(["12345", "5847012345", "98470123456", "abcdefghij"])("rejects %s", (input) => {
    expect(indianMobileSchema.safeParse(input).success).toBe(false);
  });
});

describe("otpCodeSchema", () => {
  it("accepts 6 digits, ignoring spaces", () => {
    expect(otpCodeSchema.parse("123 456")).toBe("123456");
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
  });
});

describe("fullNameSchema", () => {
  it("mirrors update_my_profile: trim, collapse, 2–60 characters", () => {
    expect(fullNameSchema.parse("  Anjali   Krishnan ")).toBe("Anjali Krishnan");
    expect(fullNameSchema.safeParse(" A ").success).toBe(false);
    expect(fullNameSchema.safeParse("a".repeat(61)).success).toBe(false);
    expect(fullNameSchema.safeParse("a".repeat(60)).success).toBe(true);
  });
});
