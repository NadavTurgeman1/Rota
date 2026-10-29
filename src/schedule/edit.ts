import {
  analyze,
  applyCoverage,
  applyExtra,
  assignmentSpan,
  clearAssignmentHours,
  coveredSeats,
  deleteVersion,
  dynamicReason,
  formatClock,
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
  undoCallOff,
  recordVersion,
  restoreVersion,
  weekCoverage,
  type CoverageGap,
  type CoverageOption,
  type DroppedLock,
  type EmergencyChoice,
  type VersionStamp,
  type ExtraShiftOption,
  type Lang,
  type Reason,
  type RotaState,
  type Schedule,
  type Slot,
} from "../domain";
import { isRelief, reliefAllowed } from "../domain/relief";
import { staffedCount } from "../domain/rest";
import type { Actor } from "../people/edit";

export type Proposal =
  | { kind: "coverage"; option: CoverageOption }
  | { kind: "extra"; option: ExtraShiftOption }
  | { kind: "relief"; employeeId: string; name: string };

/** Which closed suggestion group a proposal belongs in. A move stays a move even when someone also extends. */
export function proposalBucket(proposal: Proposal): SolutionBucket {
  if (proposal.kind === "extra" || proposal.kind === "relief") return "add";
  return proposal.option.parts.some((part) => part.from !== part.slotKey) ? "change" : "extend";
}

/** A shortage nudge lengthens a shift. A surplus nudge pulls an edge back. */
export function hourFixBucket(delta: number): SolutionBucket {
  return delta < 0 ? "extend" : "change";
}

export interface ReliefChoice {
  employeeId: string;
  name: string;
  /** The primary site's week is not ready to publish, so the seat cannot be filled yet. */
  held: boolean;
}

export type SolutionBucket = "add" | "extend" | "change";

export interface PublishCheck {
  ready: boolean;
  violations: number;
  unfilled: number;
  coverage: number;
  /** Seats on an agreement constraint or a weekly constraint. Publishing stays refused. */
  constraint: number;
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
export function generateWithReport(state: RotaState, random?: () => number): { state: RotaState; dropped: DroppedLock[] } {
  if (isPublished(state)) return { state, dropped: [] };
  let dropped: DroppedLock[] = [];
  const next = mutate(state, (draft) => {
    dropped = generate(draft, draft.week, random).dropped;
  });
  return { state: next, dropped };
}

/** Build the week again. Unlocked shifts are mixed among people the rules allow. Locked shifts stay. */
export function reshuffleWeek(state: RotaState, random: () => number = Math.random): RotaState {
  return generateWithReport(state, random).state;
}

/** Every person currently on this shift is held in place for the next regenerate. */
export function slotLocked(state: RotaState, slotKey: string): boolean {
  const ids = state.sched[state.week]?.assign[slotKey] ?? [];
  const locked = state.sched[state.week]?.locked ?? [];
  return ids.length > 0 && ids.every((id) => locked.includes(`${slotKey}#${id}`));
}

export function toggleSlotLock(state: RotaState, slotKey: string): RotaState {
  if (isPublished(state)) return state;
  const ids = state.sched[state.week]?.assign[slotKey] ?? [];
  if (ids.length === 0) return state;
  const locking = !slotLocked(state, slotKey);
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    if (locking) {
      const held = new Set(schedule.locked);
      for (const id of ids) held.add(`${slotKey}#${id}`);
      schedule.locked = [...held];
      return;
    }
    schedule.locked = schedule.locked.filter((token) => !token.startsWith(`${slotKey}#`));
  });
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
    delete schedule.hours;
    schedule.over = {};
    schedule.calloffs = [];
    schedule.status = "draft";
    delete schedule.restoredFrom;
  });
}

const CONSTRAINT_CODES = new Set(["agreement", "unavailable", "shabbat", "holiday"]);

/** An empty week is unfilled. Publishing it needs an explicit confirmation. A seat on a constraint never publishes. */
export function publishCheck(state: RotaState): PublishCheck {
  const draft = cloneState(state);
  ensureSchedule(draft, draft.week);
  const report = analyze(draft, draft.week);
  return {
    ready: report.violations.length === 0 && report.unfilled.length === 0 && report.coverage.length === 0,
    violations: report.violations.length,
    unfilled: report.unfilled.length,
    coverage: report.coverage.length,
    constraint: report.violations.filter((item) => item.reason && CONSTRAINT_CODES.has(item.reason.code)).length,
  };
}

