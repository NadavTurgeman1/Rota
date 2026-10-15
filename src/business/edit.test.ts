import { describe, expect, it } from "vitest";
import { slots } from "../domain";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { MANAGER } from "../people/edit";
import { generateWeek, toggleLock } from "../schedule/edit";
import { addShift, removeShift, setShiftRequirement, updateBusiness, updateShift } from "./edit";

const dana = { kind: "employee" as const, employeeId: SENTINEL.dana };

describe("business edits", () => {
  it("lets only a manager change settings, and rejects bad values", () => {
    const state = sentinelState("2026-10-11");
    expect(updateBusiness(state, dana, { minRest: 10 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { minRest: -1 })).toBe(state);
    expect(updateBusiness(state, MANAGER, { name: "  " })).toBe(state);
    expect(updateShift(state, MANAGER, SENTINEL.morning, { start: "25:00" })).toBe(state);

    const next = updateBusiness(state, MANAGER, { minRest: 10, maxDayHours: 12, name: " Desk " });
    expect(next.biz).toMatchObject({ minRest: 10, maxDayHours: 12, name: "Desk" });
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
});
