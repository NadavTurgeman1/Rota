import { addDays, gapBetween, shiftKind } from "./time";
import { ensureSchedule, shiftById } from "./schedule";
import { consecutiveRun, workedDates } from "./labor";
import { dynamicReason, slots, staticReason } from "./rules";
import { isRelief, reliefAllowed } from "./relief";
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
export function generate(state: RotaState, week: string, random?: () => number): GenerateResult {
  const schedule = ensureSchedule(state, week);
  schedule.ext = {};
  delete schedule.hours;
  schedule.over = {};
  const previous = schedule.assign;
  const originalLocked = [...(schedule.locked ?? [])];
  const openSlots = slots(state, week);
  const employees = state.emps.filter((employee) => employee.active);
  const automatic = employees.filter((employee) => !isRelief(employee, state.siteId));
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
    if (isRelief(employee, state.siteId) && !reliefAllowed(state, employee)) {
      dropped.push({ token, why: "rule", reason: { code: "home_schedule" } });
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
  const frozenKeys = new Set(
    Object.entries(previous).flatMap(([key, ids]) => {
      if (ids.length === 0 || !ids.every((id) => originalLocked.includes(`${key}#${id}`))) return [];
      if (!ids.every((id) => kept.includes(`${key}#${id}`))) return [];
      return [key];
    }),
  );

  const scarcity = (slot: Slot) =>
    automatic.filter((employee) => !staticReason(state, employee, slot, week)).length / slot.required;
  const isNight = (slot: Slot) => {
    const shift = shiftById(state, slot.shiftId);
    return shiftKind(shift.start, shift.end) === "n";
  };
  const nightCount = (employeeId: string) => mine[employeeId].filter(isNight).length;

  const queue: Slot[] = [];
  for (const slot of [...openSlots].sort((a, b) => scarcity(a) - scarcity(b))) {
    if (frozenKeys.has(slot.key)) continue;
    for (let seat = assign[slot.key].length; seat < slot.required; seat += 1) queue.push(slot);
  }

  const sevenDays = (employeeId: string, slot: Slot, held: Slot[]) =>
    consecutiveRun(workedDates(state, employeeId, week, held, slot.day), addDays(week, slot.day)) !== null;

  for (const slot of queue) {
    const candidates = automatic.filter(
      (employee) =>
        !assign[slot.key].includes(employee.id) &&
        !staticReason(state, employee, slot, week) &&
        !dynamicReason(state, employee, slot, mine[employee.id]) &&
        !sevenDays(employee.id, slot, mine[employee.id]),
    );
    if (!candidates.length) continue;
    const chosen = random
      ? candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
      : candidates.sort((a, b) => score(a, slot) - score(b, slot))[0];
    if (!chosen) continue;
    assign[slot.key].push(chosen.id);
    mine[chosen.id].push(slot);
  }

  const rebalance = (slot: Slot): boolean => {
    for (const employee of automatic) {
      if (assign[slot.key].includes(employee.id) || staticReason(state, employee, slot, week)) continue;
      for (const held of mine[employee.id].slice()) {
        if (schedule.locked.includes(`${held.key}#${employee.id}`)) continue;
        mine[employee.id] = mine[employee.id].filter((item) => item !== held);
        if (!dynamicReason(state, employee, slot, mine[employee.id]) && !sevenDays(employee.id, slot, mine[employee.id])) {
          const replacement = automatic.find(
            (other) =>
              other.id !== employee.id &&
              !assign[held.key].includes(other.id) &&
              !staticReason(state, other, held, week) &&
              !dynamicReason(state, other, held, mine[other.id]) &&
              !sevenDays(other.id, held, mine[other.id]),
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
    if (frozenKeys.has(slot.key)) continue;
    while (assign[slot.key].length < slot.required && rebalance(slot)) {
      // Each success fills exactly one open seat.
    }
  }

  const pinned = (slot: Slot, employeeId: string) => schedule.locked.includes(`${slot.key}#${employeeId}`);
  const trade = (employee: Employee, given: Slot): boolean => {
    const kept = mine[employee.id].filter((item) => item !== given);
    for (const other of automatic) {
      if (other.id === employee.id || assign[given.key].includes(other.id) || staticReason(state, other, given, week)) continue;
      for (const taken of mine[other.id]) {
        if (
          pinned(taken, other.id) ||
          frozenKeys.has(taken.key) ||
          frozenKeys.has(given.key) ||
          assign[taken.key].includes(employee.id) ||
          staticReason(state, employee, taken, week)
        ) {
          continue;
        }
        const otherKept = mine[other.id].filter((item) => item !== taken);
        if (
          dynamicReason(state, other, given, otherKept) ||
          dynamicReason(state, employee, taken, kept) ||
          sevenDays(other.id, given, otherKept) ||
          sevenDays(employee.id, taken, kept)
        ) {
          continue;
        }
        if (sameDayTight(heldWithPeers(other.id, otherKept), given, state.biz.minRest)) continue;
        if (sameDayTight(heldWithPeers(employee.id, kept), taken, state.biz.minRest)) continue;
        assign[given.key] = assign[given.key].filter((id) => id !== employee.id).concat(other.id);
        assign[taken.key] = assign[taken.key].filter((id) => id !== other.id).concat(employee.id);
        mine[employee.id] = [...kept, taken];
        mine[other.id] = [...otherKept, given];
        return true;
      }
    }
    return false;
  };
  for (const employee of automatic) {
    for (const given of mine[employee.id].slice()) {
      if (pinned(given, employee.id) || !mine[employee.id].includes(given)) continue;
      const rest = heldWithPeers(employee.id, mine[employee.id].filter((item) => item !== given));
      if (sameDayTight(rest, given, state.biz.minRest)) trade(employee, given);
    }
  }
  const nameOf = (id: string) => employees.find((employee) => employee.id === id)?.name ?? "";
  for (const ids of Object.values(assign)) {
    ids.sort((left, right) => nameOf(left).localeCompare(nameOf(right), "he", { sensitivity: "base" }));
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
    const held = heldWithPeers(employee.id);
    const chain = tightChain(held, slot, state.biz.minRest);
    if (chain >= 3) value += 6 + (chain - 3) * 3;
    if (sameDayTight(held, slot, state.biz.minRest)) value += 12;
    return value;
  }

  function heldWithPeers(employeeId: string, held: Slot[] = mine[employeeId]): Slot[] {
    const extra = (state.peers?.[employeeId] ?? [])
      .filter((peer) => peer.weekOffset === 0)
      .map(
        (peer): Slot => ({
          key: peer.key,
          day: peer.day,
          shiftId: peer.key,
          start: peer.start,
          end: peer.end,
          required: 1,
        }),
      );
    return [...held, ...extra];
  }
}

/** Another held shift starts on the same date and only the minimum rest separates them. A soft penalty. */
function sameDayTight(held: Slot[], slot: Slot, minRest: number): boolean {
  const date = Math.floor(slot.start / 24);
  return held.some((other) => {
    if (Math.floor(other.start / 24) !== date) return false;
    const gap = gapBetween(other, slot);
    return gap >= -1e-9 && gap <= minRest + 0.01;
  });
}

/** Shifts joined only by the site's minimum rest. Two are fine. Three is a soft penalty. */
function tightChain(held: Slot[], slot: Slot, minRest: number): number {
  const all = [...held, slot].sort((left, right) => left.start - right.start);
  const index = all.indexOf(slot);
  const tight = (gap: number) => gap >= -1e-9 && gap <= minRest + 0.01;
  let from = index;
  let to = index;
  while (from > 0 && tight(gapBetween(all[from - 1], all[from]))) from -= 1;
  while (to + 1 < all.length && tight(gapBetween(all[to], all[to + 1]))) to += 1;
  return to - from + 1;
}
