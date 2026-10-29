import type { Employee, RotaState, ShiftDefinition } from "../domain";
import { shiftKind } from "../domain/time";
import { MANAGER, removeEmployeeRecord, updateEmployee, type EmployeePatch } from "./edit";
import type { Workspace } from "../workspace/workspace";

/** Keep the person's details aligned on every site that already has this employee id. */
export function mirrorPerson(workspace: Workspace, exceptSiteId: string, person: Employee): Workspace {
  const patch: EmployeePatch = {
    name: person.name,
    contact: person.contact,
    phone: person.phone ?? "",
    role: person.role,
    quals: person.quals,
    perWeek: person.perWeek,
    maxHours: person.maxHours,
    hourlyWage: person.hourlyWage ?? 0,
    active: person.active,
    customBlocks: person.customBlocks ?? null,
  };
  let changed = false;
  const sites = workspace.sites.map((site) => {
    if (site.id === exceptSiteId || !site.state.emps.some((employee) => employee.id === person.id)) return site;
    const next = updateEmployee(site.state, MANAGER, person.id, patch);
    if (next === site.state) return site;
    changed = true;
    return { ...site, state: next };
  });
  return changed ? { ...workspace, sites } : workspace;
}

/** Fill a missing primary site. One linked site is primary. The first listed site wins when none was chosen. */
export function ensurePrimarySites<T extends { id: string; state: RotaState }>(sites: T[]): T[] {
  const known = new Set(sites.map((site) => site.id));
  const homeOf = new Map<string, string>();
  for (const site of sites) {
    for (const employee of site.state.emps) {
      if (employee.homeSiteId && known.has(employee.homeSiteId)) homeOf.set(employee.id, employee.homeSiteId);
    }
  }
  for (const site of sites) {
    for (const employee of site.state.emps) {
      if (!homeOf.has(employee.id)) homeOf.set(employee.id, site.id);
    }
  }
  let changed = false;
  const next = sites.map((site) => {
    let emps = site.state.emps;
    let siteChanged = false;
    emps.forEach((employee, index) => {
      const home = homeOf.get(employee.id);
      if (!home || employee.homeSiteId === home) return;
      if (!siteChanged) {
        emps = [...emps];
        siteChanged = true;
      }
      emps[index] = { ...employee, homeSiteId: home };
    });
    if (!siteChanged) return site;
    changed = true;
    return { ...site, state: { ...site.state, emps } };
  });
  return changed ? next : sites;
}

/**
 * Link one employee id to sites of this business.
 * One kept site is primary. The others are reinforcement.
 * The id stays the same on every site. A site with a current or future published shift cannot be removed.
 * The last remaining site stays.
 */
export function setEmployeeSites(
  workspace: Workspace,
  employeeId: string,
  siteIds: string[],
  currentWeek: string,
  homeSiteId?: string,
): Workspace {
  const origin = workspace.sites.find((site) => site.state.emps.some((employee) => employee.id === employeeId));
  const source = origin?.state.emps.find((employee) => employee.id === employeeId);
  if (!origin || !source) return workspace;
  const known = new Set(workspace.sites.map((site) => site.id));
  const wanted = new Set(siteIds.filter((siteId) => known.has(siteId)));
  const kept = new Set<string>();
  for (const site of workspace.sites) {
    const present = site.state.emps.some((employee) => employee.id === employeeId);
    if (!present) {
      if (wanted.has(site.id)) kept.add(site.id);
      continue;
    }
    if (wanted.has(site.id) || removeEmployeeRecord(site.state, MANAGER, employeeId, currentWeek) === site.state) {
      kept.add(site.id);
    }
  }
  if (kept.size === 0) return workspace;
  const home =
    (homeSiteId && kept.has(homeSiteId) ? homeSiteId : undefined) ??
    (source.homeSiteId && kept.has(source.homeSiteId) ? source.homeSiteId : undefined) ??
    workspace.sites.find((site) => kept.has(site.id))?.id;
  if (!home) return workspace;
  let changed = false;
  const sites = workspace.sites.map((site) => {
    const present = site.state.emps.some((employee) => employee.id === employeeId);
    if (kept.has(site.id) && !present) {
      changed = true;
      return { ...site, state: addPerson(site.state, origin.state, source, home) };
    }
    if (!kept.has(site.id) && present) {
      changed = true;
      return { ...site, state: removeEmployeeRecord(site.state, MANAGER, employeeId, currentWeek) };
    }
    if (present && site.state.emps.find((employee) => employee.id === employeeId)?.homeSiteId !== home) {
      changed = true;
      return { ...site, state: stampHome(site.state, employeeId, home) };
    }
    return site;
  });
  return changed ? { ...workspace, sites } : workspace;
}

/** Copy the agreement, preferences, and weekly availability onto every other site, matched by shift kind. */
export function mirrorConstraints(workspace: Workspace, sourceSiteId: string): Workspace {
  const origin = workspace.sites.find((site) => site.id === sourceSiteId);
  if (!origin) return workspace;
  let changed = false;
  const sites = workspace.sites.map((site) => {
    if (site.id === sourceSiteId) return site;
    let emps = site.state.emps;
    let avail = site.state.avail;
    let siteChanged = false;
    for (const person of origin.state.emps) {
      const index = emps.findIndex((employee) => employee.id === person.id);
      if (index < 0) continue;
      const current = emps[index];
      if (!current) continue;
      const next = translatePerson(current, person, origin.state, site.state);
      if (next !== current) {
        if (!siteChanged) emps = [...emps];
        emps[index] = next;
        siteChanged = true;
      }
      const nextAvail = translateAvail(avail, origin.state.avail, person.id, origin.state, site.state);
      if (nextAvail !== avail) {
        avail = nextAvail;
        siteChanged = true;
      }
    }
    if (!siteChanged) return site;
    changed = true;
    return { ...site, state: { ...site.state, emps, avail } };
  });
  return changed ? { ...workspace, sites } : workspace;
}

