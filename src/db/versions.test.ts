import { describe, expect, it } from "vitest";
import { loadSiteWeek } from "./load";
import { asRole, client, openTestDatabase } from "./test-db";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const north = "99999999-9999-4999-8999-999999999999";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const danaUser = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const outsider = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const schedule = "66666666-6666-4666-8666-666666666611";
const version = "55555555-5555-4555-8555-555555555501";
const week = "2026-10-11";

describe("versions, call-offs and notes in Postgres", () => {
  it("loads them into the engine and keeps them to the right roles", async () => {
    const db = await openTestDatabase();
    await db.exec(
      `insert into auth.users (id) values ('${manager}'), ('${danaUser}'), ('${outsider}');
       insert into public.organizations (id, name, slug) values ('${north}', 'North Gate', 'north-gate');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${manager}', 'manager'),
         ('${sentinel}', '${danaUser}', 'employee'),
         ('${north}', '${outsider}', 'owner');
       update public.employees set user_id = '${danaUser}' where name = 'Dana';
       update public.sites set max_day_hours = 10 where id = '${headquarters}';
       insert into public.schedules (id, org_id, site_id, week_start, status)
       values ('${schedule}', '${sentinel}', '${headquarters}', '${week}', 'published');
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
       select '${sentinel}', '${schedule}', s.id, 0, e.id
       from public.shifts s join public.employees e on e.name = 'Yossi'
       where s.name = 'Morning' and s.site_id = '${headquarters}';`,
    );
    const ids = await db.query<{ morning: string; yossi: string; tal: string }>(
      `select (select id from public.shifts where name = 'Morning' and site_id = '${headquarters}') as morning,
              (select id from public.employees where name = 'Yossi') as yossi,
              (select id from public.employees where name = 'Tal') as tal`,
    );
    const { morning, yossi, tal } = ids.rows[0];
    const snapshot = { assign: { [`0|${morning}`]: [yossi, tal] }, locked: [], status: "published" };

    await asRole(db, "authenticated", manager);
    await db.query(
      `insert into public.schedule_versions (id, org_id, schedule_id, number, reason, snapshot)
       values ($1, $2, $3, 1, 'publish', $4::jsonb)`,
      [version, sentinel, schedule, JSON.stringify(snapshot)],
    );
    await db.query(
      `insert into public.schedule_calloffs (org_id, schedule_id, shift_id, weekday, employee_id, reported_at)
       values ($1, $2, $3, 0, $4, '2026-10-11T05:00:00Z')`,
      [sentinel, schedule, morning, tal],
    );
    await db.query(
      `insert into public.constraint_notes (org_id, site_id, week_start, raw, employee_ids, model_lines, approved_at)
       values ($1, $2, $3, $4, array[$5]::uuid[], array[2], '2026-10-10T12:00:00Z')`,
      [sentinel, headquarters, week, "Yossi\nיום שלישי אין מצב בלילה", yossi],
    );
    await expect(db.query(`update public.schedule_versions set number = 2`)).rejects.toThrow(/permission denied/i);
    await expect(db.query(`delete from public.schedule_versions`)).rejects.toThrow(/permission denied/i);

    await db.exec("reset role");
    const state = await loadSiteWeek(client(db), headquarters, week);
    expect(state.biz.maxDayHours).toBe(10);
    expect(state.versions?.[week]).toEqual([
      {
        id: version,
        number: 1,
        at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        by: manager,
        reason: "publish",
        schedule: snapshot,
      },
    ]);
    expect(state.sched[week].calloffs).toEqual([
      {
        id: expect.any(String),
        slotKey: `0|${morning}`,
        employeeId: tal,
        name: "Tal",
        at: "2026-10-11T05:00:00.000Z",
        by: manager,
      },
    ]);
    expect(state.notes?.[week]).toEqual([
      {
        id: expect.any(String),
        at: "2026-10-10T12:00:00.000Z",
        raw: "Yossi\nיום שלישי אין מצב בלילה",
        employeeIds: [yossi],
        modelLines: [2],
      },
    ]);

    await asRole(db, "authenticated", danaUser);
    expect((await db.query("select id from public.schedule_versions")).rows).toEqual([]);
    expect((await db.query("select id from public.constraint_notes")).rows).toEqual([]);
    expect((await db.query("select id from public.schedule_calloffs")).rows).toHaveLength(1);
    await expect(
      db.query(
        `insert into public.schedule_versions (org_id, schedule_id, number, reason, snapshot)
         values ($1, $2, 2, 'publish', '{}'::jsonb)`,
        [sentinel, schedule],
      ),
    ).rejects.toThrow(/row-level security/i);

    await asRole(db, "authenticated", outsider);
    expect((await db.query("select id from public.schedule_versions")).rows).toEqual([]);
    expect((await db.query("select id from public.schedule_calloffs")).rows).toEqual([]);
    expect((await db.query("select id from public.constraint_notes")).rows).toEqual([]);
  });
});
