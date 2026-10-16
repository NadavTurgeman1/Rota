/** Rows projected from Postgres. Scheduling rules stay in src/domain. */

export interface SiteRow {
  id: string;
  name: string;
  timezone: string;
  min_rest_hours: number;
  max_weekly_hours: number;
  max_shift_hours: number;
  max_day_hours: number;
  assume_available: boolean;
  org_name: string;
  org_kind: string;
}

export interface ShiftRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  required_role: string;
  position: number;
}

export interface RequirementRow {
  shift_id: string;
  weekday: number;
  required_count: number;
}

export interface EmployeeRow {
  id: string;
  name: string;
  contact: string;
  job_title: string;
  weekly_shift_quota: number;
  max_weekly_hours: number | null;
  active: boolean;
  /** False when the person is only kept so an old week can still show their name. */
  on_roster: boolean;
}

export interface QualificationRow {
  employee_id: string;
  name: string;
}

export interface PreferenceRow {
  employee_id: string;
  shift_id: string;
}

export interface AgreementRow {
  employee_id: string;
  shift_id: string;
  weekday: number;
}

export interface AvailabilityWeekRow {
  id: string;
  employee_id: string;
  week_start: string;
}

export interface AvailabilityEntryRow {
  availability_week_id: string;
  shift_id: string;
  weekday: number;
}

export interface ScheduleRow {
  id: string;
  week_start: string;
  status: "draft" | "published";
  restored_from: number | null;
}

export interface AssignmentRow {
  schedule_id: string;
  shift_id: string;
  weekday: number;
  employee_id: string;
}

export interface ExtensionRow {
  schedule_id: string;
  shift_id: string;
  weekday: number;
  employee_id: string;
  start_hour: number;
  end_hour: number;
  group_id: string;
  cover_shift_id: string;
  cover_weekday: number;
  group_size: number;
}

export interface LockRow {
  schedule_id: string;
  shift_id: string;
  weekday: number;
  employee_id: string;
}

export interface OverageRow {
  schedule_id: string;
  shift_id: string;
  weekday: number;
  employee_id: string;
}

export interface CallOffRow {
  id: string;
  schedule_id: string;
  shift_id: string;
  weekday: number;
  employee_id: string;
  employee_name: string;
  reported_at: string;
  reported_by: string | null;
  reported_by_name: string | null;
}

export interface VersionRow {
  id: string;
  schedule_id: string;
  number: number;
  reason: "publish" | "calloff";
  restored_from: number | null;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
  snapshot: unknown;
}

export interface NoteRow {
  id: string;
  week_start: string;
  raw: string;
  employee_ids: string[];
  model_lines: number[];
  approved_at: string;
}

export interface SiteBundle {
  site: SiteRow;
  shifts: ShiftRow[];
  requirements: RequirementRow[];
  employees: EmployeeRow[];
  qualifications: QualificationRow[];
  preferences: PreferenceRow[];
  agreements: AgreementRow[];
  availabilityWeeks: AvailabilityWeekRow[];
  availabilityEntries: AvailabilityEntryRow[];
  schedules: ScheduleRow[];
  assignments: AssignmentRow[];
  extensions: ExtensionRow[];
  locks: LockRow[];
  overages: OverageRow[];
  calloffs: CallOffRow[];
  versions: VersionRow[];
  notes: NoteRow[];
}

export interface SqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}
