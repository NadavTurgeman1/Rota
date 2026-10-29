import type { RotaState, Schedule, ShiftDefinition, Slot } from "./types";

export function shiftById(state: RotaState, shiftId: string): ShiftDefinition {
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (!shift) throw new Error(`Unknown shift: ${shiftId}`);
  return shift;
}

export function ensureSchedule(state: RotaState, week: string): Schedule {
  const existing = state.sched[week];
  if (existing) return existing;
  const created: Schedule = { assign: {}, locked: [], status: "draft" };
  state.sched[week] = created;
  return created;
}

/** Stored on `assignment_extensions.group_id` for a personal clock, not a coverage group. */
export const HOUR_SPAN_GROUP = "hours";

export function clearAssignmentHours(schedule: Schedule, slotKey: string, employeeId: string): void {
  const key = `${slotKey}#${employeeId}`;
  if (!schedule.hours?.[key]) return;
  const next = { ...schedule.hours };
  delete next[key];
  if (Object.keys(next).length === 0) delete schedule.hours;
  else schedule.hours = next;
}

export function effectiveSlot(schedule: Schedule, slot: Slot, employeeId: string): Slot {
  const extension = schedule.ext?.[`${slot.key}#${employeeId}`];
  const custom = schedule.hours?.[`${slot.key}#${employeeId}`];
  const span = extension ?? custom;
  if (!span || (span.start === slot.start && span.end === slot.end)) return slot;
  return { ...slot, start: span.start, end: span.end };
}

/**
 * A coverage group fills one open seat only when every extension in the group
 * is still present. Matches `covered()` in the prototype.
 */
export function coveredSeats(schedule: Schedule, slotKey: string): number {
  const present = new Map<string, number>();
  const expected = new Map<string, number>();
  for (const extension of Object.values(schedule.ext ?? {})) {
    if (extension.cover !== slotKey) continue;
    present.set(extension.groupId, (present.get(extension.groupId) ?? 0) + 1);
    expected.set(extension.groupId, extension.groupSize);
  }
  let filled = 0;
  for (const [groupId, count] of present) {
    if (count === expected.get(groupId)) filled += 1;
  }
  return filled;
}
