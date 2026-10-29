import { describe, expect, it } from "vitest";
import type { Employee, RotaState, ShiftDefinition } from "../domain";
import { blockBuckets, overBucketIds } from "./blocks";
import { withinBlockLimit } from "./edit";

const days = [0, 1, 2, 3, 4, 5, 6];

function shift(id: string, name: string, start: string, end: string): ShiftDefinition {
  return { id, name, start, end, role: "", req: [1, 1, 1, 1, 1, 1, 1] };
}

function person(ids: string[], custom?: Employee["customBlocks"]): Employee {
  return {
    id: "p",
    name: "Dana",
    contact: "",
    role: "",
    quals: "",
    perWeek: 5,
    maxHours: 0,
    pref: [],
    active: true,
    grid: days.map(() => [...ids]),
    ...(custom ? { customBlocks: custom } : {}),
  };
}

function state(shifts: ShiftDefinition[], employee = person(shifts.map((item) => item.id))): RotaState {
  return {
    week: "2026-10-11",
    biz: {
      name: "A",
      type: "t",
      minRest: 11,
      maxHours: 48,
      maxShift: 12,
      assume: true,
      blockLimit: true,
      maxBlocks: 0,
      shifts,
    },
    emps: [employee],
    avail: {},
    sched: {},
    closed: {},
  };
}

function grid(shifts: ShiftDefinition[], drop: { day: number; id: string }[] = []): string[][] {
  return days.map((day) => shifts.map((item) => item.id).filter((id) => !drop.some((cell) => cell.day === day && cell.id === id)));
}

const morning = shift("m", "Morning", "06:00", "14:00");
const afternoon = shift("a", "Afternoon", "14:00", "22:00");
const night = shift("n", "Night", "22:00", "06:00");
const shifts = [morning, afternoon, night];

describe("block splits", () => {
  it("keeps one weekly number when the split is general", () => {
    const site = state(shifts);
    site.biz.maxBlocks = 1;
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }]))).toBe(true);
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 1, id: "a" }]))).toBe(false);
  });

  it("counts Sunday through Thursday apart from Friday and Saturday", () => {
    const site = state(shifts);
    site.biz.blockSplit = "weekday";
    site.biz.weekdayBlocks = 1;
    site.biz.weekendBlocks = 0;
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }]))).toBe(true);
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 4, id: "m" }]))).toBe(false);
    expect(overBucketIds(site, "p", grid(shifts, [{ day: 5, id: "a" }]))).toEqual(["weekend"]);
    expect(overBucketIds(site, "p", grid(shifts, [{ day: 6, id: "n" }]))).toEqual(["weekend"]);
  });

  it("counts each shift across the week", () => {
    const site = state(shifts);
    site.biz.blockSplit = "shift";
    site.biz.shiftBlocks = { m: 1, a: 0, n: 2 };
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 3, id: "n" }]))).toBe(true);
    expect(overBucketIds(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 1, id: "m" }]))).toEqual(["m"]);
    expect(overBucketIds(site, "p", grid(shifts, [{ day: 2, id: "a" }]))).toEqual(["a"]);
  });

  it("uses the person's numbers and still follows the site split", () => {
    const site = state(shifts, person(shifts.map((item) => item.id), { max: 1, weekday: 9, weekend: 9, shifts: { m: 9, a: 9, n: 9 } }));
    site.biz.maxBlocks = 5;
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }]))).toBe(true);
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 1, id: "m" }]))).toBe(false);
    site.biz.blockSplit = "weekday";
    site.biz.weekdayBlocks = 0;
    expect(withinBlockLimit(site, "p", grid(shifts, [{ day: 0, id: "m" }, { day: 1, id: "m" }]))).toBe(true);
  });

  it("spends the primary site's shift caps when the grid belongs to another site", () => {
    const early = shift("early", "Early", "07:00", "15:00");
    const late = shift("late", "Late", "15:00", "23:00");
    const overnight = shift("overnight", "Overnight", "23:00", "07:00");
    const reliefShifts = [early, late, overnight];
    const relief = state(reliefShifts);
    const home = state([
      shift("home-m", "Morning", "06:00", "14:00"),
      shift("home-m2", "Morning late", "10:00", "18:00"),
      shift("home-a", "Afternoon", "14:00", "22:00"),
    ]).biz;
    home.blockSplit = "shift";
    home.shiftBlocks = { "home-m": 1, "home-m2": 0, "home-a": 1 };
    relief.biz.blockLimit = false;
    relief.biz.maxBlocks = 20;
    const buckets = blockBuckets(relief, "p", grid(reliefShifts, [{ day: 0, id: "early" }, { day: 1, id: "late" }]), home);
    expect(buckets.find((bucket) => bucket.id === "home-m")?.used).toBe(1);
    expect(buckets.find((bucket) => bucket.id === "home-m2")?.used).toBe(0);
    expect(buckets.find((bucket) => bucket.id === "home-a")?.used).toBe(1);
    expect(withinBlockLimit(relief, "p", grid(reliefShifts, [{ day: 0, id: "early" }]), home)).toBe(true);
    expect(withinBlockLimit(relief, "p", grid(reliefShifts, [{ day: 0, id: "early" }, { day: 2, id: "early" }]), home)).toBe(false);
    expect(overBucketIds(relief, "p", grid(reliefShifts, [{ day: 3, id: "overnight" }]), home)).toEqual(["unmatched:overnight"]);
  });
});