function stampHome(state: RotaState, employeeId: string, homeSiteId: string): RotaState {
  return {
    ...state,
    emps: state.emps.map((employee) => (employee.id === employeeId ? { ...employee, homeSiteId } : employee)),
  };
}

function addPerson(target: RotaState, origin: RotaState, source: Employee, homeSiteId: string): RotaState {
  const person = translatePerson(
    {
      id: source.id,
      name: source.name,
      contact: source.contact,
      phone: source.phone ?? "",
      role: source.role,
      quals: source.quals,
      perWeek: source.perWeek,
      maxHours: source.maxHours,
      hourlyWage: source.hourlyWage ?? 0,
      pref: [],
      active: source.active,
      grid: [[], [], [], [], [], [], []],
      ...(source.loginEmail ? { loginEmail: source.loginEmail, loginConfirmed: source.loginConfirmed === true } : {}),
    },
    source,
    origin,
    target,
  );
  return {
    ...target,
    emps: [...target.emps, { ...person, homeSiteId }].sort((left, right) => left.name.localeCompare(right.name, "en")),
    avail: translateAvail(target.avail, origin.avail, source.id, origin, target),
  };
}

function translatePerson(current: Employee, source: Employee, origin: RotaState, target: RotaState): Employee {
  const grid = [0, 1, 2, 3, 4, 5, 6].map((day) => translateShiftIds(origin, target, dayIds(source, origin, day)));
  const pref = translateShiftIds(origin, target, source.pref ?? []);
  const homeSiteId = source.homeSiteId ?? current.homeSiteId;
  const sameCustom = JSON.stringify(current.customBlocks ?? null) === JSON.stringify(source.customBlocks ?? null);
  if (sameIds(current.pref ?? [], pref) && sameGrid(current.grid, grid) && current.homeSiteId === homeSiteId && sameCustom) return current;
  const next: Employee = { ...current, pref, grid, ...(homeSiteId ? { homeSiteId } : {}) };
  if (source.customBlocks) next.customBlocks = source.customBlocks;
  else delete next.customBlocks;
  return next;
}

function dayIds(employee: Employee, state: RotaState, day: number): string[] {
  if (employee.grid) return employee.grid[day] ?? [];
  if ((employee.blocked ?? []).includes(day)) return [];
  const allowed = new Set(employee.allowed ?? []);
  return state.biz.shifts.filter((shift) => allowed.has(shift.id)).map((shift) => shift.id);
}

function translateShiftIds(origin: RotaState, target: RotaState, ids: string[]): string[] {
  const kinds = new Set(ids.map((id) => kindOf(origin.biz.shifts, id)).filter((kind) => kind !== null));
  return target.biz.shifts.filter((shift) => kinds.has(shiftKind(shift.start, shift.end))).map((shift) => shift.id);
}

function kindOf(shifts: ShiftDefinition[], id: string): "m" | "a" | "n" | null {
  const shift = shifts.find((item) => item.id === id);
  return shift ? shiftKind(shift.start, shift.end) : null;
}

/** One week's primary-site constraints, written with the shifts of the site being viewed. */
export function constraintsAsSeenHere(
  here: RotaState,
  home: { shifts: ShiftDefinition[]; avail: RotaState["avail"] },
  employeeId: string,
  week: string,
): string[][] | undefined {
  const sourceDays = home.avail[week]?.[employeeId];
  if (!sourceDays) return undefined;
  const origin = { biz: { shifts: home.shifts } } as RotaState;
  return sourceDays.map((day) => translateShiftIds(origin, here, day));
}

function translateAvail(
  targetAvail: RotaState["avail"],
  sourceAvail: RotaState["avail"],
  employeeId: string,
  origin: RotaState,
  target: RotaState,
): RotaState["avail"] {
  const weeks = new Set([...Object.keys(targetAvail), ...Object.keys(sourceAvail)]);
  let changed = false;
  const next: RotaState["avail"] = { ...targetAvail };
  for (const week of weeks) {
    const sourceDays = sourceAvail[week]?.[employeeId];
    const currentDays = targetAvail[week]?.[employeeId];
    if (!sourceDays) {
      if (!currentDays) continue;
      const weekRows = { ...next[week] };
      delete weekRows[employeeId];
      next[week] = weekRows;
      if (Object.keys(weekRows).length === 0) delete next[week];
      changed = true;
      continue;
    }
    const translated = sourceDays.map((day) => translateShiftIds(origin, target, day));
    if (sameGrid(currentDays, translated)) continue;
    next[week] = { ...next[week], [employeeId]: translated };
    changed = true;
  }
  return changed ? next : targetAvail;
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && right.every((id, index) => id === left[index]);
}

function sameGrid(left: string[][] | undefined, right: string[][]): boolean {
  if (!left || left.length !== right.length) return false;
  return right.every((day, index) => sameIds(left[index] ?? [], day));
}
