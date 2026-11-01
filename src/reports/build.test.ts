import { describe, expect, it } from "vitest";
import { wallInstant } from "../domain/messages";
import type { Employee, RotaState, ShiftDefinition } from "../domain";
import { buildErrors, buildHours, buildPayroll, buildStandard, type ReportFilters, type ReportPunch, type ReportSite } from "./build";

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
    emps: [person(), person({ id: "yossi", name: "יוסי", role: "סיור" })],
    avail: {},
    sched: { [week]: { assign, locked: [], status: "published" } },
    closed: {},
    ...extra,
  };
}

const morning: ShiftDefinition = { id: "m", name: "בוקר", start: "06:00", end: "14:00", role: "חמוש", req: [2, 2, 2, 2, 2, 0, 0] };
const patrol: ShiftDefinition = { id: "p", name: "סיור", start: "06:00", end: "14:00", role: "סיור", req: [1, 0, 0, 0, 0, 0, 0] };

function punch(id: string, employeeId: string, kind: "in" | "out", date: string, clock: string): ReportPunch {
  return { id, employeeId, siteId: "north", kind, punchedAt: at(date, clock) };
}

function site(assign: Record<string, string[]>, punches: ReportPunch[] | null, shifts: ShiftDefinition[] = [morning], extra: Partial<RotaState> = {}): ReportSite {
  return { id: "north", name: "צפון", timeZone: zone, state: stateFor(assign, shifts, extra), punches };
}

const filters: ReportFilters = { from: week, to: week, siteId: "", employeeId: "", role: "" };

describe("hours report", () => {
  it("pairs a clock-in with the following clock-out inside the range", () => {
    const rows = buildHours(
      [site({}, [punch("in", "dana", "in", week, "06:02"), punch("out", "dana", "out", week, "14:05"), punch("old", "dana", "in", "2026-10-04", "06:00"), punch("old-out", "dana", "out", "2026-10-04", "14:00")])],
      filters,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ employeeId: "dana", date: week, minutes: 8 * 60 + 3 });
  });

  it("keeps an employee and a role filter", () => {
    const punches = [punch("d", "dana", "in", week, "06:00"), punch("y", "yossi", "in", week, "06:00")];
    expect(buildHours([site({}, punches)], { ...filters, employeeId: "yossi" }).map((row) => row.employeeId)).toEqual(["yossi"]);
    expect(buildHours([site({}, punches)], { ...filters, role: "סיור" }).map((row) => row.employeeId)).toEqual(["yossi"]);
  });
});

describe("payroll report", () => {
  const now = new Date(at(week, "15:00"));

  it("keeps the standard when the clocks cover the shift", () => {
    const rows = buildPayroll(
      [site({ "0|m": ["dana"] }, [punch("in", "dana", "in", week, "05:40"), punch("out", "dana", "out", week, "14:10")])],
      filters,
      now,
    );
    expect(rows[0]).toMatchObject({ status: "standard", issues: [], standardStart: "06:00", standardEnd: "14:00" });
  });

  it("reports a late arrival, a missing clock, and an early leave as exceptions", () => {
    const late = buildPayroll([site({ "0|m": ["dana"] }, [punch("in", "dana", "in", week, "06:20"), punch("out", "dana", "out", week, "14:00")])], filters, now);
    expect(late[0]).toMatchObject({ status: "exception", issues: ["late"], lateMinutes: 20 });
    const missing = buildPayroll([site({ "0|m": ["dana"] }, [])], filters, now);
    expect(missing[0]).toMatchObject({ status: "exception", issues: ["missing-in"] });
    const early = buildPayroll(
      [site({ "0|m": ["dana"] }, [punch("in", "dana", "in", week, "06:00"), punch("out", "dana", "out", week, "13:00")])],
      filters,
      now,
    );
    expect(early[0]).toMatchObject({ status: "exception", issues: ["early-out"], earlyOutMinutes: 60 });
    expect(buildErrors([site({ "0|m": ["dana"] }, [])], filters, now)).toHaveLength(1);
  });

  it("does not call an approved absence or an unfinished shift an exception", () => {
    const absent = buildPayroll(
      [site({ "0|m": ["dana"] }, [], [morning], { absences: [{ employeeId: "dana", kind: "vacation", start: week, end: week }] })],
      filters,
      now,
    );
    expect(absent[0]?.status).toBe("absence");
    expect(buildErrors([site({ "0|m": ["dana"] }, [], [morning], { absences: [{ employeeId: "dana", kind: "vacation", start: week, end: week }] })], filters, now)).toEqual([]);
    const open = buildPayroll([site({ "0|m": ["dana"] }, [punch("in", "dana", "in", week, "06:00")])], filters, new Date(at(week, "10:00")));
    expect(open[0]?.status).toBe("waiting");
  });
});

describe("standard against actual", () => {
  const now = new Date(at(week, "08:00"));

  it("counts a shortage, a match, and a surplus from the clock-ins", () => {
    const short = buildStandard(
      [site({ "0|m": ["dana"] }, [punch("in", "dana", "in", week, "06:00")])],
      filters,
      now,
    );
    expect(short[0]).toMatchObject({ required: 2, assigned: 1, clocked: 1, compared: "clock", gap: -1 });
    const met = buildStandard(
      [site({ "0|m": ["dana", "yossi"] }, [punch("d", "dana", "in", week, "06:00"), punch("y", "yossi", "in", week, "06:00")], [morning])],
      filters,
      now,
    );
    expect(met.find((row) => row.shiftName === "בוקר")).toMatchObject({ clocked: 2, gap: 0 });
    const over = buildStandard(
      [site({ "0|p": ["dana", "yossi"] }, [punch("d", "dana", "in", week, "06:00"), punch("y", "yossi", "in", week, "06:00")], [{ ...patrol, req: [1, 0, 0, 0, 0, 0, 0] }])],
      filters,
      now,
    );
    expect(over[0]).toMatchObject({ required: 1, clocked: 2, gap: 1 });
  });

  it("filters by role, and keeps the whole position when one employee is chosen", () => {
    const both = site({ "0|m": ["dana"], "0|p": ["yossi"] }, [punch("d", "dana", "in", week, "06:00"), punch("y", "yossi", "in", week, "06:00")], [morning, patrol]);
    expect(buildStandard([both], { ...filters, role: "סיור" }, now).map((row) => row.shiftName)).toEqual(["סיור"]);
    expect(buildStandard([both], { ...filters, employeeId: "dana" }, now)).toMatchObject([{ shiftName: "בוקר", required: 2, assigned: 1 }]);
  });

  it("compares the assignment when the shift has not started", () => {
    const rows = buildStandard([site({ "0|m": ["dana"] }, [])], filters, new Date(at(week, "05:00")));
    expect(rows[0]).toMatchObject({ clocked: null, compared: "schedule", gap: -1 });
  });
});
