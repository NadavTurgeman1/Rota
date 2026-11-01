import { describe, expect, it } from "vitest";
import { wallInstant } from "../domain/messages";
import type { Employee, RotaState, ShiftDefinition } from "../domain";
import { buildInsights, clockOutAfter, peopleOnSite, weekAttendance, type ClockPunch } from "./report";

const zone = "Asia/Jerusalem";
const week = "2026-10-11";

function at(date: string, clock: string): string {
  return wallInstant(date, clock, zone);
}

function person(extra: Partial<Employee> = {}): Employee {
  return {
    id: "dana",
    name: "דנה",
    contact: "",
    role: "חמוש",
    quals: "",
    perWeek: 5,
    maxHours: 0,
    allowed: [],
    blocked: [],
    pref: [],
    active: true,
    ...extra,
  };
}

function stateFor(assign: Record<string, string[]>, shifts: ShiftDefinition[], extra: Partial<RotaState> = {}): RotaState {
  return {
    week,
    biz: { name: "צפון", type: "t", minRest: 8, maxHours: 72, maxShift: 12, assume: true, shifts },
    emps: [person(), person({ id: "yossi", name: "יוסי" })],
    avail: {},
    sched: { [week]: { assign, locked: [], status: "published" } },
    closed: {},
    ...extra,
  };
}

const morning: ShiftDefinition = { id: "m", name: "בוקר", start: "06:00", end: "14:00", role: "חמוש", req: [2, 2, 2, 2, 2, 0, 0] };
const afternoon: ShiftDefinition = { id: "a", name: "צהריים", start: "14:00", end: "22:00", role: "חמוש", req: [1, 0, 0, 0, 0, 0, 0] };
const night: ShiftDefinition = { id: "n", name: "לילה", start: "22:00", end: "06:00", role: "חמוש", req: [1, 1, 0, 0, 0, 0, 0] };

function punch(id: string, employeeId: string, date: string, clock: string): ClockPunch {
  return { id, employeeId, kind: "in", punchedAt: at(date, clock) };
}

describe("week attendance", () => {
  const now = new Date(at(week, "08:00"));

  it("shows clock-ins against the standard, with early and late", () => {
    const state = stateFor({ "0|m": ["dana", "yossi"] }, [morning]);
    const rows = weekAttendance(state, zone, now, [punch("1", "dana", week, "06:20"), punch("2", "yossi", week, "05:40")]);
    const sunday = rows.find((row) => row.day === 0);
    expect(sunday?.clocked).toBe(2);
    expect(sunday?.required).toBe(2);
    expect(sunday?.people.find((person) => person.employeeId === "dana")).toMatchObject({ arrival: "late", minutes: 20 });
    expect(sunday?.people.find((person) => person.employeeId === "yossi")).toMatchObject({ arrival: "early", minutes: 20 });
  });

  it("keeps a punch inside a night shift on that shift", () => {
    const state = stateFor({ "0|n": ["dana"], "1|m": ["dana"] }, [morning, night]);
    const rows = weekAttendance(state, zone, new Date(at("2026-10-12", "05:55")), [punch("1", "dana", "2026-10-12", "05:50")]);
    expect(rows.find((row) => row.key === "0|n")?.people[0]).toMatchObject({ arrival: "late" });
    expect(rows.find((row) => row.key === "1|m")?.people[0]?.arrival).toBe("waiting");
  });

  it("does not call a future shift or an approved absence a no-show", () => {
    const state = stateFor({ "0|m": ["dana"], "0|a": ["yossi"] }, [morning, afternoon], {
      absences: [{ employeeId: "dana", kind: "sick", start: week, end: week }],
    });
    const rows = weekAttendance(state, zone, now, []);
    expect(rows.find((row) => row.key === "0|m")?.people[0]?.arrival).toBe("absent");
    expect(rows.find((row) => row.key === "0|a")?.people[0]?.arrival).toBe("waiting");
  });

  it("leaves attendance unmarked until punches are loaded", () => {
    const state = stateFor({ "0|m": ["dana"] }, [morning]);
    const row = weekAttendance(state, zone, now, null).find((item) => item.key === "0|m");
    expect(row?.clocked).toBeNull();
    expect(row?.people[0]?.arrival).toBe("scheduled");
  });
});

