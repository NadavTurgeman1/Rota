import { describe, expect, it } from "vitest";
import { addDays, analyze, diffIsEmpty, diffSchedules, ensureSchedule, formatReason, fullShiftCoveredByHours, planCallOff, slotPresence, slots, weekVersions } from "../domain";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import { MANAGER } from "../people/edit";
import {
  addEmployee,
  approveEmergency,
  approveProposal,
  approveReplacement,
  clearSchedule,
  commit,
  copySchedule,
  deleteWeekVersion,
  canPlace,
  hourFixes,
  placementIssue,
  setAssignmentHours,
  generateWeek,
  hasDraftAssignments,
  pasteSchedule,
  scheduleIssuesOpen,
  generateWithReport,
  goToWeek,
  isLocked,
  moveEmployee,
  placementWarning,
  proposalsFor,
  publishCheck,
  publishWeek,
  redo,
  removeEmployee,
  reportCallOff,
  restoreWeekVersion,
  revertToDraft,
  swapInSlot,
  toggleLock,
  undo,
} from "./edit";
import { hourFixLine, pngFileName } from "./display";
import { backupJson, weekExport } from "./export";
import { readDemoSave, writeDemoSave } from "./storage";

function repair(state: ReturnType<typeof sentinelState>) {
  let current = state;
  for (let step = 0; step < 100; step += 1) {
    if (publishCheck(current).ready) return current;
    const report = analyze(current, current.week);
    let progressed = false;
    for (const gap of report.unfilled) {
      if (proposalsFor(current, gap.slot).length > 0) {
        const next = approveProposal(current, gap.slot, 0);
        if (next !== current) {
          current = next;
          progressed = true;
          break;
        }
      }
      const assigned = new Set(current.sched[current.week]?.assign[gap.slot.key] ?? []);
      const candidate = current.emps.find((employee) => {
        if (!employee.active || assigned.has(employee.id)) return false;
        return placementWarning(current, gap.slot, employee.id, "he") === null;
      });
      if (!candidate) continue;
      current = addEmployee(current, gap.slot.key, candidate.id);
      progressed = true;
      break;
    }
    if (!progressed) return current;
  }
  return current;
}

