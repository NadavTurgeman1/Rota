import { describe, expect, it } from "vitest";
import { correctAttendance, loadEmployeeAttendance, loadOwnAttendance, loadRosterAttendance, recordAttendancePunch } from "./attendance";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";

const org = "11111111-1111-4111-8111-111111111111";
const otherOrg = "11111111-1111-4111-8111-111111111112";
const site = "44444444-4444-4444-8444-444444444444";
const otherSite = "44444444-4444-4444-8444-444444444445";
const dana = { employee: "77777777-7777-4777-8777-777777777771", user: "88888888-8888-4888-8888-888888888881" };
const noa = { employee: "77777777-7777-4777-8777-777777777772", user: "88888888-8888-4888-8888-888888888882" };
const manager = "99999999-9999-4999-8999-999999999991";
const owner = "99999999-9999-4999-8999-999999999992";
const outsider = "99999999-9999-4999-8999-999999999993";

async function setup() {
  const db = await openTestDatabase();
  const sql = client(db);
  await db.exec(`
    insert into public.organizations (id, name, slug) values ('${otherOrg}', 'Other', 'other-attendance');
    insert into public.sites (id, org_id, name, timezone) values
      ('${site}', '${org}', 'Main', 'Asia/Jerusalem'),
      ('${otherSite}', '${otherOrg}', 'Other', 'Asia/Jerusalem');
    insert into auth.users (id, email) values
      ('${dana.user}', 'dana.attendance@example.com'),
      ('${noa.user}', 'noa.attendance@example.com'),
      ('${manager}', 'manager@example.com'),
      ('${owner}', 'owner@example.com'),
      ('${outsider}', 'outsider@example.com');
    insert into public.memberships (org_id, user_id, role) values
      ('${org}', '${dana.user}', 'employee'),
      ('${org}', '${noa.user}', 'employee'),
      ('${org}', '${manager}', 'manager'),
      ('${org}', '${owner}', 'owner'),
      ('${otherOrg}', '${outsider}', 'owner');
    insert into public.site_memberships (org_id, site_id, user_id, role) values
      ('${org}', '${site}', '${dana.user}', 'employee'),
      ('${org}', '${site}', '${noa.user}', 'employee'),
      ('${org}', '${site}', '${manager}', 'manager');
    insert into public.employees (id, org_id, name, user_id, home_site_id) values
      ('${dana.employee}', '${org}', 'Dana', '${dana.user}', '${site}'),
      ('${noa.employee}', '${org}', 'Noa', '${noa.user}', '${site}');
    insert into public.employee_sites (org_id, employee_id, site_id) values
      ('${org}', '${dana.employee}', '${site}'),
      ('${org}', '${noa.employee}', '${site}');
  `);
  const as = (userId: string) => asRole(db, "authenticated", userId);
  const clock = async () => {
    await db.exec("reset role");
    const rows = await sql.query<{ now: string; offset: number }>(
      `select to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now,
              round((
                extract(epoch from (clock_timestamp() at time zone 'Asia/Jerusalem'))
                - extract(epoch from (clock_timestamp() at time zone 'UTC'))
              ) / 60)::int as offset`,
    );
    return { deviceAt: rows[0]!.now, deviceOffsetMinutes: Number(rows[0]!.offset) };
  };
  return { db, sql, as, clock };
}

const here = { latitude: 32.0853, longitude: 34.7818, accuracyMeters: 5 };

