import { describe, expect, it } from "vitest";
import { addDays, analyze, dynamicReason, generate, slots, type Employee, type RotaState, type ShiftDefinition } from "./index";
import type { PeerShift } from "./types";
import { addEmployee, publishCheck, publishWeek } from "../schedule/edit";

const week = "2026-10-11";

const shifts: ShiftDefinition[] = [
  { id: "d", name: "Day", start: "08:00", end: "16:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
  { id: "long", name: "Long", start: "06:00", end: "18:00", role: "", req: [1, 1, 1, 1, 1, 0, 0] },
  { id: "over", name: "Over", start: "06:00", end: "19:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
];

function person(extra: Partial<Employee> = {}): Employee {
  return {
    id: "a",
    name: "Dana",
    contact: "",
    role: "",
    quals: "",
    perWeek: 7,
    maxHours: 0,
    allowed: shifts.map((shift) => shift.id),
    blocked: [],
    pref: [],
    active: true,
    ...extra,
  };
}

function assignDays(days: number[], shiftId = "d"): Record<string, string[]> {
  const assign: Record<string, string[]> = {};
  for (const day of days) assign[`${day}|${shiftId}`] = ["a"];
  return assign;
}

function stateFor(
  assign: Record<string, string[]>,
  extra: Partial<RotaState> = {},
  bizExtra: Partial<RotaState["biz"]> = {},
): RotaState {
  return {
    week,
    biz: { name: "t", type: "t", minRest: 0, maxHours: 200, maxShift: 16, assume: true, shifts: structuredClone(shifts), ...bizExtra },
    emps: [person()],
    avail: {},
    sched: { [week]: { assign, locked: [], status: "draft" } },
    closed: {},
    ...extra,
  };
}

function codes(state: RotaState) {
  return analyze(state, state.week, "he").labor.map((note) => note.code);
}

function streak(state: RotaState) {
  return analyze(state, state.week, "he").labor.filter((note) => note.code === "consecutive_days");
}

function peer(day: number, weekOffset = 0): PeerShift {
  return {
    key: `${day}|d`,
    day,
    start: day * 24 + 8 + weekOffset * 24,
    end: day * 24 + 16 + weekOffset * 24,
    label: "Day",
    minRest: 0,
    maxHours: 200,
    maxDayHours: 0,
    maxShift: 16,
    weekOffset,
  };
}

describe("seven consecutive days", () => {
  it("notes Sunday through Saturday and still publishes", () => {
    const state = stateFor(assignDays([0, 1, 2, 3, 4, 5, 6]), {}, { shifts: [shifts[0]] });
    const found = streak(state);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("7 ימים ברצף (11.10–17.10)");
    expect(analyze(state, week, "he").violations).toHaveLength(0);
    expect(publishCheck(state).ready).toBe(true);
    expect(publishWeek(state, { id: "v", at: "2026-10-18T00:00:00.000Z", by: "manager" }).sched[week]?.status).toBe("published");
  });

  it("allows six days and a manual seventh", () => {
    const state = stateFor(assignDays([0, 1, 2, 3, 4, 5]), {}, { shifts: [shifts[0]] });
    expect(streak(state)).toHaveLength(0);
    const saturday = slots(state, week).find((slot) => slot.key === "6|d");
    const mine = slots(state, week).filter((slot) => slot.day < 6);
    expect(dynamicReason(state, person(), saturday!, mine)).toBeNull();
    const added = addEmployee(state, "6|d", "a");
    expect(added.sched[week]?.assign["6|d"]).toEqual(["a"]);
    expect(streak(added)[0]?.message).toContain("7 ימים ברצף (11.10–17.10)");
  });

  it("notes the previous Saturday through this Friday", () => {
    const previous = addDays(week, -7);
    const state = stateFor(assignDays([0, 1, 2, 3, 4, 5]), {
      sched: {
        [previous]: { assign: assignDays([6]), locked: [], status: "draft" },
        [week]: { assign: assignDays([0, 1, 2, 3, 4, 5]), locked: [], status: "draft" },
      },
    });
    expect(streak(state)[0]?.message).toContain("7 ימים ברצף (10.10–16.10)");
  });

  it("notes Monday through the next Sunday", () => {
    const next = addDays(week, 7);
    const state = stateFor(assignDays([1, 2, 3, 4, 5, 6]), {
      sched: {
        [week]: { assign: assignDays([1, 2, 3, 4, 5, 6]), locked: [], status: "draft" },
        [next]: { assign: assignDays([0]), locked: [], status: "draft" },
      },
    });
    expect(streak(state)[0]?.message).toContain("7 ימים ברצף (12.10–18.10)");
  });

  it("notes Tuesday through the next Monday", () => {
    const next = addDays(week, 7);
    const state = stateFor(assignDays([2, 3, 4, 5, 6]), {
      sched: {
        [week]: { assign: assignDays([2, 3, 4, 5, 6]), locked: [], status: "draft" },
        [next]: { assign: assignDays([0, 1]), locked: [], status: "draft" },
      },
    });
    expect(streak(state)[0]?.message).toContain("7 ימים ברצף (13.10–19.10)");
  });

  it("counts a shift at another site", () => {
    const state = stateFor(assignDays([1, 2, 3, 4, 5, 6]), { peers: { a: [peer(0)] } });
    expect(streak(state)[0]?.message).toContain("7 ימים ברצף (11.10–17.10)");
  });

  it("fills only six days when the agreement allows seven", () => {
    const state = stateFor({}, {}, { shifts: [{ id: "d", name: "Day", start: "08:00", end: "16:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] }] });
    generate(state, week);
    const days = new Set(
      Object.entries(state.sched[week]?.assign ?? {})
        .filter(([, ids]) => ids.includes("a"))
        .map(([key]) => key.split("|")[0]),
    );
    expect(days.size).toBe(6);
    expect(streak(state)).toHaveLength(0);
  });

  it("lists seven days first and keeps each law together", () => {
    const second = person({ id: "b", name: "Noa" });
    const state = stateFor(
      { ...assignDays([0, 1, 2, 3, 4, 5, 6]), "0|over": ["b"] },
      { emps: [person(), second] },
      { shifts: [shifts[0], shifts[3]] },
    );
    expect(codes(state)).toEqual(["consecutive_days", "weekly_rest", "day_cap"]);
  });
});

describe("hours of work and rest notes", () => {
  it("notes a week with no 36-hour rest, and stays quiet for a Friday-to-Sunday rest", () => {
    const worked = stateFor(assignDays([0, 1, 2, 3, 4, 5, 6]));
    expect(codes(worked)).toContain("weekly_rest");
    const next = addDays(week, 7);
    const weekend = stateFor(assignDays([0, 1, 2, 3, 4, 5]), {
      sched: {
        [week]: { assign: assignDays([0, 1, 2, 3, 4, 5]), locked: [], status: "draft" },
        [next]: { assign: assignDays([0]), locked: [], status: "draft" },
      },
    });
    expect(codes(weekend)).not.toContain("weekly_rest");
    expect(codes(stateFor(assignDays([0])))).not.toContain("weekly_rest");
  });

  it("notes a gap under eight hours and a day over twelve", () => {
    const tight = stateFor({ "0|n": ["a"], "1|d": ["a"] });
    expect(codes(tight)).toContain("daily_gap");
    const sameDay = stateFor({ "0|d": ["a"], "0|n": ["a"] });
    expect(codes(sameDay)).not.toContain("daily_gap");
    const midnight: ShiftDefinition = { id: "z", name: "Midnight", start: "00:00", end: "08:00", role: "", req: [0, 1, 0, 0, 0, 0, 0] };
    const eight = stateFor({ "0|d": ["a"], "1|z": ["a"] }, {}, { shifts: [...shifts, midnight] });
    expect(codes(eight)).not.toContain("daily_gap");
    expect(codes(stateFor({ "0|over": ["a"] }))).toContain("day_cap");
    expect(codes(stateFor({ "0|long": ["a"] }))).not.toContain("day_cap");
  });

  it("notes overtime above sixteen hours and night work in two weeks", () => {
    const heavy = stateFor(assignDays([0, 1, 2, 3, 4], "long"), {}, { shifts: [shifts[2]] });
    expect(codes(heavy)).toContain("overtime");
    expect(publishCheck(heavy).ready).toBe(true);
    expect(codes(stateFor(assignDays([0, 1, 2, 3, 4, 5])))).not.toContain("overtime");
    const night: ShiftDefinition = { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [0, 0, 0, 0, 0, 0, 0] };
    function nightWeeks(previousDays: number[], currentDays: number[]) {
      const assignOf = (days: number[]) => Object.fromEntries(days.map((day) => [`${day}|n`, ["a"]]));
      return stateFor(
        {},
        {
          sched: {
            [addDays(week, -7)]: { assign: assignOf(previousDays), locked: [], status: "draft" },
            [week]: { assign: assignOf(currentDays), locked: [], status: "draft" },
          },
        },
        { shifts: [night] },
      );
    }
    expect(codes(nightWeeks([0], [0]))).not.toContain("night_weeks");
    expect(codes(nightWeeks([0, 1, 2, 3], [0, 1, 2]))).not.toContain("night_weeks");
    const eight = nightWeeks([0, 1, 2, 3], [0, 1, 2, 3]);
    expect(codes(eight)).toContain("night_weeks");
    expect(streak(eight)).toHaveLength(0);
    expect(publishCheck(eight).ready).toBe(true);
  });

  it("notes four consecutive Saturdays and stays quiet at three", () => {
    const saturday: ShiftDefinition = { id: "d", name: "Day", start: "08:00", end: "16:00", role: "", req: [0, 0, 0, 0, 0, 0, 1] };
    function onSaturdays(offsets: number[], slotKey = "6|d", shiftList: ShiftDefinition[] = [saturday]) {
      const sched: RotaState["sched"] = {};
      for (const offset of offsets) {
        sched[addDays(week, offset)] = { assign: { [slotKey]: ["a"] }, locked: [], status: "draft" };
      }
      return stateFor({}, { sched }, { shifts: shiftList });
    }
    const four = onSaturdays([-21, -14, -7, 0]);
    expect(codes(four)).toContain("consecutive_shabbat");
    expect(publishCheck(four).ready).toBe(true);
    expect(codes(onSaturdays([-14, -7, 0]))).not.toContain("consecutive_shabbat");
    expect(codes(onSaturdays([-21, -14, 0]))).not.toContain("consecutive_shabbat");
    expect(codes(onSaturdays([-21, -14, -7, 0], "5|d"))).not.toContain("consecutive_shabbat");
    const nights = onSaturdays([-21, -14, -7, 0], "5|n", [shifts[1]]);
    expect(codes(nights)).toContain("consecutive_shabbat");
    const withPeer = onSaturdays([-21, -14, -7]);
    withPeer.sched[week] = { assign: {}, locked: [], status: "draft" };
    withPeer.peers = { a: [peer(6)] };
    expect(codes(withPeer)).toContain("consecutive_shabbat");
  });
});
