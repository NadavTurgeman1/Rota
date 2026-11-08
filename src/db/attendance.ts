import type { AttendancePunch } from "../attendance/sessions";
import { SaveError } from "./save";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODES = ["clock", "timezone", "accuracy", "location", "open", "closed", "forbidden", "kind", "future", "old", "duplicate"] as const;

export type AttendanceSnapshot = {
  serverNow: string;
  timeZone: string;
  punches: AttendancePunch[];
};

function failed(error: unknown): SaveError {
  if (error instanceof SaveError) return error;
  const message = error instanceof Error ? error.message : "";
  if (/permission denied/i.test(message)) return new SaveError("forbidden");
  const code = CODES.find((item) => new RegExp(`\\b${item}\\b`).test(message));
  return new SaveError(code ?? "attendance");
}

async function serverNow(sql: SqlClient): Promise<string> {
  const rows = await sql.query<{ now: string }>(`select clock_timestamp()::text as now`);
  return new Date(rows[0]?.now ?? Date.now()).toISOString();
}

const PUNCHES = `select p.id, p.site_id, coalesce(s.name, '') as site_name, p.kind,
    p.punched_at::text as punched_at, p.original_punched_at::text as original_punched_at, p.source,
    p.latitude, p.longitude, p.accuracy_meters
  from public.attendance_punches p
  left join public.sites s on s.id = p.site_id and s.org_id = p.org_id`;

type PunchRow = {
  id: string;
  site_id: string;
  site_name: string;
  kind: string;
  punched_at: string;
  original_punched_at: string | null;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
};

function mapPunch(row: PunchRow): AttendancePunch {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    kind: row.kind === "out" ? "out" : "in",
    punchedAt: new Date(row.punched_at).toISOString(),
    originalPunchedAt: row.original_punched_at ? new Date(row.original_punched_at).toISOString() : null,
    source: row.source === "manager" ? "manager" : "device",
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    accuracyMeters: row.accuracy_meters == null ? null : Number(row.accuracy_meters),
  };
}

/** The signed-in employee's punches at one site, plus the server clock and that site's zone. */
export async function loadOwnAttendance(sql: SqlClient, siteId: string): Promise<AttendanceSnapshot> {
  if (!UUID.test(siteId)) throw new SaveError("forbidden");
  const site = await sql.query<{ timezone: string }>(`select timezone from public.sites where id = $1`, [siteId]);
  const actor = await sql.query<{ id: string | null }>(`select private.attendance_employee($1) as id`, [siteId]);
  if (!site[0] || !actor[0]?.id) throw new SaveError("forbidden");
  const rows = await sql.query<PunchRow>(`${PUNCHES} where p.employee_id = $1 order by p.punched_at desc limit 200`, [actor[0].id]);
  return { serverNow: await serverNow(sql), timeZone: site[0].timezone, punches: rows.map(mapPunch) };
}

/** Punches an owner or a shift manager of this person's sites may read. */
export async function loadEmployeeAttendance(sql: SqlClient, employeeId: string): Promise<AttendanceSnapshot> {
  if (!UUID.test(employeeId)) throw new SaveError("forbidden");
  const allowed = await sql.query<{ ok: boolean; timezone: string | null }>(
    `select
       (
         e.user_id = (select auth.uid())
         or (select private.org_role(e.org_id)) = 'owner'
         or exists (
           select 1 from public.employee_sites es
           where es.employee_id = e.id and es.org_id = e.org_id
             and (select private.manages_site(es.site_id))
         )
       ) as ok,
       (
         select s.timezone from public.sites s
         where s.id = e.home_site_id and s.org_id = e.org_id
       ) as timezone
     from public.employees e
     where e.id = $1`,
    [employeeId],
  );
  if (!allowed[0]?.ok) throw new SaveError("forbidden");
  const rows = await sql.query<PunchRow>(`${PUNCHES} where p.employee_id = $1 order by p.punched_at desc limit 200`, [employeeId]);
  return {
    serverNow: await serverNow(sql),
    timeZone: allowed[0].timezone || "Asia/Jerusalem",
    punches: rows.map(mapPunch),
  };
}

