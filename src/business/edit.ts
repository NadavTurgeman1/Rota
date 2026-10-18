import type { Business, RotaState, ShiftDefinition } from "../domain";
import type { Actor } from "../people/edit";

export interface BusinessPatch {
  name?: string;
  type?: string;
  minRest?: number;
  maxHours?: number;
  maxShift?: number;
  maxDayHours?: number;
  staffAccess?: boolean;
  constraintStartDay?: number;
  constraintEndDay?: number;
  constraintOpens?: string;
  constraintCloses?: string;
  blockLimit?: boolean;
  maxBlocks?: number;
}

export interface ShiftPatch {
  name?: string;
  start?: string;
  end?: string;
  role?: string;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function nonNegative(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function updateBusiness(state: RotaState, actor: Actor, patch: BusinessPatch): RotaState {
  if (actor.kind !== "manager") return state;
  const next: Business = { ...state.biz };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return state;
    next.name = name;
  }
  if (patch.type !== undefined) next.type = patch.type.trim();
  for (const key of ["minRest", "maxHours", "maxShift", "maxDayHours"] as const) {
    const raw = patch[key];
    if (raw === undefined) continue;
    const value = nonNegative(raw);
    if (value === null) return state;
    next[key] = value;
  }
  if (patch.staffAccess !== undefined) next.staffAccess = patch.staffAccess;
  for (const key of ["constraintStartDay", "constraintEndDay"] as const) {
    const day = patch[key];
    if (day === undefined) continue;
    if (!Number.isInteger(day) || day < 0 || day > 6) return state;
    next[key] = day;
  }
  if (patch.constraintOpens !== undefined) {
    if (!CLOCK.test(patch.constraintOpens)) return state;
    next.constraintOpens = patch.constraintOpens;
  }
  if (patch.constraintCloses !== undefined) {
    if (!CLOCK.test(patch.constraintCloses)) return state;
    next.constraintCloses = patch.constraintCloses;
  }
  if (patch.blockLimit !== undefined) next.blockLimit = patch.blockLimit;
  if (patch.maxBlocks !== undefined) {
    const value = nonNegative(patch.maxBlocks);
    if (value === null || !Number.isInteger(value)) return state;
    next.maxBlocks = value;
  }
  return { ...state, biz: next };
}

function replaceShift(state: RotaState, shiftId: string, change: (shift: ShiftDefinition) => ShiftDefinition | null): RotaState {
  const index = state.biz.shifts.findIndex((shift) => shift.id === shiftId);
  if (index < 0) return state;
  const changed = change(state.biz.shifts[index]);
  if (!changed) return state;
  const shifts = [...state.biz.shifts];
  shifts[index] = changed;
  return { ...state, biz: { ...state.biz, shifts } };
}

export function updateShift(state: RotaState, actor: Actor, shiftId: string, patch: ShiftPatch): RotaState {
  if (actor.kind !== "manager") return state;
  return replaceShift(state, shiftId, (shift) => {
    const next = { ...shift };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return null;
      next.name = name;
    }
    for (const key of ["start", "end"] as const) {
      const value = patch[key];
      if (value === undefined) continue;
      if (!CLOCK.test(value)) return null;
      next[key] = value;
    }
    if (patch.role !== undefined) next.role = patch.role.trim();
    return next;
  });
}

/** Headcount for one weekday. `0` closes the shift on that day. */
export function setShiftRequirement(state: RotaState, actor: Actor, shiftId: string, day: number, count: number): RotaState {
  if (actor.kind !== "manager" || day < 0 || day > 6) return state;
  const value = nonNegative(count);
  if (value === null) return state;
  return replaceShift(state, shiftId, (shift) => {
    const req = [0, 1, 2, 3, 4, 5, 6].map((index) => Number(shift.req[index] || 0));
    req[day] = Math.floor(value);
    return { ...shift, req };
  });
}

/** New shifts open every day with one seat, and every agreement allows them until edited. */
export function addShift(state: RotaState, actor: Actor, input: { id: string; name: string }): RotaState {
  if (actor.kind !== "manager") return state;
  const name = input.name.trim();
  if (!name || !input.id || state.biz.shifts.some((shift) => shift.id === input.id)) return state;
  const draft = structuredClone(state);
  draft.biz.shifts.push({ id: input.id, name, start: "09:00", end: "17:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] });
  for (const employee of draft.emps) {
    if (employee.grid) employee.grid = employee.grid.map((day) => [...day, input.id]);
    else employee.allowed = [...(employee.allowed ?? []), input.id];
  }
  return draft;
}

/** Drops the shift everywhere it is referenced, except frozen versions. The last shift cannot be removed. */
export function removeShift(state: RotaState, actor: Actor, shiftId: string): RotaState {
  if (actor.kind !== "manager" || state.biz.shifts.length < 2) return state;
  if (!state.biz.shifts.some((shift) => shift.id === shiftId)) return state;
  const draft = structuredClone(state);
  draft.biz.shifts = draft.biz.shifts.filter((shift) => shift.id !== shiftId);
  for (const employee of draft.emps) {
    if (employee.grid) employee.grid = employee.grid.map((day) => day.filter((id) => id !== shiftId));
    if (employee.allowed) employee.allowed = employee.allowed.filter((id) => id !== shiftId);
    employee.pref = employee.pref.filter((id) => id !== shiftId);
  }
  for (const week of Object.values(draft.avail)) {
    for (const row of Object.values(week)) {
      for (let day = 0; day < row.length; day += 1) row[day] = row[day].filter((id) => id !== shiftId);
    }
  }
  const ofShift = (key: string) => key.split("#")[0].split("|")[1] === shiftId;
  for (const schedule of Object.values(draft.sched)) {
    for (const key of Object.keys(schedule.assign)) if (ofShift(key)) delete schedule.assign[key];
    schedule.locked = (schedule.locked ?? []).filter((token) => !ofShift(token));
    for (const [key, extension] of Object.entries(schedule.ext ?? {})) {
      if (ofShift(key) || ofShift(extension.cover)) delete schedule.ext![key];
    }
    for (const key of Object.keys(schedule.over ?? {})) if (ofShift(key)) delete schedule.over![key];
  }
  return draft;
}