describe("schedule edits", () => {
  it("snaps any date back to Sunday and leaves the current week untouched", () => {
    const state = sentinelState("2026-10-14");
    expect(state.week).toBe("2026-10-11");
    expect(goToWeek(state, "2026-10-17")).toBe(state);
    expect(goToWeek(state, "2026-10-18").week).toBe("2026-10-18");
  });

  it("refuses to publish an empty week", () => {
    const state = sentinelState("2026-10-11");
    expect(publishCheck(state).ready).toBe(false);
    expect(publishWeek(state)).toBe(state);
  });

  it("moves a draft assignment and restores it with undo", () => {
    const state = sentinelState("2026-10-11");
    const morning = `0|${SENTINEL.morning}`;
    const afternoon = `0|${SENTINEL.afternoon}`;
    const added = addEmployee(state, morning, SENTINEL.yossi);
    const moved = moveEmployee(added, morning, SENTINEL.yossi, afternoon);
    expect(moved.sched[state.week]?.assign[morning]).toEqual([]);
    expect(moved.sched[state.week]?.assign[afternoon]).toEqual([SENTINEL.yossi]);

    const undone = undo(commit({ present: added, past: [state], future: [] }, moved));
    expect(undone.present.sched[state.week]?.assign[morning]).toEqual([SENTINEL.yossi]);
    const redone = redo(undone);
    expect(redone.present.sched[state.week]?.assign[afternoon]).toEqual([SENTINEL.yossi]);
  });

  it("locks a published week and opens it again as a draft", () => {
    const bare = sentinelState("2026-10-11");
    bare.biz = {
      ...bare.biz,
      shifts: bare.biz.shifts.map((shift) => ({
        ...shift,
        req: shift.id === SENTINEL.morning ? [1, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0],
      })),
    };
    const staffed = addEmployee(bare, `0|${SENTINEL.morning}`, SENTINEL.yossi);
    expect(publishCheck(staffed).ready).toBe(true);
    const published = publishWeek(staffed);
    expect(published.sched[published.week]?.status).toBe("published");
    expect(removeEmployee(published, `0|${SENTINEL.morning}`, SENTINEL.yossi)).toBe(published);
    const draft = revertToDraft(published);
    expect(draft.sched[draft.week]?.status).toBe("draft");
    expect(removeEmployee(draft, `0|${SENTINEL.morning}`, SENTINEL.yossi).sched[draft.week]?.assign).toEqual({
      [`0|${SENTINEL.morning}`]: [],
    });
  });

  it("publishes the Sentinel week only after the engine's own repairs", () => {
    const generated = generateWeek(sentinelState("2026-10-11"));
    expect(analyze(generated, generated.week).violations).toEqual([]);
    const ready = repair(generated);
    const report = analyze(ready, ready.week);
    const holes = report.unfilled.map((item) => `${item.slot.key} ${item.filled}/${item.slot.required} ${item.why}`);
    expect(holes).toEqual([]);
    expect(report.violations).toEqual([]);
    expect(publishWeek(ready).sched[ready.week]?.status).toBe("published");
  });

  it("explains a contract break in English", () => {
    const night = slots(sentinelState("2026-10-11"), "2026-10-11").find(
      (slot) => slot.day === 0 && slot.shiftId === SENTINEL.night,
    );
    if (!night) throw new Error("missing night slot");
    const placed = sentinelState("2026-10-11");
    ensureSchedule(placed, placed.week).assign[night.key] = [SENTINEL.dana];
    const message = analyze(placed, placed.week, "en").violations[0]?.message ?? "";
    expect(message).toContain("Sunday");
    expect(message).toContain("agreement");
  });

  it("publishes, changes, publishes again, and brings the first version back", () => {
    const ready = repair(generateWeek(sentinelState("2026-10-11")));
    const first = publishWeek(ready, { id: "v1", at: "2026-10-11T08:00:00.000Z", by: "manager" });
    expect(weekVersions(first).map((version) => [version.number, version.reason])).toEqual([[1, "publish"]]);

    let found: { slotKey: string; out: string; swap: string; changed: typeof first } | null = null;
    for (const slot of slots(first, first.week)) {
      for (const out of first.sched[first.week]!.assign[slot.key] ?? []) {
        const without = removeEmployee(revertToDraft(first), slot.key, out);
        const swap = first.emps.find(
          (employee) =>
            employee.id !== out &&
            !(without.sched[without.week]!.assign[slot.key] ?? []).includes(employee.id) &&
            placementWarning(without, slot, employee.id, "he") === null,
        );
        if (!swap) continue;
        const changed = addEmployee(without, slot.key, swap.id);
        if (publishCheck(changed).ready) found = { slotKey: slot.key, out, swap: swap.id, changed };
        if (found) break;
      }
      if (found) break;
    }
    expect(found).not.toBeNull();
    const { slotKey: seat, out, swap, changed } = found!;
    const original = first.sched[first.week]!.assign[seat];
    const second = publishWeek(changed, { id: "v2", at: "2026-10-11T09:00:00.000Z", by: "manager" });
    const [v1, v2] = weekVersions(second);
    expect(v2.number).toBe(2);
    const diff = diffSchedules(v1.schedule, v2.schedule);
    expect(diff.added).toEqual([{ slotKey: seat, employeeId: swap }]);
    expect(diff.removed).toEqual([{ slotKey: seat, employeeId: out }]);

    const employee = { kind: "employee" as const, employeeId: SENTINEL.dana };
    expect(restoreWeekVersion(second, employee, "v1")).toBe(second);
    const restored = restoreWeekVersion(second, MANAGER, "v1");
    expect(restored.sched[restored.week]).toMatchObject({ status: "draft", restoredFrom: 1 });
    expect(restored.sched[restored.week]!.assign[seat]).toEqual(original);
    expect(weekVersions(restored)).toHaveLength(2);

    const third = publishWeek(restored, { id: "v3", at: "2026-10-11T10:00:00.000Z", by: "manager" });
    const v3 = weekVersions(third)[2];
    expect(v3).toMatchObject({ number: 3, reason: "publish", restoredFrom: 1 });
    expect(third.sched[third.week]!.restoredFrom).toBeUndefined();
    expect(diffIsEmpty(diffSchedules(v1.schedule, v3.schedule))).toBe(true);
    v3.schedule.assign[seat] = [];
    expect(third.sched[third.week]!.assign[seat]).toEqual(original);
  });

  it("keeps a locked seat through regeneration and drops a lock the rules no longer allow", () => {
    const state = sentinelState("2026-10-11");
    const plain = generateWeek(state);
    const target = slots(state, state.week).find((slot) => slot.key === `3|${SENTINEL.afternoon}`)!;
    const outsider = state.emps.find(
      (employee) =>
        !(plain.sched[state.week]!.assign[target.key] ?? []).includes(employee.id) &&
        placementWarning(state, target, employee.id, "he") === null,
    )!;
    const placed = addEmployee(state, target.key, outsider.id);
    const locked = toggleLock(placed, target.key, outsider.id);
    expect(isLocked(locked, target.key, outsider.id)).toBe(true);

    const again = generateWithReport(locked);
    expect(again.dropped).toEqual([]);
    expect(again.state.sched[state.week]!.assign[target.key]).toContain(outsider.id);
    expect(isLocked(again.state, target.key, outsider.id)).toBe(true);
    expect(analyze(again.state, state.week).violations).toEqual([]);
    expect(isLocked(toggleLock(again.state, target.key, outsider.id), target.key, outsider.id)).toBe(false);
    expect(isLocked(removeEmployee(again.state, target.key, outsider.id), target.key, outsider.id)).toBe(false);

    const sundayNight = `0|${SENTINEL.night}`;
    const broken = sentinelState("2026-10-11");
    ensureSchedule(broken, broken.week).assign[sundayNight] = [SENTINEL.dana];
    const forced = toggleLock(broken, sundayNight, SENTINEL.dana);
    const report = generateWithReport(forced);
    expect(report.dropped).toEqual([
      { token: `${sundayNight}#${SENTINEL.dana}`, why: "rule", reason: expect.objectContaining({ code: "agreement" }) },
    ]);
    expect(report.state.sched[state.week]!.assign[sundayNight]).not.toContain(SENTINEL.dana);
    expect(report.state.sched[state.week]!.locked).toEqual([]);
  });

  it("records a version when a call-off on a published week is covered", () => {
    const published = publishWeek(repair(generateWeek(sentinelState("2026-10-11"))), {
      id: "v1",
      at: "2026-10-11T08:00:00.000Z",
      by: "manager",
    });
    let covered: ReturnType<typeof publishWeek> | null = null;
    for (const slot of slots(published, published.week)) {
      for (const employeeId of published.sched[published.week]!.assign[slot.key] ?? []) {
        const off = reportCallOff(published, MANAGER, { id: "c1", slotKey: slot.key, employeeId, at: "x", nowHours: -1 });
        const plan = planCallOff(off, slot);
        const stamp = { id: "v2", at: "2026-10-12T08:00:00.000Z", by: "manager" };
        const next = plan.replacements[0]
          ? approveReplacement(off, MANAGER, slot.key, plan.replacements[0].employeeId, stamp)
          : approveEmergency(off, MANAGER, slot.key, { kind: "extension", index: 0 }, stamp);
        if (next !== off) covered = next;
        if (covered) break;
      }
      if (covered) break;
    }
    expect(covered).not.toBeNull();
    const [v1, v2] = weekVersions(covered!);
    expect(v2).toMatchObject({ number: 2, reason: "calloff" });
    expect(diffSchedules(v1.schedule, v2.schedule).calloffs.map((item) => item.id)).toEqual(["c1"]);
    expect(covered!.sched[covered!.week]!.status).toBe("published");
  });

  it("exports only a published week, right to left, with open seats and extensions", () => {
    const draft = repair(generateWeek(sentinelState("2026-10-11")));
    expect(weekExport(draft, "he", "Sentinel Security")).toBeNull();
    const published = publishWeek(draft);
    const table = weekExport(published, "he", "Sentinel Security")!;
    expect(table.dir).toBe("rtl");
    expect(table.title).toBe("Sentinel Security · מטה");
    expect(table.days.map((day) => day.name)[0]).toBe("ראשון");
    expect(table.rows.map((row) => row.shift)).toEqual(["בוקר", "צהריים", "לילה"]);
    expect(table.open).toBe(0);
    const extendedPeople = table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.people.filter((person) => person.hours)));
    expect(extendedPeople.length).toBe(table.extended);
    expect(weekExport(published, "en", "Sentinel Security")!.dir).toBe("ltr");
    expect(pngFileName("ברן", "2026-10-18")).toBe("ברן-18.10-24.10.png");

    const backup = JSON.parse(backupJson(published, { org: "Sentinel Security", at: "2026-10-11T08:00:00.000Z" }));
    expect(backup).toMatchObject({ format: "rota.backup.v1", org: "Sentinel Security" });
    expect(backup.state).toEqual(published);
  });

  it("ignores a broken saved demo", () => {
    expect(readDemoSave("not json")).toBeNull();
    expect(readDemoSave(JSON.stringify({ version: 1, state: { week: "nope" } }))).toBeNull();
    const state = sentinelState("2026-10-11");
    expect(readDemoSave(writeDemoSave(state, "en"))).toEqual({ state, lang: "en" });
  });
});

