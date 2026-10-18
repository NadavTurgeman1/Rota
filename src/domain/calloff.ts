import { addDays, shiftKind } from "./time";
import { effectiveSlot, shiftById } from "./schedule";
import { dynamicReason, slots, staticReason } from "./rules";
import { isRelief, reliefAllowed } from "./relief";
import { applyCoverage, applyExtra, suggest, suggestExtra } from "./suggest";
import { markDearer, wageRank } from "./wage";
import type { CoverageOption, Employee, ExtraShiftOption, Reason, RotaState, Schedule, Slot } from "./types";

export interface ReplacementCandidate {
  employeeId: string;
  name: string;
  hours: number;
  shifts: number;
  agreed: number;
  /** This shift would land them on the weekly quota. */
  atQuota: boolean;
  prefers: boolean;
  consecutiveNights: number;
  wage?: number;
  dearerThan?: number;
}

export interface RejectedCandidate {
  employeeId: string;
  name: string;
  reason: Reason;
}

export type EmergencyChoice =
  | { kind: "extension"; index: number }
  | { kind: "split"; index: number }
  | { kind: "extra"; index: number };

export interface CallOffPlan {
  replacements: ReplacementCandidate[];
  rejected: RejectedCandidate[];
  /** Shown only when nobody can take the seat within the hard rules. */
  extensions: CoverageOption[];
  splits: CoverageOption[];
  extras: ExtraShiftOption[];
}

export interface CallOffInput {
  id: string;
  slotKey: string;
  employeeId: string;
  at: string;
  by: string;
  /** Hours from Sunday 00:00 of `state.week`. A shift that has already ended cannot be reported. */
  nowHours: number;
}

function cloneState(state: RotaState): RotaState {
  return structuredClone(state);
}

function isNight(state: RotaState, slot: Slot): boolean {
  const shift = shiftById(state, slot.shiftId);
  return shiftKind(shift.start, shift.end) === "n";
}

function heldShifts(state: RotaState, week: string, employeeId: string, exceptKey?: string): Slot[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const mine: Slot[] = [];
  for (const slot of slots(state, week)) {
    if (slot.key === exceptKey) continue;
    if ((schedule.assign[slot.key] ?? []).includes(employeeId)) {
      mine.push(effectiveSlot(schedule, slot, employeeId));
    }
  }
  return mine;
}

function nightDays(state: RotaState, week: string, employeeId: string, extra: Slot | null): number[] {
  const days = new Set<number>();
  const addWeek = (targetWeek: string, shift: number) => {
    const schedule = state.sched[targetWeek];
    if (!schedule) return;
    for (const slot of slots(state, targetWeek)) {
      if (!(schedule.assign[slot.key] ?? []).includes(employeeId) || !isNight(state, slot)) continue;
      days.add(slot.day + shift);
    }
  };
  addWeek(week, 0);
  addWeek(addDays(week, -7), -7);
  addWeek(addDays(week, 7), 7);
  if (extra && isNight(state, extra)) days.add(extra.day);
  return [...days].sort((left, right) => left - right);
}

/** Length of the night run that contains `day`. Zero when this seat is not a night. */
function consecutiveNights(state: RotaState, week: string, employeeId: string, slot: Slot): number {
  if (!isNight(state, slot)) return 0;
  const days = new Set(nightDays(state, week, employeeId, slot));
  let start = slot.day;
  let end = slot.day;
  while (days.has(start - 1)) start -= 1;
  while (days.has(end + 1)) end += 1;
  return end - start + 1;
}

function clearExtensionGroup(schedule: Schedule, slotKey: string, employeeId: string): void {
  const extensions = schedule.ext;
  if (!extensions) return;
  const key = `${slotKey}#${employeeId}`;
  const groupId = extensions[key]?.groupId;
  const next = { ...extensions };
  if (!groupId) delete next[key];
  else {
    for (const [otherKey, value] of Object.entries(next)) {
      if (value.groupId === groupId) delete next[otherKey];
    }
  }
  schedule.ext = next;
}

function clearOverage(schedule: Schedule, slotKey: string, employeeId: string): void {
  const key = `${slotKey}#${employeeId}`;
  if (!schedule.over?.[key]) return;
  const next = { ...schedule.over };
  delete next[key];
  schedule.over = next;
}

function calledOff(schedule: Schedule, slotKey: string): Set<string> {
  return new Set((schedule.calloffs ?? []).filter((item) => item.slotKey === slotKey).map((item) => item.employeeId));
}

