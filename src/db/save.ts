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
       id, org_id, name, min_rest_hours, max_weekly_hours, max_shift_hours, max_day_hours, assume_available
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       name = excluded.name,
       min_rest_hours = excluded.min_rest_hours,
       max_weekly_hours = excluded.max_weekly_hours,
       max_shift_hours = excluded.max_shift_hours,
       max_day_hours = excluded.max_day_hours,
       assume_available = excluded.assume_available
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
  for (const shift of state.biz.shifts) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const required = Math.max(0, Math.trunc(Number(shift.req[weekday] ?? 0)));
      await sql.query(
        `insert into public.shift_requirements (org_id, shift_id, weekday, required_count)
         values ($1, $2, $3, $4)`,
        [orgId, shift.id, weekday, required],
      );
    }
  }

  for (const person of people) {
    await sql.query(
      `insert into public.employees (
         id, org_id, name, contact, job_title, weekly_shift_quota, max_weekly_hours, active
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set
         name = excluded.name,
         contact = excluded.contact,
         job_title = excluded.job_title,
         weekly_shift_quota = excluded.weekly_shift_quota,
         max_weekly_hours = excluded.max_weekly_hours,
         active = excluded.active
       where public.employees.org_id = excluded.org_id`,
      [
        person.id,
        orgId,
        person.name,
        person.contact,
        person.role,
        person.perWeek,
        person.maxHours,
        person.active,
      ],
    );
    await sql.query(
      `insert into public.employee_sites (org_id, employee_id, site_id)
       values ($1, $2, $3)
       on conflict do nothing`,
      [orgId, person.id, siteId],
    );
  }

  const keptIds = people.map((person) => person.id);
  await sql.query(
    `delete from public.employee_sites
     where site_id = $1 and not (employee_id = any($2::uuid[]))`,
    [siteId, keptIds],
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
  for (const person of people.filter((item) => item.active)) {
    for (const qualification of person.quals) {
      const rows = await sql.query<{ id: string }>(
        `with inserted as (
           insert into public.qualifications (org_id, name)
           values ($1, $2)
           on conflict (org_id, name) do nothing
           returning id
         )
         select id from inserted
         union all
         select id from public.qualifications where org_id = $1 and name = $2
         limit 1`,
        [orgId, qualification],
      );
      const qualificationId = rows[0]?.id;
      if (!qualificationId) throw new SaveError("qualification");
      await sql.query(
        `insert into public.employee_qualifications (org_id, employee_id, qualification_id)
         values ($1, $2, $3)
         on conflict do nothing`,
        [orgId, person.id, qualificationId],
      );
    }
    for (const shiftId of person.pref) {
      if (!shiftSet.has(shiftId)) continue;
      await sql.query(
        `insert into public.employee_preferences (org_id, employee_id, shift_id)
         values ($1, $2, $3)
         on conflict do nothing`,
        [orgId, person.id, shiftId],
      );
    }
    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const shiftId of person.grid[weekday] ?? []) {
        if (!shiftSet.has(shiftId)) continue;
        await sql.query(
          `insert into public.employee_agreements (org_id, employee_id, shift_id, weekday)
           values ($1, $2, $3, $4)
           on conflict do nothing`,
          [orgId, person.id, shiftId, weekday],
        );
      }
    }
  }

  await sql.query(`delete from public.availability_weeks where site_id = $1`, [siteId]);
  const knownPeople = new Set(keptIds);
  for (const [week, byEmployee] of Object.entries(state.avail)) {
    if (!isSunday(week)) continue;
    for (const [employeeId, days] of Object.entries(byEmployee)) {
      if (!knownPeople.has(employeeId)) continue;
      const weeks = await sql.query<{ id: string }>(
        `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
         values ($1, $2, $3, $4)
         returning id`,
        [orgId, siteId, employeeId, week],
      );
      const weekId = weeks[0]?.id;
      if (!weekId) throw new SaveError("availability");
      for (let weekday = 0; weekday < 7; weekday += 1) {
        for (const shiftId of days[weekday] ?? []) {
          if (!shiftSet.has(shiftId)) continue;
          await sql.query(
            `insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
             values ($1, $2, $3, $4)
             on conflict do nothing`,
            [orgId, weekId, shiftId, weekday],
          );
        }
      }
    }
  }

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
  active: boolean;
  quals: string[];
  pref: string[];
  grid: string[][];
}

