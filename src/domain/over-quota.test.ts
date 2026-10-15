import { describe, expect, it } from "vitest";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { publishCheck } from "../schedule/edit";
import { analyze } from "./analyze";
import type { Employee, RotaState } from "./types";

const week = "2026-10-11";
const { morning, afternoon, night } = SENTINEL;

function weekWith(mornings: number[], extra?: { day: number; shiftId: string }): RotaState {
  const state = sentinelState(week);
  const guard: Employee = {
    id: "g",
    name: "Gal",
    contact: "",
    role: "",
    quals: "",
    perWeek: 5,
    maxHours: 0,
    pref: [],
    active: true,
    grid: [0, 1, 2, 3, 4, 5, 6].map(() => [morning, afternoon]),
  };
  state.emps = [guard];
  for (const shift of state.biz.shifts) shift.req = [1, 1, 1, 1, 1, 1, 1];
  const assign: Record<string, string[]> = {};
  for (const day of mornings) assign[`${day}|${morning}`] = ["g"];
  if (extra) assign[`${extra.day}|${extra.shiftId}`] = ["g"];
  state.sched[week] = { assign, locked: [], status: "draft" } as RotaState["sched"][string];
  return state;
}

describe("shifts past the agreed weekly count", () => {
  it("shows up once as an exception and does not count as a violation", () => {
    const report = analyze(weekWith([0, 1, 2, 3, 4, 5]), week);
    expect(report.violations).toEqual([]);
    expect(report.overQuota).toHaveLength(1);
    expect(report.overQuota[0]).toMatchObject({ count: 6, agreed: 5 });
    expect(report.overQuota[0].message).toContain("Gal");
    expect(publishCheck(weekWith([0, 1, 2, 3, 4, 5])).violations).toBe(0);
  });

  it("stays quiet at the agreed count", () => {
    expect(analyze(weekWith([0, 1, 2, 3, 4]), week).overQuota).toEqual([]);
  });

  it("keeps an agreement breach as a violation", () => {
    const report = analyze(weekWith([0, 1], { day: 3, shiftId: night }), week);
    expect(report.violations).toHaveLength(1);
    expect(report.overQuota).toEqual([]);
  });
});
