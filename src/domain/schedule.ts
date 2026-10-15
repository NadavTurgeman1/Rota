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

export function effectiveSlot(schedule: Schedule, slot: Slot, employeeId: string): Slot {
  const extension = schedule.ext?.[`${slot.key}#${employeeId}`];
  if (!extension) return slot;
  return { ...slot, start: extension.start, end: extension.end };
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
