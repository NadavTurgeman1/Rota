import { coveredSeats, effectiveSlot } from "./schedule";
import { approvedExtraShifts, dynamicReason, slots, staticReason } from "./rules";
import type { CoverageOption, ExtraShiftOption, RotaState, Schedule, Slot } from "./types";

/**
 * Same-day repair for exactly one open seat across three back-to-back shifts.
 * Morning may extend forward and night may start earlier, splitting the middle
 * shift, up to the business max length. Nothing is written until `applyCoverage`.
 */
export function suggest(state: RotaState, week: string, target: Slot): CoverageOption[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const daySlots = slots(state, week)
    .filter((slot) => slot.day === target.day)
    .sort((a, b) => a.start - b.start);
  const maxLength = state.biz.maxShift || 12;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (daySlots.length !== 3) return [];
  const [first, second, third] = daySlots;
  if (!near(first.end, second.start) || !near(second.end, third.start)) return [];

  const assigned = (slot: Slot) => schedule.assign[slot.key] ?? [];
  const alreadyExtended = daySlots.some(
    (slot) =>
      coveredSeats(schedule, slot.key) > 0 ||
      assigned(slot).some((id) => schedule.ext?.[`${slot.key}#${id}`]),
  );
  if (alreadyExtended) return [];
  const missing = daySlots.reduce((sum, slot) => sum + slot.required - assigned(slot).length, 0);
  if (missing !== 1 || first.required < 1 || third.required < 1) return [];

  const people = [...new Set(daySlots.flatMap(assigned))];
  if (people.length > 7) return [];
  const dayKeys = new Set(daySlots.map((slot) => slot.key));
  const half = (second.end - second.start) / 2;

  const mineOf = (employeeId: string): Slot[] => {
    const held: Slot[] = [];
    for (const slot of slots(state, week)) {
      if (dayKeys.has(slot.key) || !(schedule.assign[slot.key] ?? []).includes(employeeId)) continue;
      held.push(effectiveSlot(schedule, slot, employeeId));
    }
    return held;
  };

  type Role = { slot: Slot; extend?: "f" | "b" };
  const roles: Role[] = [{ slot: first, extend: "f" }];
  for (let index = 1; index < first.required; index += 1) roles.push({ slot: first });
  for (let index = 1; index < second.required; index += 1) roles.push({ slot: second });
  roles.push({ slot: third, extend: "b" });
  for (let index = 1; index < third.required; index += 1) roles.push({ slot: third });
  if (roles.length !== people.length) return [];

  const interval = (role: Role): [number, number] => {
    if (role.extend === "f") return [first.start, first.end + half];
    if (role.extend === "b") return [third.start - half, third.end];
    return [role.slot.start, role.slot.end];
  };
  const needs = (role: Role): Slot[] => {
    if (role.extend === "f") return [first, second];
    if (role.extend === "b") return [third, second];
    return [role.slot];
  };

  const allowed = people.map((employeeId) =>
    roles.map((role) => {
      const employee = state.emps.find((item) => item.id === employeeId);
      if (!employee?.active) return false;
      if (needs(role).some((slot) => staticReason(state, employee, slot, week))) return false;
      const [start, end] = interval(role);
      if (end - start > maxLength + 1e-9) return false;
      const proposed: Slot = { ...role.slot, start, end };
      return !dynamicReason(state, employee, proposed, mineOf(employeeId));
    }),
  );

  const origin = (employeeId: string) => daySlots.find((slot) => assigned(slot).includes(employeeId))!.key;
  const found: { moves: number; pick: number[] }[] = [];
  const used: boolean[] = [];
  const pick: number[] = [];
  const search = (index: number): void => {
    if (index === people.length) {
      const moves = people.reduce(
        (sum, employeeId, personIndex) => sum + (origin(employeeId) !== roles[pick[personIndex]].slot.key ? 1 : 0),
        0,
      );
      found.push({ moves, pick: pick.slice() });
      return;
    }
    for (let roleIndex = 0; roleIndex < roles.length; roleIndex += 1) {
      if (used[roleIndex] || !allowed[index][roleIndex]) continue;
      used[roleIndex] = true;
      pick[index] = roleIndex;
      search(index + 1);
      used[roleIndex] = false;
    }
  };
  search(0);
  found.sort((a, b) => a.moves - b.moves);

  const seen = new Set<string>();
  const options: CoverageOption[] = [];
  for (const result of found) {
    const signature = result.pick.map((roleIndex) => `${roles[roleIndex].slot.key}${roles[roleIndex].extend ?? ""}`).join();
    if (seen.has(signature)) continue;
    seen.add(signature);
    const parts = people
      .map((employeeId, personIndex) => {
        const role = roles[result.pick[personIndex]];
        const [start, end] = interval(role);
        const employee = state.emps.find((item) => item.id === employeeId)!;
        return {
          id: employeeId,
          name: employee.name,
          slotKey: role.slot.key,
          start,
          end,
          from: origin(employeeId),
          extended: Boolean(role.extend),
        };
      })
      .sort((a, b) => a.start - b.start);
    const nextAssign: Record<string, string[]> = {};
    for (const slot of daySlots) nextAssign[slot.key] = [];
    for (const part of parts) nextAssign[part.slotKey].push(part.id);
    options.push({
      parts,
      assign: nextAssign,
      cover: second.key,
      ext: parts.filter((part) => part.extended),
    });
    if (options.length === 2) break;
  }
  return options;
}

/** Someone who may take one more shift than their agreement. Not applied until `applyExtra`. */
export function suggestExtra(state: RotaState, week: string, slot: Slot): ExtraShiftOption[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const openSlots = slots(state, week);
  const options: ExtraShiftOption[] = [];
  for (const employee of state.emps) {
    if (!employee.active || !employee.perWeek) continue;
    if ((schedule.assign[slot.key] ?? []).includes(employee.id)) continue;
    if (staticReason(state, employee, slot, week)) continue;
    const mine: Slot[] = [];
    for (const other of openSlots) {
      if ((schedule.assign[other.key] ?? []).includes(employee.id)) {
        mine.push(effectiveSlot(schedule, other, employee.id));
      }
    }
    const bumped = {
      ...employee,
      perWeek: employee.perWeek + approvedExtraShifts(state, employee.id) + 1,
    };
    if (dynamicReason(state, bumped, slot, mine)) continue;
    options.push({
      type: "extra",
      id: employee.id,
      name: employee.name,
      slotKey: slot.key,
      n: mine.length + 1,
      agreed: employee.perWeek,
      load: mine.length,
    });
  }
  return options.sort((a, b) => a.load - b.load).slice(0, 3);
}

export function applyCoverage(schedule: Schedule, option: CoverageOption): void {
  Object.assign(schedule.assign, option.assign);
  schedule.ext = schedule.ext ?? {};
  const groupId = `g${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  for (const part of option.ext) {
    schedule.ext[`${part.slotKey}#${part.id}`] = {
      start: part.start,
      end: part.end,
      groupId,
      cover: option.cover,
      groupSize: option.ext.length,
    };
  }
}

export function applyExtra(schedule: Schedule, option: ExtraShiftOption): void {
  schedule.assign[option.slotKey] = [...(schedule.assign[option.slotKey] ?? []), option.id];
  if (option.n > option.agreed) {
    schedule.over = schedule.over ?? {};
    schedule.over[`${option.slotKey}#${option.id}`] = true;
  }
}
