import type { Employee, RotaState } from "./types";

/** A reinforcement site is any linked site other than the employee's primary site. */
export function isRelief(employee: Pick<Employee, "homeSiteId">, siteId: string | undefined): boolean {
  return Boolean(siteId && employee.homeSiteId && employee.homeSiteId !== siteId);
}

/** Manual placement on a reinforcement site is allowed only after the primary week is ready to publish. */
export function reliefAllowed(state: RotaState, employee: Pick<Employee, "id" | "homeSiteId">): boolean {
  if (!isRelief(employee, state.siteId)) return true;
  return state.homeReady?.[employee.id] === true;
}

/** This week's shifts already worked by the same employee id at other sites. */
export function peerLoad(state: RotaState, employeeId: string): { shifts: number; hours: number } {
  let shifts = 0;
  let hours = 0;
  for (const peer of state.peers?.[employeeId] ?? []) {
    if (peer.weekOffset !== 0) continue;
    shifts += 1;
    hours += peer.end - peer.start;
  }
  return { shifts, hours };
}
