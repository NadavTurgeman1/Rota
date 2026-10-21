import { describe, expect, it } from "vitest";
import { hebrewDay, hebrewMonthSpan, hebrewWeek, hebrewWeekRange, holidaysBetween } from "./hebrew-calendar";

describe("hebrew calendar", () => {
  it("names the Hebrew date in letters", () => {
    expect(hebrewDay("2026-10-20", "he")).toBe("ט׳ חשון");
    expect(hebrewDay("2026-10-20", "en")).toBe("9 Cheshvan");
  });

  it("names a week's Hebrew range and each day's date and holidays", () => {
    expect(hebrewWeekRange("2026-09-27", "he")).toBe("ט״ז–כ״ב תשרי תשפ״ז");
    expect(hebrewWeekRange("2026-10-11", "he")).toBe("ל׳ תשרי – ו׳ חשון תשפ״ז");
    expect(hebrewWeekRange("2026-09-06", "he")).toBe("כ״ד אלול תשפ״ו – א׳ תשרי תשפ״ז");
    const week = hebrewWeek("2026-09-27", "he");
    expect(week).toHaveLength(7);
    expect(week[0].hebrew).toBe("ט״ז תשרי");
    expect(week[6].holidays).toEqual([{ name: "שמיני עצרת", rest: true }]);
  });

  it("spans the Hebrew months of a Gregorian month", () => {
    expect(hebrewMonthSpan(2026, 10, "he")).toBe("תשרי–חשון תשפ״ז");
  });

  it("lists holidays in Israel and marks days of rest", () => {
    const days = holidaysBetween("2026-09-01", "2027-06-30", "he");
    expect(days.get("2026-09-21")).toEqual([{ name: "יום כפור", rest: true }]);
    expect(days.get("2026-09-12")).toEqual([{ name: "ראש השנה", rest: true }]);
    expect(days.get("2026-09-27")?.[0]).toMatchObject({ rest: false });
    expect(days.get("2027-05-12")?.[0].name).toBe("יום העצמאות");
    expect(days.get("2027-04-21")).toEqual([{ name: "ערב פסח", rest: false }]);
    expect(days.has("2026-09-05")).toBe(false);
    expect(days.has("2027-02-21")).toBe(false);
  });
});
