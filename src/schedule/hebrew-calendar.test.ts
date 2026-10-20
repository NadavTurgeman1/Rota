import { describe, expect, it } from "vitest";
import { hebrewDay, hebrewMonthSpan, holidaysBetween } from "./hebrew-calendar";

describe("hebrew calendar", () => {
  it("names the Hebrew date in letters", () => {
    expect(hebrewDay("2026-10-20", "he")).toBe("ט׳ חשון");
    expect(hebrewDay("2026-10-20", "en")).toBe("9 Cheshvan");
  });

  it("spans the Hebrew months of a Gregorian month", () => {
    expect(hebrewMonthSpan(2026, 10, "he")).toBe("תשרי–חשון תשפ״ז");
  });

  it("lists holidays in Israel and marks days of rest", () => {
    const days = holidaysBetween("2026-09-01", "2027-06-30", "he");
    expect(days.get("2026-09-21")).toEqual([{ name: "יום כפור", rest: true }]);
    expect(days.get("2026-09-27")?.[0]).toMatchObject({ rest: false });
    expect(days.get("2027-05-12")?.[0].name).toBe("יום העצמאות");
    expect(days.get("2027-04-21")).toEqual([{ name: "ערב פסח", rest: false }]);
    expect(days.has("2026-09-05")).toBe(false);
    expect(days.has("2027-02-21")).toBe(false);
  });
});