describe("insights", () => {
  it("counts each labor exception and keeps the detail", () => {
    const day: ShiftDefinition = { id: "d", name: "יום", start: "08:00", end: "16:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] };
    const assign: Record<string, string[]> = {};
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) assign[`${dayIndex}|d`] = ["dana"];
    const state = stateFor(assign, [day]);
    const report = buildInsights(state, "week", "he", zone, new Date(at(week, "12:00")), []);
    const streak = report.labor.find((group) => group.code === "consecutive_days");
    expect(report.labor).toHaveLength(7);
    expect(streak?.count).toBe(1);
    expect(streak?.notes[0]?.message).toContain("דנה");
    const monday = buildInsights(state, "day", "he", zone, new Date(at("2026-10-12", "12:00")), []);
    expect(monday.labor.find((group) => group.code === "day_cap")?.count).toBe(0);
  });

  it("keeps a long day on that day only", () => {
    const long: ShiftDefinition = { id: "long", name: "ארוך", start: "06:00", end: "19:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] };
    const state = stateFor({ "0|long": ["dana"] }, [long]);
    const sunday = buildInsights(state, "day", "he", zone, new Date(at(week, "12:00")), []);
    expect(sunday.labor.find((group) => group.code === "day_cap")?.count).toBe(1);
    const monday = buildInsights(state, "day", "he", zone, new Date(at("2026-10-12", "12:00")), []);
    expect(monday.labor.find((group) => group.code === "day_cap")?.count).toBe(0);
  });

  it("reports shortages, lateness, no-shows, and a repeated gap", () => {
    const state = stateFor({ "0|m": ["dana"], "1|m": ["dana"], "2|m": ["dana"] }, [morning]);
    const now = new Date(at("2026-10-13", "08:00"));
    const clocks = [punch("1", "dana", week, "06:30"), punch("2", "dana", "2026-10-12", "06:25"), punch("3", "dana", "2026-10-13", "06:40")];
    const report = buildInsights(state, "week", "he", zone, now, clocks);
    expect(report.shortages.length).toBeGreaterThanOrEqual(3);
    expect(report.recurring[0]).toMatchObject({ shiftId: "m", times: expect.any(Number) });
    expect(report.recurring[0].times).toBeGreaterThanOrEqual(2);
    expect(report.late).toHaveLength(3);
    expect(report.patterns.find((item) => item.kind === "late")?.count).toBe(3);
    expect(report.hiring[0]).toMatchObject({ shiftId: "m", hire: 1 });
    expect(report.secondaryFills).toEqual([]);
  });

  it("counts a shift filled through a secondary role, and ignores a primary one", () => {
    const patrol: ShiftDefinition = { id: "p", name: "סיור", start: "06:00", end: "14:00", role: "סיור", req: [1, 0, 0, 0, 0, 0, 0] };
    const state = stateFor({ "0|m": ["dana"], "0|p": ["dana", "yossi"] }, [morning, patrol], {
      emps: [person({ secondaryRoles: ["סיור"] }), person({ id: "yossi", name: "יוסי" })],
    });
    const report = buildInsights(state, "day", "he", zone, new Date(at(week, "08:00")), []);
    expect(report.secondaryFills).toEqual([
      { employeeId: "dana", name: "דנה", date: week, shiftId: "p", shiftName: "סיור", role: "סיור" },
    ]);
  });

  it("does not treat an approved absence as a no-show", () => {
    const state = stateFor({ "0|m": ["dana", "yossi"] }, [morning], {
      absences: [{ employeeId: "yossi", kind: "vacation", start: week, end: week }],
    });
    const report = buildInsights(state, "day", "he", zone, new Date(at(week, "08:00")), [punch("1", "dana", week, "06:00")]);
    expect(report.noShows).toEqual([]);
    expect(report.late).toEqual([]);
  });

  it("flags someone whose last clock-in was more than 15 days ago", () => {
    const state = stateFor({}, [morning], {
      sched: {
        [week]: { assign: {}, locked: [], status: "published" },
        "2026-08-30": { assign: { "0|m": ["dana"] }, locked: [], status: "published" },
      },
    });
    const report = buildInsights(state, "day", "he", zone, new Date(at(week, "08:00")), [punch("old", "dana", "2026-08-30", "06:05")]);
    expect(report.idle.find((item) => item.employeeId === "dana")?.days).toBeGreaterThan(15);
    expect(report.idle.find((item) => item.employeeId === "yossi")).toBeUndefined();
  });

  it("keeps someone on site until they clock out, and only for 18 hours", () => {
    const now = new Date(at(week, "10:00"));
    const punches = [
      punch("in", "dana", week, "06:10"),
      { id: "out", employeeId: "yossi", kind: "out" as const, punchedAt: at(week, "09:00") },
      { id: "yin", employeeId: "yossi", kind: "in" as const, punchedAt: at(week, "06:00") },
      punch("old", "dana", "2026-10-10", "06:00"),
    ];
    expect(peopleOnSite(punches, now).map((item) => item.employeeId)).toEqual(["dana"]);
    expect(clockOutAfter(punches, "yossi", at(week, "06:00"))).toBe(at(week, "09:00"));
    expect(clockOutAfter(punches, "dana", at(week, "06:10"))).toBeNull();
    expect(peopleOnSite([punch("stale", "dana", "2026-10-09", "06:00")], now)).toEqual([]);
  });

  it("skips attendance conclusions when punches are not loaded", () => {
    const state = stateFor({ "0|m": ["dana"] }, [morning]);
    const report = buildInsights(state, "day", "he", zone, new Date(at(week, "08:00")), null);
    expect(report.noShows).toEqual([]);
    expect(report.late).toEqual([]);
    expect(report.secondaryFills).toEqual([]);
  });
});
