import { addDays, agreementAllows, type Business, type Employee, type EmployeeProfile, type RotaState } from "../domain";
import { absenceOnWeekDay } from "../domain/absence";
import { isRelief } from "../domain/relief";
import { shabbatBlocks, shiftRest, staffedCount } from "../domain/rest";
import { cleanProfile, employeeProfile } from "../domain/profile";
import { constraintDraftWritable, parseConstraints, type LineOverride } from "../parser/parse";
import { blockedCells, blockBuckets, normalizeCustom } from "./blocks";

/** What the signed-in user may do. `viewer` reads everything and writes nothing. */
export type Actor = { kind: "manager" } | { kind: "viewer" } | { kind: "employee"; employeeId: string };

export const MANAGER: Actor = { kind: "manager" };
export const VIEWER: Actor = { kind: "viewer" };

export interface EmployeePatch {
  name?: string;
  contact?: string;
  phone?: string;
  role?: string;
  quals?: string;
  perWeek?: number;
  maxHours?: number;
  hourlyWage?: number;
  active?: boolean;
  observesShabbat?: boolean;
  observesHolidays?: boolean;
  profile?: Partial<EmployeeProfile>;
  /** `null` clears a personal override and returns the person to the primary site's numbers. */
  customBlocks?: Employee["customBlocks"] | null;
}

function cloneState(state: RotaState): RotaState {
  return structuredClone(state);
}

function findEmployee(state: RotaState, employeeId: string): Employee | undefined {
  return state.emps.find((employee) => employee.id === employeeId);
}

/** A reinforcement employee is edited on the primary site. The secondary site only displays the grid. */
function reliefLocked(state: RotaState, employeeId: string): boolean {
  const employee = findEmployee(state, employeeId);
  return Boolean(employee && isRelief(employee, state.siteId));
}

export const DEFAULT_SHIFTS_PER_WEEK = 5;

/** `null` means the site does not cap weekly blocks. The number is the general cap; other splits use `blockBuckets`. */
export function blockLimitOf(biz: RotaState["biz"]): number | null {
  if (biz.blockLimit !== true) return null;
  const max = biz.maxBlocks ?? 0;
  if (!Number.isFinite(max) || max < 0) return 0;
  return Math.floor(max);
}

/** Shifts the agreement allows on days the site is open this week, apart from Shabbat and festival blocks. */
export function openAvailabilityGrid(state: RotaState, employeeId: string): string[][] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => openConstraintShiftIds(state, employeeId, day));
}

/** Agreement shifts that are staffed this week and not closed by Shabbat or a festival. */
export function openConstraintShiftIds(state: RotaState, employeeId: string, day: number): string[] {
  const employee = findEmployee(state, employeeId);
  if (!employee) return [];
  if (absenceOnWeekDay(state, employeeId, day)) return [];
  return state.biz.shifts
    .filter(
      (shift) =>
        agreementAllows(employee, day, shift.id, shift) &&
        staffedCount(shift, day, state.week) > 0 &&
        shiftRest(employee, shift, day, state.week) === null,
    )
    .map((shift) => shift.id);
}

/** Open shifts missing from `grid`. A missing week is not a submission, so it has no blocks. */
export function countBlocks(state: RotaState, employeeId: string, grid: string[][] | undefined): number {
  return blockedCells(state, employeeId, grid).length;
}

/** `home` is the primary site. It decides the split and the numbers, including on a reinforcement site. */
export function withinBlockLimit(state: RotaState, employeeId: string, grid: string[][], home: Business = state.biz): boolean {
  if (home.blockLimit !== true) return true;
  return blockBuckets(state, employeeId, grid, home).every((bucket) => bucket.used <= bucket.max);
}

/** The manager lifted the block cap for this person and week. */
export function hasConstraintGrant(state: RotaState, employeeId: string, week = state.week): boolean {
  return (state.constraintGrants?.[week] ?? []).includes(employeeId);
}

