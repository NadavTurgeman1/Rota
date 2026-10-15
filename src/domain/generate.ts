import { shiftKind } from "./time";
import { ensureSchedule, shiftById } from "./schedule";
import { dynamicReason, slots, staticReason } from "./rules";
import type { Employee, Reason, RotaState, Slot } from "./types";

export type DroppedLock =
  | { token: string; why: "missing" | "full" }
  | { token: string; why: "rule"; reason: Reason };

export interface GenerateResult {
  kept: string[];
  dropped: DroppedLock[];
}

/**
 * Locked seats are placed first and checked by the same rules as everyone else.
 * A lock that no longer passes is dropped and reported, never forced.
 * Then greedy fill, then a single-swap repair for seats that stayed open.
 * Mutates `state.sched[week]`.
 */
export function generate(state: RotaState, week: string): GenerateResult {
  const schedule = ensureSchedule(state, week);
  schedule.ext = {};
  schedule.over = {};
  const previous = schedule.assign;
  const openSlots = slots(state, week);
  const employees = state.emps.filter((employee) => employee.active);
  const assign: Record<string, string[]> = {};
  const mine: Record<string, Slot[]> = {};
  for (const employee of employees) mine[employee.id] = [];
  for (const slot of openSlots) assign[slot.key] = [];

  const kept: string[] = [];
  const dropped: DroppedLock[] = [];
  for (const token of new Set(schedule.locked ?? [])) {
    const split = token.lastIndexOf("#");
    const slot = openSlots.find((item) => item.key === token.slice(0, split));
    const employee = employees.find((item) => item.id === token.slice(split + 1));
    if (split <= 0 || !slot || !employee) {
      dropped.push({ token, why: "missing" });
      continue;
    }
    if (assign[slot.key].length >= slot.required || assign[slot.key].includes(employee.id)) {
      dropped.push({ token, why: "full" });
      continue;
    }
    const reason = staticReason(state, employee, slot, week) ?? dynamicReason(state, employee, slot, mine[employee.id]);
    if (reason) {
      dropped.push({ token, why: "rule", reason });
      continue;
    }
    assign[slot.key].push(employee.id);
    mine[employee.id].push(slot);
    kept.push(token);
  }
  schedule.locked = kept;

  const scarcity = (slot: Slot) =>
    employees.filter((employee) => !staticReason(state, employee, slot, week)).length / slot.required;
  const isNight = (slot: Slot) => {
    const shift = shiftById(state, slot.shiftId);
    return shiftKind(shift.start, shift.end) === "n";
  };
  const nightCount = (employeeId: string) => mine[employeeId].filter(isNight).length;

  const queue: Slot[] = [];
  for (const slot of [...openSlots].sort((a, b) => scarcity(a) - scarcity(b))) {
    for (let seat = assign[slot.key].length; seat < slot.required; seat += 1) queue.push(slot);
  }

  for (const slot of queue) {
    const candidates = employees.filter(
      (employee) =>
        !assign[slot.key].includes(employee.id) &&
        !staticReason(state, employee, slot, week) &&
        !dynamicReason(state, employee, slot, mine[employee.id]),
    );
    if (!candidates.length) continue;
    candidates.sort((a, b) => score(a, slot) - score(b, slot));
    const chosen = candidates[0];
    assign[slot.key].push(chosen.id);
    mine[chosen.id].push(slot);
  }

  const rebalance = (slot: Slot): boolean => {
    for (const employee of employees) {
      if (assign[slot.key].includes(employee.id) || staticReason(state, employee, slot, week)) continue;
      for (const held of mine[employee.id].slice()) {
        if (schedule.locked.includes(`${held.key}#${employee.id}`)) continue;
        mine[employee.id] = mine[employee.id].filter((item) => item !== held);
        if (!dynamicReason(state, employee, slot, mine[employee.id])) {
          const replacement = employees.find(
            (other) =>
              other.id !== employee.id &&
              !assign[held.key].includes(other.id) &&
              !staticReason(state, other, held, week) &&
              !dynamicReason(state, other, held, mine[other.id]),
          );
          if (replacement) {
            assign[held.key] = assign[held.key].filter((id) => id !== employee.id).concat(replacement.id);
            mine[replacement.id].push(held);
            assign[slot.key].push(employee.id);
            mine[employee.id].push(slot);
            return true;
          }
        }
        mine[employee.id].push(held);
      }
    }
    return false;
  };

  for (const slot of openSlots) {
    while (assign[slot.key].length < slot.required && rebalance(slot)) {
      // Each success fills exactly one open seat.
    }
  }
  schedule.assign = assign;
  return { kept, dropped };

  function score(employee: Employee, slot: Slot): number {
    const assigned = mine[employee.id].length;
    const need = Math.max(0, (employee.perWeek || 0) - assigned);
    let value =
      assigned * 2 -
      need * 3 -
      ((employee.pref ?? []).includes(slot.shiftId) ? 2 : 0) -
      ((previous[slot.key] ?? []).includes(employee.id) ? 2 : 0);
    if (isNight(slot)) {
      value += nightCount(employee.id) * 2;
      if (mine[employee.id].some((other) => isNight(other) && Math.abs(other.start - slot.start) <= 30)) {
        value += 5;
      }
    }
    return value;
  }
}