/**
 * Legal replacements first. Someone already on this seat in an earlier draft
 * gets no ranking boost: a hard rule always wins.
 * Emergency extensions, splits, and over-quota shifts are filled in only when
 * the legal list is empty, and nothing here writes the schedule.
 */
export function planCallOff(state: RotaState, slot: Slot): CallOffPlan {
  const week = state.week;
  const schedule = state.sched[week];
  const empty: CallOffPlan = { replacements: [], rejected: [], extensions: [], splits: [], extras: [] };
  if (!schedule) return empty;
  const blocked = calledOff(schedule, slot.key);
  const assigned = new Set(schedule.assign[slot.key] ?? []);
  const replacements: ReplacementCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  const deferred: Employee[] = [];
  const consider = (employee: Employee, ignoreWeekly: boolean) => {
    const reason = blockedReason(state, week, employee, slot);
    if (reason && !(ignoreWeekly && reason.code === "weekly_shifts")) {
      rejected.push({ employeeId: employee.id, name: employee.name, reason });
      return;
    }
    const mine = heldShifts(state, week, employee.id);
    const hours = mine.reduce((sum, item) => sum + item.end - item.start, 0) + (slot.end - slot.start);
    const shifts = mine.length + 1;
    replacements.push({
      employeeId: employee.id,
      name: employee.name,
      hours,
      shifts,
      agreed: employee.perWeek,
      atQuota: employee.perWeek > 0 && shifts >= employee.perWeek,
      prefers: (employee.pref ?? []).includes(slot.shiftId),
      consecutiveNights: consecutiveNights(state, week, employee.id, slot),
      wage: employee.hourlyWage ?? 0,
    });
  };

  for (const employee of state.emps) {
    if (assigned.has(employee.id) || blocked.has(employee.id)) continue;
    if (isRelief(employee, state.siteId)) {
      deferred.push(employee);
      continue;
    }
    consider(employee, false);
  }
  if (replacements.length === 0) {
    for (const employee of deferred) {
      if (!reliefAllowed(state, employee)) {
        rejected.push({ employeeId: employee.id, name: employee.name, reason: { code: "home_schedule" } });
        continue;
      }
      consider(employee, true);
    }
  }

  replacements.sort(
    (left, right) =>
      Number(left.atQuota) - Number(right.atQuota) ||
      wageRank(left.wage) - wageRank(right.wage) ||
      left.hours - right.hours ||
      Number(right.prefers) - Number(left.prefers) ||
      left.consecutiveNights - right.consecutiveNights ||
      left.name.localeCompare(right.name, "en"),
  );
  markDearer(replacements, (candidate) => candidate.wage ?? 0);

  if (replacements.length > 0) return { replacements, rejected, extensions: [], splits: [], extras: [] };
  const stillOut = (employeeId: string) => blocked.has(employeeId);
  return {
    replacements,
    rejected,
    extensions: suggest(state, week, slot).filter((option) => !option.parts.some((part) => stillOut(part.id))),
    splits: suggestSplits(state, slot).filter((option) => !option.ext.some((part) => stillOut(part.id))),
    extras: suggestExtra(state, week, slot).filter((option) => !stillOut(option.id)),
  };
}

