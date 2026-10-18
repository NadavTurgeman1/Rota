import { describe, expect, it } from "vitest";
import type { RotaState } from "../domain/types";
import { calendarTitle, ownPublishedShifts, shiftsIcs } from "./calendar";

const state: RotaState = {
  week: "2026-10-18",
  biz: {
    name: "דרום",
    type: "",
    minRest: 8,
    maxHours: 72,
    maxShift: 0,
    assume: true,
    shifts: [
      { id: "morning", name: "בוקר", start: "07:00", end: "15:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
      { id: "night", name: "לילה", start: "23:00", end: "07:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
    ],
  },
  emps: [],
  avail: {},
  closed: {},
  sched: {
    "2026-10-18": {
      assign: { "0|morning": ["me", "other"], "1|night": ["me"] },
      locked: [],
      status: "published",
    },
  },
};

describe("shift calendar", () => {
  it("names each event work, site, then business", () => {
    expect(calendarTitle("דרום", "ברן")).toBe("עבודה - דרום - ברן");
    const ics = shiftsIcs({
      title: calendarTitle("דרום", "ברן"),
      week: "2026-10-18",
      employeeId: "me",
      shifts: ownPublishedShifts(state, "me"),
    });
    expect(ics).toContain("SUMMARY:עבודה - דרום - ברן");
    expect(ics).toContain("DTSTART:20261018T070000");
    expect(ics).toContain("DTEND:20261018T150000");
    expect(ics).toContain("DTSTART:20261019T230000");
    expect(ics).toContain("DTEND:20261020T070000");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("skips a week that is not published", () => {
    const draft: RotaState = {
      ...state,
      sched: { "2026-10-18": { ...state.sched["2026-10-18"]!, status: "draft" } },
    };
    expect(ownPublishedShifts(draft, "me")).toEqual([]);
  });
});