/** Publishing freezes a new version of the week. `anyway` confirms every problem except a constraint seat. */
export function publishWeek(state: RotaState, stamp: VersionStamp = freshStamp(), options?: { anyway?: boolean }): RotaState {
  const check = publishCheck(state);
  if (isPublished(state) || check.constraint > 0 || (!check.ready && !options?.anyway)) return state;
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
  const keepLocked = slotLocked(state, slotKey);
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[slotKey] = [...(schedule.assign[slotKey] ?? []), employeeId];
    if (keepLocked) schedule.locked = [...schedule.locked, `${slotKey}#${employeeId}`];
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
    clearAssignmentHours(schedule, slotKey, employeeId);
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
  const keepLocked = slotLocked(state, toKey);
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    schedule.assign[fromKey] = (schedule.assign[fromKey] ?? []).filter((id) => id !== employeeId);
    schedule.assign[toKey] = [...(schedule.assign[toKey] ?? []), employeeId];
    if (keepLocked) schedule.locked = [...schedule.locked, `${toKey}#${employeeId}`];
    clearExtensionGroup(schedule, fromKey, employeeId);
    clearAssignmentHours(schedule, fromKey, employeeId);
    clearOverage(schedule, fromKey, employeeId);
    clearLock(schedule, fromKey, employeeId);
  });
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
    const hours: NonNullable<Schedule["hours"]> = {};
    for (const [token, span] of Object.entries(source.hours ?? {})) {
      const parsed = parseAssignmentToken(token);
      if (!parsed || !assign[parsed.slotKey]?.includes(parsed.employeeId)) continue;
      hours[token] = { ...span };
    }
    if (Object.keys(hours).length > 0) schedule.hours = hours;
    else delete schedule.hours;
    const over: NonNullable<Schedule["over"]> = {};
    for (const token of Object.keys(source.over ?? {})) {
      const parsed = parseAssignmentToken(token);
      if (parsed && assign[parsed.slotKey]?.includes(parsed.employeeId)) over[token] = true;
    }
    schedule.over = over;
  });
}

/** Set one person's clock on a draft shift. The shift's own hours clear the override. */
export function setAssignmentHours(state: RotaState, slotKey: string, employeeId: string, start: number, end: number): RotaState {
  if (isPublished(state)) return state;
  const schedule = state.sched[state.week];
  if (!schedule || !(schedule.assign[slotKey] ?? []).includes(employeeId)) return state;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start) || start < 0) return state;
  const slot = slots(state, state.week).find((item) => item.key === slotKey);
  if (!slot) return state;
  const cap = state.biz.maxShift > 0 ? state.biz.maxShift : 12;
  const length = end - start;
  if (length < 0.5 - 1e-6 || length > cap + 1e-6) return state;
  if (end <= slot.start + 1e-6 || start >= slot.end - 1e-6) return state;
  const key = `${slotKey}#${employeeId}`;
  const current = schedule.hours?.[key];
  const hasExtension = Boolean(schedule.ext?.[key]);
  const sameAsSlot = Math.abs(start - slot.start) < 0.01 && Math.abs(end - slot.end) < 0.01;
  if (!hasExtension && current && Math.abs(current.start - start) < 0.01 && Math.abs(current.end - end) < 0.01) return state;
  if (!hasExtension && !current && sameAsSlot) return state;
  return mutate(state, (draft) => {
    const next = ensureSchedule(draft, draft.week);
    clearExtensionGroup(next, slotKey, employeeId);
    if (sameAsSlot) clearAssignmentHours(next, slotKey, employeeId);
    else next.hours = { ...(next.hours ?? {}), [key]: { start, end } };
  });
}

export type HourFix = {
  employeeId: string;
  name: string;
  /** The shift the person is already on. The clock change is applied there. */
  slotKey: string;
  start: number;
  end: number;
  edge: "start" | "end";
};

const HOUR_FIX_EPS = 0.05;

function coverageImbalance(state: RotaState): number {
  return weekCoverage(state, state.week).reduce((sum, gap) => sum + Math.abs(gap.delta) * (gap.end - gap.start), 0);
}

function spanIsLegal(state: RotaState, employeeId: string, home: Slot, start: number, end: number): boolean {
  const employee = state.emps.find((item) => item.id === employeeId);
  const schedule = state.sched[state.week];
  if (!employee || !schedule) return false;
  const mine = slots(state, state.week)
    .filter((open) => open.key !== home.key && (schedule.assign[open.key] ?? []).includes(employeeId))
    .map((open) => effectiveSlot(schedule, open, employeeId));
  const reason = dynamicReason(state, employee, { ...home, start, end }, mine);
  return reason === null || reason.code === "weekly_shifts";
}

/**
 * A neighbor who can start earlier or stay later, or the person whose extra hour can move back.
 * Only a change that shrinks the week's shortage and surplus is offered.
 */