function blockedReason(state: RotaState, week: string, employee: Employee, slot: Slot): Reason | null {
  return staticReason(state, employee, slot, week) || dynamicReason(state, employee, slot, heldShifts(state, week, employee.id));
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

/**
 * Two people already working that day each take half of the open seat,
 * extending the shift that touches it. Used when the three-shift repair
 * in `suggest` does not apply.
 */
function suggestSplits(state: RotaState, slot: Slot): CoverageOption[] {
  const week = state.week;
  const schedule = state.sched[week];
  if (!schedule) return [];
  const maxLength = state.biz.maxShift || 12;
  const daySlots = slots(state, week)
    .filter((item) => item.day === slot.day)
    .sort((left, right) => left.start - right.start);
  const earlier = daySlots.find((item) => near(item.end, slot.start));
  const later = daySlots.find((item) => near(item.start, slot.end));
  if (!earlier || !later) return [];
  const half = (slot.end - slot.start) / 2;
  if (half <= 0) return [];

  const side = (home: Slot, direction: "forward" | "back") => {
    const found: { employee: Employee; start: number; end: number }[] = [];
    for (const employeeId of schedule.assign[home.key] ?? []) {
      const employee = state.emps.find((item) => item.id === employeeId);
      if (!employee?.active) continue;
      const current = effectiveSlot(schedule, home, employeeId);
      if (schedule.ext?.[`${home.key}#${employeeId}`]) continue;
      const start = direction === "forward" ? current.start : slot.start + half;
      const end = direction === "forward" ? slot.start + half : current.end;
      if (!near(direction === "forward" ? current.end : current.start, direction === "forward" ? slot.start : slot.end)) {
        continue;
      }
      if (end - start > maxLength + 1e-9) continue;
      if (staticReason(state, employee, slot, week)) continue;
      const proposed: Slot = { ...home, start, end };
      if (dynamicReason(state, employee, proposed, heldShifts(state, week, employeeId, home.key))) continue;
      found.push({ employee, start, end });
    }
    return found;
  };

  const left = side(earlier, "forward");
  const right = side(later, "back");
  const options: CoverageOption[] = [];
  const used = new Set<string>();
  for (const first of left) {
    for (const second of right) {
      if (first.employee.id === second.employee.id || used.has(first.employee.id) || used.has(second.employee.id)) {
        continue;
      }
      used.add(first.employee.id);
      used.add(second.employee.id);
      const parts = [
        {
          id: first.employee.id,
          name: first.employee.name,
          slotKey: earlier.key,
          start: first.start,
          end: first.end,
          from: earlier.key,
          extended: true,
        },
        {
          id: second.employee.id,
          name: second.employee.name,
          slotKey: later.key,
          start: second.start,
          end: second.end,
          from: later.key,
          extended: true,
        },
      ];
      options.push({
        parts,
        assign: {
          [earlier.key]: [...(schedule.assign[earlier.key] ?? [])],
          [slot.key]: [...(schedule.assign[slot.key] ?? [])],
          [later.key]: [...(schedule.assign[later.key] ?? [])],
        },
        cover: slot.key,
        ext: parts,
      });
      if (options.length === 2) return options;
    }
  }
  return options;
}

/** Drop a published assignment and keep a record. The contract is not edited. */
export function recordCallOff(state: RotaState, input: CallOffInput): RotaState {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published" || !input.id) return state;
  const slot = slots(state, state.week).find((item) => item.key === input.slotKey);
  if (!slot || !(schedule.assign[slot.key] ?? []).includes(input.employeeId)) return state;
  if (effectiveSlot(schedule, slot, input.employeeId).end <= input.nowHours) return state;
  const employee = state.emps.find((item) => item.id === input.employeeId);
  if (!employee) return state;

  const draft = cloneState(state);
  const next = draft.sched[draft.week];
  next.assign[slot.key] = (next.assign[slot.key] ?? []).filter((id) => id !== input.employeeId);
  next.locked = (next.locked ?? []).filter((token) => token !== `${slot.key}#${input.employeeId}`);
  clearExtensionGroup(next, slot.key, input.employeeId);
  clearOverage(next, slot.key, input.employeeId);
  next.calloffs = [
    ...(next.calloffs ?? []),
    {
      id: input.id,
      slotKey: slot.key,
      employeeId: employee.id,
      name: employee.name,
      at: input.at,
      by: input.by,
    },
  ];
  next.status = "published";
  return draft;
}

/** Put a ranked replacement on the open seat. Stays published. Refuses anyone the plan rejected. */
export function assignReplacement(state: RotaState, slotKey: string, employeeId: string): RotaState {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return state;
  const slot = slots(state, state.week).find((item) => item.key === slotKey);
  if (!slot) return state;
  const chosen = planCallOff(state, slot).replacements.find((item) => item.employeeId === employeeId);
  if (!chosen || (schedule.assign[slot.key] ?? []).includes(employeeId)) return state;
  const draft = cloneState(state);
  const next = draft.sched[draft.week];
  next.assign[slot.key] = [...(next.assign[slot.key] ?? []), employeeId];
  next.status = "published";
  return draft;
}

/**
 * Approve an extension, a split, or an over-quota shift.
 * Refuses to run while a legal replacement still exists.
 */
export function assignEmergency(state: RotaState, slotKey: string, choice: EmergencyChoice): RotaState {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return state;
  const slot = slots(state, state.week).find((item) => item.key === slotKey);
  if (!slot) return state;
  const plan = planCallOff(state, slot);
  if (plan.replacements.length > 0) return state;
  const draft = cloneState(state);
  const next = draft.sched[draft.week];
  if (choice.kind === "extra") {
    const option = plan.extras[choice.index];
    if (!option) return state;
    applyExtra(next, option);
  } else {
    const option = (choice.kind === "extension" ? plan.extensions : plan.splits)[choice.index];
    if (!option) return state;
    applyCoverage(next, option);
  }
  next.status = "published";
  return draft;
}
