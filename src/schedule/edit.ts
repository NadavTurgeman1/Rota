import {
  analyze,
  applyCoverage,
  applyExtra,
  coveredSeats,
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
import type { Actor } from "../people/edit";

export type Proposal =
  | { kind: "coverage"; option: CoverageOption }
  | { kind: "extra"; option: ExtraShiftOption };

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
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[fromKey] = (schedule.assign[fromKey] ?? []).filter((id) => id !== employeeId);
    schedule.assign[toKey] = [...(schedule.assign[toKey] ?? []), employeeId];
    clearExtensionGroup(schedule, fromKey, employeeId);
    clearOverage(schedule, fromKey, employeeId);
    clearLock(schedule, fromKey, employeeId);
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

export function placementWarning(state: RotaState, slot: Slot, employeeId: string, lang: Lang): string | null {
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!employee) return null;
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
  return [
    ...suggestExtra(state, state.week, slot).map((option) => ({ kind: "extra" as const, option })),
    ...suggest(state, state.week, slot).map((option) => ({ kind: "coverage" as const, option })),
  ];
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
