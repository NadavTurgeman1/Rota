import type { CallOff, RotaState, Schedule, ScheduleVersion } from "../domain/types";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveError";
  }
}

/** Replace one site's rows from the in-memory schedule. The caller owns the transaction. */
export async function saveSite(sql: SqlClient, input: { orgId: string; siteId: string; state: RotaState }): Promise<void> {
  const { orgId, siteId, state } = input;
  if (!UUID.test(orgId) || !UUID.test(siteId)) throw new SaveError("site");
  const name = state.biz.name.trim();
  if (!name) throw new SaveError("site name");
  const existing = await sql.query<{ org_id: string }>(`select org_id from public.sites where id = $1`, [siteId]);
  if (existing[0] && existing[0].org_id !== orgId) throw new SaveError("site");

  try {
    await sql.query(
    `insert into public.sites (
       id, org_id, name, min_rest_hours, max_weekly_hours, max_shift_hours, max_day_hours, assume_available,
       staff_access, constraint_opens_day, constraint_closes_day, constraint_opens, constraint_closes,
       constraint_block_limit, constraint_max_blocks
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::time, $13::time, $14, $15)
     on conflict (id) do update set
       name = excluded.name,
       min_rest_hours = excluded.min_rest_hours,
       max_weekly_hours = excluded.max_weekly_hours,
       max_shift_hours = excluded.max_shift_hours,
       max_day_hours = excluded.max_day_hours,
       assume_available = excluded.assume_available,
       staff_access = excluded.staff_access,
       constraint_opens_day = excluded.constraint_opens_day,
       constraint_closes_day = excluded.constraint_closes_day,
       constraint_opens = excluded.constraint_opens,
       constraint_closes = excluded.constraint_closes,
       constraint_block_limit = excluded.constraint_block_limit,
       constraint_max_blocks = excluded.constraint_max_blocks
     where public.sites.org_id = excluded.org_id`,
      [
        siteId,
        orgId,
        name,
        hours(state.biz.minRest),
        hours(state.biz.maxHours),
        hours(state.biz.maxShift),
        hours(state.biz.maxDayHours ?? 0),
        state.biz.assume,
        state.biz.staffAccess !== false,
        state.biz.constraintStartDay ?? 0,
        state.biz.constraintEndDay ?? 6,
        state.biz.constraintOpens ?? "00:00",
        state.biz.constraintCloses ?? "23:59",
        state.biz.blockLimit === true,
        Math.max(0, Math.floor(state.biz.maxBlocks ?? 0)),
      ],
    );
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/row-level security|permission denied/i.test(message)) throw new SaveError("forbidden");
    throw error;
  }
  const owned = await sql.query<{ org_id: string }>(`select org_id from public.sites where id = $1`, [siteId]);
  if (owned[0]?.org_id !== orgId) throw new SaveError("site");

  const shiftNames = uniqueNames(state.biz.shifts.map((shift) => ({ id: shift.id, name: shift.name })));
  const shiftIds = state.biz.shifts.map((shift) => {
    if (!UUID.test(shift.id)) throw new SaveError("shift");
    if (!CLOCK.test(shift.start) || !CLOCK.test(shift.end)) throw new SaveError("shift time");
    return shift.id;
  });

  const people = peopleToKeep(state);
  await sql.query(`update public.shifts set name = 'tmp-' || replace(id::text, '-', '') where site_id = $1`, [siteId]);
  for (const [index, shift] of state.biz.shifts.entries()) {
    await sql.query(
      `insert into public.shifts (id, org_id, site_id, name, starts_at, ends_at, required_role, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set
         name = excluded.name,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         required_role = excluded.required_role,
         position = excluded.position
       where public.shifts.org_id = excluded.org_id and public.shifts.site_id = excluded.site_id`,
      [shift.id, orgId, siteId, shiftNames.get(shift.id), shift.start, shift.end, shift.role ?? "", index],
    );
  }

  await sql.query(
    `delete from public.shift_requirements r
     using public.shifts s
     where r.shift_id = s.id and s.site_id = $1`,
    [siteId],
  );
  const requirementShifts: string[] = [];
  const requirementDays: number[] = [];
  const requirementCounts: number[] = [];
  for (const shift of state.biz.shifts) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      requirementShifts.push(shift.id);
      requirementDays.push(weekday);
      requirementCounts.push(Math.max(0, Math.trunc(Number(shift.req[weekday] ?? 0))));
    }
  }
  await writeRows(
    sql,
    `insert into public.shift_requirements (org_id, shift_id, weekday, required_count)
     select $1, shift_id, weekday, required_count
     from unnest($2::uuid[], $3::int[], $4::int[]) as t(shift_id, weekday, required_count)`,
    [orgId],
    [requirementShifts, requirementDays, requirementCounts],
  );

  await writeRows(
    sql,
    `insert into public.employees (
       id, org_id, name, contact, job_title, weekly_shift_quota, max_weekly_hours, active, hourly_wage
     )
     select id, $1, name, contact, job_title, quota, max_hours, active <> 0, wage
     from unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::int[], $7::numeric[], $8::int[], $9::numeric[])
       as t(id, name, contact, job_title, quota, max_hours, active, wage)
     on conflict (id) do update set
       name = excluded.name,
       contact = excluded.contact,
       job_title = excluded.job_title,
       weekly_shift_quota = excluded.weekly_shift_quota,
       max_weekly_hours = excluded.max_weekly_hours,
       active = excluded.active,
       hourly_wage = excluded.hourly_wage
     where public.employees.org_id = excluded.org_id`,
    [orgId],
    [
      people.map((person) => person.id),
      people.map((person) => person.name),
      people.map((person) => person.contact),
      people.map((person) => person.role),
      people.map((person) => person.perWeek),
      people.map((person) => person.maxHours),
      // A boolean array is sent as one boolean, so the active flag travels as 0 or 1.
      people.map((person) => (person.active ? 1 : 0)),
      people.map((person) => person.hourlyWage),
    ],
  );
  const rosterIds = people.filter((person) => person.roster).map((person) => person.id);
  await writeRows(
    sql,
    `insert into public.employee_sites (org_id, employee_id, site_id)
     select $1, employee_id, $2
     from unnest($3::uuid[]) as employee_id
     on conflict do nothing`,
    [orgId, siteId],
    [rosterIds],
  );

  const keptIds = people.map((person) => person.id);
  await sql.query(
    `delete from public.employee_sites
     where site_id = $1 and not (employee_id = any($2::uuid[]))`,
    [siteId, rosterIds],
  );

  await sql.query(
    `delete from public.employee_qualifications eq
     using public.employee_sites es
     where eq.employee_id = es.employee_id and es.site_id = $1 and eq.employee_id = any($2::uuid[])`,
    [siteId, keptIds],
  );
  await sql.query(
    `delete from public.employee_agreements a
     using public.shifts s
     where a.shift_id = s.id and s.site_id = $1`,
    [siteId],
  );
  await sql.query(
    `delete from public.employee_preferences p
     using public.shifts s
     where p.shift_id = s.id and s.site_id = $1`,
    [siteId],
  );

  const shiftSet = new Set(shiftIds);
  const rosterPeople = people.filter((item) => item.roster);
  const qualificationEmployees: string[] = [];
  const qualificationNamesForPeople: string[] = [];
  const preferredEmployees: string[] = [];
  const preferredShifts: string[] = [];
  const agreedEmployees: string[] = [];
  const agreedShifts: string[] = [];
  const agreedDays: number[] = [];
  for (const person of rosterPeople) {
    for (const qualification of person.quals) {
      qualificationEmployees.push(person.id);
      qualificationNamesForPeople.push(qualification);
    }
    for (const shiftId of person.pref) {
      if (!shiftSet.has(shiftId)) continue;
      preferredEmployees.push(person.id);
      preferredShifts.push(shiftId);
    }
    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const shiftId of person.grid[weekday] ?? []) {
        if (!shiftSet.has(shiftId)) continue;
        agreedEmployees.push(person.id);
        agreedShifts.push(shiftId);
        agreedDays.push(weekday);
      }
    }
  }
  const distinctQualifications = [...new Set(qualificationNamesForPeople)];
  await writeRows(
    sql,
    `insert into public.qualifications (org_id, name)
     select $1, name from unnest($2::text[]) as name
     on conflict (org_id, name) do nothing`,
    [orgId],
    [distinctQualifications],
  );
  await writeRows(
    sql,
    `insert into public.employee_qualifications (org_id, employee_id, qualification_id)
     select $1, t.employee_id, q.id
     from unnest($2::uuid[], $3::text[]) as t(employee_id, name)
     join public.qualifications q on q.org_id = $1 and q.name = t.name
     on conflict do nothing`,
    [orgId],
    [qualificationEmployees, qualificationNamesForPeople],
  );
  await writeRows(
    sql,
    `insert into public.employee_preferences (org_id, employee_id, shift_id)
     select $1, employee_id, shift_id
     from unnest($2::uuid[], $3::uuid[]) as t(employee_id, shift_id)
     on conflict do nothing`,
    [orgId],
    [preferredEmployees, preferredShifts],
  );
  await writeRows(
    sql,
    `insert into public.employee_agreements (org_id, employee_id, shift_id, weekday)
     select $1, employee_id, shift_id, weekday
     from unnest($2::uuid[], $3::uuid[], $4::int[]) as t(employee_id, shift_id, weekday)
     on conflict do nothing`,
    [orgId],
    [agreedEmployees, agreedShifts, agreedDays],
  );

  await sql.query(`delete from public.availability_weeks where site_id = $1`, [siteId]);
  const knownPeople = new Set(keptIds);
  const availableEmployees: string[] = [];
  const availableWeeks: string[] = [];
  const availableDays = new Map<string, string[][]>();
  for (const [week, byEmployee] of Object.entries(state.avail)) {
    if (!isSunday(week)) continue;
    for (const [employeeId, days] of Object.entries(byEmployee)) {
      if (!knownPeople.has(employeeId)) continue;
      availableEmployees.push(employeeId);
      availableWeeks.push(week);
      availableDays.set(`${employeeId}|${week}`, days);
    }
  }
  const insertedWeeks = await writeReturning<{ id: string; employee_id: string; week_start: string }>(
    sql,
    `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
     select $1, $2, employee_id, week_start::date
     from unnest($3::uuid[], $4::text[]) as t(employee_id, week_start)
     returning id, employee_id, to_char(week_start, 'YYYY-MM-DD') as week_start`,
    [orgId, siteId],
    [availableEmployees, availableWeeks],
  );
  const entryWeeks: string[] = [];
  const entryShifts: string[] = [];
  const entryDays: number[] = [];
  for (const week of insertedWeeks) {
    const days = availableDays.get(`${week.employee_id}|${week.week_start}`);
    if (!days) throw new SaveError("availability");
    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const shiftId of days[weekday] ?? []) {
        if (!shiftSet.has(shiftId)) continue;
        entryWeeks.push(week.id);
        entryShifts.push(shiftId);
        entryDays.push(weekday);
      }
    }
  }
  await writeRows(
    sql,
    `insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
     select $1, availability_week_id, shift_id, weekday
     from unnest($2::uuid[], $3::uuid[], $4::int[]) as t(availability_week_id, shift_id, weekday)
     on conflict do nothing`,
    [orgId],
    [entryWeeks, entryShifts, entryDays],
  );

  const weeks = Object.keys(state.sched).filter(isSunday);
  await sql.query(
    `delete from public.schedules
     where site_id = $1 and not (week_start = any($2::date[]))`,
    [siteId, weeks],
  );
  for (const week of weeks) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    await writeSchedule(sql, { orgId, siteId, week, schedule, versions: state.versions?.[week] ?? [], shiftIds: shiftSet, people: knownPeople });
  }

  await sql.query(`delete from public.constraint_notes where site_id = $1`, [siteId]);
  for (const [week, notes] of Object.entries(state.notes ?? {})) {
    if (!isSunday(week)) continue;
    for (const note of notes) {
      if (!UUID.test(note.id)) throw new SaveError("note");
      const raw = note.raw.trim().slice(0, 4000);
      if (!raw) continue;
      const employeeIds = note.employeeIds.filter((id) => UUID.test(id));
      const lines = (note.modelLines ?? []).map((line) => Math.trunc(line)).filter((line) => line > 0);
      await sql.query(
        `insert into public.constraint_notes (
           id, org_id, site_id, week_start, raw, employee_ids, model_lines, approved_at
         ) values ($1, $2, $3, $4, $5, $6::uuid[], $7::int[], $8)`,
        [note.id, orgId, siteId, week, raw, employeeIds, lines, note.at],
      );
    }
  }

  await sql.query(
    `delete from public.shifts
     where site_id = $1 and not (id = any($2::uuid[]))`,
    [siteId, shiftIds],
  );
  await deleteOrphanEmployees(sql, orgId);
}