export function hourFixes(state: RotaState, gap: CoverageGap): HourFix[] {
  if (isPublished(state)) return [];
  const schedule = state.sched[state.week];
  if (!schedule) return [];
  const before = coverageImbalance(state);
  const cap = state.biz.maxShift > 0 ? state.biz.maxShift : 12;
  const found: (HourFix & { change: number })[] = [];
  const seen = new Set<string>();

  for (const slot of slots(state, state.week)) {
    for (const employeeId of schedule.assign[slot.key] ?? []) {
      const employee = state.emps.find((item) => item.id === employeeId);
      if (!employee) continue;
      const span = assignmentSpan(schedule, slot, employeeId);
      const proposals: { start: number; end: number; edge: HourFix["edge"] }[] = [];
      if (gap.delta < 0 && Math.abs(span.end - gap.start) < HOUR_FIX_EPS) {
        const end = Math.min(gap.end, span.start + cap);
        if (end > span.end + HOUR_FIX_EPS) proposals.push({ start: span.start, end, edge: "end" });
      }
      if (gap.delta < 0 && Math.abs(span.start - gap.end) < HOUR_FIX_EPS) {
        const start = Math.max(gap.start, span.end - cap);
        if (start < span.start - HOUR_FIX_EPS) proposals.push({ start, end: span.end, edge: "start" });
      }
      if (gap.delta > 0 && span.start < gap.start + HOUR_FIX_EPS && span.end > gap.start + HOUR_FIX_EPS) {
        const end = gap.start;
        if (end < span.end - HOUR_FIX_EPS && end - span.start >= 0.5) proposals.push({ start: span.start, end, edge: "end" });
      }
      if (gap.delta > 0 && span.end > gap.end - HOUR_FIX_EPS && span.start < gap.end - HOUR_FIX_EPS) {
        const start = gap.end;
        if (start > span.start + HOUR_FIX_EPS && span.end - start >= 0.5) proposals.push({ start, end: span.end, edge: "start" });
      }
      for (const proposal of proposals) {
        const id = `${employeeId}|${proposal.edge}|${proposal.start}|${proposal.end}`;
        if (seen.has(id) || !spanIsLegal(state, employeeId, slot, proposal.start, proposal.end)) continue;
        const next = setAssignmentHours(state, slot.key, employeeId, proposal.start, proposal.end);
        if (next === state || coverageImbalance(next) >= before - 0.01) continue;
        seen.add(id);
        const change = proposal.edge === "end" ? Math.abs(proposal.end - span.end) : Math.abs(proposal.start - span.start);
        found.push({
          employeeId,
          name: employee.name,
          slotKey: slot.key,
          start: proposal.start,
          end: proposal.end,
          edge: proposal.edge,
          change,
        });
      }
    }
  }

  found.sort(
    (left, right) =>
      left.change - right.change ||
      Number(left.slotKey === gap.slot.key) - Number(right.slotKey === gap.slot.key) ||
      left.name.localeCompare(right.name, "he"),
  );
  return found.slice(0, 4).map((item) => ({
    employeeId: item.employeeId,
    name: item.name,
    slotKey: item.slotKey,
    start: item.start,
    end: item.end,
    edge: item.edge,
  }));
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

/** Why this person cannot take the seat, including a shift past the agreement. `null` means the seat is open to them. */
export function placementIssue(state: RotaState, slot: Slot, employeeId: string, lang: Lang = "he"): Reason | null {
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!employee) return { code: "inactive" };
  if (!reliefAllowed(state, employee)) return { code: "home_schedule" };
  const blocked = staticReason(state, employee, slot, state.week);
  if (blocked) return blocked;
  const schedule = state.sched[state.week];
  const mine = slots(state, state.week)
    .filter((open) => (schedule?.assign[open.key] ?? []).includes(employeeId))
    .map((open) => (schedule ? effectiveSlot(schedule, open, employeeId) : open));
  return dynamicReason(state, employee, slot, mine, lang);
}

/** A shift past the weekly agreement is still a choice. Every other issue refuses the seat. */
export function canPlace(reason: Reason | null): boolean {
  return reason === null || reason.code === "weekly_shifts";
}

export function placementWarning(state: RotaState, slot: Slot, employeeId: string, lang: Lang): string | null {
  const reason = placementIssue(state, slot, employeeId, lang);
  return reason ? formatReason(reason, lang) : null;
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

/** Headcount for one shift on the open week. Other weeks keep the standing number. */
export function setWeekStaffing(state: RotaState, actor: Actor, shiftId: string, day: number, count: number): RotaState {
  if (actor.kind !== "manager" || isPublished(state) || day < 0 || day > 6) return state;
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (!shift) return state;
  const value = Math.floor(Number(count));
  if (!Number.isFinite(value) || value < 0) return state;
  const template = staffedCount(shift, day, state.week);
  return mutate(state, (draft) => {
    const schedule = ensureSchedule(draft, draft.week);
    const staffing = { ...(schedule.staffing ?? {}) };
    const key = `${day}|${shiftId}`;
    if (value === template) delete staffing[key];
    else staffing[key] = value;
    if (Object.keys(staffing).length === 0) delete schedule.staffing;
    else schedule.staffing = staffing;
  });
}

/** Drop the call-off record and seat the same person again. */
export function returnCallOff(state: RotaState, actor: Actor, callOffId: string): RotaState {
  if (actor.kind !== "manager") return state;
  return undoCallOff(state, callOffId);
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
  return formatClock(hour);
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