describe("swapInSlot", () => {
  it("swaps two names in one shift and leaves everything else as it was", () => {
    const generated = generateWeek(sentinelState("2026-10-11"));
    const [key, ids] = Object.entries(generated.sched[generated.week].assign).find(([, people]) => people.length >= 2)!;
    const swapped = swapInSlot(generated, key, ids[0], ids[1]);
    expect(swapped.sched[swapped.week].assign[key]).toEqual([ids[1], ids[0], ...ids.slice(2)]);
    expect(analyze(swapped, swapped.week).counts).toEqual(analyze(generated, generated.week).counts);
    expect(swapInSlot(generated, key, ids[0], ids[0])).toBe(generated);
    expect(swapInSlot(generated, key, ids[0], "nobody")).toBe(generated);
    const published = structuredClone(generated);
    published.sched[published.week].status = "published";
    expect(swapInSlot(published, key, ids[0], ids[1])).toBe(published);
  });
});

describe("pasteSchedule", () => {
  const morning = `0|${SENTINEL.morning}`;
  const afternoon = `0|${SENTINEL.afternoon}`;

  it("copies a chosen week and pastes it onto the week on screen", () => {
    const state = sentinelState("2026-10-18");
    const sourceWeek = addDays(state.week, -14);
    state.sched[sourceWeek] = {
      assign: { [morning]: [SENTINEL.dana, SENTINEL.eli], [afternoon]: [SENTINEL.maya] },
      locked: [`${morning}#${SENTINEL.dana}`],
      status: "published",
      ext: {
        [`${morning}#${SENTINEL.dana}`]: { start: 6, end: 18, groupId: "g", cover: afternoon, groupSize: 2 },
      },
      over: { [`${afternoon}#${SENTINEL.maya}`]: true },
      calloffs: [{ id: "c", slotKey: morning, employeeId: SENTINEL.dana, name: "Dana", at: "2026-10-11T00:00:00.000Z", by: "manager" }],
    };
    state.week = sourceWeek;
    const snapshot = copySchedule(state);
    const target = goToWeek(state, "2026-10-18");
    target.sched[target.week] = { assign: { [`0|${SENTINEL.night}`]: [SENTINEL.yossi] }, locked: [], status: "draft" };
    const pasted = pasteSchedule(target, snapshot);
    const schedule = pasted.sched[target.week];
    expect(schedule.assign[morning]).toEqual([SENTINEL.dana, SENTINEL.eli]);
    expect(schedule.assign[`0|${SENTINEL.night}`]).toBeUndefined();
    expect(schedule.status).toBe("draft");
    expect(schedule.locked).toEqual([`${morning}#${SENTINEL.dana}`]);
    expect(schedule.ext?.[`${morning}#${SENTINEL.dana}`]?.end).toBe(18);
    expect(schedule.over).toEqual({ [`${afternoon}#${SENTINEL.maya}`]: true });
    expect(schedule.calloffs).toEqual([]);
    expect(pasted.sched[sourceWeek].status).toBe("published");
  });

  it("leaves the week alone when there is nothing to paste or the week is published", () => {
    const state = sentinelState("2026-10-18");
    expect(copySchedule(state)).toBeNull();
    expect(pasteSchedule(state, null)).toBe(state);
    const dana = state.emps.find((employee) => employee.id === SENTINEL.dana)!;
    dana.active = false;
    const inactive = { assign: { [morning]: [SENTINEL.dana] }, locked: [], status: "draft" as const };
    expect(pasteSchedule(state, inactive)).toBe(state);
    dana.active = true;
    state.sched[state.week] = { assign: {}, locked: [], status: "published" };
    expect(pasteSchedule(state, inactive)).toBe(state);
  });
});

