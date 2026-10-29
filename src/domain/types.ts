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

/** Manager-only employee card. Scheduling does not read it. */
export interface EmployeeProfile {
  nationalId: string;
  /** `YYYY-MM-DD`, or empty. */
  birthDate: string;
  /** `female`, `male`, or empty. */
  gender: string;
  mobile: string;
  city: string;
  street: string;
  houseNumber: string;
  zip: string;
  /** `YYYY-MM-DD`, or empty. */
  startedOn: string;
  /** `YYYY-MM-DD`, or empty. */
  endedOn: string;
  /** Company employee number. Empty until someone fills it in. */
  employeeNumber: string;
  department: string;
  /** `single`, `married`, `divorced`, `widowed`, or empty. */
  maritalStatus: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
}

export interface Employee {
  id: string;
  name: string;
  contact: string;
  /** Phone number. Empty is allowed. Together with `id`, this identifies the person across sites. */
  phone?: string;
  /** Omitted when every card field is empty. */
  profile?: EmployeeProfile;
  /** Primary site. Other linked sites are reinforcement. Omitted until a site is chosen. */
  homeSiteId?: string;
  role: string;
  /**
   * Personal block numbers. Present only when this person overrides the primary site.
   * The split itself stays the primary site's: general uses `max`, weekdays use `weekday`
   * and `weekend`, and each shift uses `shifts` keyed by that site's shift id.
   */
  customBlocks?: {
    max: number;
    weekday: number;
    weekend: number;
    shifts: Record<string, number>;
  };
  /** Comma-separated extra qualifications. */
  quals: string;
  /** Agreed shifts per week. `0` means no shift-count cap. */
  perWeek: number;
  /** Personal weekly hour cap. `0` means "use the business cap only". */
  maxHours: number;
  pref: string[];
  active: boolean;
  /** Hourly wage in shekels. `0` or omitted means it has not been set. */
  hourlyWage?: number;
  /** No shift from Friday 15:00 through Saturday 21:00. Turning this on also keeps festivals, until that is turned off. */
  observesShabbat?: boolean;
  /** No shift on Israeli festival days, from 15:00 the day before through 21:00 that day. Only with `observesShabbat`. */
  observesHolidays?: boolean;
  /** Login email already stored for this person, confirmed or still an open invitation. */
  loginEmail?: string;
  /** True only after the person has confirmed the login. */
  loginConfirmed?: boolean;
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
   * When false, employees do not sign in and the shift manager enters constraints.
   * Omitted means employees may have their own login.
   */
  staffAccess?: boolean;
  /** First weekday of the constraint window. Sunday = 0. Omitted means Sunday. */
  constraintStartDay?: number;
  /** Last weekday of the constraint window. Sunday = 0. Omitted means Saturday. */
  constraintEndDay?: number;
  /** Clock `HH:mm` when the window opens on the start day. Omitted means `00:00`. */
  constraintOpens?: string;
  /** Clock `HH:mm` when the window closes on the end day. Omitted means `23:59`. */
  constraintCloses?: string;
  /**
   * When true, each person may block only so many open shifts in a week.
   * Omitted or false means weekly constraints have no block cap.
   * `blockSplit` says how that cap is divided. Omitted means one number for the week.
   */
  blockLimit?: boolean;
  /** `general` is one weekly number. `weekday` splits Sunday–Thursday from Friday–Saturday. `shift` is one number per shift. */
  blockSplit?: "general" | "weekday" | "shift";
  /** How many weekly blocks are allowed while the split is general. Omitted means 0. */
  maxBlocks?: number;
  /** Sunday–Thursday blocks while the split is weekday. Omitted means 0. */
  weekdayBlocks?: number;
  /** Friday–Saturday blocks while the split is weekday. Omitted means 0. */
  weekendBlocks?: number;
  /** Blocks of one shift across the week, keyed by that site's shift id. A missing shift means 0. */
  shiftBlocks?: Record<string, number>;
  /** Extra submission window. An ISO time. A missing or past time means it is closed. */
  constraintExtensionUntil?: string;
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
  /**
   * Clock override for one person on one shift. Key: `slotKey#employeeId`.
   * Hours use the same scale as `Slot`. Missing means the shift's own hours.
   */
  hours?: Record<string, { start: number; end: number }>;
  /** Approved shifts beyond the weekly agreement. Key: `slotKey#employeeId`. */
  over?: Record<string, true>;
  /** People removed from a published week. The seat stays open until a manager covers it. */
  calloffs?: CallOff[];
  /** Set when a draft was restored from a version, until the next publish. */
  restoredFrom?: number;
}

