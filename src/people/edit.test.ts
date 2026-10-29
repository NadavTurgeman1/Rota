import { describe, expect, it } from "vitest";
import { agreementAllows } from "../domain";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { generateWeek } from "../schedule/edit";
import {
  MANAGER,
  addEmployeeRecord,
  agreementCell,
  availabilityCell,
  copyAvailability,
  setAgreement,
  setPreference,
  setWholeAgreement,
  grantConstraintException,
  hasConstraintGrant,
  replaceAvailability,
  setAvailability,
  setWholeAvailability,
  updateEmployee,
} from "./edit";

const danaActor = { kind: "employee" as const, employeeId: SENTINEL.dana };

function danaGrid(state: ReturnType<typeof sentinelState>) {
  return state.emps.find((employee) => employee.id === SENTINEL.dana)?.grid;
}

describe("people edits", () => {
  it("turns festival observance on with Shabbat and clears it when Shabbat is off", () => {
    const open = sentinelState("2026-10-11");
    const on = updateEmployee(open, MANAGER, SENTINEL.dana, { observesShabbat: true });
    expect(on.emps.find((employee) => employee.id === SENTINEL.dana)).toMatchObject({ observesShabbat: true, observesHolidays: true });
    expect(updateEmployee(open, MANAGER, SENTINEL.dana, { observesHolidays: true })).toBe(open);
    const festivalsOff = updateEmployee(on, MANAGER, SENTINEL.dana, { observesHolidays: false });
    const kept = festivalsOff.emps.find((employee) => employee.id === SENTINEL.dana);
    expect(kept?.observesShabbat).toBe(true);
    expect(kept?.observesHolidays).toBeUndefined();
    expect(agreementCell(festivalsOff, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("shabbat");
    expect(agreementCell(festivalsOff, SENTINEL.dana, 5, SENTINEL.morning)).toBe("allowed");
    expect(agreementCell(festivalsOff, SENTINEL.dana, 6, SENTINEL.morning)).toBe("shabbat");
    expect(setAgreement(festivalsOff, MANAGER, SENTINEL.dana, 5, SENTINEL.afternoon, false)).toBe(festivalsOff);
    expect(availabilityCell(festivalsOff, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("shabbat");
    expect(availabilityCell(festivalsOff, SENTINEL.dana, 5, SENTINEL.morning)).toBe("available");
    const cleared = setWholeAgreement(festivalsOff, MANAGER, SENTINEL.dana, false);
    expect(agreementCell(cleared, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("shabbat");
    expect(danaGrid(cleared)?.[5]).toEqual([SENTINEL.afternoon]);
    expect(danaGrid(cleared)?.[0]).toEqual([]);
    const off = updateEmployee(cleared, MANAGER, SENTINEL.dana, { observesShabbat: false });
    const person = off.emps.find((employee) => employee.id === SENTINEL.dana);
    expect(person?.observesShabbat).toBeUndefined();
    expect(person?.observesHolidays).toBeUndefined();
    expect(agreementCell(off, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("allowed");
    expect(agreementCell(off, SENTINEL.dana, 0, SENTINEL.morning)).toBe("excluded");
    expect(availabilityCell(off, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("available");
  });

  it("locks a festival shift in that week's constraints and leaves the agreement open", () => {
    const week = sentinelState("2026-09-21");
    const on = updateEmployee(week, MANAGER, SENTINEL.dana, { observesShabbat: true, observesHolidays: true });
    expect(agreementCell(on, SENTINEL.dana, 0, SENTINEL.afternoon)).toBe("allowed");
    expect(availabilityCell(on, SENTINEL.dana, 0, SENTINEL.afternoon)).toBe("holiday");
    expect(availabilityCell(on, SENTINEL.dana, 5, SENTINEL.afternoon)).toBe("shabbat");
    expect(availabilityCell(on, SENTINEL.dana, 0, SENTINEL.morning)).toBe("available");
    expect(setAvailability(on, MANAGER, SENTINEL.dana, 0, SENTINEL.afternoon, false)).toBe(on);
    const marked = setAvailability(on, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false);
    expect(availabilityCell(marked, SENTINEL.dana, 0, SENTINEL.morning)).toBe("unavailable");
    expect(availabilityCell(marked, SENTINEL.dana, 0, SENTINEL.afternoon)).toBe("holiday");
  });

  it("stores a shift preference without closing the agreement", () => {
    const open = sentinelState("2026-10-11");
    const dana = open.emps.find((employee) => employee.id === SENTINEL.dana);
    expect(dana?.pref ?? []).not.toContain(SENTINEL.morning);
    const preferred = setPreference(open, MANAGER, SENTINEL.dana, SENTINEL.morning, true);
    expect(preferred.emps.find((employee) => employee.id === SENTINEL.dana)?.pref).toContain(SENTINEL.morning);
    expect(agreementCell(preferred, SENTINEL.dana, 0, SENTINEL.morning)).toBe("allowed");
    const cleared = setPreference(preferred, danaActor, SENTINEL.dana, SENTINEL.morning, false);
    expect(cleared).toBe(preferred);
  });

  it("drops a closed agreement cell from the generated week", () => {
    const open = sentinelState("2026-10-11");
    const sundayMorning = `0|${SENTINEL.morning}`;
    expect(generateWeek(open).sched[open.week]?.assign[sundayMorning]).toContain(SENTINEL.dana);

    const closed = setAgreement(open, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false);
    expect(agreementCell(closed, SENTINEL.dana, 0, SENTINEL.morning)).toBe("excluded");
    expect(generateWeek(closed).sched[open.week]?.assign[sundayMorning]).not.toContain(SENTINEL.dana);
  });

  it("hides a shift for this week without rewriting the agreement", () => {
    const open = sentinelState("2026-10-11");
    const before = structuredClone(danaGrid(open));
    const hidden = setAvailability(open, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false);
    expect(danaGrid(hidden)).toEqual(before);
    expect(availabilityCell(hidden, SENTINEL.dana, 0, SENTINEL.morning)).toBe("unavailable");
    expect(agreementCell(hidden, SENTINEL.dana, 0, SENTINEL.morning)).toBe("allowed");

    const sundayMorning = `0|${SENTINEL.morning}`;
    expect(generateWeek(hidden).sched[open.week]?.assign[sundayMorning]).not.toContain(SENTINEL.dana);
    expect(generateWeek(open).sched[open.week]?.assign[sundayMorning]).toContain(SENTINEL.dana);
  });

  it("refuses to open a shift the agreement excludes", () => {
    const open = sentinelState("2026-10-11");
    expect(setAvailability(open, MANAGER, SENTINEL.dana, 0, SENTINEL.night, true)).toBe(open);
    expect(availabilityCell(open, SENTINEL.dana, 0, SENTINEL.night)).toBe("forbidden");
  });

  it("refuses an agreement cell on a day the site is closed", () => {
    const open = sentinelState("2026-10-11");
    const night = open.biz.shifts.find((shift) => shift.id === SENTINEL.night)!;
    night.req = night.req.map((count, day) => (day === 0 ? 0 : count));
    expect(setAgreement(open, MANAGER, SENTINEL.dana, 0, SENTINEL.night, true)).toBe(open);
    expect(agreementCell(open, SENTINEL.dana, 0, SENTINEL.night)).toBe("closed");
  });

  it("copies last week's availability and still leaves the agreement alone", () => {
    const open = sentinelState("2026-10-11");
    const before = structuredClone(danaGrid(open));
    const copied = copyAvailability(open, MANAGER, SENTINEL.dana);
    expect(danaGrid(copied)).toEqual(before);
    expect(copied.avail[open.week]?.[SENTINEL.dana]?.[0]).toEqual([SENTINEL.morning, SENTINEL.afternoon]);
    expect(copied.avail[open.week]?.[SENTINEL.dana]?.[2]).toEqual([]);
    expect(copied.avail["2026-10-04"][SENTINEL.dana][0]).toContain(SENTINEL.night);
  });

  it("lets an employee submit their own week and blocks the agreement", () => {
    const open = sentinelState("2026-10-11");
    expect(setAgreement(open, danaActor, SENTINEL.dana, 0, SENTINEL.morning, false)).toBe(open);
    expect(setAvailability(open, danaActor, SENTINEL.yossi, 0, SENTINEL.morning, false)).toBe(open);

    const own = setAvailability(open, danaActor, SENTINEL.dana, 1, SENTINEL.morning, false);
    expect(own.avail[open.week]?.[SENTINEL.dana]?.[1]).not.toContain(SENTINEL.morning);
    expect(agreementAllows(own.emps.find((employee) => employee.id === SENTINEL.dana)!, 1, SENTINEL.morning)).toBe(true);
  });

  it("stops a weekly block once the site cap is full", () => {
    const open = sentinelState("2026-10-11");
    open.biz.blockLimit = true;
    open.biz.maxBlocks = 1;
    const once = setAvailability(open, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false);
    expect(availabilityCell(once, SENTINEL.dana, 0, SENTINEL.morning)).toBe("unavailable");
    expect(setAvailability(once, MANAGER, SENTINEL.dana, 1, SENTINEL.morning, false)).toBe(once);
    expect(setWholeAvailability(once, MANAGER, SENTINEL.dana, false)).toBe(once);
    const marked = setWholeAvailability(once, MANAGER, SENTINEL.dana, true);
    expect(availabilityCell(marked, SENTINEL.dana, 0, SENTINEL.morning)).toBe("available");
    expect(availabilityCell(marked, SENTINEL.dana, 1, SENTINEL.afternoon)).toBe("available");
  });

  it("lets a manager lift the block cap for one person and week", () => {
    const open = sentinelState("2026-10-11");
    expect(hasConstraintGrant(open, SENTINEL.dana)).toBe(false);
    const granted = grantConstraintException(open, SENTINEL.dana, true);
    expect(hasConstraintGrant(granted, SENTINEL.dana)).toBe(true);
    expect(hasConstraintGrant(granted, SENTINEL.yossi)).toBe(false);
    expect(hasConstraintGrant(grantConstraintException(granted, SENTINEL.dana, false), SENTINEL.dana)).toBe(false);
  });

  it("updates the profile and keeps an inactive employee out of generation", () => {
    const open = sentinelState("2026-10-11");
    const edited = updateEmployee(open, MANAGER, SENTINEL.dana, { contact: "dana@sentinel.test", perWeek: 3, active: false });
    const dana = edited.emps.find((employee) => employee.id === SENTINEL.dana)!;
    expect(dana.contact).toBe("dana@sentinel.test");
    expect(dana.perWeek).toBe(3);
    expect(dana.active).toBe(false);
    expect(danaGrid(edited)).toEqual(danaGrid(open));

    const assignments = Object.values(generateWeek(edited).sched[open.week]?.assign ?? {});
    expect(assignments.every((ids) => !ids.includes(SENTINEL.dana))).toBe(true);
    expect(updateEmployee(open, danaActor, SENTINEL.dana, { active: false })).toBe(open);
  });

  it("adds a person with every shift the site runs already in the agreement", () => {
    const open = sentinelState("2026-10-11");
    open.biz.shifts[0].req[6] = 0;
    const added = addEmployeeRecord(open, MANAGER, { id: "new-guard", name: "  Lior  " });
    const lior = added.emps.find((employee) => employee.id === "new-guard")!;
    const ids = open.biz.shifts.map((shift) => shift.id);
    expect(lior.name).toBe("Lior");
    expect(lior.perWeek).toBe(5);
    expect(lior.maxHours).toBe(0);
    expect(lior.grid?.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5].map(() => ids));
    expect(lior.grid?.[6]).toEqual(ids.slice(1));
    expect(addEmployeeRecord(open, danaActor, { id: "other", name: "Noa Two" })).toBe(open);
  });

  it("selects or clears the whole agreement and trims submitted availability on clear", () => {
    const open = sentinelState("2026-10-11");
    const cleared = setWholeAgreement(open, MANAGER, SENTINEL.dana, false);
    expect(danaGrid(cleared)).toEqual([[], [], [], [], [], [], []]);
    const all = setWholeAgreement(cleared, MANAGER, SENTINEL.dana, true);
    expect(danaGrid(all)?.every((day) => day.length === open.biz.shifts.length)).toBe(true);
    expect(setWholeAgreement(all, MANAGER, SENTINEL.dana, true)).toBe(all);
    expect(setWholeAgreement(open, danaActor, SENTINEL.dana, false)).toBe(open);

    open.avail[open.week] = { [SENTINEL.dana]: [0, 1, 2, 3, 4, 5, 6].map(() => open.biz.shifts.map((shift) => shift.id)) };
    expect(setWholeAgreement(open, MANAGER, SENTINEL.dana, false).avail[open.week][SENTINEL.dana]).toEqual([[], [], [], [], [], [], []]);
  });

  it("keeps a reinforcement employee's constraints unchanged away from the primary site", () => {
    const open = sentinelState("2026-10-11");
    const away = {
      ...open,
      siteId: "secondary",
      emps: open.emps.map((employee) => (employee.id === SENTINEL.dana ? { ...employee, homeSiteId: "primary" } : employee)),
    };
    expect(setAvailability(away, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false)).toBe(away);
    expect(setWholeAvailability(away, MANAGER, SENTINEL.dana, false)).toBe(away);
    expect(replaceAvailability(away, MANAGER, SENTINEL.dana, away.week, [[], [], [], [], [], [], []])).toBe(away);

    const home = { ...away, siteId: "primary" };
    expect(setAvailability(home, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false)).not.toBe(home);
  });
});
