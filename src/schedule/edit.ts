import {
  analyze,
  applyCoverage,
  applyExtra,
  coveredSeats,
  deleteVersion,
  dynamicReason,
  effectiveSlot,
  ensureSchedule,
  formatReason,
  generate,
  slots,
  staticReason,
  suggest,
  suggestExtra,
  sundayOnOrBefore,
  assignEmergency,
  assignReplacement,
  recordCallOff,
  recordVersion,
  restoreVersion,
  type CoverageOption,
  type DroppedLock,
  type EmergencyChoice,
  type VersionStamp,
  type ExtraShiftOption,
  type Lang,
  type RotaState,
  type Schedule,
  type Slot,
} from "../domain";
import { isRelief, reliefAllowed } from "../domain/relief";
import type { Actor } from "../people/edit";

export type Proposal =
  | { kind: "coverage"; option: CoverageOption }
  | { kind: "extra"; option: ExtraShiftOption }
  | { kind: "relief"; employeeId: string; name: string };

export interface ReliefChoice {
  employeeId: string;
  name: string;
  /** The primary site's week is not ready to publish, so the seat cannot be filled yet. */
  held: boolean;
}

export interface PublishCheck {
  ready: boolean;
  violations: number;
  unfilled: number;
}

export interface History {
  present: RotaState;
  past: RotaState[];
  future: RotaState[];
}

const HISTORY_LIMIT = 60;

function cloneState(state: RotaState): RotaState {
  return structuredClone(state);
}

function mutate(state: RotaState, change: (draft: RotaState) => void): RotaState {
  const draft = cloneState(state);
  change(draft);
  return draft;
}

function isPublished(state: RotaState): boolean {
  return state.sched[state.week]?.status === "published";
}

function clearExtensionGroup(schedule: Schedule, slotKey: string, employeeId: string): void {
  const extensions = schedule.ext;
  if (!extensions) return;
  const key = `${slotKey}#${employeeId}`;
  const groupId = extensions[key]?.groupId;
  const next = { ...extensions };
  if (!groupId) {
    delete next[key];
  } else {
    for (const [otherKey, value] of Object.entries(next)) {
      if (value.groupId === groupId) delete next[otherKey];
    }
  }
  schedule.ext = next;
}

function clearOverage(schedule: Schedule, slotKey: string, employeeId: string): void {
  const key = `${slotKey}#${employeeId}`;
  if (!schedule.over?.[key]) return;
  const next = { ...schedule.over };
  delete next[key];
  schedule.over = next;
}

function clearLock(schedule: Schedule, slotKey: string, employeeId: string): void {
  const token = `${slotKey}#${employeeId}`;
  if (schedule.locked?.includes(token)) schedule.locked = schedule.locked.filter((item) => item !== token);
}

export function freshStamp(by = "manager"): VersionStamp {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), by };
}

export function generateWeek(state: RotaState): RotaState {
  return generateWithReport(state).state;
}

/** Same as `generateWeek`, plus the locks that no longer passed the rules. */
export function generateWithReport(state: RotaState): { state: RotaState; dropped: DroppedLock[] } {
  if (isPublished(state)) return { state, dropped: [] };
  let dropped: DroppedLock[] = [];
  const next = mutate(state, (draft) => {
    dropped = generate(draft, draft.week).dropped;
  });
  return { state: next, dropped };
}

export function isLocked(state: RotaState, slotKey: string, employeeId: string): boolean {
  return state.sched[state.week]?.locked?.includes(`${slotKey}#${employeeId}`) ?? false;
}

/** A lock keeps a draft seat in place when the week is generated again. */
export function toggleLock(state: RotaState, slotKey: string, employeeId: string): RotaState {
  if (isPublished(state)) return state;
  if (!(state.sched[state.week]?.assign[slotKey] ?? []).includes(employeeId)) return state;
  const token = `${slotKey}#${employeeId}`;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    const locked = schedule.locked ?? [];
    schedule.locked = locked.includes(token) ? locked.filter((item) => item !== token) : [...locked, token];
  });
}

