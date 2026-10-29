import { describe, expect, it } from "vitest";
import { staticReason } from "./rules";
import { absenceOnWeekDay, clickAbsenceDay } from "./absence";
import type { Employee, RotaState, Slot } from "./types";

const morning = { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] };
const dana: Employee = {
  id: "d",
  name: "Dana",
  contact: "",
  role: "Guard",
  quals: "",
  perWeek: 5,
  maxHours: 0,
  pref: [],
  active: true,
  grid: [[morning.id], [morning.id], [morning.id], [morning.id], [morning.id], [morning.id], [morning.id]],
};

function site(absences?: RotaState["absences"]): RotaState {
  return {
    week: "2026-10-11",
    biz: { name: "A", type: "t", minRest: 11, maxHours: 48, maxShift: 12, assume: true, shifts: [morning] },
    emps: [dana],
    avail: {},
    sched: {},
    closed: {},
    absences,
  };
}

const slot: Slot = { key: "0|m", day: 0, shiftId: "m", start: 6, end: 14, required: 1 };

describe("approved absences", () => {
  it("covers the calendar day of the open week", () => {
    const state = site([{ employeeId: "d", kind: "sick", start: "2026-10-11", end: "2026-10-12" }]);
    expect(absenceOnWeekDay(state, "d", 0)).toBe("sick");
    expect(absenceOnWeekDay(state, "d", 1)).toBe("sick");
    expect(absenceOnWeekDay(state, "d", 2)).toBeNull();
  });

  it("blocks placement without treating the day as a weekly constraint", () => {
    const state = site([{ employeeId: "d", kind: "vacation", start: "2026-10-11", end: "2026-10-11" }]);
    expect(staticReason(state, dana, slot, state.week)).toEqual({ code: "absent", day: 0, kind: "vacation" });
  });

  it("builds a date range from two day clicks", () => {
    expect(clickAbsenceDay("", "", "2026-10-13")).toEqual({ start: "2026-10-13", end: "2026-10-13" });
    expect(clickAbsenceDay("2026-10-13", "2026-10-13", "2026-10-15")).toEqual({ start: "2026-10-13", end: "2026-10-15" });
    expect(clickAbsenceDay("2026-10-13", "2026-10-13", "2026-10-13")).toEqual({ start: "", end: "" });
    expect(clickAbsenceDay("2026-10-13", "2026-10-15", "2026-10-11")).toEqual({ start: "2026-10-11", end: "2026-10-11" });
  });
});
