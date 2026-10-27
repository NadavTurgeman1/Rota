import { cleanProfile } from "../domain/profile";
import type { RotaState, Schedule, ScheduleVersion, ShiftDefinition } from "../domain/types";
import type { SiteBundle } from "./types";

const EMPTY_WEEK = (): string[][] => [[], [], [], [], [], [], []];

/** Build the in-memory state the scheduler already understands. */
export function toRotaState(bundle: SiteBundle, week: string): RotaState {
  const position = new Map(bundle.shifts.map((shift) => [shift.id, shift.position]));
  const byPosition = (a: string, b: string) => (position.get(a) ?? 0) - (position.get(b) ?? 0);
  const shifts: ShiftDefinition[] = [...bundle.shifts]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((shift) => {
      const required = [0, 0, 0, 0, 0, 0, 0];
      for (const row of bundle.requirements) {
        if (row.shift_id === shift.id) required[Number(row.weekday)] = Number(row.required_count);
      }
      return {
        id: shift.id,
        name: shift.name,
        start: shift.starts_at,
        end: shift.ends_at,
        role: shift.required_role,
        req: required,
      };
    });
  const minRest = Number(bundle.site.min_rest_hours);
  const maxHours = Number(bundle.site.max_weekly_hours);
  const maxShift = Number(bundle.site.max_shift_hours);

  const roster = bundle.employees.filter((employee) => employee.on_roster !== false);
  const former = Object.fromEntries(
    bundle.employees.filter((employee) => employee.on_roster === false).map((employee) => [employee.id, employee.name]),
  );
  const people = [...roster]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((employee) => {
      const grid = EMPTY_WEEK();
      for (const cell of bundle.agreements) {
        if (cell.employee_id !== employee.id) continue;
        grid[Number(cell.weekday)].push(cell.shift_id);
      }
      for (const day of grid) day.sort(byPosition);
      const pref = bundle.preferences
        .filter((row) => row.employee_id === employee.id)
        .map((row) => row.shift_id)
        .sort(byPosition);
      const quals = bundle.qualifications
        .filter((row) => row.employee_id === employee.id)
        .map((row) => row.name)
        .sort((a, b) => a.localeCompare(b));
      const profile = cleanProfile(employee.profile);
      return {
        id: employee.id,
        name: employee.name,
        contact: employee.email,
        phone: employee.phone ?? "",
        ...(employee.home_site_id ? { homeSiteId: employee.home_site_id } : {}),
        role: employee.job_title,
        quals: quals.join(","),
        perWeek: Number(employee.weekly_shift_quota),
        maxHours: employee.max_weekly_hours == null ? 0 : Number(employee.max_weekly_hours),
        hourlyWage: employee.hourly_wage == null ? 0 : Number(employee.hourly_wage),
        ...(profile ? { profile } : {}),
        pref,
        active: employee.active,
        grid,
        ...(employee.login_email
          ? { loginEmail: employee.login_email, loginConfirmed: employee.login_confirmed === true }
          : {}),
      };
    });

  const avail: RotaState["avail"] = {};
  for (const submitted of bundle.availabilityWeeks) {
    const days = EMPTY_WEEK();
    for (const entry of bundle.availabilityEntries) {
      if (entry.availability_week_id !== submitted.id) continue;
      days[Number(entry.weekday)].push(entry.shift_id);
    }
    for (const day of days) day.sort(byPosition);
    const weekKey = submitted.week_start;
    avail[weekKey] ??= {};
    avail[weekKey][submitted.employee_id] = days;
  }

  const sched: RotaState["sched"] = {};
  const versions: NonNullable<RotaState["versions"]> = {};
  for (const schedule of bundle.schedules) {
    sched[schedule.week_start] = scheduleFromBundle(bundle, schedule.id, schedule.status, schedule.restored_from);
    const frozen = bundle.versions
      .filter((row) => row.schedule_id === schedule.id)
      .sort((a, b) => a.number - b.number)
      .map(
        (row): ScheduleVersion => ({
          id: row.id,
          number: Number(row.number),
          at: isoTime(row.created_at),
          by: row.author_name || row.created_by || "manager",
          reason: row.reason,
          ...(row.restored_from ? { restoredFrom: Number(row.restored_from) } : {}),
          schedule: { ...(row.snapshot as Schedule), status: "published" },
        }),
      );
    if (frozen.length) versions[schedule.week_start] = frozen;
  }

  const notes: NonNullable<RotaState["notes"]> = {};
  for (const row of bundle.notes) {
    (notes[row.week_start] ??= []).push({
      id: row.id,
      at: isoTime(row.approved_at),
      raw: row.raw,
      employeeIds: row.employee_ids,
      ...(row.model_lines.length ? { modelLines: row.model_lines.map(Number) } : {}),
    });
  }

  const maxDayHours = Number(bundle.site.max_day_hours);
  return {
    week,
    biz: {
      name: bundle.site.name,
      type: bundle.site.org_kind,
      minRest,
      maxHours,
      maxShift,
      ...(maxDayHours > 0 ? { maxDayHours } : {}),
      staffAccess: bundle.site.staff_access !== false,
      constraintStartDay: Number(bundle.site.constraint_opens_day),
      constraintEndDay: Number(bundle.site.constraint_closes_day),
      constraintOpens: bundle.site.constraint_opens || "00:00",
      constraintCloses: bundle.site.constraint_closes || "23:59",
      blockLimit: bundle.site.constraint_block_limit === true,
      maxBlocks: Number(bundle.site.constraint_max_blocks) || 0,
      assume: bundle.site.assume_available,
      shifts,
    },
    emps: people,
    avail,
    sched,
    closed: {},
    ...(Object.keys(notes).length ? { notes } : {}),
    ...(Object.keys(versions).length ? { versions } : {}),
    ...(Object.keys(former).length ? { former } : {}),
  };
}