/** Remember or forget that a person may ignore the block cap for one week. */
export function grantConstraintException(state: RotaState, employeeId: string, allowed: boolean, week = state.week): RotaState {
  const ids = new Set(state.constraintGrants?.[week] ?? []);
  if (allowed) ids.add(employeeId);
  else ids.delete(employeeId);
  const constraintGrants = { ...state.constraintGrants };
  if (ids.size === 0) delete constraintGrants[week];
  else constraintGrants[week] = [...ids].sort();
  const next = { ...state };
  if (Object.keys(constraintGrants).length === 0) delete next.constraintGrants;
  else next.constraintGrants = constraintGrants;
  return next;
}

export function gridWithCell(
  state: RotaState,
  employeeId: string,
  base: string[][] | undefined,
  day: number,
  shiftId: string,
  available: boolean,
): string[][] {
  const source = base ?? openAvailabilityGrid(state, employeeId);
  const row = source.map((shifts) => [...shifts]);
  const dayShifts = new Set(row[day] ?? []);
  if (available) dayShifts.add(shiftId);
  else dayShifts.delete(shiftId);
  row[day] = state.biz.shifts.map((shift) => shift.id).filter((id) => dayShifts.has(id));
  return row;
}

function siteClosed(state: RotaState, day: number, shiftId: string): boolean {
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  return !shift || Number(shift.req[day] || 0) <= 0;
}

function canEditRoster(actor: Actor): boolean {
  return actor.kind === "manager";
}

function canEditAvailability(actor: Actor, employeeId: string): boolean {
  return actor.kind === "manager" || (actor.kind === "employee" && actor.employeeId === employeeId);
}

function gridFrom(employee: Employee, shiftIds: string[]): string[][] {
  if (employee.grid) return employee.grid.map((day) => [...day]);
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    if ((employee.blocked ?? []).includes(day)) return [];
    const allowed = new Set(employee.allowed ?? []);
    return shiftIds.filter((shiftId) => allowed.has(shiftId));
  });
}

function sameCells(left: string[][] | undefined, right: string[][]): boolean {
  if (!left || left.length !== right.length) return false;
  return right.every(
    (day, index) => day.length === (left[index]?.length ?? -1) && day.every((shiftId, cell) => shiftId === left[index][cell]),
  );
}

function nonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Soft shift preference. The generator favors these shifts without forbidding the others. */
export function setPreference(state: RotaState, actor: Actor, employeeId: string, shiftId: string, preferred: boolean): RotaState {
  if (!canEditRoster(actor)) return state;
  const employee = findEmployee(state, employeeId);
  if (!employee || !state.biz.shifts.some((shift) => shift.id === shiftId)) return state;
  const current = employee.pref ?? [];
  const next = preferred ? [...new Set([...current, shiftId])] : current.filter((id) => id !== shiftId);
  if (next.length === current.length && next.every((id, index) => id === current[index])) return state;
  const draft = cloneState(state);
  const index = draft.emps.findIndex((item) => item.id === employeeId);
  draft.emps[index] = { ...draft.emps[index], pref: next };
  return draft;
}

