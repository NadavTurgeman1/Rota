import { describe, expect, it } from "vitest";
import {
  addDays,
  analyze,
  applyCoverage,
  applyExtra,
  dynamicReason,
  ensureSchedule,
  generate,
  slots,
  suggest,
  suggestExtra,
  type Employee,
  type RotaState,
  type ShiftDefinition,
} from "./index";
import { reshuffleWeek, slotLocked, toggleSlotLock } from "../schedule/edit";

const week = "2026-10-04";

const standardShifts: ShiftDefinition[] = [
  { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [2, 2, 2, 2, 2, 2, 2] },
  { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [2, 2, 2, 2, 2, 2, 2] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
];

function employee(id: string, perWeek: number, allowed: string[]): Employee {
  return {
    id,
    name: id,
    contact: "",
    role: "Guard",
    quals: "",
    perWeek,
    maxHours: 0,
    allowed,
    blocked: [],
    pref: [],
    active: true,
  };
}

function stateFor(
  emps: Employee[],
  avail: Record<string, string[][]> = {},
  shifts: ShiftDefinition[] = standardShifts,
  minRest = 11,
): RotaState {
  return {
    week,
    biz: {
      name: "t",
      type: "t",
      minRest,
      maxHours: 48,
      maxShift: 12,
      assume: true,
      shifts: structuredClone(shifts),
    },
    emps,
    avail: { [week]: avail },
    sched: {},
    closed: {},
  };
}

describe("prototype scheduling parity", () => {
  it("treats an overnight shift as 8h ending the next day", () => {
    const state = stateFor([]);
    const night = slots(state, week).find((slot) => slot.key === "0|n");
    expect(night && night.end - night.start).toBe(8);
    expect(night?.end).toBe(30);
  });

  it("never assigns days the employee marked unavailable", () => {
    const state = stateFor(
      [employee("x", 4, ["m", "a"]), employee("y", 5, ["m", "a", "n"])],
      { x: [["m", "a"], ["m", "a"], [], [], [], [], []] },
    );
    generate(state, week);
    const assignments = state.sched[week].assign;
    expect(
      Object.entries(assignments).every(([key, ids]) => !ids.includes("x") || Number(key[0]) < 2),
    ).toBe(true);
    expect(analyze(state, week).violations).toHaveLength(0);
  });

  it("explains an employee left under their agreement", () => {
    const state = stateFor([employee("x", 4, ["m", "a"])], { x: [["m"], [], [], [], [], [], []] });
    generate(state, week);
    const report = analyze(state, week);
    expect(report.under).toHaveLength(1);
    expect(report.unfilled.length).toBeGreaterThan(0);
  });

  it("reports missing staff instead of inventing an assignment", () => {
    const state = stateFor([employee("x", 5, ["m"])]);
    generate(state, week);
    const report = analyze(state, week);
    expect(report.unfilled.length).toBeGreaterThan(0);
    expect(report.violations).toHaveLength(0);
    expect(state.sched[week].assign["0|m"]).toHaveLength(1);
  });

  it("blocks a night shift followed by the next morning", () => {
    const state = stateFor([employee("x", 7, ["m", "n"])]);
    const open = slots(state, week);
    const night = open.find((slot) => slot.key === "0|n")!;
    const morning = open.find((slot) => slot.key === "1|m")!;
    expect(dynamicReason(state, state.emps[0], morning, [night])?.code).toBe("rest");
  });

  it("enforces a required qualification", () => {
    const shifts = structuredClone(standardShifts);
    shifts[0].role = "Armed";
    const state = stateFor([employee("x", 5, ["m", "a", "n"])], {}, shifts);
    generate(state, week);
    expect(
      Object.entries(state.sched[week].assign).some(([key, ids]) => key.endsWith("|m") && ids.length > 0),
    ).toBe(false);
  });

  it("does not give one employee overlapping shifts", () => {
    const state = stateFor([
      employee("x", 7, ["m", "a", "n"]),
      employee("y", 7, ["m", "a", "n"]),
      employee("z", 7, ["m", "a", "n"]),
    ]);
    generate(state, week);
    expect(analyze(state, week).violations).toHaveLength(0);
  });

  it("covers a missing afternoon seat by extending morning and night to 12h", () => {
    const shifts = structuredClone(standardShifts);
    for (const shift of shifts) shift.req = [2, 0, 0, 0, 0, 0, 0];
    const state = stateFor(["p", "q", "r", "u", "v"].map((id) => employee(id, 3, ["m", "a", "n"])), {}, shifts);
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["p", "q"], "0|a": ["r"], "0|n": ["u", "v"] };
    const options = suggest(state, week, slots(state, week).find((slot) => slot.key === "0|a")!);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].ext).toHaveLength(2);
    expect(options[0].ext.every((part) => part.end - part.start === 12)).toBe(true);
    applyCoverage(schedule, options[0]);
    const report = analyze(state, week);
    expect(report.unfilled).toHaveLength(0);
    expect(report.violations).toHaveLength(0);
  });

  it("rearranges the same day when a night seat is open", () => {
    const shifts = structuredClone(standardShifts);
    for (const shift of shifts) shift.req = [2, 0, 0, 0, 0, 0, 0];
    const state = stateFor(["p", "q", "r", "u", "v"].map((id) => employee(id, 3, ["m", "a", "n"])), {}, shifts);
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["p", "q"], "0|a": ["r", "u"], "0|n": ["v"] };
    const options = suggest(state, week, slots(state, week).find((slot) => slot.key === "0|n")!);
    expect(options.length).toBeGreaterThan(0);
    applyCoverage(schedule, options[0]);
    const report = analyze(state, week);
    expect(report.unfilled).toHaveLength(0);
    expect(report.violations).toHaveLength(0);
  });

  it("closes a gap with an approved sixth shift instead of five", () => {
    const morningOnly = structuredClone(standardShifts[0]);
    morningOnly.req = [1, 0, 1, 0, 0, 0, 0];
    const state = stateFor([employee("p", 1, ["m"])], {}, [morningOnly]);
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["p"] };
    const tuesday = slots(state, week).find((slot) => slot.key === "2|m")!;
    const before = analyze(state, week);
    const options = suggestExtra(state, week, tuesday);
    expect(before.unfilled).toHaveLength(1);
    expect(options).toHaveLength(1);
    expect(options[0].n).toBe(2);
    applyExtra(schedule, options[0]);
    const report = analyze(state, week);
    expect(report.unfilled).toHaveLength(0);
    expect(report.violations).toHaveLength(0);
  });

  it("enforces rest across Saturday night into Sunday morning", () => {
    const state = stateFor([employee("p", 5, ["m", "a", "n"])]);
    state.sched[addDays(week, -7)] = {
      assign: { "6|n": ["p"] },
      locked: [],
      status: "published",
    };
    generate(state, week);
    expect(state.sched[week].assign["0|m"] ?? []).not.toContain("p");
    const morning = slots(state, week).find((slot) => slot.key === "0|m")!;
    expect(dynamicReason(state, state.emps[0], morning, [])).not.toBeNull();
    state.sched[addDays(week, -7)].assign = {};
    expect(dynamicReason(state, state.emps[0], morning, [])).toBeNull();
  });

  it("orders a generated shift by name and favors a preferred shift", () => {
    const morning = { ...standardShifts[0], req: [2, 0, 0, 0, 0, 0, 0] };
    const named = stateFor(
      [
        { ...employee("b", 1, ["m"]), name: "בני" },
        { ...employee("a", 1, ["m"]), name: "אבי" },
      ],
      {},
      [morning],
    );
    generate(named, week);
    expect(named.sched[week].assign["0|m"]).toEqual(["a", "b"]);

    const preferred = stateFor(
      [
        { ...employee("plain", 1, ["m"]), name: "plain" },
        { ...employee("keen", 1, ["m"]), name: "keen", pref: ["m"] },
      ],
      {},
      [{ ...morning, req: [1, 0, 0, 0, 0, 0, 0] }],
    );
    generate(preferred, week);
    expect(preferred.sched[week].assign["0|m"]).toEqual(["keen"]);
  });

  it("reshuffles unlocked shifts and leaves a locked shift in place", () => {
    const morning = { ...standardShifts[0], req: [1, 1, 0, 0, 0, 0, 0] };
    const state = stateFor([employee("a", 2, ["m"]), employee("b", 2, ["m"])], {}, [morning]);
    generate(state, week);
    const locked = toggleSlotLock(state, "0|m");
    expect(slotLocked(locked, "0|m")).toBe(true);
    const held = locked.sched[week].assign["0|m"];
    const toFirst = reshuffleWeek(locked, () => 0);
    const toSecond = reshuffleWeek(locked, () => 0.99);
    expect(toFirst.sched[week].assign["0|m"]).toEqual(held);
    expect(toSecond.sched[week].assign["0|m"]).toEqual(held);
    expect(toFirst.sched[week].assign["1|m"]).not.toEqual(toSecond.sched[week].assign["1|m"]);

    const blocked = stateFor([employee("a", 1, ["m"]), employee("b", 1, ["m"])], { b: [["m"], [], [], [], [], [], []] }, [morning]);
    generate(blocked, week);
    const mixed = reshuffleWeek(blocked, () => 0.99);
    expect(mixed.sched[week].assign["1|m"] ?? []).not.toContain("b");
  });

  it("keeps a lock on regenerate, which the prototype used to clear", () => {
    const state = stateFor([employee("p", 5, ["m", "a", "n"])]);
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["p"] };
    schedule.locked = ["0|m#p"];
    generate(state, week);
    expect(schedule.locked).toEqual(["0|m#p"]);
    expect(schedule.assign["0|m"]).toContain("p");
  });
});