export async function deleteOrphanEmployees(sql: SqlClient, orgId: string): Promise<void> {
  await sql.query(
    `delete from public.employees e
     where e.org_id = $1
       and not exists (select 1 from public.employee_sites es where es.employee_id = e.id)
       and not exists (select 1 from public.assignments a where a.employee_id = e.id)
       and not exists (select 1 from public.schedule_calloffs c where c.employee_id = e.id)`,
    [orgId],
  );
}

interface KeptPerson {
  id: string;
  name: string;
  contact: string;
  role: string;
  perWeek: number;
  maxHours: number | null;
  hourlyWage: number;
  active: boolean;
  /** People on the team stay linked to the site. Deleted people are names on old weeks only. */
  roster: boolean;
  quals: string[];
  pref: string[];
  grid: string[][];
}

function peopleToKeep(state: RotaState): KeptPerson[] {
  const roster = new Map<string, KeptPerson>();
  for (const employee of state.emps) {
    if (!UUID.test(employee.id)) throw new SaveError("employee");
    const name = employee.name.trim();
    if (!name) throw new SaveError("employee");
    const perWeek = Number.isFinite(employee.perWeek) ? employee.perWeek : 0;
    roster.set(employee.id, {
      id: employee.id,
      name,
      contact: employee.contact ?? "",
      role: employee.role ?? "",
      perWeek: Math.max(0, Math.trunc(perWeek)),
      maxHours: employee.maxHours > 0 ? hours(employee.maxHours) : null,
      hourlyWage: Math.max(0, Number(employee.hourlyWage) || 0),
      active: employee.active !== false,
      roster: true,
      quals: qualificationNames(employee.quals),
      pref: (employee.pref ?? []).filter((id) => UUID.test(id)),
      grid: employee.grid ?? [[], [], [], [], [], [], []],
    });
  }
  const historical = new Map<string, string>();
  for (const [id, name] of Object.entries(state.former ?? {})) {
    if (!UUID.test(id) || roster.has(id)) continue;
    historical.set(id, name.trim() || " ");
  }
  for (const schedule of Object.values(state.sched)) {
    for (const ids of Object.values(schedule.assign)) {
      for (const id of ids) remember(historical, roster, id, "");
    }
    for (const calloff of schedule.calloffs ?? []) remember(historical, roster, calloff.employeeId, calloff.name);
  }
  return [
    ...roster.values(),
    ...[...historical].map(([id, name]) => ({
      id,
      name: name || " ",
      contact: "",
      role: "",
      perWeek: 0,
      maxHours: null,
      hourlyWage: 0,
      active: false,
      roster: false,
      quals: [],
      pref: [],
      grid: [[], [], [], [], [], [], []],
    })),
  ];
}

