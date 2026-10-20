import { describe, expect, it } from "vitest";
import { applyTrade, swapTargets, tradeProblem, type Employee, type RotaState, type ShiftDefinition } from "./index";

const week = "2026-10-18";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "בוקר", start: "06:00", end: "14:00", role: "", req: [1, 1, 1, 0, 0, 0, 0] },
  { id: "n", name: "לילה", start: "22:00", end: "06:00", role: "", req: [1, 1, 0, 0, 0, 0, 0] },
];

function person(id: string, perWeek = 3): Employee {
  return { id, name: id, contact: "", role: "", quals: "", perWeek, maxHours: 0, allowed: ["m", "n"], blocked: [], pref: [], active: true };
}

function published(): RotaState {
  return {
    week,
    biz: { name: "אתר", type: "", minRest: 8, maxHours: 72, maxShift: 12, assume: true, shifts },
    emps: [person("dana"), person("noa"), person("avi")],
    avail: {},
    sched: {
      [week]: {
        status: "published",
        locked: ["0|m#dana"],
        assign: { "0|m": ["dana"], "1|m": ["noa"], "1|n": ["noa"], "2|m": ["avi"], "0|n": ["avi"] },
      },
    },
    closed: {},
  };
}

describe("shift trades", () => {
  it("swaps two seats and keeps the lock on the seat", () => {
    const state = published();
    const move = { kind: "swap" as const, from: { slotKey: "0|m", employeeId: "dana" }, to: { slotKey: "2|m", employeeId: "avi" } };
    expect(tradeProblem(state, week, move, null)).toBeNull();
    const next = applyTrade(state, week, move, { id: "v1", at: "2026-10-18T08:00:00Z", by: "מנהל" });
    expect(next.sched[week].assign["0|m"]).toEqual(["avi"]);
    expect(next.sched[week].assign["2|m"]).toEqual(["dana"]);
    expect(next.sched[week].locked).toEqual(["0|m#avi"]);
    expect(next.versions?.[week]?.[0]).toMatchObject({ number: 1, reason: "trade", by: "מנהל" });
  });

  it("refuses a swap that breaks the other person's weekly constraints", () => {
    const state = published();
    state.avail = { [week]: { avi: [[], ["n"], ["m"], [], [], [], []] } };
    const move = { kind: "swap" as const, from: { slotKey: "0|m", employeeId: "dana" }, to: { slotKey: "2|m", employeeId: "avi" } };
    expect(tradeProblem(state, week, move, null)).toMatchObject({ code: "rule", employeeId: "avi", reason: { code: "unavailable" } });
  });

  it("refuses a swap that leaves too little rest", () => {
    const state = published();
    const tight = { kind: "swap" as const, from: { slotKey: "1|m", employeeId: "noa" }, to: { slotKey: "2|m", employeeId: "avi" } };
    expect(tradeProblem(state, week, tight, null)).toMatchObject({ code: "rule", reason: { code: "rest" } });
  });

  it("lists only seats of other people that pass every rule", () => {
    const state = published();
    state.avail = { [week]: { noa: [["n"], ["m", "n"], ["m"], [], [], [], []] } };
    const targets = swapTargets(state, week, { slotKey: "0|m", employeeId: "dana" }, null);
    expect(targets).toEqual([
      { slotKey: "2|m", employeeId: "avi" },
      { slotKey: "0|n", employeeId: "avi" },
    ]);
  });

  it("hands a seat to a taker only within their agreed shifts", () => {
    const state = published();
    const move = { kind: "giveaway" as const, from: { slotKey: "2|m", employeeId: "avi" }, takerId: "dana" };
    expect(tradeProblem(state, week, move, null)).toBeNull();
    state.emps = state.emps.map((employee) => (employee.id === "dana" ? { ...employee, perWeek: 1 } : employee));
    expect(tradeProblem(state, week, move, null)).toMatchObject({ code: "rule", reason: { code: "weekly_shifts" } });
  });

  it("does not move a shift that has started, or a week that is not published", () => {
    const state = published();
    const move = { kind: "giveaway" as const, from: { slotKey: "0|m", employeeId: "dana" }, takerId: "avi" };
    expect(tradeProblem(state, week, move, 7)).toEqual({ code: "started" });
    state.sched[week].status = "draft";
    expect(tradeProblem(state, week, move, null)).toEqual({ code: "unpublished" });
  });
});
