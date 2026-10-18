import { describe, expect, it } from "vitest";
import { analyze, ensureSchedule, generate, type Employee, type RotaState, type ShiftDefinition } from "./index";

const week = "2026-10-18";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 1, 1, 0, 0, 0, 0] },
  { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [0, 1, 0, 0, 0, 0, 0] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
];

function person(id: string, name: string): Employee {
  return {
    id,
    name,
    contact: "",
    role: "מאבטח",
    quals: "",
    perWeek: 4,
    maxHours: 42,
    allowed: ["m", "a", "n"],
    blocked: [],
    pref: [],
    active: true,
  };
}

function ready(emps: Employee[]): RotaState {
  const state: RotaState = {
    week,
    biz: { name: "דרום", type: "security", minRest: 8, maxHours: 42, maxShift: 12, assume: true, shifts },
    emps,
    avail: {},
    sched: {},
    closed: {},
  };
  const schedule = ensureSchedule(state, week);
  schedule.locked = ["0|n#dana", "1|a#dana", "0|m#noa", "1|m#noa"];
  return state;
}

describe("generation avoids a third tight shift", () => {
  it("gives the next shift to someone who is not already on a minimum-rest chain", () => {
    const state = ready([person("dana", "דנה"), person("noa", "נועה")]);
    generate(state, week);
    expect(state.sched[week].assign["2|m"]).toEqual(["noa"]);
    expect(state.sched[week].ext ?? {}).toEqual({});
    expect(analyze(state, week).violations).toEqual([]);
  });

  it("still assigns the only legal person, even on a third tight shift", () => {
    const state = ready([person("dana", "דנה"), person("noa", "נועה")]);
    state.avail = { [week]: { noa: [["m"], ["m"], [], [], [], [], []] } };
    generate(state, week);
    expect(state.sched[week].assign["2|m"]).toEqual(["dana"]);
    expect(analyze(state, week).violations).toEqual([]);
  });
});
