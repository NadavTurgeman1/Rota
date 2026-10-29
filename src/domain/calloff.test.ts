import { describe, expect, it } from "vitest";
import { dynamicReason, ensureSchedule, slots, type Employee, type RotaState, type ShiftDefinition } from "./index";
import { assignEmergency, assignReplacement, planCallOff, recordCallOff, undoCallOff } from "./calloff";
import { reportCallOff } from "../schedule/edit";

const week = "2026-10-11";

function employee(id: string, name: string, perWeek: number, allowed: string[], quals = ""): Employee {
  return {
    id,
    name,
    contact: "",
    role: "Guard",
    quals,
    perWeek,
    maxHours: 0,
    pref: [],
    allowed,
    blocked: [],
    active: true,
  };
}

function stateFor(
  emps: Employee[],
  shifts: ShiftDefinition[],
  minRest: number,
  maxDayHours = 0,
): RotaState {
  return {
    week,
    biz: {
      name: "t",
      type: "t",
      minRest,
      maxHours: 48,
      maxShift: 12,
      maxDayHours,
      assume: true,
      shifts,
    },
    emps,
    avail: {},
    sched: {},
    closed: {},
  };
}

const nightShift = (role = ""): ShiftDefinition => ({
  id: "n",
  name: "Night",
  start: "22:00",
  end: "06:00",
  role,
  req: [0, 0, 1, 1, 0, 0, 0],
});

