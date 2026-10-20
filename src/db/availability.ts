import { SaveError } from "./save";
import type { SqlClient } from "./types";

/** Replace the signed-in employee's availability for one site and week. */
export async function saveOwnAvailability(
  sql: SqlClient,
  input: { siteId: string; week: string; shifts: string[][] | null },
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.week)) throw new SaveError("availability");
  const shifts = input.shifts;
  if (
    shifts !== null &&
    (shifts.length !== 7 || shifts.some((day) => !Array.isArray(day) || day.some((id) => typeof id !== "string" || !id)))
  ) {
    throw new SaveError("availability");
  }
  try {
    const mine = await sql.query<{ id: string; org_id: string }>(
      `select e.id, e.org_id
       from public.employees e
       join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
       where e.user_id = (select auth.uid()) and es.site_id = $1`,
      [input.siteId],
    );
    const employee = mine[0];
    if (!employee) throw new SaveError("forbidden");
    if (shifts === null) {
      await sql.query(
        `delete from public.availability_weeks
         where site_id = $1 and employee_id = $2 and week_start = $3::date`,
        [input.siteId, employee.id, input.week],
      );
      return;
    }
    const week = await sql.query<{ id: string }>(
      `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
       values ($1, $2, $3, $4::date)
       on conflict (site_id, employee_id, week_start) do update set week_start = excluded.week_start
       returning id`,
      [employee.org_id, input.siteId, employee.id, input.week],
    );
    const weekId = week[0]?.id;
    if (!weekId) throw new SaveError("availability");
    await sql.query(`delete from public.availability_entries where availability_week_id = $1`, [weekId]);
    const shiftIds: string[] = [];
    const weekdays: number[] = [];
    shifts.forEach((day, weekday) => {
      for (const shiftId of day) {
        shiftIds.push(shiftId);
        weekdays.push(weekday);
      }
    });
    if (shiftIds.length === 0) return;
    const inserted = await sql.query<{ shift_id: string }>(
      `insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
       select $2, $3, requested.shift_id, requested.weekday
       from unnest($4::uuid[], $5::int[]) as requested(shift_id, weekday)
       join public.shifts s on s.id = requested.shift_id and s.site_id = $1 and s.org_id = $2
       returning shift_id`,
      [input.siteId, employee.org_id, weekId, shiftIds, weekdays],
    );
    if (inserted.length !== shiftIds.length) throw new SaveError("availability");
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/42501|not allowed|forbidden/i.test(message)) throw new SaveError("forbidden");
    throw new SaveError("availability");
  }
}

export interface StoredRequest {
  id: string;
  employeeId: string;
  week: string;
  shifts: string[][];
}

export function normalizeGrid(value: unknown): string[][] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [[], [], [], [], [], [], []];
  const days = parsed.slice(0, 7).map((day) => (Array.isArray(day) ? day.filter((id): id is string => typeof id === "string" && id.length > 0) : []));
  while (days.length < 7) days.push([]);
  return days;
}

function flattenGrid(shifts: string[][]): { shiftIds: string[]; weekdays: number[] } {
  const shiftIds: string[] = [];
  const weekdays: number[] = [];
  shifts.forEach((day, weekday) => {
    for (const shiftId of day) {
      shiftIds.push(shiftId);
      weekdays.push(weekday);
    }
  });
  return { shiftIds, weekdays };
}

async function writeAvailabilityWeek(
  sql: SqlClient,
  input: { orgId: string; siteId: string; employeeId: string; week: string; shifts: string[][] },
): Promise<void> {
  const week = await sql.query<{ id: string }>(
    `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
     values ($1, $2, $3, $4::date)
     on conflict (site_id, employee_id, week_start) do update set week_start = excluded.week_start
     returning id`,
    [input.orgId, input.siteId, input.employeeId, input.week],
  );
  const weekId = week[0]?.id;
  if (!weekId) throw new SaveError("availability");
  await sql.query(`delete from public.availability_entries where availability_week_id = $1`, [weekId]);
  const { shiftIds, weekdays } = flattenGrid(input.shifts);
  if (shiftIds.length === 0) return;
  const inserted = await sql.query<{ shift_id: string }>(
    `insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
     select $2, $3, requested.shift_id, requested.weekday
     from unnest($4::uuid[], $5::int[]) as requested(shift_id, weekday)
     join public.shifts s on s.id = requested.shift_id and s.site_id = $1 and s.org_id = $2
     returning shift_id`,
    [input.siteId, input.orgId, weekId, shiftIds, weekdays],
  );
  if (inserted.length !== shiftIds.length) throw new SaveError("availability");
}