export function restoreWeekVersion(state: RotaState, actor: Actor, versionId: string): RotaState {
  if (actor.kind !== "manager") return state;
  return restoreVersion(state, versionId);
}

/** Remove one frozen version of this week. The live schedule stays as it is. */
export function deleteWeekVersion(state: RotaState, actor: Actor, versionId: string): RotaState {
  if (actor.kind !== "manager") return state;
  return deleteVersion(state, versionId);
}

/** The current week has at least one assigned person. */
export function hasAssignments(state: RotaState): boolean {
  return Object.values(state.sched[state.week]?.assign ?? {}).some((ids) => ids.length > 0);
}

/** The draft has at least one assigned person. */
export function hasDraftAssignments(state: RotaState): boolean {
  return !isPublished(state) && hasAssignments(state);
}

/** Issues stay hidden on an empty draft. They open once someone is assigned, and a published week always shows them. */
export function scheduleIssuesOpen(state: RotaState): boolean {
  const schedule = state.sched[state.week];
  if (!schedule) return false;
  if (schedule.status === "published") return true;
  return hasAssignments(state);
}

/** Remove every assigned person from the current draft. A published week stays as it is. */
export function clearSchedule(state: RotaState): RotaState {
  if (!hasDraftAssignments(state)) return state;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign = {};
    schedule.locked = [];
    schedule.ext = {};
    schedule.over = {};
    schedule.calloffs = [];
    schedule.status = "draft";
    delete schedule.restoredFrom;
  });
}

/** An empty week is treated as unfilled, so it cannot be published. */
export function publishCheck(state: RotaState): PublishCheck {
  const draft = cloneState(state);
  ensureSchedule(draft, draft.week);
  const report = analyze(draft, draft.week);
  return {
    ready: report.violations.length === 0 && report.unfilled.length === 0,
    violations: report.violations.length,
    unfilled: report.unfilled.length,
  };
}

/** Publishing freezes a new version of the week. */
export function publishWeek(state: RotaState, stamp: VersionStamp = freshStamp()): RotaState {
  if (isPublished(state) || !publishCheck(state).ready) return state;
  const published = mutate(state, (draft) => {
    ensureSchedule(draft, draft.week).status = "published";
  });
  return recordVersion(published, "publish", stamp);
}

export function revertToDraft(state: RotaState): RotaState {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status === "draft") return state;
  return mutate(state, (draft) => {
    draft.sched[draft.week].status = "draft";
  });
}

export function goToWeek(state: RotaState, isoDate: string): RotaState {
  const week = sundayOnOrBefore(isoDate);
  if (week === state.week) return state;
  return { ...state, week };
}

export function addEmployee(state: RotaState, slotKey: string, employeeId: string): RotaState {
  if (isPublished(state)) return state;
  if (!state.emps.some((employee) => employee.id === employeeId)) return state;
  const assigned = state.sched[state.week]?.assign[slotKey] ?? [];
  if (assigned.includes(employeeId)) return state;
  if (assignmentBlocked(state, slotKey, employeeId)) return state;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[slotKey] = [...(schedule.assign[slotKey] ?? []), employeeId];
  });
}

export function removeEmployee(state: RotaState, slotKey: string, employeeId: string): RotaState {
  if (isPublished(state)) return state;
  const assigned = state.sched[state.week]?.assign[slotKey] ?? [];
  if (!assigned.includes(employeeId)) return state;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[slotKey] = (schedule.assign[slotKey] ?? []).filter((id) => id !== employeeId);
    clearExtensionGroup(schedule, slotKey, employeeId);
    clearOverage(schedule, slotKey, employeeId);
    clearLock(schedule, slotKey, employeeId);
  });
}

export function moveEmployee(state: RotaState, fromKey: string, employeeId: string, toKey: string): RotaState {
  if (fromKey === toKey || isPublished(state)) return state;
  const from = state.sched[state.week]?.assign[fromKey] ?? [];
  if (!from.includes(employeeId)) return state;
  const to = state.sched[state.week]?.assign[toKey] ?? [];
  if (to.includes(employeeId)) return state;
  if (assignmentBlocked(state, toKey, employeeId, fromKey)) return state;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[fromKey] = (schedule.assign[fromKey] ?? []).filter((id) => id !== employeeId);
    schedule.assign[toKey] = [...(schedule.assign[toKey] ?? []), employeeId];
    clearExtensionGroup(schedule, fromKey, employeeId);
    clearOverage(schedule, fromKey, employeeId);
    clearLock(schedule, fromKey, employeeId);
  });
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