export type AttendanceRoster = {
  serverNow: string;
  timeZone: string;
  employees: { id: string; timeZone: string; punches: AttendancePunch[] }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One read for the team screen: the punches a manager of this site is allowed to see. A date range reads that window instead of the latest 200. */
export async function loadRosterAttendance(
  sql: SqlClient,
  siteId: string,
  range?: { from: string; to: string },
): Promise<AttendanceRoster> {
  if (!UUID.test(siteId)) throw new SaveError("forbidden");
  const site = await sql.query<{ timezone: string; ok: boolean }>(
    `select timezone,
       ((select private.org_role(org_id)) = 'owner' or (select private.manages_site(id))) as ok
     from public.sites where id = $1`,
    [siteId],
  );
  if (!site[0]?.ok) throw new SaveError("forbidden");
  const timeZone = site[0].timezone || "Asia/Jerusalem";
  const people = await sql.query<{ id: string; timezone: string }>(
    `select e.id, coalesce(home.timezone, $2) as timezone
     from public.employees e
     join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id and es.site_id = $1
     left join public.sites home on home.id = e.home_site_id and home.org_id = e.org_id
     order by e.name`,
    [siteId, timeZone],
  );
  const punches = new Map<string, AttendancePunch[]>();
  if (people.length > 0) {
    const rows = await sql.query<PunchRow & { employee_id: string }>(
      `select employee_id, id, site_id, site_name, kind, punched_at, original_punched_at, source, latitude, longitude, accuracy_meters
       from (
         select p.employee_id, p.id, p.site_id, coalesce(s.name, '') as site_name, p.kind,
           p.punched_at::text as punched_at, p.original_punched_at::text as original_punched_at, p.source,
           p.latitude, p.longitude, p.accuracy_meters,
           row_number() over (partition by p.employee_id order by p.punched_at desc, p.id desc) as n
         from public.attendance_punches p
         left join public.sites s on s.id = p.site_id and s.org_id = p.org_id
         where p.employee_id = any($1::uuid[])
           and ($2::date is null or p.punched_at >= ($2::date::timestamp at time zone $4))
           and ($3::date is null or p.punched_at < (($3::date + interval '1 day') at time zone $4))
       ) recent
       where n <= $5
       order by punched_at`,
      [
        people.map((person) => person.id),
        range && DAY.test(range.from) && DAY.test(range.to) && range.from <= range.to ? range.from : null,
        range && DAY.test(range.from) && DAY.test(range.to) && range.from <= range.to ? range.to : null,
        timeZone,
        range ? 5000 : 200,
      ],
    );
    for (const row of rows) {
      const list = punches.get(row.employee_id) ?? [];
      list.push(mapPunch(row));
      punches.set(row.employee_id, list);
    }
  }
  return {
    serverNow: await serverNow(sql),
    timeZone,
    employees: people.map((person) => ({
      id: person.id,
      timeZone: person.timezone || timeZone,
      punches: punches.get(person.id) ?? [],
    })),
  };
}

export async function recordAttendancePunch(
  sql: SqlClient,
  input: {
    siteId: string;
    kind: "in" | "out";
    deviceAt: string;
    deviceOffsetMinutes: number;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  },
): Promise<void> {
  if (!UUID.test(input.siteId)) throw new SaveError("forbidden");
  const deviceAt = new Date(input.deviceAt);
  if (Number.isNaN(deviceAt.getTime())) throw new SaveError("clock");
  try {
    await sql.query(
      `select private.record_attendance_punch($1, $2, $3, $4, $5, $6, $7)`,
      [input.siteId, input.kind, deviceAt.toISOString(), input.deviceOffsetMinutes, input.latitude, input.longitude, input.accuracyMeters],
    );
  } catch (error) {
    throw failed(error);
  }
}

/** A manager above this employee adds a missed punch, changes its time, or deletes a whole clock session. */
export async function correctAttendance(
  sql: SqlClient,
  input: {
    employeeId: string;
    action: "add" | "adjust" | "remove";
    siteId?: string | null;
    kind?: "in" | "out" | null;
    punchId?: string | null;
    punchIdB?: string | null;
    at?: string | null;
  },
): Promise<void> {
  if (!UUID.test(input.employeeId)) throw new SaveError("forbidden");
  if (input.action === "add" && (!input.siteId || !UUID.test(input.siteId) || (input.kind !== "in" && input.kind !== "out"))) {
    throw new SaveError("kind");
  }
  if (input.action !== "add" && (!input.punchId || !UUID.test(input.punchId))) throw new SaveError("forbidden");
  if (input.punchIdB && !UUID.test(input.punchIdB)) throw new SaveError("forbidden");
  const at = input.at ? new Date(input.at) : null;
  if (input.action !== "remove" && (!at || Number.isNaN(at.getTime()))) throw new SaveError("clock");
  try {
    if (input.action === "remove") {
      await sql.query(`select private.remove_attendance_session($1, $2, $3)`, [
        input.employeeId,
        input.punchId,
        input.punchIdB && UUID.test(input.punchIdB) ? input.punchIdB : null,
      ]);
      return;
    }
    await sql.query(`select private.correct_attendance($1, $2, $3, $4, $5, $6)`, [
      input.employeeId,
      input.action,
      input.siteId && UUID.test(input.siteId) ? input.siteId : null,
      input.kind === "in" || input.kind === "out" ? input.kind : null,
      input.punchId && UUID.test(input.punchId) ? input.punchId : null,
      at ? at.toISOString() : null,
    ]);
  } catch (error) {
    throw failed(error);
  }
}
