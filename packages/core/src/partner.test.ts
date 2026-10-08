import { describe, expect, it } from "vitest";
import { formatPhone, telUrl } from "./format";
import {
  barberInputSchema,
  inviteBarberInputSchema,
  paiseToRupeesText,
  pushTokenInputSchema,
  rupeesToPaiseSchema,
  shopDetailsSchema,
  timeOffInputSchema,
  workingHoursSchema,
} from "./schemas";
import { shopSlugSchema } from "./schemas/booking";
import { slugify, slugWithSuffix } from "./slug";
import {
  formatWallClockTime,
  localDateTimeToIso,
  localDayBounds,
  localTimeOf,
  weekdayOfLocalDate,
} from "./time";

const UUID = "3f0c8f1e-2a4b-4c6d-8e9f-0a1b2c3d4e5f";

describe("IST date/time helpers", () => {
  it("converts local wall-clock times to UTC instants", () => {
    expect(localDateTimeToIso("2026-10-03", "09:30")).toBe("2026-10-03T04:00:00.000Z");
    expect(localDateTimeToIso("2026-10-03", "00:00")).toBe("2026-10-02T18:30:00.000Z");
  });

  it("gives the UTC bounds of an IST day", () => {
    expect(localDayBounds("2026-10-03")).toEqual({
      start: "2026-10-02T18:30:00.000Z",
      end: "2026-10-03T18:30:00.000Z",
    });
    // Month and year boundaries.
    expect(localDayBounds("2026-12-31").end).toBe("2026-12-31T18:30:00.000Z");
  });

  it("reads the IST wall-clock time of an instant", () => {
    expect(localTimeOf("2026-10-03T04:00:00Z")).toBe("09:30");
    expect(localTimeOf("2026-10-03T18:45:00Z")).toBe("00:15");
  });

  it("finds the weekday of a local date (0 = Sunday)", () => {
    expect(weekdayOfLocalDate("2026-10-04")).toBe(0);
    expect(weekdayOfLocalDate("2026-10-03")).toBe(6);
  });

  it("formats wall-clock times for display", () => {
    expect(formatWallClockTime("14:30")).toMatch(/2:30\s?pm/i);
    expect(formatWallClockTime("09:05")).toMatch(/9:05\s?am/i);
  });
});

describe("phone formatting", () => {
  it("formats Supabase Auth phones", () => {
    expect(formatPhone("919847012345")).toBe("+91 98470 12345");
    expect(formatPhone("+919847012345")).toBe("+91 98470 12345");
    expect(formatPhone("447700900123")).toBe("+447700900123");
    expect(formatPhone("")).toBe("");
  });

  it("builds tel: links", () => {
    expect(telUrl("919847012345")).toBe("tel:+919847012345");
    expect(telUrl("+91 98470 12345")).toBe("tel:+919847012345");
  });
});

describe("slugify", () => {
  it("builds URL slugs from the shop name and area", () => {
    expect(slugify("Fade Theory", "Edappally")).toBe("fade-theory-edappally");
    expect(slugify("  Café   Cuts!! ", null)).toBe("cafe-cuts");
    expect(slugify("A&B Salon")).toBe("a-b-salon");
  });

  it("always returns a valid shop slug", () => {
    for (const name of ["", "AB", "കേരള ബാർബർ", "x".repeat(200), "--hello--", "Ü"]) {
      expect(shopSlugSchema.safeParse(slugify(name)).success, name).toBe(true);
    }
  });

  it("adds a random suffix that keeps the slug valid", () => {
    const slug = slugWithSuffix(slugify("x".repeat(80)), () => 0.5);
    expect(slug).toMatch(/^x+-[0-9a-z]{4}$/);
    expect(shopSlugSchema.safeParse(slug).success).toBe(true);
    expect(slugWithSuffix("fade-theory", () => 0)).toBe("fade-theory-0000");
  });
});

describe("barber and invite inputs", () => {
  it("trims names and clears an empty bio", () => {
    expect(barberInputSchema.parse({ display_name: "  Arjun ", bio: "  ", is_active: true })).toEqual({
      display_name: "Arjun",
      bio: null,
      is_active: true,
    });
    expect(barberInputSchema.safeParse({ display_name: " ", is_active: true }).success).toBe(false);
  });

  it("normalises the invite phone to E.164", () => {
    expect(inviteBarberInputSchema.parse({ p_barber_id: UUID, p_phone: "98470 12345" }).p_phone).toBe("+919847012345");
    expect(inviteBarberInputSchema.safeParse({ p_barber_id: UUID, p_phone: "12345" }).success).toBe(false);
  });
});

