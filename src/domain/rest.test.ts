import { describe, expect, it } from "vitest";
import { generate, slots, staticReason, sundayOnOrBefore, addDays, type Employee, type RotaState, type ShiftDefinition } from "./index";
import { holidaysBetween } from "../schedule/hebrew-calendar";
import { isYomTov, shiftRest, staffedCount, usesShabbatStaffing } from "./rest";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [3, 3, 3, 3, 3, 3, 2] },
  { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [3, 3, 3, 3, 3, 3, 2] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
];

function person(flags: Pick<Employee, "observesShabbat" | "observesHolidays"> = {}): Employee {
  return {
    id: "a",
    name: "a",
    contact: "",
    role: "",
    quals: "",
    perWeek: 14,
    maxHours: 0,
    allowed: ["m", "a", "n"],
    blocked: [],
    pref: [],
    active: true,
    ...flags,
  };
}

function stateFor(week: string, employee: Employee): RotaState {
  return {
    week,
    biz: { name: "t", type: "t", minRest: 8, maxHours: 200, maxShift: 12, assume: true, shifts: structuredClone(shifts) },
    emps: [employee],
    avail: {},
    sched: {},
    closed: {},
  };
}

describe("Shabbat and festival observance", () => {
  const week = "2026-10-11";

  it("blocks a shift that touches Friday 15:00 through Saturday 21:00", () => {
    const observer = person({ observesShabbat: true });
    expect(shiftRest(observer, shifts[0], 5, week)).toBeNull();
    expect(shiftRest(observer, shifts[1], 5, week)).toBe("shabbat");
    expect(shiftRest(observer, shifts[2], 5, week)).toBe("shabbat");
    expect(shiftRest(observer, shifts[0], 6, week)).toBe("shabbat");
    expect(shiftRest(observer, shifts[2], 6, week)).toBeNull();
    expect(shiftRest(observer, { start: "15:00", end: "23:00" }, 5, week)).toBe("shabbat");
    expect(shiftRest(observer, { start: "07:00", end: "15:00" }, 5, week)).toBeNull();
    expect(shiftRest(observer, { start: "21:00", end: "05:00" }, 6, week)).toBeNull();
    expect(shiftRest(person(), shifts[1], 5, week)).toBeNull();
  });

  it("blocks festival days only when festival observance is on", () => {
    const yomKippur = "2026-09-21";
    const festivalWeek = sundayOnOrBefore(yomKippur);
    const day = [0, 1, 2, 3, 4, 5, 6].find((index) => addDays(festivalWeek, index) === yomKippur)!;
    const eve = day - 1;
    const shabbatOnly = person({ observesShabbat: true });
    const both = person({ observesShabbat: true, observesHolidays: true });
    expect(shiftRest(both, shifts[1], eve, festivalWeek)).toBe("holiday");
    expect(shiftRest(both, shifts[0], day, festivalWeek)).toBe("holiday");
    expect(shiftRest(both, { start: "21:00", end: "05:00" }, day, festivalWeek)).toBeNull();
    expect(shiftRest(shabbatOnly, shifts[1], eve, festivalWeek)).toBeNull();
    expect(shiftRest(shabbatOnly, shifts[0], day, festivalWeek)).toBeNull();
  });

  it("uses Saturday staffing on a festival day and leaves Chol HaMoed alone", () => {
    const yomKippur = "2026-09-21";
    const festivalWeek = sundayOnOrBefore(yomKippur);
    const day = [0, 1, 2, 3, 4, 5, 6].find((index) => addDays(festivalWeek, index) === yomKippur)!;
    expect(usesShabbatStaffing(festivalWeek, day)).toBe(true);
    expect(staffedCount(shifts[0], day, festivalWeek)).toBe(2);
    const ordinary = day === 0 ? 1 : 0;
    expect(staffedCount(shifts[0], ordinary, festivalWeek)).toBe(3);

    const chol = sundayOnOrBefore("2026-09-27");
    expect(isYomTov("2026-09-27")).toBe(false);
    expect(staffedCount(shifts[0], 0, chol)).toBe(3);
    expect(slots(stateFor(festivalWeek, person()), festivalWeek).find((slot) => slot.day === day && slot.shiftId === "m")?.required).toBe(2);
  });

  it("follows the same festival days the calendar marks as rest", () => {
    const days = holidaysBetween("2026-09-01", "2027-06-30", "he");
    for (const [iso, holidays] of days) {
      if (holidays.some((holiday) => holiday.rest)) expect(isYomTov(iso)).toBe(true);
    }
    expect(isYomTov("2026-09-12")).toBe(true);
    expect(isYomTov("2026-09-13")).toBe(true);
    expect(isYomTov("2027-04-21")).toBe(false);
    expect(isYomTov("2027-04-22")).toBe(true);
  });

  it("keeps a Shabbat observer off the overlapping shifts", () => {
    const limited = structuredClone(shifts);
    for (const shift of limited) shift.req = [0, 0, 0, 0, 0, 0, 0];
    limited[0].req[5] = 1;
    limited[1].req[5] = 1;
    limited[0].req[6] = 1;
    const employee = person({ observesShabbat: true, observesHolidays: true });
    const state = stateFor(week, employee);
    state.biz.minRest = 0;
    state.biz.shifts = limited;
    generate(state, week);
    const assigned = state.sched[week].assign;
    expect(assigned["5|m"]).toEqual(["a"]);
    expect(assigned["5|a"] ?? []).not.toContain("a");
    expect(assigned["6|m"] ?? []).not.toContain("a");
    expect(staticReason(state, employee, slots(state, week).find((slot) => slot.key === "5|a")!, week)?.code).toBe("shabbat");
  });
});