describe("setAssignmentHours", () => {
  const morning = `0|${SENTINEL.morning}`;

  function sundayOnly() {
    const state = sentinelState("2026-10-11");
    state.biz = {
      ...state.biz,
      shifts: state.biz.shifts.map((shift) => ({
        ...shift,
        req: shift.id === SENTINEL.morning ? [2, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0],
      })),
    };
    state.sched[state.week] = {
      assign: { [morning]: [SENTINEL.dana, SENTINEL.noa] },
      locked: [],
      status: "draft",
    };
    return state;
  }

  it("notes a shortage for the hour one person leaves early, and publishes only after confirmation", () => {
    const state = sundayOnly();
    const next = setAssignmentHours(state, morning, SENTINEL.dana, 6, 13);
    expect(next.sched[state.week].hours?.[`${morning}#${SENTINEL.dana}`]).toEqual({ start: 6, end: 13 });
    const report = analyze(next, next.week);
    expect(report.coverage).toEqual([expect.objectContaining({ start: 13, end: 14, delta: -1 })]);
    expect(report.unfilled).toHaveLength(0);
    expect(report.hours[SENTINEL.dana]).toBe(7);
    expect(report.hours[SENTINEL.noa]).toBe(8);
    expect(publishCheck(next)).toMatchObject({ ready: false, coverage: 1, constraint: 0 });
    expect(publishWeek(next)).toBe(next);
    const published = publishWeek(next, { id: "gap", at: "2026-10-11T08:00:00.000Z", by: "manager" }, { anyway: true });
    expect(published.sched[next.week]?.status).toBe("published");
  });

  it("refuses to publish a seat on a submitted constraint", () => {
    const state = sundayOnly();
    state.avail = { [state.week]: { [SENTINEL.dana]: [[], [], [], [], [], [], []] } };
    expect(publishCheck(state).constraint).toBeGreaterThan(0);
    expect(publishWeek(state, { id: "blocked", at: "2026-10-11T08:00:00.000Z", by: "manager" }, { anyway: true })).toBe(state);
  });

  it("records the shortened hours as a change", () => {
    const state = sundayOnly();
    const next = setAssignmentHours(state, morning, SENTINEL.dana, 6, 13);
    expect(diffSchedules(state.sched[state.week], next.sched[next.week]).extensions).toEqual([
      { slotKey: morning, employeeId: SENTINEL.dana, after: { start: 6, end: 13 } },
    ]);
  });

  it("notes a surplus for an hour past the shift", () => {
    const state = sundayOnly();
    const next = setAssignmentHours(state, morning, SENTINEL.dana, 6, 15);
    expect(analyze(next, next.week).coverage).toEqual([expect.objectContaining({ start: 14, end: 15, delta: 1 })]);
  });

  it("publishes when staggered hours cover every hour of the shift", () => {
    const state = sundayOnly();
    const withDana = setAssignmentHours(state, morning, SENTINEL.dana, 6, 13);
    const withYossi = addEmployee(withDana, morning, SENTINEL.yossi);
    const next = setAssignmentHours(withYossi, morning, SENTINEL.yossi, 13, 14);
    const report = analyze(next, next.week);
    expect(report.coverage).toEqual([]);
    expect(report.violations).toEqual([]);
    expect(report.unfilled).toEqual([]);
    expect(publishCheck(next).ready).toBe(true);
  });

  it("clears the override when the hours match the shift, and refuses a published week", () => {
    const state = sundayOnly();
    const shortened = setAssignmentHours(state, morning, SENTINEL.dana, 6, 13);
    const cleared = setAssignmentHours(shortened, morning, SENTINEL.dana, 6, 14);
    expect(cleared.sched[state.week].hours).toBeUndefined();
    expect(setAssignmentHours(state, morning, SENTINEL.dana, 6, 19)).toBe(state);
    expect(setAssignmentHours(state, morning, SENTINEL.dana, 14, 16)).toBe(state);
    const removed = removeEmployee(shortened, morning, SENTINEL.dana);
    expect(removed.sched[state.week].hours).toBeUndefined();
    shortened.sched[state.week].status = "published";
    expect(setAssignmentHours(shortened, morning, SENTINEL.dana, 6, 12)).toBe(shortened);
  });

  it("treats a 12-hour morning and a 12-hour night as covering the afternoon seat they fill", () => {
    const state = sentinelState("2026-10-11");
    const clocks: Record<string, { start: string; end: string; req: number[] }> = {
      [SENTINEL.morning]: { start: "07:00", end: "15:00", req: [2, 0, 0, 0, 0, 0, 0] },
      [SENTINEL.afternoon]: { start: "15:00", end: "23:00", req: [2, 0, 0, 0, 0, 0, 0] },
      [SENTINEL.night]: { start: "23:00", end: "07:00", req: [1, 0, 0, 0, 0, 0, 0] },
    };
    state.biz = {
      ...state.biz,
      shifts: state.biz.shifts.map((shift) => ({ ...shift, ...clocks[shift.id] })),
    };
    const morning = `0|${SENTINEL.morning}`;
    const afternoon = `0|${SENTINEL.afternoon}`;
    const night = `0|${SENTINEL.night}`;
    state.sched[state.week] = {
      assign: {
        [morning]: [SENTINEL.dana, SENTINEL.noa],
        [afternoon]: [SENTINEL.maya],
        [night]: [SENTINEL.yossi],
      },
      locked: [],
      status: "draft",
    };
    const extended = setAssignmentHours(
      setAssignmentHours(state, morning, SENTINEL.dana, 7, 19),
      night,
      SENTINEL.yossi,
      19,
      31,
    );
    const report = analyze(extended, extended.week);
    expect(report.coverage).toEqual([]);
    expect(report.unfilled).toEqual([]);
    expect(report.violations).toEqual([]);
    const afternoonSlot = slots(extended, extended.week).find((slot) => slot.key === afternoon);
    const morningSlot = slots(extended, extended.week).find((slot) => slot.key === morning);
    expect(afternoonSlot && slotPresence(extended, afternoonSlot)).toBe(2);
    expect(afternoonSlot && fullShiftCoveredByHours(extended, afternoonSlot)).toBe(true);
    expect(morningSlot && fullShiftCoveredByHours(extended, morningSlot)).toBe(false);
    expect(publishCheck(extended).ready).toBe(true);
  });

  it("offers the afternoon worker an earlier start for the hour a morning worker leaves early", () => {
    const state = sentinelState("2026-10-11");
    const clocks: Record<string, { start: string; end: string; req: number[] }> = {
      [SENTINEL.morning]: { start: "07:00", end: "15:00", req: [2, 0, 0, 0, 0, 0, 0] },
      [SENTINEL.afternoon]: { start: "15:00", end: "23:00", req: [2, 0, 0, 0, 0, 0, 0] },
      [SENTINEL.night]: { start: "23:00", end: "07:00", req: [0, 0, 0, 0, 0, 0, 0] },
    };
    state.biz = {
      ...state.biz,
      shifts: state.biz.shifts.map((shift) => ({ ...shift, ...clocks[shift.id] })),
    };
    const morning = `0|${SENTINEL.morning}`;
    const afternoon = `0|${SENTINEL.afternoon}`;
    state.sched[state.week] = {
      assign: {
        [morning]: [SENTINEL.dana, SENTINEL.noa],
        [afternoon]: [SENTINEL.maya, SENTINEL.yossi],
      },
      locked: [],
      status: "draft",
    };
    const next = setAssignmentHours(state, morning, SENTINEL.dana, 7, 14);
    const report = analyze(next, next.week);
    expect(report.coverage).toEqual([expect.objectContaining({ start: 14, end: 15, delta: -1 })]);
    expect(report.unfilled).toEqual([]);
    const morningSlot = slots(next, next.week).find((slot) => slot.key === morning);
    expect(morningSlot && fullShiftCoveredByHours(next, morningSlot)).toBe(false);
    const fixes = hourFixes(next, report.coverage[0]);
    const maya = fixes.find((fix) => fix.employeeId === SENTINEL.maya);
    expect(maya).toMatchObject({ slotKey: afternoon, start: 14, end: 23, edge: "start" });
    expect(hourFixLine(maya!, "he", next)).toContain("צהריים");
    expect(hourFixLine(maya!, "he", next)).toContain("14:00");
    const fixed = setAssignmentHours(next, maya!.slotKey, maya!.employeeId, maya!.start, maya!.end);
    expect(analyze(fixed, fixed.week).coverage).toEqual([]);
    expect(publishCheck(fixed).ready).toBe(true);
  });

  it("offers a night worker an earlier start for the afternoon hours a capped morning shift cannot cover", () => {
    const state = sentinelState("2026-10-11");
    state.biz = {
      ...state.biz,
      shifts: state.biz.shifts.map((shift) => ({
        ...shift,
        req: [2, 0, 0, 0, 0, 0, 0],
      })),
    };
    const morning = `0|${SENTINEL.morning}`;
    const afternoon = `0|${SENTINEL.afternoon}`;
    const night = `0|${SENTINEL.night}`;
    state.sched[state.week] = {
      assign: {
        [morning]: [SENTINEL.dana, SENTINEL.noa],
        [afternoon]: [SENTINEL.maya],
        [night]: [SENTINEL.yossi, SENTINEL.tal],
      },
      locked: [],
      status: "draft",
    };
    const next = setAssignmentHours(state, morning, SENTINEL.dana, 6, 18);
    const gap = analyze(next, next.week).coverage.find((item) => item.delta < 0);
    expect(gap).toMatchObject({ start: 18, end: 22, delta: -1 });
    const yossi = hourFixes(next, gap!).find((fix) => fix.employeeId === SENTINEL.yossi);
    expect(yossi).toMatchObject({ slotKey: night, start: 18, end: 30, edge: "start" });
    const fixed = setAssignmentHours(next, yossi!.slotKey, yossi!.employeeId, yossi!.start, yossi!.end);
    const report = analyze(fixed, fixed.week);
    expect(report.coverage).toEqual([]);
    expect(report.unfilled).toEqual([]);
    const afternoonSlot = slots(fixed, fixed.week).find((slot) => slot.key === afternoon);
    expect(afternoonSlot && fullShiftCoveredByHours(fixed, afternoonSlot)).toBe(true);
  });
});