/** Store a request. The weekly constraints stay as they are until a manager approves it. */
export async function submitAvailabilityRequest(
  sql: SqlClient,
  input: { siteId: string; week: string; shifts: string[][] },
): Promise<StoredRequest> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.week) || input.shifts.length !== 7) throw new SaveError("availability");
  const shifts = normalizeGrid(input.shifts);
  try {
    const mine = await sql.query<{ id: string; org_id: string }>(
      `select e.id, e.org_id
       from public.employees e
       join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
       where e.user_id = (select auth.uid()) and es.site_id = $1`,
      [input.siteId],
    );
    const employee = mine[0];
    if (!employee) throw new SaveError("forbidden");
    const open = await sql.query<{ open: boolean }>(`select private.constraint_window_open($1) as open`, [input.siteId]);
    if (open[0]?.open !== true) throw new SaveError("window");
    const { shiftIds, weekdays } = flattenGrid(shifts);
    const cap = await sql.query<{ limited: boolean; max_blocks: number }>(
      `select constraint_block_limit as limited, constraint_max_blocks::int as max_blocks
       from public.sites where id = $1`,
      [input.siteId],
    );
    if (cap[0]?.limited) {
      const counted = await sql.query<{ blocks: number }>(
        shiftIds.length === 0
          ? `select count(*)::int as blocks
             from public.employee_agreements a
             join public.shift_requirements r on r.shift_id = a.shift_id and r.weekday = a.weekday
             where a.employee_id = $1 and r.required_count > 0`
          : `select count(*)::int as blocks
             from public.employee_agreements a
             join public.shift_requirements r on r.shift_id = a.shift_id and r.weekday = a.weekday
             where a.employee_id = $1 and r.required_count > 0
               and not exists (
                 select 1
                 from unnest($2::int[], $3::uuid[]) as cell(weekday, shift_id)
                 where cell.weekday = a.weekday and cell.shift_id = a.shift_id
               )`,
        shiftIds.length === 0 ? [employee.id] : [employee.id, weekdays, shiftIds],
      );
      if ((counted[0]?.blocks ?? 0) > cap[0].max_blocks) throw new SaveError("blocks");
    }
    const current = await sql.query<{ weekday: number | null; shift_id: string | null }>(
      `select e.weekday, e.shift_id::text as shift_id
       from public.availability_weeks w
       left join public.availability_entries e on e.availability_week_id = w.id
       where w.site_id = $1 and w.employee_id = $2 and w.week_start = $3::date`,
      [input.siteId, employee.id, input.week],
    );
    if (current.length > 0) {
      const official = new Set(current.filter((row) => row.shift_id).map((row) => `${row.weekday}|${row.shift_id}`));
      const requested = new Set(shiftIds.map((shiftId, index) => `${weekdays[index]}|${shiftId}`));
      if (official.size === requested.size && [...requested].every((cell) => official.has(cell))) throw new SaveError("same");
    }
    await sql.query(
      `delete from public.availability_requests
       where site_id = $1 and employee_id = $2 and week_start = $3::date and status = 'pending'`,
      [input.siteId, employee.id, input.week],
    );
    const inserted = await sql.query<{ id: string }>(
      shiftIds.length === 0
        ? `insert into public.availability_requests (org_id, site_id, employee_id, week_start, status, shifts)
           values ($1, $2, $3, $4::date, 'pending', '[[],[],[],[],[],[],[]]'::jsonb)
           returning id`
        : `insert into public.availability_requests (org_id, site_id, employee_id, week_start, status, shifts)
           select $1, $2, $3, $4::date, 'pending', (
             select jsonb_agg(coalesce(grouped.ids, '[]'::jsonb) order by day.weekday)
             from generate_series(0, 6) as day(weekday)
             left join (
               select weekday, jsonb_agg(shift_id::text) as ids
               from unnest($5::uuid[], $6::int[]) as cell(shift_id, weekday)
               group by weekday
             ) grouped on grouped.weekday = day.weekday
           )
           returning id`,
      shiftIds.length === 0
        ? [employee.org_id, input.siteId, employee.id, input.week]
        : [employee.org_id, input.siteId, employee.id, input.week, shiftIds, weekdays],
    );
    const id = inserted[0]?.id;
    if (!id) throw new SaveError("availability");
    return { id, employeeId: employee.id, week: input.week, shifts };
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/window|42501/i.test(message)) throw new SaveError("window");
    throw new SaveError("availability");
  }
}

/** A shift manager approves the request into the weekly constraints, or rejects it. */
export async function decideAvailabilityRequest(
  sql: SqlClient,
  input: { requestId: string; approve: boolean },
): Promise<StoredRequest> {
  const rows = await sql.query<{ id: string; org_id: string; site_id: string; employee_id: string; week_start: string; shifts: unknown }>(
    `select id, org_id, site_id, employee_id, week_start::text as week_start, shifts
     from public.availability_requests
     where id = $1 and status = 'pending'`,
    [input.requestId],
  );
  const request = rows[0];
  if (!request) throw new SaveError("forbidden");
  const shifts = normalizeGrid(request.shifts);
  const week = request.week_start.slice(0, 10);
  try {
    if (input.approve) {
      await writeAvailabilityWeek(sql, {
        orgId: request.org_id,
        siteId: request.site_id,
        employeeId: request.employee_id,
        week,
        shifts,
      });
    }
    const updated = await sql.query<{ id: string }>(
      `update public.availability_requests
       set status = $2, decided_at = now()
       where id = $1 and status = 'pending'
       returning id`,
      [request.id, input.approve ? "approved" : "rejected"],
    );
    if (!updated[0]) throw new SaveError("forbidden");
    return { id: request.id, employeeId: request.employee_id, week, shifts };
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/42501|not allowed|forbidden/i.test(message)) throw new SaveError("forbidden");
    throw new SaveError("availability");
  }
}

/** The employee dismisses the notice for a request the shift manager already answered. */
export async function acknowledgeAvailabilityRequest(sql: SqlClient, requestId: string): Promise<void> {
  if (!requestId) throw new SaveError("availability");
  try {
    await sql.query(`select public.acknowledge_availability_request($1)`, [requestId]);
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/42501|not allowed|forbidden/i.test(message)) throw new SaveError("forbidden");
    throw new SaveError("availability");
  }
}
