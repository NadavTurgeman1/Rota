import { describe, expect, it } from "vitest";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { ensureSchedule } from "./schedule";
import { generate } from "./generate";
import { slots, staticReason } from "./rules";
import { suggestExtra } from "./suggest";
import { placementIssue } from "../schedule/edit";
import { MANAGER, updateEmployee } from "../people/edit";

describe("primary and secondary roles", () => {
  function armedWeek() {
    const state = sentinelState("2026-10-11");
    for (const shift of state.biz.shifts) {
      shift.req = [0, 0, 0, 0, 0, 0, 0];
      shift.role = "";
    }
    const morning = state.biz.shifts.find((shift) => shift.id === SENTINEL.morning)!;
    const afternoon = state.biz.shifts.find((shift) => shift.id === SENTINEL.afternoon)!;
    morning.role = "חמוש";
    morning.req[0] = 1;
    afternoon.role = "סיור";
    afternoon.req[0] = 1;
    for (const employee of state.emps) employee.active = employee.id === SENTINEL.dana;
    const dana = state.emps.find((employee) => employee.id === SENTINEL.dana)!;
    dana.role = "חמוש";
    dana.secondaryRoles = ["סיור"];
    dana.quals = "סיור";
    dana.perWeek = 5;
    return state;
  }

  it("fills only the primary role, and still offers a secondary role by hand", () => {
    const state = armedWeek();
    generate(state, state.week);
    const assign = state.sched[state.week].assign;
    expect(assign[`0|${SENTINEL.morning}`]).toEqual([SENTINEL.dana]);
    expect(assign[`0|${SENTINEL.afternoon}`] ?? []).toEqual([]);

    const open = armedWeek();
    ensureSchedule(open, open.week);
    const afternoon = slots(open, open.week).find((slot) => slot.shiftId === SENTINEL.afternoon)!;
    const dana = open.emps.find((employee) => employee.id === SENTINEL.dana)!;
    expect(staticReason(open, dana, afternoon, open.week)).toMatchObject({ code: "role", role: "סיור" });
    expect(staticReason(open, dana, afternoon, open.week, "any")).toBeNull();
    expect(placementIssue(open, afternoon, SENTINEL.dana)).toBeNull();
    expect(suggestExtra(open, open.week, afternoon).map((option) => option.id)).toContain(SENTINEL.dana);

    const qualificationsOnly = armedWeek();
    const person = qualificationsOnly.emps.find((employee) => employee.id === SENTINEL.dana)!;
    delete person.secondaryRoles;
    const slot = slots(qualificationsOnly, qualificationsOnly.week).find((item) => item.shiftId === SENTINEL.afternoon)!;
    expect(staticReason(qualificationsOnly, person, slot, qualificationsOnly.week, "any")?.code).toBe("role");
  });

  it("drops the primary role out of the secondary list", () => {
    const state = sentinelState("2026-10-11");
    const next = updateEmployee(state, MANAGER, SENTINEL.dana, { role: "חמוש", secondaryRoles: ["חמוש", "סיור", "סיור"] });
    expect(next.emps.find((employee) => employee.id === SENTINEL.dana)).toMatchObject({
      role: "חמוש",
      secondaryRoles: ["סיור"],
    });
  });
});
