/** Scheduling state extracted from the Rota.html prototype. */

export interface ShiftDefinition {
  id: string;
  name: string;
  /** Clock time `HH:mm`. An end at or before start crosses midnight. */
  start: string;
  end: string;
  /** Empty string means any role may work the shift. */
  role: string;
  /** Required headcount for Sunday–Saturday. `0` closes that day. */
  req: number[];
}

export interface Employee {
  id: string;
  name: string;
  contact: string;
  role: string;
  /** Comma-separated extra qualifications. */
  quals: string;
  /** Agreed shifts per week. `0` means no shift-count cap. */
  perWeek: number;
  /** Personal weekly hour cap. `0` means "use the business cap only". */
  maxHours: number;
  pref: string[];
  active: boolean;
  /** Allowed shift ids per weekday. When set, replaces `allowed` + `blocked`. */
  grid?: string[][];
  allowed?: string[];
  blocked?: number[];
}

export interface Business {
  name: string;
  type: string;
  /** Minimum hours between two shifts. */
  minRest: number;
  maxHours: number;
  /** Maximum length of an emergency extension. `0` falls back to 12. */
  maxShift: number;
  /**
   * Maximum hours of shifts that start on the same weekday.
   * `0` or omitted means the prototype rule: no daily cap.
   */
  maxDayHours?: number;
  /**
   * Stored by the prototype when availability was not submitted.
   * The engine still treats a missing week as "available per contract".
   */
  assume: boolean;
  shifts: ShiftDefinition[];
}

/** Hours actually worked when a shift is extended to cover a neighbour. */
export interface ShiftExtension {
  start: number;
  end: number;
  groupId: string;
  /** Slot key whose open seat this group covers. */
  cover: string;
  groupSize: number;
}

export interface Schedule {
  assign: Record<string, string[]>;
  /** Keys are `slotKey#employeeId`. Generation keeps every lock that still passes the rules. */
  locked: string[];
  status: "draft" | "published";
  ext?: Record<string, ShiftExtension>;
  /** Approved shifts beyond the weekly agreement. Key: `slotKey#employeeId`. */
  over?: Record<string, true>;
  /** People removed from a published week. The seat stays open until a manager covers it. */
  calloffs?: CallOff[];
  /** Set when a draft was restored from a version, until the next publish. */
  restoredFrom?: number;
}

export type VersionReason = "publish" | "calloff";

/** A frozen copy of a published week. Versions are never edited. */
export interface ScheduleVersion {
  id: string;
  /** 1, 2, 3… per week. */
  number: number;
  at: string;
  by: string;
  reason: VersionReason;
  restoredFrom?: number;
  schedule: Schedule;
}

/** An approved free-text message. The scheduler never reads it. */
export interface ConstraintNote {
  id: string;
  /** ISO timestamp of the approval. */
  at: string;
  raw: string;
  employeeIds: string[];
  /** Line numbers whose reading came from an accepted model suggestion. */
  modelLines?: number[];
}

/** An assigned person who will not work a published shift. The agreement is untouched. */
export interface CallOff {
  id: string;
  slotKey: string;
  employeeId: string;
  name: string;
  /** ISO timestamp of the report. */
  at: string;
  /** `manager`, until real accounts exist. */
  by: string;
}

export interface RotaState {
  /** Sunday of the week currently being edited, `YYYY-MM-DD`. */
  week: string;
  biz: Business;
  emps: Employee[];
  /** `avail[week][employeeId][day] = shift ids the employee can work`. */
  avail: Record<string, Record<string, string[][]>>;
  sched: Record<string, Schedule>;
  closed: Record<string, unknown>;
  /** Approved free-text messages, keyed by week. */
  notes?: Record<string, ConstraintNote[]>;
  /** Published versions, keyed by week, oldest first. */
  versions?: Record<string, ScheduleVersion[]>;
  /** Names of deleted employees that published weeks and versions still reference. */
  former?: Record<string, string>;
}

/** One staffed seat group on a weekday. Times are hours from Sunday 00:00. */
export interface Slot {
  key: string;
  day: number;
  shiftId: string;
  start: number;
  end: number;
  required: number;
}

export type Reason =
  | { code: "inactive" }
  | { code: "agreement"; day: number; shiftName: string }
  | { code: "role"; role: string }
  | { code: "unavailable"; day: number; shiftName: string }
  | { code: "overlap"; label: string }
  | { code: "rest"; hours: number; label: string }
  | { code: "weekly_hours"; cap: number }
  | { code: "daily_hours"; cap: number }
  | { code: "weekly_shifts"; agreed: number };

export interface Violation {
  key?: string;
  message: string;
}

export interface UnfilledShift {
  slot: Slot;
  filled: number;
  why: string;
  tip: string;
}

export interface UnderContract {
  employee: Employee;
  message: string;
  why: string;
}

export interface OverQuota {
  employee: Employee;
  count: number;
  agreed: number;
  message: string;
}

export interface Analysis {
  violations: Violation[];
  /** Shifts past the agreed weekly count. Shown as an exception, and it does not block publishing. */
  overQuota: OverQuota[];
  unfilled: UnfilledShift[];
  under: UnderContract[];
  hours: Record<string, number>;
  counts: Record<string, number>;
}

export interface CoveragePart {
  id: string;
  name: string;
  slotKey: string;
  start: number;
  end: number;
  from: string;
  extended: boolean;
}

export interface CoverageOption {
  parts: CoveragePart[];
  assign: Record<string, string[]>;
  cover: string;
  ext: CoveragePart[];
}

export interface ExtraShiftOption {
  type: "extra";
  id: string;
  name: string;
  slotKey: string;
  /** Shift count this employee would reach, including the proposed seat. */
  n: number;
  agreed: number;
  load: number;
}
