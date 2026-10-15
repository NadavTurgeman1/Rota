import { describe, expect, it } from "vitest";
import { analyze, dynamicReason, generate, slots } from "../domain/index";
import { loadSiteWeek } from "./load";
import { asRole, client, openTestDatabase } from "./test-db";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const north = "99999999-9999-4999-8999-999999999999";
const week = "2026-10-04";

describe("multi-tenant database", () => {
  it("loads the Sentinel demo into the scheduler and keeps orgs apart", async () => {
    const db = await openTestDatabase();

    const unprotected = await db.query<{ count: string }>(
      `select count(*)::text as count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(unprotected.rows[0].count).toBe("0");

    await expect(
      db.exec(
        `insert into public.schedules (org_id, site_id, week_start, status)
         values ('${sentinel}', '${headquarters}', '2026-10-05', 'draft')`,
      ),
    ).rejects.toThrow(/week_start/i);

    await db.exec(
      `insert into public.schedules (id, org_id, site_id, week_start, status)
       values (
         '66666666-6666-4666-8666-666666666601',
         '${sentinel}',
         '${headquarters}',
         '2026-09-27',
         'published'
       )`,
    );
    await db.exec(
      `insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
       select '${sentinel}', '66666666-6666-4666-8666-666666666601', s.id, 6, e.id
       from public.shifts s
       join public.employees e on e.name = 'Yossi'
       where s.name = 'Night' and s.site_id = '${headquarters}'`,
    );

    const state = await loadSiteWeek(client(db), headquarters, week);
    expect(state.biz).toMatchObject({
      name: "Headquarters",
      type: "Security company",
      minRest: 11,
      maxHours: 48,
      maxShift: 12,
    });
    expect(state.emps.map((employee) => employee.name)).toEqual([
      "Dana",
      "Eli",
      "Maya",
      "Noa",
      "Omer",
      "Ron",
      "Tal",
      "Yossi",
    ]);

    const morning = state.biz.shifts.find((shift) => shift.name === "Morning")!;
    const night = state.biz.shifts.find((shift) => shift.name === "Night")!;
    const dana = state.emps.find((employee) => employee.name === "Dana")!;
    const maya = state.emps.find((employee) => employee.name === "Maya")!;
    const ron = state.emps.find((employee) => employee.name === "Ron")!;
    const omer = state.emps.find((employee) => employee.name === "Omer")!;
    const yossi = state.emps.find((employee) => employee.name === "Yossi")!;

    expect(dana.grid?.every((day) => day.includes(morning.id) && !day.includes(night.id))).toBe(true);
    expect(maya.grid?.[6]).toEqual([]);
    expect(ron.grid?.[5]).toEqual([]);
    expect(omer.pref).toContain(night.id);
    expect(state.avail[week][dana.id][0]).toContain(morning.id);
    expect(state.avail[week][dana.id][2]).toEqual([]);
    expect(state.avail[week][maya.id]).toBeUndefined();

    const sundayMorning = slots(state, week).find((slot) => slot.key === `0|${morning.id}`)!;
    expect(dynamicReason(state, yossi, sundayMorning, [])?.code).toBe("rest");
    const sundayNight = slots(state, week).find((slot) => slot.key === `0|${night.id}`)!;
    expect(sundayNight.end).toBe(30);

    generate(state, week);
    const report = analyze(state, week);
    expect(report.violations).toEqual([]);
    expect(
      Object.entries(state.sched[week].assign).every(
        ([key, ids]) => !ids.includes(dana.id) || Number(key[0]) < 2,
      ),
    ).toBe(true);

    await db.exec(
      `insert into auth.users (id) values ('${userA}'), ('${userB}');
       insert into public.organizations (id, name, slug, kind)
       values ('${north}', 'North Gate', 'north-gate', 'Security company');
       insert into public.sites (id, org_id, name)
       values ('88888888-8888-4888-8888-888888888888', '${north}', 'North Post');
       insert into public.employees (id, org_id, name)
       values ('77777777-7777-4777-8777-777777777777', '${north}', 'Secret');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${userA}', 'owner'),
         ('${north}', '${userB}', 'owner');`,
    );

    await asRole(db, "authenticated", userA);
    const seenByA = await db.query<{ name: string }>("select name from public.organizations order by name");
    expect(seenByA.rows.map((row) => row.name)).toEqual(["Sentinel Security"]);
    const staffA = await db.query<{ name: string }>("select name from public.employees order by name");
    expect(staffA.rows.map((row) => row.name)).not.toContain("Secret");
    expect(staffA.rows).toHaveLength(8);
    await expect(
      db.query(
        `insert into public.employees (org_id, name) values ('${north}', 'Spy') returning id`,
      ),
    ).rejects.toThrow(/row-level security/i);
    const hired = await db.query<{ name: string }>(
      `insert into public.employees (org_id, name, job_title)
       values ('${sentinel}', 'Temporary', 'Guard')
       returning name`,
    );
    expect(hired.rows[0].name).toBe("Temporary");

    await asRole(db, "authenticated", userB);
    const seenByB = await db.query<{ name: string }>("select name from public.organizations");
    expect(seenByB.rows.map((row) => row.name)).toEqual(["North Gate"]);
    const staffB = await db.query<{ name: string }>("select name from public.employees");
    expect(staffB.rows.map((row) => row.name)).toEqual(["Secret"]);

    await db.exec("reset role");
    await db.exec("grant usage on schema public to anon");
    await db.exec("grant select on all tables in schema public to anon");
    await asRole(db, "anon");
    const seenByAnon = await db.query("select * from public.organizations");
    expect(seenByAnon.rows).toEqual([]);
  });
});