export type VersionReason = "publish" | "calloff" | "trade";

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
  /**
   * Shifts the same employee id already works at other sites.
   * Computed for the open week. It is not stored.
   */
  peers?: Record<string, PeerShift[]>;
  /** Site these employees are being viewed from. Computed, not stored. */
  siteId?: string;
  /**
   * Whether each reinforcement employee's primary site week is ready to publish.
   * Computed for the open week. It is not stored.
   */
  homeReady?: Record<string, boolean>;
  /** Employee ids allowed to ignore the block cap, keyed by week. */
  constraintGrants?: Record<string, string[]>;
  /** Approved sick leave and vacation. Scheduling reads these. */
  absences?: import("./absence").ApprovedAbsence[];
}

/** Work at another site of the same business, for the same employee id. */
export interface PeerShift {
  key: string;
  day: number;
  start: number;
  end: number;
  label: string;
  minRest: number;
  maxHours: number;
  maxDayHours: number;
  maxShift: number;
  /** `0` is this week. `-7` and `7` count for rest only. */
  weekOffset: number;
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
  | { code: "absent"; day: number; kind: import("./absence").AbsenceKind }
  | { code: "overlap"; label: string }
  | { code: "rest"; hours: number; label: string }
  | { code: "weekly_hours"; cap: number }
  | { code: "daily_hours"; cap: number }
  | { code: "weekly_shifts"; agreed: number }
  | { code: "shift_length"; cap: number }
  | { code: "home_schedule" }
  | { code: "shabbat" }
  | { code: "holiday" }
  | { code: "consecutive_days"; from: string; to: string; days: number };

/** A Hours of Work and Rest Law note. It does not block placement. */
export interface LaborNote {
  key: string;
  employeeId: string;
  code: "weekly_rest" | "daily_gap" | "day_cap" | "overtime" | "night_weeks" | "consecutive_shabbat";
  hours?: number;
  message: string;
}

export interface Violation {
  key?: string;
  message: string;
  /** The rule behind a person's seat. Missing on a headcount note. */
  reason?: Reason;
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

/** One stretch where the people actually present differ from the shift's required count. */
export interface CoverageGap {
  slot: Slot;
  start: number;
  end: number;
  /** Negative is a shortage. Positive is a surplus. */
  delta: number;
}

export interface Analysis {
  violations: Violation[];
  /** Hours of Work and Rest Law notes. They do not block placement or publishing by themselves. */
  labor: LaborNote[];
  /** Shifts past the agreed weekly count. Shown as an exception, and it does not block publishing. */
  overQuota: OverQuota[];
  unfilled: UnfilledShift[];
  /** Hour-by-hour shortages and surpluses. Publishing asks before it goes out with these. */
  coverage: CoverageGap[];
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
  /** Hourly wage of this person. `0` means it has not been set. */
  wage?: number;
}

export interface CoverageOption {
  parts: CoveragePart[];
  assign: Record<string, string[]>;
  cover: string;
  ext: CoveragePart[];
  /** Highest set wage among the people who extend. `0` means none is set. */
  wage?: number;
  /** Cheapest set wage among the other suggestions, when this one costs more. */
  dearerThan?: number;
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
  wage?: number;
  dearerThan?: number;
}