/** Profile fields. Does not touch the agreement grid or any availability row. */
export function updateEmployee(state: RotaState, actor: Actor, employeeId: string, patch: EmployeePatch): RotaState {
  if (!canEditRoster(actor)) return state;
  const employee = findEmployee(state, employeeId);
  if (!employee) return state;
  const next: Employee = { ...employee };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return state;
    next.name = name;
  }
  if (patch.contact !== undefined) next.contact = patch.contact.trim();
  if (patch.phone !== undefined) next.phone = patch.phone.trim();
  if (patch.role !== undefined) next.role = patch.role.trim();
  if (patch.quals !== undefined) next.quals = patch.quals.trim();
  if (patch.perWeek !== undefined) next.perWeek = Math.floor(nonNegative(patch.perWeek));
  if (patch.maxHours !== undefined) next.maxHours = nonNegative(patch.maxHours);
  if (patch.hourlyWage !== undefined) next.hourlyWage = nonNegative(patch.hourlyWage);
  if (patch.active !== undefined) next.active = patch.active;
  applyObservance(next, employee, patch);
  if (patch.customBlocks !== undefined) {
    if (patch.customBlocks === null) delete next.customBlocks;
    else {
      const cleaned = normalizeCustom(patch.customBlocks);
      if (!cleaned) return state;
      next.customBlocks = cleaned;
    }
  }
  if (patch.profile !== undefined) {
    const cleaned = cleanProfile({ ...employeeProfile(employee), ...patch.profile });
    if (cleaned) next.profile = cleaned;
    else delete next.profile;
  }
  if (
    next.name === employee.name &&
    next.contact === employee.contact &&
    (next.phone ?? "") === (employee.phone ?? "") &&
    next.role === employee.role &&
    next.quals === employee.quals &&
    next.perWeek === employee.perWeek &&
    next.maxHours === employee.maxHours &&
    (next.hourlyWage ?? 0) === (employee.hourlyWage ?? 0) &&
    next.active === employee.active &&
    (next.observesShabbat === true) === (employee.observesShabbat === true) &&
    (next.observesHolidays === true) === (employee.observesHolidays === true) &&
    JSON.stringify(next.customBlocks ?? null) === JSON.stringify(employee.customBlocks ?? null) &&
    JSON.stringify(cleanProfile(next.profile) ?? null) === JSON.stringify(cleanProfile(employee.profile) ?? null)
  ) {
    return state;
  }
  const draft = cloneState(state);
  const index = draft.emps.findIndex((item) => item.id === employeeId);
  const saved = { ...draft.emps[index], ...next, grid: draft.emps[index].grid };
  if (!next.profile) delete saved.profile;
  if (!next.customBlocks) delete saved.customBlocks;
  if (next.observesShabbat !== true) delete saved.observesShabbat;
  if (next.observesHolidays !== true) delete saved.observesHolidays;
  draft.emps[index] = saved;
  return draft;
}

export function addEmployeeRecord(state: RotaState, actor: Actor, input: { id: string; name: string }): RotaState {
  if (!canEditRoster(actor)) return state;
  const name = input.name.trim();
  if (!name || !input.id || findEmployee(state, input.id)) return state;
  const draft = cloneState(state);
  draft.emps.push({
    id: input.id,
    name,
    contact: "",
    role: "",
    quals: "",
    perWeek: DEFAULT_SHIFTS_PER_WEEK,
    maxHours: 0,
    hourlyWage: 0,
    pref: [],
    active: true,
    grid: openGrid(state),
    ...(state.siteId ? { homeSiteId: state.siteId } : {}),
  });
  draft.emps.sort((left, right) => left.name.localeCompare(right.name, "en"));
  return draft;
}

/** Weeks from `currentWeek` on whose published schedule still seats this employee. */
export function deletionBlockedBy(state: RotaState, employeeId: string, currentWeek: string): string[] {
  return Object.entries(state.sched)
    .filter(
      ([week, schedule]) =>
        week >= currentWeek &&
        schedule.status === "published" &&
        Object.values(schedule.assign).some((ids) => ids.includes(employeeId)),
    )
    .map(([week]) => week)
    .sort();
}

/**
 * Removes the person, their availability and their draft seats.
 * Published weeks and versions stay as they were, so the name is kept in `former`.
 * Refused while a current or future published week still seats them.
 */