function peopleToKeep(state: RotaState): KeptPerson[] {
  const active = new Map<string, KeptPerson>();
  for (const employee of state.emps) {
    if (!UUID.test(employee.id)) throw new SaveError("employee");
    const name = employee.name.trim();
    if (!name) throw new SaveError("employee");
    active.set(employee.id, {
      id: employee.id,
      name,
      contact: employee.contact ?? "",
      role: employee.role ?? "",
      perWeek: Math.max(0, Math.trunc(employee.perWeek)),
      maxHours: employee.maxHours > 0 ? hours(employee.maxHours) : null,
      active: true,
      quals: qualificationNames(employee.quals),
      pref: employee.pref.filter((id) => UUID.test(id)),
      grid: employee.grid ?? [[], [], [], [], [], [], []],
    });
  }
  const inactive = new Map<string, string>();
  for (const [id, name] of Object.entries(state.former ?? {})) {
    if (!UUID.test(id) || active.has(id)) continue;
    inactive.set(id, name.trim() || " ");
  }
  for (const schedule of Object.values(state.sched)) {
    for (const ids of Object.values(schedule.assign)) {
      for (const id of ids) remember(inactive, active, id, "");
    }
    for (const calloff of schedule.calloffs ?? []) remember(inactive, active, calloff.employeeId, calloff.name);
  }
  return [
    ...active.values(),
    ...[...inactive].map(([id, name]) => ({
      id,
      name: name || " ",
      contact: "",
      role: "",
      perWeek: 0,
      maxHours: null,
      active: false,
      quals: [],
      pref: [],
      grid: [[], [], [], [], [], [], []],
    })),
  ];
}

function remember(inactive: Map<string, string>, active: Map<string, KeptPerson>, id: string, name: string): void {
  if (!UUID.test(id) || active.has(id)) return;
  if (!inactive.has(id)) inactive.set(id, name.trim());
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
  for (const [key, employeeIds] of Object.entries(input.schedule.assign)) {
    const slot = parseSlot(key);
    if (!slot || !input.shiftIds.has(slot.shiftId)) continue;
    for (const employeeId of employeeIds) {
      if (!input.people.has(employeeId)) continue;
      await sql.query(
        `insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
         values ($1, $2, $3, $4, $5)
         on conflict do nothing`,
        [input.orgId, scheduleId, slot.shiftId, slot.weekday, employeeId],
      );
      seated.add(`${slot.weekday}|${slot.shiftId}#${employeeId}`);
    }
  }

  for (const [key, extension] of Object.entries(input.schedule.ext ?? {})) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    const cover = parseSlot(extension.cover);
    if (!seat || !cover || !input.shiftIds.has(cover.shiftId)) continue;
    await sql.query(
      `insert into public.assignment_extensions (
         org_id, schedule_id, shift_id, weekday, employee_id, start_hour, end_hour, group_id, cover_shift_id, cover_weekday, group_size
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.orgId,
        scheduleId,
        seat.shiftId,
        seat.weekday,
        seat.employeeId,
        extension.start,
        extension.end,
        extension.groupId,
        cover.shiftId,
        cover.weekday,
        Math.max(1, Math.trunc(extension.groupSize)),
      ],
    );
  }
  for (const key of input.schedule.locked) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    if (!seat) continue;
    await sql.query(
      `insert into public.assignment_locks (org_id, schedule_id, shift_id, weekday, employee_id)
       values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [input.orgId, scheduleId, seat.shiftId, seat.weekday, seat.employeeId],
    );
  }
  for (const key of Object.keys(input.schedule.over ?? {})) {
    if (!seated.has(key)) continue;
    const seat = parseSeat(key);
    if (!seat) continue;
    await sql.query(
      `insert into public.assignment_overages (org_id, schedule_id, shift_id, weekday, employee_id)
       values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [input.orgId, scheduleId, seat.shiftId, seat.weekday, seat.employeeId],
    );
  }
  for (const calloff of input.schedule.calloffs ?? []) await writeCalloff(sql, input.orgId, scheduleId, calloff, input.shiftIds, input.people);

  for (const version of input.versions) {
    if (!UUID.test(version.id) || version.number <= 0) throw new SaveError("version");
    if (version.reason !== "publish" && version.reason !== "calloff") throw new SaveError("version");
    await sql.query(
      `insert into public.schedule_versions (
         id, org_id, schedule_id, number, reason, restored_from, author_name, snapshot, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       on conflict (schedule_id, number) do nothing`,
      [
        version.id,
        input.orgId,
        scheduleId,
        version.number,
        version.reason,
        version.restoredFrom && version.restoredFrom > 0 ? version.restoredFrom : null,
        version.by ?? "",
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