function keptAssignments(state: RotaState, source: Schedule | null | undefined): Record<string, string[]> | null {
  if (!source) return null;
  const open = new Set(slots(state, state.week).map((slot) => slot.key));
  const people = new Set(state.emps.filter((employee) => employee.active).map((employee) => employee.id));
  const assign: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(source.assign)) {
    if (!open.has(key)) continue;
    const kept = ids.filter((id) => people.has(id));
    if (kept.length > 0) assign[key] = kept;
  }
  return Object.keys(assign).length > 0 ? assign : null;
}

/** A snapshot of the week on screen, for pasting onto another week. */
export function copySchedule(state: RotaState): Schedule | null {
  const schedule = state.sched[state.week];
  if (!schedule || !hasAssignments(state)) return null;
  return structuredClone(schedule);
}

/** Replace this week's draft with a copied schedule. A published week stays as it is. */
export function pasteSchedule(state: RotaState, source: Schedule | null): RotaState {
  if (isPublished(state)) return state;
  const assign = keptAssignments(state, source);
  if (!assign || !source) return state;
  const open = new Set(slots(state, state.week).map((slot) => slot.key));
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign = assign;
    schedule.status = "draft";
    delete schedule.restoredFrom;
    schedule.calloffs = [];
    schedule.locked = (source.locked ?? []).filter((token) => {
      const parsed = parseAssignmentToken(token);
      return Boolean(parsed && assign[parsed.slotKey]?.includes(parsed.employeeId));
    });
    const ext: NonNullable<Schedule["ext"]> = {};
    for (const [token, extension] of Object.entries(source.ext ?? {})) {
      const parsed = parseAssignmentToken(token);
      if (!parsed || !assign[parsed.slotKey]?.includes(parsed.employeeId) || !open.has(extension.cover)) continue;
      ext[token] = { ...extension };
    }
    schedule.ext = ext;
    const over: NonNullable<Schedule["over"]> = {};
    for (const token of Object.keys(source.over ?? {})) {
      const parsed = parseAssignmentToken(token);
      if (parsed && assign[parsed.slotKey]?.includes(parsed.employeeId)) over[token] = true;
    }
    schedule.over = over;
  });
}

/** How far this person's shift can stretch into the touching neighbour, within the site cap. */
export function doubleShiftPlan(
  state: RotaState,
  slotKey: string,
  employeeId: string,
): { start: number; end: number; cover: string; full: boolean } | null {
  const schedule = state.sched[state.week];
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!schedule || !employee?.active || !(schedule.assign[slotKey] ?? []).includes(employeeId)) return null;
  if (schedule.ext?.[`${slotKey}#${employeeId}`]) return null;
  const open = slots(state, state.week);
  const slot = open.find((item) => item.key === slotKey);
  if (!slot) return null;
  const cap = state.biz.maxShift > 0 ? state.biz.maxShift : 12;
  const room = cap - (slot.end - slot.start);
  if (room <= 0.01) return null;
  const forward = open.find((item) => near(item.start, slot.end));
  const backward = open.find((item) => near(item.end, slot.start));
  for (const neighbor of [forward, backward]) {
    if (!neighbor) continue;
    if (staticReason(state, employee, neighbor, state.week)) continue;
    const span = neighbor.end - neighbor.start;
    const take = Math.min(room, span);
    if (take <= 0.01) continue;
    const full = near(take, span);
    const ahead = neighbor === forward;
    const start = ahead ? slot.start : slot.start - take;
    const end = ahead ? slot.end + take : slot.end;
    const proposed: Slot = { ...slot, start, end };
    const mine = open
      .filter((item) => item.key !== slot.key && (!full || item.key !== neighbor.key) && (schedule.assign[item.key] ?? []).includes(employeeId))
      .map((item) => effectiveSlot(schedule, item, employeeId));
    if (dynamicReason(state, employee, proposed, mine)) continue;
    return { start, end, cover: neighbor.key, full };
  }
  return null;
}

