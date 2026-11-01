import { describe, expect, it } from "vitest";
import { hebrewDay, holidaysBetween } from "./hebrew-calendar";
import { faithHolidays, orthodoxEaster, westernEaster } from "./faith-holidays";
import { CALENDARS_OFF } from "./shown-calendars";

describe("faith calendars", () => {
  it("places Western and Orthodox Easter, Christmas, and the main Muslim feasts", () => {
    expect(westernEaster(2026)).toBe("2026-04-05");
    expect(orthodoxEaster(2026)).toBe("2026-04-12");
    expect(westernEaster(2024)).toBe("2024-03-31");
    expect(orthodoxEaster(2024)).toBe("2024-05-05");

    const christian = faithHolidays("2026-01-01", "2026-12-31", "he", { christian: true, muslim: false });
    expect(christian.get("2026-12-25")?.[0].name).toBe("חג המולד");
    expect(christian.get("2026-01-07")?.[0].name).toBe("חג המולד האורתודוקסי");
    expect(christian.get("2026-04-05")?.[0].name).toBe("חג הפסחא");
    expect(christian.get("2026-04-12")?.[0].name).toBe("חג הפסחא האורתודוקסי");
    expect(christian.get("2026-01-01")?.[0].name).toBe("שנה חדשה");
    expect(christian.get("2026-10-31")?.[0].name).toBe("אלווין");
    expect(christian.get("2026-12-31")?.[0].name).toBe("סילבסטר");
    expect(christian.get("2026-12-24")?.[0].name).toBe("ערב חג המולד");
    expect(christian.get("2026-01-06")?.map((item) => item.name)).toContain("חג המולד הארמני");
    expect(christian.get("2026-03-29")?.[0].name).toBe("יום ראשון של הדקלים");
    expect(christian.get("2026-05-14")?.[0].name).toBe("חג העלייה");
    expect(christian.get("2026-08-15")?.[0].name).toBe("חג העלייה לשמים");
    expect(christian.get("2026-08-28")?.[0].name).toBe("חג ההירדמות");
    expect(christian.get("2026-11-01")?.[0].name).toBe("כל הקדושים");
    expect(christian.get("2026-02-18")?.[0].name).toBe("יום רביעי של האפר");
    expect(christian.get("2026-02-23")?.[0].name).toBe("יום שני הנקי");

    const muslim = faithHolidays("2026-03-01", "2026-06-30", "en", { christian: false, muslim: true });
    expect(muslim.get("2026-03-20")?.map((item) => item.name)).toContain("Eid al-Fitr");
    expect(muslim.get("2026-05-27")?.map((item) => item.name)).toContain("Eid al-Adha");
    expect(muslim.get("2026-06-16")?.map((item) => item.name)).toContain("Islamic New Year");
    const muslimYear = faithHolidays("2026-01-01", "2026-12-31", "he", { christian: false, muslim: true });
    const muslimNames = [...muslimYear.values()].flat().map((item) => item.name);
    expect(muslimNames).toContain("לילת אל-בראאה");
    expect(muslimNames).toContain("עיד אל-ע'דיר");
    expect(muslimNames).toContain("עאשורה");
    expect(muslimNames).toContain("מולד הנביא");
    expect(muslimNames).toContain("לילת אל-קדר");
  });

  it("names a Hebrew date in Russian and stays off until a calendar is chosen", () => {
    expect(hebrewDay("2026-10-20", "ru")).toBe("9 Хешван");
    expect(holidaysBetween("2026-09-21", "2026-09-21", "ru").get("2026-09-21")?.[0].name).toBe("Йом Кипур");
    expect(holidaysBetween("2026-09-27", "2026-10-03", "ru").get("2026-10-03")?.[0].name).toBe("Шмини Ацерет");
    expect(CALENDARS_OFF).toEqual({ hebrew: false, christian: false, muslim: false });
  });
});
