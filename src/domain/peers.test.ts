import { describe, expect, it } from "vitest";
import { dynamicReason, ensureSchedule, generate, slots, type Employee, type RotaState, type ShiftDefinition } from "./index";
import { peerDuties } from "./peers";
import { addEmployee, moveEmployee } from "../schedule/edit";

const week = "2026-10-18";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "בוקר", start: "06:00", end: "14:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
  { id: "n", name: "לילה", start: "22:00", end: "06:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
];

function person(id: string, name: string, phone = ""): Employee {
  return {
    id,
    name,
    contact: "",
    phone,
    role: "",
    quals: "",
    perWeek: 5,
    maxHours: 42,
    allowed: ["m", "n"],
    blocked: [],
    pref: [],
    active: true,
  };
}

function site(name: string, employees: Employee[], assign: Record<string, string[]> = {}): RotaState {
  const state: RotaState = {
    week,
    biz: { name, type: "security", minRest: 8, maxHours: 42, maxShift: 12, assume: true, shifts },
    emps: employees,
    avail: {},
    sched: {},
    closed: {},
  };
  ensureSchedule(state, week).assign = assign;
  return state;
}

describe("the same employee id across sites", () => {
  it("counts that id's other site, and ignores a different id with the same phone or the same name", () => {
    const dana = person("dana", "דנה", "0501111111");
    const other = person("other", "דנה", "0501111111");
    const here = site("דרום", [dana]);
    const there = site("צפון", [dana, other], { "0|n": ["dana"], "0|m": ["other"] });
    there.biz.minRest = 11;
    const peers = peerDuties(
      [
        { id: "south", state: here },
        { id: "north", state: there },
      ],
      "south",
      week,
    );
    expect(peers.dana?.map((peer) => peer.label)).toEqual(["צפון · לילה"]);
    expect(peers.other).toBeUndefined();
    const morning = slots(here, week).find((slot) => slot.shiftId === "m");
    if (!morning) throw new Error("missing morning");
    here.peers = peers;
    expect(dynamicReason(here, dana, morning, [])?.code).toBe("rest");
    expect(addEmployee(here, morning.key, dana.id)).toBe(here);
  });

  it("refuses a move onto a shift that overlaps the same id at another site", () => {
    const dana = person("dana", "דנה", "0501111111");
    const here = site("דרום", [dana], { "0|m": ["dana"] });
    const there = site("צפון", [dana], { "0|n": ["dana"] });
    here.peers = peerDuties(
      [
        { id: "south", state: here },
        { id: "north", state: there },
      ],
      "south",
      week,
    );
    const night = slots(here, week).find((slot) => slot.shiftId === "n");
    if (!night) throw new Error("missing night");
    expect(moveEmployee(here, "0|m", dana.id, night.key)).toBe(here);
    expect(here.sched[week].assign["0|m"]).toEqual(["dana"]);
  });

  it("still fills a seat when the other site does not conflict", () => {
    const dana = person("dana", "דנה", "0501111111");
    const here = site("דרום", [dana]);
    here.biz.shifts = [{ id: "m", name: "בוקר", start: "06:00", end: "14:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] }];
    const there = site("צפון", [dana]);
    here.peers = peerDuties(
      [
        { id: "south", state: here },
        { id: "north", state: there },
      ],
      "south",
      week,
    );
    generate(here, week);
    expect(here.sched[week].assign["0|m"]).toEqual(["dana"]);
  });
});
