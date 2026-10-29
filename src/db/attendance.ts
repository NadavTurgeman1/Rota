import type { AttendancePunch } from "../attendance/sessions";
import { SaveError } from "./save";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODES = ["clock", "timezone", "accuracy", "location", "open", "closed", "forbidden", "kind"] as const;

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
    p.punched_at::text as punched_at, p.latitude, p.longitude, p.accuracy_meters
  from public.attendance_punches p
  left join public.sites s on s.id = p.site_id and s.org_id = p.org_id`;

function mapPunch(row: {
  id: string;
  site_id: string;
  site_name: string;
  kind: string;
  punched_at: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
}): AttendancePunch {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    kind: row.kind === "out" ? "out" : "in",
    punchedAt: new Date(row.punched_at).toISOString(),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: Number(row.accuracy_meters),
  };
}

/** The signed-in employee's punches at one site, plus the server clock and that site's zone. */
export async function loadOwnAttendance(sql: SqlClient, siteId: string): Promise<AttendanceSnapshot> {
  if (!UUID.test(siteId)) throw new SaveError("forbidden");
  const site = await sql.query<{ timezone: string }>(`select timezone from public.sites where id = $1`, [siteId]);
  const actor = await sql.query<{ id: string | null }>(`select private.site_employee($1) as id`, [siteId]);
  if (!site[0] || !actor[0]?.id) throw new SaveError("forbidden");
  const rows = await sql.query<{
    id: string;
    site_id: string;
    site_name: string;
    kind: string;
    punched_at: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number;
  }>(`${PUNCHES} where p.employee_id = $1 order by p.punched_at desc limit 200`, [actor[0].id]);
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
  const rows = await sql.query<{
    id: string;
    site_id: string;
    site_name: string;
    kind: string;
    punched_at: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number;
  }>(`${PUNCHES} where p.employee_id = $1 order by p.punched_at desc limit 200`, [employeeId]);
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

/** One read for the team screen: the punches a manager of this site is allowed to see. */
export async function loadRosterAttendance(sql: SqlClient, siteId: string): Promise<AttendanceRoster> {
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
    const rows = await sql.query<{
      employee_id: string;
      id: string;
      site_id: string;
      site_name: string;
      kind: string;
      punched_at: string;
      latitude: number;
      longitude: number;
      accuracy_meters: number;
    }>(
      `select employee_id, id, site_id, site_name, kind, punched_at, latitude, longitude, accuracy_meters
       from (
         select p.employee_id, p.id, p.site_id, coalesce(s.name, '') as site_name, p.kind,
           p.punched_at::text as punched_at, p.latitude, p.longitude, p.accuracy_meters,
           row_number() over (partition by p.employee_id order by p.punched_at desc, p.id desc) as n
         from public.attendance_punches p
         left join public.sites s on s.id = p.site_id and s.org_id = p.org_id
         where p.employee_id = any($1::uuid[])
       ) recent
       where n <= 200
       order by punched_at`,
      [people.map((person) => person.id)],
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
