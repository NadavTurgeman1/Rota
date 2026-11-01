import {
  CAPABILITY_KEYS,
  MANAGEMENT_CAPABILITIES,
  type Capabilities,
  type Capability,
  type Employee,
} from "../domain/types";

export interface ReportNode {
  id: string;
  reportsTo?: string;
  openedBy?: string;
  capabilities?: Capabilities;
  schedulable?: boolean;
}

const STAFF_ON: Capability[] = ["clock", "constraints", "absences", "trades", "schedule_view"];

/** Weekly constraints and shift swaps apply only to someone who can be placed on a shift. Clocking in is the day's attendance, so it stays. */
export const SHIFT_CAPABILITIES = ["constraints", "trades"] as const satisfies readonly Capability[];

export function blankCapabilities(): Capabilities {
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, false])) as Capabilities;
}

export function allCapabilities(): Capabilities {
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true])) as Capabilities;
}

/** A person who works shifts, submits constraints, and sees a published schedule. */
export function staffCapabilities(): Capabilities {
  const caps = blankCapabilities();
  for (const key of STAFF_ON) caps[key] = true;
  return caps;
}

/** Site and people authority, plus the same personal tools as every employee. */
export function managerCapabilities(): Capabilities {
  return allCapabilities();
}

export function normalizeCapabilities(value: unknown): Capabilities {
  const caps = blankCapabilities();
  if (!value || typeof value !== "object") return caps;
  const record = value as Record<string, unknown>;
  for (const key of CAPABILITY_KEYS) caps[key] = record[key] === true;
  if (caps.schedule_edit) caps.schedule_view = true;
  return caps;
}

export function isLead(capabilities: Capabilities): boolean {
  return MANAGEMENT_CAPABILITIES.some((key) => capabilities[key]);
}

/** A site manager leads people or sites. A person who only works shifts is not one. */
export function isSiteManager(person: { schedulable?: boolean; capabilities?: Capabilities }): boolean {
  return person.schedulable === false || isLead(capabilitiesOf(person));
}

/** Keep only permissions the grantor holds. The company owner can grant any of them. */
export function grantable(actor: Capabilities, requested: Capabilities, owner = false): Capabilities {
  const next = blankCapabilities();
  for (const key of CAPABILITY_KEYS) {
    next[key] = (owner || actor[key]) && requested[key] === true;
  }
  if (next.schedule_edit) next.schedule_view = true;
  return next;
}

export function isSchedulable(employee: { schedulable?: boolean }): boolean {
  return employee.schedulable !== false;
}

/** A person who is not placed on shifts does not submit weekly constraints or request swaps. */
export function withoutShiftCapabilities(caps: Capabilities): Capabilities {
  const next = { ...caps };
  for (const key of SHIFT_CAPABILITIES) next[key] = false;
  return next;
}

export function capabilitiesOf(employee: Pick<Employee, "capabilities">): Capabilities {
  return employee.capabilities ? normalizeCapabilities(employee.capabilities) : staffCapabilities();
}

/** Walk up the reporting line. A person is not an ancestor of themselves. */
export function isAncestor(people: ReportNode[], ancestorId: string | null | undefined, descendantId: string): boolean {
  if (!ancestorId || ancestorId === descendantId) return false;
  const byId = new Map(people.map((person) => [person.id, person]));
  let cursor = byId.get(descendantId)?.reportsTo;
  const seen = new Set<string>();
  for (let depth = 0; cursor && depth < 32; depth += 1) {
    if (cursor === ancestorId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    cursor = byId.get(cursor)?.reportsTo;
  }
  return false;
}

export function descendants(people: ReportNode[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const person of people) {
    if (!person.reportsTo) continue;
    const list = children.get(person.reportsTo) ?? [];
    list.push(person.id);
    children.set(person.reportsTo, list);
  }
  const out: string[] = [];
  const stack = [...(children.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(children.get(next) ?? []));
  }
  return out;
}

/**
 * Where direct management of `employeeId` may move.
 * The owner can choose any site manager in the company.
 * Anyone else can choose themselves, or a site manager under them, and never someone under the employee.
 */
export function transferTargets(
  people: ReportNode[],
  employeeId: string,
  actorId: string | null | undefined,
  owner = false,
): string[] {
  const person = people.find((item) => item.id === employeeId);
  if (!person) return [];
  const blocked = new Set([employeeId, ...descendants(people, employeeId)]);
  if (owner) {
    return people
      .filter((item) => {
        if (blocked.has(item.id)) return false;
        if (actorId && item.id === actorId) return true;
        return isSiteManager(item);
      })
      .map((item) => item.id);
  }
  if (!actorId) return [];
  const may = actorId === person.openedBy || isAncestor(people, actorId, employeeId);
  if (!may) return [];
  return people
    .filter((item) => {
      if (blocked.has(item.id)) return false;
      if (item.id === actorId) return true;
      return isAncestor(people, actorId, item.id) && isSiteManager(item);
    })
    .map((item) => item.id);
}

/** True when someone still reports here, or this person opened their account. */
export function holdsPeople(people: ReportNode[], employeeId: string): boolean {
  return people.some(
    (person) => person.id !== employeeId && (person.reportsTo === employeeId || person.openedBy === employeeId),
  );
}