describe("prices", () => {
  it("converts rupees to paise", () => {
    expect(rupeesToPaiseSchema.parse("300")).toBe(30000);
    expect(rupeesToPaiseSchema.parse("₹ 1,250")).toBe(125000);
    expect(rupeesToPaiseSchema.parse("99.5")).toBe(9950);
    expect(rupeesToPaiseSchema.parse("0")).toBe(0);
  });

  it("rejects bad prices", () => {
    for (const value of ["", "abc", "-10", "10.555", "1e3", "10000000"]) {
      expect(rupeesToPaiseSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("shows paise as rupee text", () => {
    expect(paiseToRupeesText(30000)).toBe("300");
    expect(paiseToRupeesText(12550)).toBe("125.50");
  });
});

describe("workingHoursSchema", () => {
  it("accepts split shifts and empty weeks", () => {
    expect(
      workingHoursSchema.safeParse([
        { weekday: 1, start_time: "09:30", end_time: "13:30" },
        { weekday: 1, start_time: "14:30", end_time: "20:00" },
        { weekday: 2, start_time: "13:30", end_time: "20:00" },
      ]).success,
    ).toBe(true);
    expect(workingHoursSchema.safeParse([]).success).toBe(true);
  });

  it("allows back-to-back shifts but not overlaps", () => {
    expect(
      workingHoursSchema.safeParse([
        { weekday: 1, start_time: "09:00", end_time: "13:00" },
        { weekday: 1, start_time: "13:00", end_time: "18:00" },
      ]).success,
    ).toBe(true);
    const result = workingHoursSchema.safeParse([
      { weekday: 3, start_time: "12:00", end_time: "18:00" },
      { weekday: 3, start_time: "09:00", end_time: "13:00" },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.message, i.path])).toEqual([["OVERLAP", [0]]]);
  });

  it("rejects end before start and bad times", () => {
    const result = workingHoursSchema.safeParse([{ weekday: 0, start_time: "18:00", end_time: "09:00" }]);
    expect(result.error?.issues[0]?.message).toBe("END_BEFORE_START");
    expect(workingHoursSchema.safeParse([{ weekday: 7, start_time: "09:00", end_time: "10:00" }]).success).toBe(false);
    expect(workingHoursSchema.safeParse([{ weekday: 1, start_time: "9:00", end_time: "10:00" }]).success).toBe(false);
    expect(workingHoursSchema.safeParse([{ weekday: 1, start_time: "24:00", end_time: "10:00" }]).success).toBe(false);
  });
});

describe("timeOffInputSchema", () => {
  const base = { barber_id: UUID, shop_id: UUID };

  it("accepts a period with an optional reason", () => {
    expect(
      timeOffInputSchema.parse({
        ...base,
        starts_at: "2026-10-03T04:00:00.000Z",
        ends_at: "2026-10-03T10:00:00.000Z",
        reason: "",
      }).reason,
    ).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(
      timeOffInputSchema.safeParse({
        ...base,
        starts_at: "2026-10-03T10:00:00.000Z",
        ends_at: "2026-10-03T04:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("shopDetailsSchema", () => {
  const shop = { name: "Fade Theory", address_line: "NH 66", city: "Kochi", postal_code: "682024" };

  it("accepts details and clears empty optional fields", () => {
    expect(shopDetailsSchema.parse({ ...shop, phone: " ", area: "" })).toMatchObject({
      phone: null,
      area: null,
      description: null,
      postal_code: "682024",
    });
    expect(shopDetailsSchema.parse({ ...shop, postal_code: "" }).postal_code).toBeNull();
  });

  it("rejects a bad PIN code", () => {
    expect(shopDetailsSchema.safeParse({ ...shop, postal_code: "012345" }).success).toBe(false);
  });
});

describe("pushTokenInputSchema", () => {
  it("accepts Expo push tokens only", () => {
    expect(pushTokenInputSchema.safeParse({ token: "ExponentPushToken[abc]", platform: "android" }).success).toBe(true);
    expect(pushTokenInputSchema.safeParse({ token: "ExpoPushToken[abc]", platform: "ios" }).success).toBe(true);
    expect(pushTokenInputSchema.safeParse({ token: "fcm-token", platform: "android" }).success).toBe(false);
  });
});