function remember(historical: Map<string, string>, roster: Map<string, KeptPerson>, id: string, name: string): void {
  if (!UUID.test(id) || roster.has(id)) return;
  if (!historical.has(id)) historical.set(id, name.trim());
}

function qualificationNames(value: string): string[] {
  const names = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function uniqueNames(shifts: { id: string; name: string }[]): Map<string, string> {
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const shift of shifts) {
    const base = shift.name.trim() || "shift";
    let name = base;
    let count = 2;
    while (used.has(name)) {
      name = `${base} ${count}`;
      count += 1;
    }
    used.add(name);
    names.set(shift.id, name);
  }
  return names;
}

/** One statement for a whole list. An empty list does not touch the database. */
async function writeRows(sql: SqlClient, statement: string, scalars: unknown[], columns: unknown[][]): Promise<void> {
  await writeReturning(sql, statement, scalars, columns);
}

async function writeReturning<Row>(sql: SqlClient, statement: string, scalars: unknown[], columns: unknown[][]): Promise<Row[]> {
  if (columns.length === 0 || columns[0].length === 0) return [];
  return sql.query<Row>(statement, [...scalars, ...columns]);
}

function hours(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new SaveError("hours");
  return value;
}

function isSunday(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

async function writeSchedule(
  sql: SqlClient,
  input: {
    orgId: string;
    siteId: string;
    week: string;
    schedule: Schedule;
    versions: ScheduleVersion[];
    shiftIds: Set<string>;
    people: Set<string>;
  },
): Promise<void> {
  const status = input.schedule.status === "published" ? "published" : "draft";
  const restored = input.schedule.restoredFrom && input.schedule.restoredFrom > 0 ? input.schedule.restoredFrom : null;
  const rows = await sql.query<{ id: string }>(
    `insert into public.schedules (org_id, site_id, week_start, status, restored_from)
     values ($1, $2, $3, $4, $5)
     on conflict (site_id, week_start) do update set
       status = excluded.status,
       restored_from = excluded.restored_from
     returning id`,
    [input.orgId, input.siteId, input.week, status, restored],
  );
  const scheduleId = rows[0]?.id;
  if (!scheduleId) throw new SaveError("schedule");

  await sql.query(`delete from public.schedule_calloffs where schedule_id = $1`, [scheduleId]);
  await sql.query(`delete from public.assignments where schedule_id = $1`, [scheduleId]);

  const seated = new Set<string>();
  const assignedShifts: string[] = [];
  const assignedDays: number[] = [];
  const assignedEmployees: string[] = [];
  for (const [key, employeeIds] of Object.entries(input.schedule.assign)) {
    const slot = parseSlot(key);
    if (!slot || !input.shiftIds.has(slot.shiftId)) continue;
    for (const employeeId of employeeIds) {
      if (!input.people.has(employeeId)) continue;
      assignedShifts.push(slot.shiftId);
      assignedDays.push(slot.weekday);
      assignedEmployees.push(employeeId);
      seated.add(`${slot.weekday}|${slot.shiftId}#${employeeId}`);
    }
  }
  await writeRows(
    sql,
    `insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
     select $1, $2, shift_id, weekday, employee_id
     from unnest($3::uuid[], $4::int[], $5::uuid[]) as t(shift_id, weekday, employee_id)
     on conflict do nothing`,
    [input.orgId, scheduleId],
    [assignedShifts, assignedDays, assignedEmployees],
  );

  const extensionShifts: string[] = [];
  const extensionDays: number[] = [];
  const extensionEmployees: string[] = [];
  const extensionStarts: number[] = [];
  const extensionEnds: number[] = [];
  const extensionGroups: string[] = [];
  const extensionCovers: string[] = [];
  const extensionCoverDays: number[] = [];
  const extensionSizes: number[] = [];
  for (const [key, extension] of Object.entries(input.schedule.ext ?? {})) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    const cover = parseSlot(extension.cover);
    if (!seat || !cover || !input.shiftIds.has(cover.shiftId)) continue;
    extensionShifts.push(seat.shiftId);
    extensionDays.push(seat.weekday);
    extensionEmployees.push(seat.employeeId);
    extensionStarts.push(extension.start);
    extensionEnds.push(extension.end);
    extensionGroups.push(extension.groupId);
    extensionCovers.push(cover.shiftId);
    extensionCoverDays.push(cover.weekday);
    extensionSizes.push(Math.max(1, Math.trunc(extension.groupSize)));
  }
  await writeRows(
    sql,
    `insert into public.assignment_extensions (
       org_id, schedule_id, shift_id, weekday, employee_id, start_hour, end_hour, group_id, cover_shift_id, cover_weekday, group_size
     )
     select $1, $2, shift_id, weekday, employee_id, start_hour, end_hour, group_id, cover_shift_id, cover_weekday, group_size
     from unnest(
       $3::uuid[], $4::int[], $5::uuid[], $6::numeric[], $7::numeric[], $8::text[], $9::uuid[], $10::int[], $11::int[]
     ) as t(shift_id, weekday, employee_id, start_hour, end_hour, group_id, cover_shift_id, cover_weekday, group_size)`,
    [input.orgId, scheduleId],
    [
      extensionShifts,
      extensionDays,
      extensionEmployees,
      extensionStarts,
      extensionEnds,
      extensionGroups,
      extensionCovers,
      extensionCoverDays,
      extensionSizes,
    ],
  );
  const lockedShifts: string[] = [];
  const lockedDays: number[] = [];
  const lockedEmployees: string[] = [];
  for (const key of input.schedule.locked) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    if (!seat) continue;
    lockedShifts.push(seat.shiftId);
    lockedDays.push(seat.weekday);
    lockedEmployees.push(seat.employeeId);
  }
  await writeRows(
    sql,
    `insert into public.assignment_locks (org_id, schedule_id, shift_id, weekday, employee_id)
     select $1, $2, shift_id, weekday, employee_id
     from unnest($3::uuid[], $4::int[], $5::uuid[]) as t(shift_id, weekday, employee_id)
     on conflict do nothing`,
    [input.orgId, scheduleId],
    [lockedShifts, lockedDays, lockedEmployees],
  );
  const overShifts: string[] = [];
  const overDays: number[] = [];
  const overEmployees: string[] = [];
  for (const key of Object.keys(input.schedule.over ?? {})) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    if (!seat) continue;
    overShifts.push(seat.shiftId);
    overDays.push(seat.weekday);
    overEmployees.push(seat.employeeId);
  }
  await writeRows(
    sql,
    `insert into public.assignment_overages (org_id, schedule_id, shift_id, weekday, employee_id)
     select $1, $2, shift_id, weekday, employee_id
     from unnest($3::uuid[], $4::int[], $5::uuid[]) as t(shift_id, weekday, employee_id)
     on conflict do nothing`,
    [input.orgId, scheduleId],
    [overShifts, overDays, overEmployees],
  );
  for (const calloff of input.schedule.calloffs ?? []) await writeCalloff(sql, input.orgId, scheduleId, calloff, input.shiftIds, input.people);

  for (const version of input.versions) {
    if (!UUID.test(version.id) || version.number <= 0) throw new SaveError("version");
    if (version.reason !== "publish" && version.reason !== "calloff") throw new SaveError("version");
    await sql.query(
      `insert into public.schedule_versions (
         id, org_id, schedule_id, number, reason, restored_from, author_name, snapshot, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9)
       on conflict (schedule_id, number) do nothing`,
      [
        version.id,
        input.orgId,
        scheduleId,
        version.number,
        version.reason,
        version.restoredFrom && version.restoredFrom > 0 ? version.restoredFrom : null,
        version.by ?? "",
        // A ::jsonb parameter is stringified again by the driver, so the check
        // sees a string instead of an object. Parsing text avoids that.
        JSON.stringify(version.schedule),
        version.at,
      ],
    );
  }
}