function isoTime(value: string): string {
  return new Date(value).toISOString();
}

function scheduleFromBundle(
  bundle: SiteBundle,
  scheduleId: string,
  status: Schedule["status"],
  restoredFrom: number | null,
): Schedule {
  const assign: Schedule["assign"] = {};
  const locked: Schedule["locked"] = [];
  const over: NonNullable<Schedule["over"]> = {};
  for (const row of bundle.assignments) {
    if (row.schedule_id !== scheduleId) continue;
    const key = `${Number(row.weekday)}|${row.shift_id}`;
    (assign[key] ??= []).push(row.employee_id);
    if (row.locked) locked.push(`${key}#${row.employee_id}`);
    if (row.over_quota) over[`${key}#${row.employee_id}`] = true;
  }
  const ext: NonNullable<Schedule["ext"]> = {};
  for (const row of bundle.extensions) {
    if (row.schedule_id !== scheduleId) continue;
    ext[`${Number(row.weekday)}|${row.shift_id}#${row.employee_id}`] = {
      start: Number(row.start_hour),
      end: Number(row.end_hour),
      groupId: row.group_id,
      cover: `${Number(row.cover_weekday)}|${row.cover_shift_id}`,
      groupSize: Number(row.group_size),
    };
  }
  const calloffs = bundle.calloffs
    .filter((row) => row.schedule_id === scheduleId)
    .map((row) => ({
      id: row.id,
      slotKey: `${Number(row.weekday)}|${row.shift_id}`,
      employeeId: row.employee_id,
      name: row.employee_name,
      at: isoTime(row.reported_at),
      by: row.reported_by_name || row.reported_by || "manager",
    }));
  return {
    assign,
    locked,
    status,
    ...(restoredFrom ? { restoredFrom: Number(restoredFrom) } : {}),
    ...(Object.keys(ext).length ? { ext } : {}),
    ...(Object.keys(over).length ? { over } : {}),
    ...(calloffs.length ? { calloffs } : {}),
  };
}