export function removeEmployeeRecord(state: RotaState, actor: Actor, employeeId: string, currentWeek: string): RotaState {
  if (!canEditRoster(actor)) return state;
  const employee = findEmployee(state, employeeId);
  if (!employee || deletionBlockedBy(state, employeeId, currentWeek).length > 0) return state;

  const draft = cloneState(state);
  draft.emps = draft.emps.filter((item) => item.id !== employeeId);
  for (const week of Object.keys(draft.avail)) {
    delete draft.avail[week][employeeId];
    if (Object.keys(draft.avail[week]).length === 0) delete draft.avail[week];
  }
  const suffix = `#${employeeId}`;
  for (const schedule of Object.values(draft.sched)) {
    if (schedule.status === "published") continue;
    for (const key of Object.keys(schedule.assign)) {
      schedule.assign[key] = schedule.assign[key].filter((id) => id !== employeeId);
    }
    schedule.locked = schedule.locked.filter((token) => !token.endsWith(suffix));
    for (const token of Object.keys(schedule.ext ?? {})) if (token.endsWith(suffix)) delete schedule.ext![token];
    for (const token of Object.keys(schedule.hours ?? {})) if (token.endsWith(suffix)) delete schedule.hours![token];
    if (schedule.hours && Object.keys(schedule.hours).length === 0) delete schedule.hours;
    for (const token of Object.keys(schedule.over ?? {})) if (token.endsWith(suffix)) delete schedule.over![token];
  }
  draft.former = { ...draft.former, [employeeId]: employee.name };
  return draft;
}

/** Shabbat turns festival observance on. Festival observance cannot stay on alone. */
function applyObservance(next: Employee, employee: Employee, patch: EmployeePatch): void {
  if (patch.observesShabbat === undefined && patch.observesHolidays === undefined) return;
  const wasShabbat = employee.observesShabbat === true;
  let shabbat = patch.observesShabbat !== undefined ? patch.observesShabbat === true : wasShabbat;
  let holidays = patch.observesHolidays !== undefined ? patch.observesHolidays === true : employee.observesHolidays === true;
  if (shabbat && !wasShabbat && patch.observesHolidays === undefined) holidays = true;
  if (!shabbat) holidays = false;
  if (shabbat) next.observesShabbat = true;
  else delete next.observesShabbat;
  if (shabbat && holidays) next.observesHolidays = true;
  else delete next.observesHolidays;
}

/** Current name, or the name a deleted employee had. */
export function employeeName(state: RotaState, employeeId: string): string {
  return findEmployee(state, employeeId)?.name ?? state.former?.[employeeId] ?? employeeId;
}

/**
 * Contract cell. A closed site day cannot be opened.
 * Turning a cell off also drops it from submitted availability, so a week row cannot outlive the contract.
 */
export function setAgreement(
  state: RotaState,
  actor: Actor,
  employeeId: string,
  day: number,
  shiftId: string,
  allowed: boolean,
): RotaState {
  if (!canEditRoster(actor) || day < 0 || day > 6) return state;
  const employee = findEmployee(state, employeeId);
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (!employee || !shift || siteClosed(state, day, shiftId) || shabbatBlocks(employee, shift, day)) return state;
  const currently = agreementAllows(employee, day, shiftId, shift);
  if (currently === allowed) return state;

  const draft = cloneState(state);
  const nextEmployee = draft.emps.find((item) => item.id === employeeId)!;
  const grid = gridFrom(nextEmployee, draft.biz.shifts.map((shift) => shift.id));
  const dayShifts = new Set(grid[day] ?? []);
  if (allowed) dayShifts.add(shiftId);
  else dayShifts.delete(shiftId);
  grid[day] = draft.biz.shifts.map((shift) => shift.id).filter((id) => dayShifts.has(id));
  nextEmployee.grid = grid;
  delete nextEmployee.allowed;
  delete nextEmployee.blocked;

  if (!allowed) {
    for (const week of Object.values(draft.avail)) {
      const row = week[employeeId];
      if (!row?.[day]) continue;
      row[day] = row[day].filter((id) => id !== shiftId);
    }
  }
  return draft;
}

/** Every shift the site runs, per weekday. */
function openGrid(state: RotaState): string[][] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => state.biz.shifts.map((shift) => shift.id).filter((shiftId) => !siteClosed(state, day, shiftId)));
}