describe("attendance punches", () => {
  it("records the server time and the GPS fix, and refuses a second entry or a bad clock", async () => {
    const { db, sql, as, clock } = await setup();
    const first = await clock();
    await as(dana.user);
    await recordAttendancePunch(sql, { siteId: site, kind: "in", ...first, ...here });
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "in", ...first, ...here })).rejects.toThrow(SaveError);
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "in", ...first, ...here })).rejects.toThrow(/open/);

    const skewed = { ...first, deviceAt: new Date(Date.now() - 10 * 60_000).toISOString() };
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...skewed, ...here })).rejects.toThrow(/clock/);
    await expect(
      recordAttendancePunch(sql, { siteId: site, kind: "out", ...first, deviceOffsetMinutes: first.deviceOffsetMinutes + 60, ...here }),
    ).rejects.toThrow(/timezone/);
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...first, ...here, accuracyMeters: 101 })).rejects.toThrow(/accuracy/);
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...first, ...here, accuracyMeters: 400 })).rejects.toThrow(/accuracy/);
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...first, ...here, latitude: 120 })).rejects.toThrow(/location/);

    const leaving = await clock();
    await as(dana.user);
    await recordAttendancePunch(sql, { siteId: site, kind: "out", ...leaving, ...here, accuracyMeters: 52 });
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...leaving, ...here })).rejects.toThrow(/closed/);

    await db.exec("reset role");
    const stored = await sql.query<{ kind: string; punched_at: string; device_at: string; accuracy_meters: number }>(
      `select kind, punched_at::text as punched_at, device_at::text as device_at, accuracy_meters
       from public.attendance_punches where employee_id = $1 order by punched_at`,
      [dana.employee],
    );
    expect(stored.map((row) => row.kind)).toEqual(["in", "out"]);
    expect(Math.abs(new Date(stored[0]!.punched_at).getTime() - new Date(first.deviceAt).getTime())).toBeLessThan(5_000);
    expect(Number(stored[1]!.accuracy_meters)).toBe(52);

    await as(dana.user);
    const own = await loadOwnAttendance(sql, site);
    expect(own.timeZone).toBe("Asia/Jerusalem");
    expect(own.punches).toHaveLength(2);
    expect(own.punches[0]?.kind).toBe("out");
  });

  it("lets the owner and the site's shift manager read the log, and nobody else write or read it", async () => {
    const { db, sql, as, clock } = await setup();
    const stamp = await clock();
    await as(dana.user);
    await recordAttendancePunch(sql, { siteId: site, kind: "in", ...stamp, ...here });

    await as(noa.user);
    await expect(loadEmployeeAttendance(sql, dana.employee)).rejects.toThrow(/forbidden/);
    const hidden = await sql.query<{ id: string }>(`select id from public.attendance_punches where employee_id = $1`, [dana.employee]);
    expect(hidden).toEqual([]);
    await expect(
      sql.query(
        `insert into public.attendance_punches (
           org_id, site_id, employee_id, kind, punched_at, device_at, device_offset_minutes, latitude, longitude, accuracy_meters
         ) values ($1, $2, $3, 'in', clock_timestamp(), clock_timestamp(), 120, 32, 34, 10)`,
        [org, site, noa.employee],
      ),
    ).rejects.toThrow(/permission denied/i);

    await as(manager);
    const managed = await loadEmployeeAttendance(sql, dana.employee);
    expect(managed.punches).toHaveLength(1);
    expect(managed.punches[0]?.latitude).toBeCloseTo(here.latitude);

    await as(owner);
    expect(await loadEmployeeAttendance(sql, dana.employee)).toMatchObject({ punches: [{ kind: "in" }] });

    await as(outsider);
    await expect(loadEmployeeAttendance(sql, dana.employee)).rejects.toThrow(/forbidden/);
    await expect(recordAttendancePunch(sql, { siteId: site, kind: "out", ...stamp, ...here })).rejects.toThrow(/forbidden/);

    await as(dana.user);
    await expect(sql.query(`update public.attendance_punches set accuracy_meters = 1`)).rejects.toThrow(/permission denied/i);
    await expect(sql.query(`delete from public.attendance_punches`)).rejects.toThrow(/permission denied/i);
    await db.exec("reset role");
  });

  it("loads the whole site log in one read for a manager", async () => {
    const { db, sql, as, clock } = await setup();
    const stamp = await clock();
    await as(dana.user);
    await recordAttendancePunch(sql, { siteId: site, kind: "in", ...stamp, ...here });
    await as(dana.user);
    await expect(loadRosterAttendance(sql, site)).rejects.toThrow(/forbidden/);
    await as(manager);
    const roster = await loadRosterAttendance(sql, site);
    expect(roster.employees.map((person) => person.id).sort()).toEqual([dana.employee, noa.employee].sort());
    expect(roster.employees.find((person) => person.id === dana.employee)?.punches).toHaveLength(1);
    expect(roster.employees.find((person) => person.id === noa.employee)?.punches).toEqual([]);
    await db.exec("reset role");
  });

  it("lets the person's manager add and correct a time, and keeps the first time", async () => {
    const { db, sql, as, clock } = await setup();
    const lead = "77777777-7777-4777-8777-777777777773";
    await db.exec(`
      insert into public.employees (id, org_id, name, user_id, home_site_id)
      values ('${lead}', '${org}', 'Lead', '${manager}', '${site}');
      update public.employees set reports_to = '${lead}' where id = '${dana.employee}';
    `);
    const missed = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const left = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const moved = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    await as(dana.user);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "in", at: missed })).rejects.toThrow(/forbidden/);
    await as(noa.user);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "in", at: missed })).rejects.toThrow(/forbidden/);

    await as(manager);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "out", at: left })).rejects.toThrow(/closed/);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "in", at: new Date(Date.now() + 86_400_000).toISOString() })).rejects.toThrow(/future/);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "in", at: new Date(Date.now() - 100 * 86_400_000).toISOString() })).rejects.toThrow(/old/);
    await correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "in", at: missed });
    await correctAttendance(sql, { employeeId: dana.employee, action: "add", siteId: site, kind: "out", at: left });

    await db.exec("reset role");
    const added = await sql.query<{ id: string; kind: string; source: string; original_punched_at: string | null; latitude: number | null }>(
      `select id, kind, source, original_punched_at::text as original_punched_at, latitude
       from public.attendance_punches where employee_id = $1 order by punched_at`,
      [dana.employee],
    );
    expect(added.map((row) => row.kind)).toEqual(["in", "out"]);
    expect(added.every((row) => row.source === "manager" && row.original_punched_at == null && row.latitude == null)).toBe(true);

    await as(owner);
    await correctAttendance(sql, { employeeId: dana.employee, action: "adjust", punchId: added[0]!.id, at: moved });
    await db.exec("reset role");
    const once = await sql.query<{ punched_at: string; original_punched_at: string }>(
      `select punched_at::text as punched_at, original_punched_at::text as original_punched_at
       from public.attendance_punches where id = $1`,
      [added[0]!.id],
    );
    expect(new Date(once[0]!.punched_at).toISOString()).toBe(new Date(moved).toISOString());
    expect(new Date(once[0]!.original_punched_at).toISOString()).toBe(new Date(missed).toISOString());

    await as(owner);
    await correctAttendance(sql, { employeeId: dana.employee, action: "adjust", punchId: added[0]!.id, at: missed });
    await db.exec("reset role");
    const restored = await sql.query<{ punched_at: string; original_punched_at: string | null }>(
      `select punched_at::text as punched_at, original_punched_at::text as original_punched_at
       from public.attendance_punches where id = $1`,
      [added[0]!.id],
    );
    expect(restored[0]!.original_punched_at).toBeNull();
    expect(new Date(restored[0]!.punched_at).toISOString()).toBe(new Date(missed).toISOString());

    await as(manager);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "remove", punchId: added[0]!.id })).rejects.toThrow(/closed/);
    await correctAttendance(sql, { employeeId: dana.employee, action: "remove", punchId: added[0]!.id, punchIdB: added[1]!.id });

    const stamp = await clock();
    await as(dana.user);
    await recordAttendancePunch(sql, { siteId: site, kind: "in", ...stamp, ...here });
    await db.exec("reset role");
    const phone = await sql.query<{ id: string; punched_at: string }>(
      `select id, punched_at::text as punched_at from public.attendance_punches
       where employee_id = $1 and source = 'device'`,
      [dana.employee],
    );
    await as(dana.user);
    await expect(correctAttendance(sql, { employeeId: dana.employee, action: "remove", punchId: phone[0]!.id })).rejects.toThrow(/forbidden/);
    await as(owner);
    await correctAttendance(sql, { employeeId: dana.employee, action: "adjust", punchId: phone[0]!.id, at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });
    await db.exec("reset role");
    const corrected = await sql.query<{ original_punched_at: string; latitude: number }>(
      `select original_punched_at::text as original_punched_at, latitude from public.attendance_punches where id = $1`,
      [phone[0]!.id],
    );
    expect(new Date(corrected[0]!.original_punched_at).toISOString()).toBe(new Date(phone[0]!.punched_at).toISOString());
    expect(Number(corrected[0]!.latitude)).toBeCloseTo(here.latitude);

    await as(owner);
    await correctAttendance(sql, { employeeId: dana.employee, action: "remove", punchId: phone[0]!.id });
    await db.exec("reset role");
    const gone = await sql.query<{ id: string }>(`select id from public.attendance_punches where id = $1`, [phone[0]!.id]);
    expect(gone).toEqual([]);
  });
});