describe("clearSchedule", () => {
  it("removes every assigned person from a draft", () => {
    const state = sentinelState("2026-10-18");
    const morning = `0|${SENTINEL.morning}`;
    const token = `${morning}#${SENTINEL.dana}`;
    state.sched[state.week] = {
      assign: { [morning]: [SENTINEL.dana] },
      locked: [token],
      status: "draft",
      restoredFrom: 2,
      ext: {
        [token]: { start: 6, end: 18, groupId: "g", cover: `0|${SENTINEL.afternoon}`, groupSize: 2 },
      },
      over: { [token]: true },
      calloffs: [{ id: "c", slotKey: morning, employeeId: SENTINEL.dana, name: "Dana", at: "2026-10-18T00:00:00.000Z", by: "manager" }],
    };
    expect(hasDraftAssignments(state)).toBe(true);
    expect(scheduleIssuesOpen(state)).toBe(true);
    const cleared = clearSchedule(state);
    expect(cleared.sched[state.week]).toEqual({
      assign: {},
      locked: [],
      status: "draft",
      ext: {},
      over: {},
      calloffs: [],
    });
    expect(hasDraftAssignments(cleared)).toBe(false);
    expect(scheduleIssuesOpen(cleared)).toBe(false);
    expect(scheduleIssuesOpen(addEmployee(cleared, morning, SENTINEL.dana))).toBe(true);
    expect(clearSchedule(cleared)).toBe(cleared);
    state.sched[state.week]!.status = "published";
    expect(clearSchedule(state)).toBe(state);
  });
});