/** "Select all" opens every shift the site runs; "clear" closes them all and trims submitted availability to match. */
export function setWholeAgreement(state: RotaState, actor: Actor, employeeId: string, allowed: boolean): RotaState {
  if (!canEditRoster(actor)) return state;
  const employee = findEmployee(state, employeeId);
  if (!employee) return state;
  const shiftIds = state.biz.shifts.map((shift) => shift.id);
  const current = gridFrom(employee, shiftIds);
  const base = allowed ? openGrid(state) : [[], [], [], [], [], [], []];
  const grid = base.map((dayShifts, day) => {
    const kept = new Set(dayShifts);
    for (const shift of state.biz.shifts) {
      if (!shabbatBlocks(employee, shift, day)) continue;
      if ((current[day] ?? []).includes(shift.id)) kept.add(shift.id);
      else kept.delete(shift.id);
    }
    return state.biz.shifts.map((shift) => shift.id).filter((id) => kept.has(id));
  });
  if (JSON.stringify(current) === JSON.stringify(grid)) return state;

  const draft = cloneState(state);
  const nextEmployee = draft.emps.find((item) => item.id === employeeId)!;
  nextEmployee.grid = grid;
  delete nextEmployee.allowed;
  delete nextEmployee.blocked;
  if (!allowed) {
    for (const week of Object.values(draft.avail)) {
      if (week[employeeId]) week[employeeId] = [[], [], [], [], [], [], []];
    }
  }
  return draft;
}

/** This week's availability. Cannot add a shift the agreement, or a closed site day, excludes. */
export function setAvailability(
  state: RotaState,
  actor: Actor,
  employeeId: string,
  day: number,
  shiftId: string,
  available: boolean,
  home: Business = state.biz,
): RotaState {
  if (!canEditAvailability(actor, employeeId) || day < 0 || day > 6 || reliefLocked(state, employeeId)) return state;
  const employee = findEmployee(state, employeeId);
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (
    !employee ||
    !shift ||
    staffedCount(shift, day, state.week) <= 0 ||
    shiftRest(employee, shift, day, state.week) ||
    absenceOnWeekDay(state, employeeId, day) ||
    !agreementAllows(employee, day, shiftId, shift)
  ) {
    return state;
  }

  const current = state.avail[state.week]?.[employeeId];
  const hasShift = !current || (current[day] ?? []).includes(shiftId);
  if (available === hasShift && (current || available)) return state;

  const row = gridWithCell(state, employeeId, current, day, shiftId, available);
  if (!withinBlockLimit(state, employeeId, row, home)) return state;
  const draft = cloneState(state);
  (draft.avail[draft.week] ??= {})[employeeId] = row;
  return draft;
}

/** Copy the previous week's submission. A missing previous week clears this week's row. */
/** A manager writes the approved request into the official weekly constraints. */
export function replaceAvailability(
  state: RotaState,
  actor: Actor,
  employeeId: string,
  week: string,
  shifts: string[][],
): RotaState {
  if (actor.kind !== "manager" || reliefLocked(state, employeeId) || !findEmployee(state, employeeId) || shifts.length !== 7) return state;
  const draft = cloneState(state);
  (draft.avail[week] ??= {})[employeeId] = shifts.map((day) => [...day]);
  return draft;
}

export function copyAvailability(state: RotaState, actor: Actor, employeeId: string, home: Business = state.biz): RotaState {
  if (!canEditAvailability(actor, employeeId) || reliefLocked(state, employeeId) || !findEmployee(state, employeeId)) return state;
  const previous = state.avail[addDays(state.week, -7)]?.[employeeId];
  const current = state.avail[state.week]?.[employeeId];
  if (!previous) {
    if (!current) return state;
    const draft = cloneState(state);
    delete draft.avail[draft.week][employeeId];
    if (Object.keys(draft.avail[draft.week]).length === 0) delete draft.avail[draft.week];
    return draft;
  }
  const copied = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const open = new Set(openConstraintShiftIds(state, employeeId, day));
    return (previous[day] ?? []).filter((shiftId) => open.has(shiftId));
  });
  if (!withinBlockLimit(state, employeeId, copied, home)) return state;
  if (sameCells(current, copied)) return state;
  const draft = cloneState(state);
  (draft.avail[draft.week] ??= {})[employeeId] = copied;
  return draft;
}