describe("call-offs", () => {
  it("ranks a rested qualified replacement and rejects the adjacent night", () => {
    const dana = employee("dana", "Dana", 4, ["n"], "Medic");
    const yossi = employee("yossi", "Yossi", 4, ["n"], "Medic");
    const omer = employee("omer", "Omer", 4, ["n"], "Medic");
    const noa = employee("noa", "Noa", 4, ["n"]);
    const state = stateFor([dana, yossi, omer, noa], [nightShift("Medic")], 18);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "2|n": ["omer"], "3|n": ["dana"] };
    const before = structuredClone(state.emps);

    const next = recordCallOff(state, {
      id: "c1",
      slotKey: "3|n",
      employeeId: "dana",
      at: "2026-10-14T18:00:00.000Z",
      by: "manager",
      nowHours: 80,
    });

    expect(next).not.toBe(state);
    expect(next.sched[week].status).toBe("published");
    expect(next.sched[week].assign["3|n"]).toEqual([]);
    expect(next.sched[week].calloffs).toEqual([
      {
        id: "c1",
        slotKey: "3|n",
        employeeId: "dana",
        name: "Dana",
        at: "2026-10-14T18:00:00.000Z",
        by: "manager",
      },
    ]);
    expect(next.emps).toEqual(before);

    const slot = slots(next, week).find((item) => item.key === "3|n")!;
    const plan = planCallOff(next, slot);
    expect(plan.replacements.map((item) => item.name)).toEqual(["Yossi"]);
    expect(plan.extensions).toHaveLength(0);
    expect(plan.rejected.find((item) => item.name === "Omer")?.reason.code).toBe("rest");
    expect(plan.rejected.find((item) => item.name === "Noa")?.reason.code).toBe("role");

    const covered = assignReplacement(next, "3|n", "yossi");
    expect(covered.sched[week].status).toBe("published");
    expect(covered.sched[week].assign["3|n"]).toEqual(["yossi"]);
    expect(covered.sched[week].calloffs).toHaveLength(1);
    expect(assignReplacement(next, "3|n", "omer")).toBe(next);

    const returned = undoCallOff(next, "c1");
    expect(returned.sched[week].assign["3|n"]).toEqual(["dana"]);
    expect(returned.sched[week].calloffs).toBeUndefined();
    expect(returned.sched[week].status).toBe("published");
    expect(undoCallOff(returned, "c1")).toBe(returned);
  });

  it("prefers fewer consecutive nights when rest still allows both", () => {
    const dana = employee("dana", "Dana", 5, ["n"], "Medic");
    const cara = employee("cara", "Cara", 5, ["m", "n"], "Medic");
    const dani = employee("dani", "Dani", 5, ["m", "n"], "Medic");
    const shifts: ShiftDefinition[] = [
      { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
      nightShift("Medic"),
    ];
    const state = stateFor([dana, cara, dani], shifts, 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "0|m": ["dani"], "2|n": ["cara"], "3|n": ["dana"] };
    const next = recordCallOff(state, {
      id: "c2",
      slotKey: "3|n",
      employeeId: "dana",
      at: "2026-10-14T18:00:00.000Z",
      by: "manager",
      nowHours: 80,
    });
    const slot = slots(next, week).find((item) => item.key === "3|n")!;
    const plan = planCallOff(next, slot);
    expect(plan.replacements.map((item) => item.name)).toEqual(["Dani", "Cara"]);
    expect(plan.replacements[0].consecutiveNights).toBe(1);
    expect(plan.replacements[1].consecutiveNights).toBe(2);
  });

  it("offers an extension instead of assigning someone who breaks rest", () => {
    const shifts: ShiftDefinition[] = [
      { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [2, 0, 0, 0, 0, 0, 0] },
      { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
      { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [2, 0, 0, 0, 0, 0, 0] },
    ];
    const people = ["p", "q", "r", "u", "v"].map((id) => employee(id, id, 3, ["m", "a", "n"]));
    const state = stateFor(people, shifts, 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "0|m": ["p", "q"], "0|a": ["r"], "0|n": ["u", "v"] };
    const next = recordCallOff(state, {
      id: "c3",
      slotKey: "0|a",
      employeeId: "r",
      at: "2026-10-11T08:00:00.000Z",
      by: "manager",
      nowHours: 1,
    });
    const slot = slots(next, week).find((item) => item.key === "0|a")!;
    const plan = planCallOff(next, slot);
    expect(plan.replacements).toHaveLength(0);
    expect(plan.extensions.length).toBeGreaterThan(0);
    expect(plan.extensions[0].ext.every((part) => part.end - part.start === 12)).toBe(true);
    expect(next.sched[week].assign["0|a"]).toEqual([]);
    expect(plan.extras).toHaveLength(0);

    const covered = assignEmergency(next, "0|a", { kind: "extension", index: 0 });
    expect(covered.sched[week].status).toBe("published");
    expect(covered.sched[week].assign["0|a"]).toEqual([]);
    const reportHours = covered.sched[week].ext ?? {};
    expect(Object.values(reportHours).some((item) => item.cover === "0|a")).toBe(true);
  });

  it("splits the open seat when the three-shift repair does not apply", () => {
    const shifts: ShiftDefinition[] = [
      { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [2, 0, 0, 0, 0, 0, 0] },
      { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
      { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
    ];
    const people = ["p", "r", "u"].map((id) => employee(id, id, 3, ["m", "a", "n"]));
    const state = stateFor(people, shifts, 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "0|m": ["p"], "0|a": ["r"], "0|n": ["u"] };
    const next = recordCallOff(state, {
      id: "c4",
      slotKey: "0|a",
      employeeId: "r",
      at: "2026-10-11T08:00:00.000Z",
      by: "manager",
      nowHours: 1,
    });
    const slot = slots(next, week).find((item) => item.key === "0|a")!;
    const plan = planCallOff(next, slot);
    expect(plan.replacements).toHaveLength(0);
    expect(plan.extensions).toHaveLength(0);
    expect(plan.splits).toHaveLength(1);
    expect(plan.splits[0].ext.map((part) => [part.id, part.start, part.end])).toEqual([
      ["p", 6, 18],
      ["u", 18, 30],
    ]);
    const covered = assignEmergency(next, "0|a", { kind: "split", index: 0 });
    expect(covered.sched[week].status).toBe("published");
    expect(covered.sched[week].assign["0|m"]).toEqual(["p"]);
    expect(covered.sched[week].assign["0|a"]).toEqual([]);
  });

  it("refuses a call-off after the shift ended, and on a draft", () => {
    const state = stateFor([employee("dana", "Dana", 4, ["n"], "Medic")], [nightShift()], 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "2|n": ["dana"] };
    expect(
      recordCallOff(state, {
        id: "late",
        slotKey: "2|n",
        employeeId: "dana",
        at: "2026-10-14T18:00:00.000Z",
        by: "manager",
        nowHours: 80,
      }),
    ).toBe(state);
    schedule.status = "draft";
    schedule.assign = { "3|n": ["dana"] };
    expect(
      recordCallOff(state, {
        id: "draft",
        slotKey: "3|n",
        employeeId: "dana",
        at: "2026-10-14T18:00:00.000Z",
        by: "manager",
        nowHours: 80,
      }),
    ).toBe(state);
  });

  it("treats an extension that is still running as an active shift", () => {
    const state = stateFor([employee("p", "P", 3, ["m"])], [
      { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
    ], 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "0|m": ["p"] };
    schedule.ext = { "0|m#p": { start: 6, end: 18, groupId: "g", cover: "0|a", groupSize: 1 } };
    const during = recordCallOff(state, {
      id: "mid",
      slotKey: "0|m",
      employeeId: "p",
      at: "2026-10-11T12:00:00.000Z",
      by: "manager",
      nowHours: 15,
    });
    expect(during.sched[week].assign["0|m"]).toEqual([]);
    expect(
      recordCallOff(state, {
        id: "after",
        slotKey: "0|m",
        employeeId: "p",
        at: "2026-10-11T16:00:00.000Z",
        by: "manager",
        nowHours: 19,
      }),
    ).toBe(state);
  });

  it("keeps an employee from reporting a call-off", () => {
    const state = stateFor([employee("dana", "Dana", 4, ["n"])], [nightShift()], 11);
    const schedule = ensureSchedule(state, week);
    schedule.status = "published";
    schedule.assign = { "3|n": ["dana"] };
    expect(
      reportCallOff(
        state,
        { kind: "employee", employeeId: "dana" },
        { id: "own", slotKey: "3|n", employeeId: "dana", at: "2026-10-14T18:00:00.000Z", nowHours: 80 },
      ),
    ).toBe(state);
  });

  it("blocks a same-day shift that would pass the weekly cap but not the daily cap", () => {
    const shifts: ShiftDefinition[] = [
      { id: "m", name: "Morning", start: "06:00", end: "12:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
      { id: "e", name: "Evening", start: "16:00", end: "22:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
    ];
    const state = stateFor([employee("x", "X", 4, ["m", "e"])], shifts, 3, 10);
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["x"] };
    const evening = slots(state, week).find((item) => item.key === "0|e")!;
    expect(dynamicReason(state, state.emps[0], evening, [{ ...evening, key: "0|m", start: 6, end: 12 }])?.code).toBe(
      "daily_hours",
    );
    state.biz.maxDayHours = 0;
    expect(dynamicReason(state, state.emps[0], evening, [{ ...evening, key: "0|m", start: 6, end: 12 }])).toBeNull();
  });
});