/** Extend one assigned shift into the touching neighbour, or remove that extension. */
export function extendToDouble(state: RotaState, slotKey: string, employeeId: string): RotaState {
  if (isPublished(state)) return state;
  const schedule = state.sched[state.week];
  if (!schedule || !(schedule.assign[slotKey] ?? []).includes(employeeId)) return state;
  if (schedule.ext?.[`${slotKey}#${employeeId}`]) {
    return mutate(state, (draft) => {
      clearExtensionGroup(ensureSchedule(draft, draft.week), slotKey, employeeId);
    });
  }
  const plan = doubleShiftPlan(state, slotKey, employeeId);
  if (!plan) return state;
  return mutate(state, (draft) => {
    const next = ensureSchedule(draft, draft.week);
    if (plan.full) {
      next.assign[plan.cover] = (next.assign[plan.cover] ?? []).filter((id) => id !== employeeId);
      clearExtensionGroup(next, plan.cover, employeeId);
      clearOverage(next, plan.cover, employeeId);
      clearLock(next, plan.cover, employeeId);
    }
    next.ext = { ...(next.ext ?? {}) };
    next.ext[`${slotKey}#${employeeId}`] = {
      start: plan.start,
      end: plan.end,
      groupId: `double:${slotKey}#${employeeId}`,
      cover: plan.cover,
      groupSize: plan.full ? 1 : 2,
    };
  });
}

/** Swap the order of two people in the same shift. Who works it does not change. */
export function swapInSlot(state: RotaState, slotKey: string, employeeId: string, otherId: string): RotaState {
  if (employeeId === otherId || isPublished(state)) return state;
  const ids = state.sched[state.week]?.assign[slotKey] ?? [];
  const from = ids.indexOf(employeeId);
  const to = ids.indexOf(otherId);
  if (from < 0 || to < 0) return state;
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    schedule.assign[slotKey] = next;
  });
}

/** Rest, constraints, hours, and shift length, including the same employee id at other sites. */
function assignmentBlocked(state: RotaState, slotKey: string, employeeId: string, exceptKey?: string): boolean {
  const slot = slots(state, state.week).find((item) => item.key === slotKey);
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!slot || !employee) return true;
  if (!reliefAllowed(state, employee)) return true;
  if (staticReason(state, employee, slot, state.week)) return true;
  const schedule = state.sched[state.week];
  const mine = slots(state, state.week)
    .filter((open) => open.key !== exceptKey && (schedule?.assign[open.key] ?? []).includes(employeeId))
    .map((open) => (schedule ? effectiveSlot(schedule, open, employeeId) : open));
  const reason = dynamicReason(state, employee, slot, mine);
  return reason !== null && reason.code !== "weekly_shifts";
}

export function placementWarning(state: RotaState, slot: Slot, employeeId: string, lang: Lang): string | null {
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!employee) return null;
  if (!reliefAllowed(state, employee)) return formatReason({ code: "home_schedule" }, lang);
  const blocked = staticReason(state, employee, slot, state.week);
  if (blocked) return formatReason(blocked, lang);
  const schedule = state.sched[state.week];
  const mine = slots(state, state.week)
    .filter((open) => (schedule?.assign[open.key] ?? []).includes(employeeId))
    .map((open) => (schedule ? effectiveSlot(schedule, open, employeeId) : open));
  const dynamic = dynamicReason(state, employee, slot, mine, lang);
  return dynamic ? formatReason(dynamic, lang) : null;
}

export function proposalsFor(state: RotaState, slot: Slot): Proposal[] {
  const regular: Proposal[] = [
    ...suggestExtra(state, state.week, slot).map((option) => ({ kind: "extra" as const, option })),
    ...suggest(state, state.week, slot).map((option) => ({ kind: "coverage" as const, option })),
  ];
  if (regular.length > 0) return regular;
  return reliefChoices(state, slot)
    .filter((choice) => !choice.held)
    .map((choice) => ({ kind: "relief" as const, employeeId: choice.employeeId, name: choice.name }));
}