/** Mark every open shift available, or block every open shift when the cap allows it. */
export function setWholeAvailability(state: RotaState, actor: Actor, employeeId: string, available: boolean, home: Business = state.biz): RotaState {
  if (!canEditAvailability(actor, employeeId) || reliefLocked(state, employeeId) || !findEmployee(state, employeeId)) return state;
  const grid = available ? openAvailabilityGrid(state, employeeId) : [[], [], [], [], [], [], []];
  if (!withinBlockLimit(state, employeeId, grid, home)) return state;
  const current = state.avail[state.week]?.[employeeId];
  if (sameCells(current, grid)) return state;
  const draft = cloneState(state);
  (draft.avail[draft.week] ??= {})[employeeId] = grid;
  return draft;
}

export type AgreementCell = "closed" | "allowed" | "excluded" | "shabbat";
export type AvailabilityCell = "closed" | "forbidden" | "available" | "unavailable" | "shabbat" | "holiday" | "absent";

export function agreementCell(state: RotaState, employeeId: string, day: number, shiftId: string): AgreementCell {
  if (siteClosed(state, day, shiftId)) return "closed";
  const employee = findEmployee(state, employeeId);
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (!employee || !shift) return "excluded";
  if (shabbatBlocks(employee, shift, day)) return "shabbat";
  return agreementAllows(employee, day, shiftId, shift) ? "allowed" : "excluded";
}

export function availabilityCell(state: RotaState, employeeId: string, day: number, shiftId: string): AvailabilityCell {
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  const employee = findEmployee(state, employeeId);
  if (!shift || staffedCount(shift, day, state.week) <= 0) return "closed";
  if (employee && absenceOnWeekDay(state, employeeId, day)) return "absent";
  if (employee && shabbatBlocks(employee, shift, day)) return "shabbat";
  if (employee && shiftRest(employee, shift, day, state.week) === "holiday") return "holiday";
  if (!employee || !agreementAllows(employee, day, shiftId, shift)) return "forbidden";
  const submitted = state.avail[state.week]?.[employeeId];
  if (!submitted || (submitted[day] ?? []).includes(shiftId)) return "available";
  return "unavailable";
}

export function availabilitySubmitted(state: RotaState, employeeId: string): boolean {
  return Boolean(state.avail[state.week]?.[employeeId]);
}

/**
 * Write a parsed availability draft. A manager approval is the only path in.
 * Unknown names and ambiguous lines stay out of the row. The agreement is untouched.
 * Only the grid is kept: the message itself is not stored, so a later manual edit is the final word.
 */
export function applyConstraintText(
  state: RotaState,
  actor: Actor,
  raw: string,
  overrides: LineOverride[] = [],
  homeOf: (employeeId: string) => Business = () => state.biz,
): RotaState {
  if (actor.kind !== "manager") return state;
  const draft = parseConstraints(raw, state, overrides);
  if (!constraintDraftWritable(draft)) return state;
  const employeeIds = Object.keys(draft.proposals);
  if (employeeIds.length === 0) return state;

  const next = cloneState(state);
  const week = (next.avail[next.week] ??= {});
  let changed = false;
  for (const employeeId of employeeIds) {
    const employee = findEmployee(next, employeeId);
    if (!employee || isRelief(employee, next.siteId)) continue;
    const proposal = draft.proposals[employeeId].map((dayShifts, day) =>
      next.biz.shifts
        .filter(
          (shift) => dayShifts.includes(shift.id) && agreementAllows(employee, day, shift.id, shift) && !siteClosed(next, day, shift.id),
        )
        .map((shift) => shift.id),
    );
    const implicit = [0, 1, 2, 3, 4, 5, 6].map((day) =>
      next.biz.shifts
        .filter((shift) => agreementAllows(employee, day, shift.id, shift) && !siteClosed(next, day, shift.id))
        .map((shift) => shift.id),
    );
    if (!withinBlockLimit(next, employeeId, proposal, homeOf(employeeId))) continue;
    if (sameCells(week[employeeId] ?? implicit, proposal)) continue;
    week[employeeId] = proposal;
    changed = true;
  }
  return changed ? next : state;
}
