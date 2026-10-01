import { describe, expect, it } from "vitest";
import {
  addDaysToLocalDate,
  bookableDates,
  formatInAppTimeZone,
  formatLocalDate,
  isBeforeCancellationCutoff,
  localDateOf,
  todayInAppTimeZone,
} from "./time";

describe("local dates in Asia/Kolkata", () => {
  it("rolls over at IST midnight (18:30 UTC), not UTC midnight", () => {
    expect(localDateOf("2026-10-02T18:29:59Z")).toBe("2026-10-02");
    expect(localDateOf("2026-10-02T18:30:00Z")).toBe("2026-10-03");
    expect(todayInAppTimeZone(new Date("2026-10-02T23:00:00Z"))).toBe("2026-10-03");
  });

  it("adds days across month and year ends", () => {
    expect(addDaysToLocalDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToLocalDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToLocalDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("offers today through today + maxDaysAhead, like the database", () => {
    const dates = bookableDates(3, new Date("2026-10-02T19:00:00Z")); // 00:30 IST on 3 Oct
    expect(dates).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
  });

  it("formats a calendar date without shifting the day", () => {
    expect(formatLocalDate("2026-10-03", { day: "numeric", month: "short", year: "numeric" })).toBe(
      "3 Oct 2026",
    );
  });

  it("formats instants in IST", () => {
    expect(formatInAppTimeZone("2026-10-03T04:30:00Z", { hour: "numeric", minute: "2-digit", hour12: false })).toBe(
      "10:00",
    );
  });
});

describe("isBeforeCancellationCutoff", () => {
  const startsAt = "2026-10-03T04:30:00Z";

  it("allows cancelling up to exactly the cutoff", () => {
    expect(isBeforeCancellationCutoff(startsAt, 30, new Date("2026-10-03T04:00:00Z"))).toBe(true);
    expect(isBeforeCancellationCutoff(startsAt, 30, new Date("2026-10-03T04:00:01Z"))).toBe(false);
  });

  it("with no cutoff, allows cancelling until the start", () => {
    expect(isBeforeCancellationCutoff(startsAt, 0, new Date("2026-10-03T04:29:59Z"))).toBe(true);
  });
});