/** Reinforcement staff who could fill a hole nobody else can. They are never placed automatically. */
export function reliefChoices(state: RotaState, slot: Slot): ReliefChoice[] {
  if (suggestExtra(state, state.week, slot).length > 0 || suggest(state, state.week, slot).length > 0) return [];
  const schedule = state.sched[state.week];
  const choices: ReliefChoice[] = [];
  for (const employee of state.emps) {
    if (!employee.active || !isRelief(employee, state.siteId)) continue;
    if ((schedule?.assign[slot.key] ?? []).includes(employee.id)) continue;
    if (staticReason(state, employee, slot, state.week)) continue;
    const mine = slots(state, state.week)
      .filter((open) => (schedule?.assign[open.key] ?? []).includes(employee.id))
      .map((open) => (schedule ? effectiveSlot(schedule, open, employee.id) : open));
    const reason = dynamicReason(state, employee, slot, mine);
    if (reason && reason.code !== "weekly_shifts") continue;
    choices.push({
      employeeId: employee.id,
      name: employee.name,
      held: !reliefAllowed(state, employee),
    });
  }
  choices.sort((left, right) => left.name.localeCompare(right.name, "he"));
  return choices;
}

/** Hours from local Sunday 00:00 of `week` until `now`. */
export function hoursSinceWeek(week: string, now: Date): number {
  const [year, month, day] = week.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  return (now.getTime() - start.getTime()) / 3_600_000;
}

export function reportCallOff(
  state: RotaState,
  actor: Actor,
  input: { id: string; slotKey: string; employeeId: string; at: string; nowHours: number },
): RotaState {
  if (actor.kind !== "manager") return state;
  return recordCallOff(state, { ...input, by: "manager" });
}

/** Every cover on a published week becomes a new version. */
export function approveReplacement(
  state: RotaState,
  actor: Actor,
  slotKey: string,
  employeeId: string,
  stamp: VersionStamp = freshStamp(),
): RotaState {
  if (actor.kind !== "manager") return state;
  const next = assignReplacement(state, slotKey, employeeId);
  return next === state ? state : recordVersion(next, "calloff", stamp);
}

export function approveEmergency(
  state: RotaState,
  actor: Actor,
  slotKey: string,
  choice: EmergencyChoice,
  stamp: VersionStamp = freshStamp(),
): RotaState {
  if (actor.kind !== "manager") return state;
  const next = assignEmergency(state, slotKey, choice);
  return next === state ? state : recordVersion(next, "calloff", stamp);
}

export function approveProposal(state: RotaState, slot: Slot, index: number): RotaState {
  if (isPublished(state)) return state;
  const proposal = proposalsFor(state, slot)[index];
  if (!proposal) return state;
  if (proposal.kind === "relief") return addEmployee(state, slot.key, proposal.employeeId);
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    if (proposal.kind === "extra") applyExtra(schedule, proposal.option);
    else applyCoverage(schedule, proposal.option);
  });
}

export function coverageSummary(state: RotaState): { filled: number; required: number } {
  const schedule = state.sched[state.week];
  let filled = 0;
  let required = 0;
  for (const slot of slots(state, state.week)) {
    required += slot.required;
    const assigned = schedule?.assign[slot.key]?.length ?? 0;
    const covered = schedule ? coveredSeats(schedule, slot.key) : 0;
    filled += Math.min(slot.required, assigned + covered);
  }
  return { filled, required };
}

export function assignmentToken(slotKey: string, employeeId: string): string {
  return `${slotKey}#${employeeId}`;
}

export function parseAssignmentToken(token: string): { slotKey: string; employeeId: string } | null {
  const split = token.lastIndexOf("#");
  if (split <= 0) return null;
  return { slotKey: token.slice(0, split), employeeId: token.slice(split + 1) };
}

export function clockLabel(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const hours = Math.floor(wrapped + 1e-9);
  const minutes = Math.round((wrapped - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function commit(history: History, next: RotaState): History {
  if (next === history.present) return history;
  return {
    present: next,
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    present: next,
    past: [...history.past, history.present],
    future: rest,
  };
}
