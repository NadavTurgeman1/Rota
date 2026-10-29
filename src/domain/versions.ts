import type { CallOff, RotaState, Schedule, ScheduleVersion, VersionReason } from "./types";

export interface VersionStamp {
  id: string;
  at: string;
  by: string;
}

export interface SeatChange {
  slotKey: string;
  employeeId: string;
}

export interface ExtensionChange extends SeatChange {
  before?: { start: number; end: number };
  after?: { start: number; end: number };
}

export interface ScheduleDiff {
  added: SeatChange[];
  removed: SeatChange[];
  extensions: ExtensionChange[];
  calloffs: CallOff[];
}

export function weekVersions(state: RotaState, week: string = state.week): ScheduleVersion[] {
  return state.versions?.[week] ?? [];
}

/** Freeze the current week as the next version. Only a published week is frozen. */
export function recordVersion(state: RotaState, reason: VersionReason, stamp: VersionStamp): RotaState {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published" || !stamp.id) return state;
  const draft = structuredClone(state);
  const live = draft.sched[draft.week];
  const restoredFrom = live.restoredFrom;
  delete live.restoredFrom;
  const frozen = structuredClone(live);
  const list = draft.versions?.[draft.week] ?? [];
  const version: ScheduleVersion = {
    id: stamp.id,
    number: (list.at(-1)?.number ?? 0) + 1,
    at: stamp.at,
    by: stamp.by,
    reason,
    ...(restoredFrom ? { restoredFrom } : {}),
    schedule: frozen,
  };
  draft.versions = { ...(draft.versions ?? {}), [draft.week]: [...list, version] };
  return draft;
}

/** Drop one frozen version of the current week. Later numbers stay as they are. */
export function deleteVersion(state: RotaState, versionId: string): RotaState {
  const list = state.versions?.[state.week];
  if (!list?.some((item) => item.id === versionId)) return state;
  const draft = structuredClone(state);
  const next = (draft.versions?.[draft.week] ?? []).filter((item) => item.id !== versionId);
  const versions = { ...(draft.versions ?? {}) };
  if (next.length) versions[draft.week] = next;
  else delete versions[draft.week];
  if (Object.keys(versions).length) draft.versions = versions;
  else delete draft.versions;
  return draft;
}

/** Bring a version back as a draft. Publishing it again runs the normal checks. */
export function restoreVersion(state: RotaState, versionId: string): RotaState {
  const version = weekVersions(state).find((item) => item.id === versionId);
  if (!version) return state;
  const draft = structuredClone(state);
  draft.sched[draft.week] = { ...structuredClone(version.schedule), status: "draft", restoredFrom: version.number };
  return draft;
}

function seats(schedule: Schedule | undefined): Set<string> {
  const found = new Set<string>();
  for (const [slotKey, ids] of Object.entries(schedule?.assign ?? {})) {
    for (const id of ids) found.add(`${slotKey}#${id}`);
  }
  return found;
}

function splitToken(token: string): SeatChange {
  const split = token.lastIndexOf("#");
  return { slotKey: token.slice(0, split), employeeId: token.slice(split + 1) };
}

function bySeat(left: SeatChange, right: SeatChange): number {
  const [leftDay, leftShift] = left.slotKey.split("|");
  const [rightDay, rightShift] = right.slotKey.split("|");
  return Number(leftDay) - Number(rightDay) || leftShift.localeCompare(rightShift) || left.employeeId.localeCompare(right.employeeId);
}

/** What changed from `before` to `after`: seats, extension hours, and new call-offs. */
export function diffSchedules(before: Schedule | undefined, after: Schedule | undefined): ScheduleDiff {
  const was = seats(before);
  const now = seats(after);
  const added = [...now].filter((token) => !was.has(token)).map(splitToken).sort(bySeat);
  const removed = [...was].filter((token) => !now.has(token)).map(splitToken).sort(bySeat);

  const extensions: ExtensionChange[] = [];
  const spans = (schedule: Schedule | undefined, token: string) => schedule?.ext?.[token] ?? schedule?.hours?.[token];
  const keys = new Set([
    ...Object.keys(before?.ext ?? {}),
    ...Object.keys(after?.ext ?? {}),
    ...Object.keys(before?.hours ?? {}),
    ...Object.keys(after?.hours ?? {}),
  ]);
  for (const token of keys) {
    const old = spans(before, token);
    const next = spans(after, token);
    if (old && next && old.start === next.start && old.end === next.end) continue;
    extensions.push({
      ...splitToken(token),
      ...(old ? { before: { start: old.start, end: old.end } } : {}),
      ...(next ? { after: { start: next.start, end: next.end } } : {}),
    });
  }
  extensions.sort(bySeat);

  const known = new Set((before?.calloffs ?? []).map((item) => item.id));
  const calloffs = (after?.calloffs ?? []).filter((item) => !known.has(item.id));
  return { added, removed, extensions, calloffs };
}

export function diffIsEmpty(diff: ScheduleDiff): boolean {
  return !diff.added.length && !diff.removed.length && !diff.extensions.length && !diff.calloffs.length;
}
