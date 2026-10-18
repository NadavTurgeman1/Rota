import { effectiveSlot } from "./schedule";
import { slots } from "./rules";
import { addDays } from "./time";
import type { PeerShift, RotaState } from "./types";

/** Shifts the same employee id works at the other sites of this business. */
export function peerDuties(
  sites: { id: string; state: RotaState }[],
  siteId: string,
  week: string,
): Record<string, PeerShift[]> {
  const here = sites.find((site) => site.id === siteId);
  if (!here) return {};
  const ids = here.state.emps.map((employee) => employee.id);
  const peers: Record<string, PeerShift[]> = {};
  for (const site of sites) {
    if (site.id === siteId) continue;
    for (const employeeId of ids) {
      const duties = dutiesAt(site.state, site.id, employeeId, week);
      if (duties.length === 0) continue;
      (peers[employeeId] ??= []).push(...duties);
    }
  }
  return peers;
}

function dutiesAt(state: RotaState, siteId: string, employeeId: string, week: string): PeerShift[] {
  const found: PeerShift[] = [];
  for (const [dayOffset, hourOffset] of [
    [-7, -168],
    [0, 0],
    [7, 168],
  ] as const) {
    const schedule = state.sched[addDays(week, dayOffset)];
    if (!schedule) continue;
    for (const slot of slots(state, week)) {
      if (!(schedule.assign[slot.key] ?? []).includes(employeeId)) continue;
      const effective = effectiveSlot(schedule, slot, employeeId);
      const shift = state.biz.shifts.find((item) => item.id === slot.shiftId);
      found.push({
        key: `${siteId}|${dayOffset}|${slot.key}`,
        day: slot.day,
        start: effective.start + hourOffset,
        end: effective.end + hourOffset,
        label: `${state.biz.name} · ${shift?.name ?? slot.shiftId}`,
        minRest: state.biz.minRest,
        maxHours: state.biz.maxHours,
        maxDayHours: state.biz.maxDayHours ?? 0,
        maxShift: state.biz.maxShift,
        weekOffset: dayOffset,
      });
    }
  }
  return found;
}