describe("deleteWeekVersion", () => {
  it("removes one frozen version and leaves the live schedule", () => {
    const state = sentinelState("2026-10-18");
    const morning = `0|${SENTINEL.morning}`;
    const frozen = { assign: { [morning]: [SENTINEL.dana] }, locked: [], status: "published" as const };
    state.sched[state.week] = { ...frozen };
    state.versions = {
      [state.week]: [
        { id: "v1", number: 1, at: "2026-10-18T08:00:00.000Z", by: "manager", reason: "publish", schedule: frozen },
        { id: "v2", number: 2, at: "2026-10-18T09:00:00.000Z", by: "manager", reason: "calloff", schedule: frozen },
      ],
      "2026-10-11": [
        { id: "older", number: 1, at: "2026-10-11T08:00:00.000Z", by: "manager", reason: "publish", schedule: frozen },
      ],
    };
    const employee = { kind: "employee" as const, employeeId: SENTINEL.dana };
    expect(deleteWeekVersion(state, employee, "v1")).toBe(state);
    const removed = deleteWeekVersion(state, MANAGER, "v1");
    expect(weekVersions(removed).map((version) => version.id)).toEqual(["v2"]);
    expect(removed.sched[state.week]).toEqual(frozen);
    expect(removed.versions?.["2026-10-11"]).toHaveLength(1);
    const gone = deleteWeekVersion(removed, MANAGER, "v2");
    expect(gone.versions).toEqual({
      "2026-10-11": removed.versions?.["2026-10-11"],
    });
    expect(deleteWeekVersion(gone, MANAGER, "missing")).toBe(gone);
  });
});

describe("who can join a shift", () => {
  it("keeps a free colleague open and names a constraint as unavailable", () => {
    const state = sentinelState("2026-10-11");
    const slot = slots(state, state.week).find((item) => item.day === 0 && item.shiftId === SENTINEL.morning)!;
    state.avail = { [state.week]: { [SENTINEL.maya]: [[], [], [], [], [], [], []] } };
    expect(placementIssue(state, slot, SENTINEL.yossi)).toBeNull();
    const maya = placementIssue(state, slot, SENTINEL.maya);
    expect(maya?.code).toBe("unavailable");
    expect(canPlace(maya)).toBe(false);
    expect(formatReason(maya!, "he")).toBe("סומן באילוצים כלא זמין למשמרת Morning ביום ראשון");
    expect(formatReason({ code: "rest", hours: 0, label: "ראשון צהריים" }, "he")).toBe("אין מנוחה ליד ראשון צהריים");
    expect(canPlace({ code: "weekly_shifts", agreed: 5 })).toBe(true);
  });
});