async function writeCalloff(
  sql: SqlClient,
  orgId: string,
  scheduleId: string,
  calloff: CallOff,
  shiftIds: Set<string>,
  people: Set<string>,
): Promise<void> {
  if (!UUID.test(calloff.id) || !people.has(calloff.employeeId)) throw new SaveError("calloff");
  const slot = parseSlot(calloff.slotKey);
  if (!slot || !shiftIds.has(slot.shiftId)) throw new SaveError("calloff");
  await sql.query(
    `insert into public.schedule_calloffs (
       id, org_id, schedule_id, shift_id, weekday, employee_id, reported_at, reported_by_name
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [calloff.id, orgId, scheduleId, slot.shiftId, slot.weekday, calloff.employeeId, calloff.at, calloff.by ?? ""],
  );
}

function parseSlot(key: string): { weekday: number; shiftId: string } | null {
  const match = /^([0-6])\|([0-9a-f-]{36})$/i.exec(key);
  if (!match || !UUID.test(match[2])) return null;
  return { weekday: Number(match[1]), shiftId: match[2] };
}

function parseSeat(key: string): { weekday: number; shiftId: string; employeeId: string } | null {
  const match = /^([0-6])\|([0-9a-f-]{36})#([0-9a-f-]{36})$/i.exec(key);
  if (!match || !UUID.test(match[2]) || !UUID.test(match[3])) return null;
  return { weekday: Number(match[1]), shiftId: match[2], employeeId: match[3] };
}
