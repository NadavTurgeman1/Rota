import { describe, expect, it } from "vitest";
import { slots } from "../domain";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { MANAGER } from "../people/edit";
import { generateWeek, toggleLock } from "../schedule/edit";
import { addJobRole, addShift, removeJobRole, renameJobRole, removeShift, setShiftRequirement, updateBusiness, updateShift } from "./edit";

const dana = { kind: "employee" as const, employeeId: SENTINEL.dana };

describe("business edits", () => {
  it("lets only a manager change settings, and rejects bad values", () => {
    const state = sentinelState("2026-10-11");
    expect(updateBusiness(state, dana, { minRest: 10 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { minRest: -1 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { name: "  " })).toBe(state);
    expect(updateShift(state, MANAGER, SENTINEL.morning, { start: "25:00" })).toBe(state);

    const next = updateBusiness(state, MANAGER, {
      minRest: 10,
      maxDayHours: 12,
      name: " Desk ",
      staffAccess: false,
      constraintStartDay: 0,
      constraintEndDay: 4,
      constraintOpens: "08:00",
      constraintCloses: "18:00",
    });
    expect(next.biz).toMatchObject({
      minRest: 10,
      maxDayHours: 12,
      name: "Desk",
      staffAccess: false,
      constraintStartDay: 0,
      constraintEndDay: 4,
      constraintOpens: "08:00",
      constraintCloses: "18:00",
    });
    expect(updateBusiness(state, MANAGER, { blockLimit: true, maxBlocks: 3 }).biz).toMatchObject({ blockLimit: true, maxBlocks: 3 });
    expect(updateBusiness(state, MANAGER, { maxBlocks: -1 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { maxBlocks: 1.5 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { blockSplit: "weekday", weekdayBlocks: 2, weekendBlocks: 1 }).biz).toMatchObject({
      blockSplit: "weekday",
      weekdayBlocks: 2,
      weekendBlocks: 1,
    });
    expect(updateBusiness(state, MANAGER, { weekendBlocks: -1 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { blockSplit: "general" }).biz.blockSplit).toBeUndefined();
    expect(updateBusiness(state, MANAGER, { constraintStartDay: 7 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { constraintOpens: "25:00" })).toBe(state);
    expect(state.biz.minRest).not.toBe(10);
  });

  it("closing a day removes its slot from the week", () => {
    const state = sentinelState("2026-10-11");
    const key = `5|${SENTINEL.night}`;
    expect(slots(state, state.week).some((slot) => slot.key === key)).toBe(true);
    const closed = setShiftRequirement(state, MANAGER, SENTINEL.night, 5, 0);
    expect(slots(closed, closed.week).some((slot) => slot.key === key)).toBe(false);
    expect(generateWeek(closed).sched[closed.week].assign[key]).toBeUndefined();
  });

  it("adds a shift every agreement allows, and removes it everywhere", () => {
    const state = generateWeek(sentinelState("2026-10-11"));
    const added = addShift(state, MANAGER, { id: "s-extra", name: "Extra" });
    expect(added.biz.shifts.at(-1)).toMatchObject({ id: "s-extra", req: [1, 1, 1, 1, 1, 1, 1] });
    expect(added.emps.find((employee) => employee.id === SENTINEL.dana)?.grid?.[0]).toContain("s-extra");

    const night = `1|${SENTINEL.night}`;
    const someone = state.sched[state.week].assign[night][0];
    const locked = toggleLock(state, night, someone);
    const removed = removeShift(locked, MANAGER, SENTINEL.night);
    expect(removed.biz.shifts.map((shift) => shift.id)).not.toContain(SENTINEL.night);
    expect(removed.sched[removed.week].assign[night]).toBeUndefined();
    expect(removed.sched[removed.week].locked.some((token) => token.startsWith(night))).toBe(false);
    expect(removed.emps.every((employee) => !(employee.grid ?? []).flat().includes(SENTINEL.night))).toBe(true);

    const single = { ...state, biz: { ...state.biz, shifts: state.biz.shifts.slice(0, 1) } };
    expect(removeShift(single, MANAGER, single.biz.shifts[0].id)).toBe(single);
  });

  it("keeps one role name, and clears it from shifts and people when it is removed", () => {
    const state = sentinelState("2026-10-11");
    const added = addJobRole(addJobRole(addJobRole(state, MANAGER, "  סיור  "), MANAGER, "סיור"), dana, "חמוש");
    expect(added.biz.roles).toEqual(["סיור"]);
    const both = addJobRole(added, MANAGER, "חמוש");
    const morning = updateShift(both, MANAGER, SENTINEL.morning, { role: "חמוש" });
    const person = morning.emps.find((employee) => employee.id === SENTINEL.dana)!;
    person.role = "חמוש";
    person.secondaryRoles = ["סיור"];
    const removed = removeJobRole(morning, MANAGER, "חמוש");
    expect(removed.biz.roles).toEqual(["סיור"]);
    expect(removed.biz.shifts.find((shift) => shift.id === SENTINEL.morning)?.role).toBe("");
    expect(removed.emps.find((employee) => employee.id === SENTINEL.dana)).toMatchObject({
      role: "",
      secondaryRoles: ["סיור"],
    });
    expect(removeJobRole(removed, dana, "סיור")).toBe(removed);
  });

  it("renames a role on the catalog, the shifts, and the people who hold it", () => {
    const state = sentinelState("2026-10-11");
    const added = addJobRole(addJobRole(state, MANAGER, "סיור"), MANAGER, "חמוש");
    const morning = updateShift(added, MANAGER, SENTINEL.morning, { role: "חמוש" });
    const person = morning.emps.find((employee) => employee.id === SENTINEL.dana)!;
    person.role = "חמוש";
    person.secondaryRoles = ["סיור"];
    const renamed = renameJobRole(morning, MANAGER, "חמוש", "  מאבטח  ");
    expect(renamed.biz.roles).toEqual(["סיור", "מאבטח"]);
    expect(renamed.biz.shifts.find((shift) => shift.id === SENTINEL.morning)?.role).toBe("מאבטח");
    expect(renamed.emps.find((employee) => employee.id === SENTINEL.dana)).toMatchObject({
      role: "מאבטח",
      secondaryRoles: ["סיור"],
    });
    expect(renameJobRole(renamed, MANAGER, "מאבטח", "סיור")).toBe(renamed);
    expect(renameJobRole(renamed, dana, "מאבטח", "קופאי")).toBe(renamed);
  });
});
