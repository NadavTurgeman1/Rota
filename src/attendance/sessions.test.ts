import { describe, expect, it } from "vitest";
import { formatDuration, pairPunches, type AttendancePunch } from "./sessions";

function punch(id: string, kind: "in" | "out", at: string): AttendancePunch {
  return { id, siteId: "site", siteName: "אתר", kind, punchedAt: at, latitude: 32.07, longitude: 34.78, accuracyMeters: 12 };
}

describe("attendance sessions", () => {
  it("pairs each entry with the following exit, newest first", () => {
    const sessions = pairPunches([
      punch("2", "out", "2026-10-27T14:00:00Z"),
      punch("1", "in", "2026-10-27T06:00:00Z"),
      punch("3", "in", "2026-10-28T06:00:00Z"),
    ]);
    expect(sessions.map((session) => [session.in?.id ?? null, session.out?.id ?? null])).toEqual([
      ["3", null],
      ["1", "2"],
    ]);
    expect(formatDuration("2026-10-27T06:00:00Z", "2026-10-27T14:07:00Z", "he")).toBe("8 שע׳ 07 דק׳");
    expect(formatDuration("2026-10-27T06:00:00Z", "2026-10-27T14:07:00Z", "en")).toBe("8h 07m");
  });
});
