import { describe, expect, it } from "vitest";
import { listMemberships, resolveActiveOrg } from "../auth/session";
import { asRole, client, openTestDatabase } from "./test-db";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const north = "99999999-9999-4999-8999-999999999999";
const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const danaUser = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const founder = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

describe("role permissions", () => {
  it("lets a manager edit the agreement and keeps an employee to the published schedule", async () => {
    const db = await openTestDatabase();
    await db.exec(
      `insert into auth.users (id) values
         ('${ownerA}'), ('${ownerB}'), ('${manager}'), ('${danaUser}'), ('${founder}');
       insert into public.organizations (id, name, slug) values
         ('${north}', 'North Gate', 'north-gate');
       insert into public.sites (id, org_id, name) values
         ('88888888-8888-4888-8888-888888888888', '${north}', 'North Post');
       insert into public.employees (id, org_id, name) values
         ('77777777-7777-4777-8777-777777777777', '${north}', 'Secret');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${ownerA}', 'owner'),
         ('${sentinel}', '${manager}', 'manager'),
         ('${north}', '${ownerB}', 'owner'),
         ('${north}', '${ownerA}', 'employee');
       update public.employees set user_id = '${danaUser}' where name = 'Dana';
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${danaUser}', 'employee');
       insert into public.site_memberships (org_id, site_id, user_id, role)
       values ('${sentinel}', '${headquarters}', '${danaUser}', 'employee');
       insert into public.schedules (id, org_id, site_id, week_start, status) values
         ('66666666-6666-4666-8666-666666666611', '${sentinel}', '${headquarters}', '2026-10-11', 'published'),
         ('66666666-6666-4666-8666-666666666618', '${sentinel}', '${headquarters}', '2026-10-18', 'draft');
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
       select '${sentinel}', '66666666-6666-4666-8666-666666666611', s.id, 0, e.id
       from public.shifts s
       join public.employees e on e.name = 'Yossi'
       where s.name = 'Morning' and s.site_id = '${headquarters}';
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
       select '${sentinel}', '66666666-6666-4666-8666-666666666618', s.id, 0, e.id
       from public.shifts s
       join public.employees e on e.name = 'Ron'
       where s.name = 'Morning' and s.site_id = '${headquarters}';`,
    );

    const uncovered = await db.query<{ count: string }>(
      `select count(*)::text as count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not exists (
           select 1 from pg_policies p
           where p.schemaname = 'public' and p.tablename = c.relname
         )`,
    );
    expect(uncovered.rows[0].count).toBe("0");
    const blanket = await db.query<{ count: string }>(
      `select count(*)::text as count from pg_policies where policyname = 'member_all'`,
    );
    expect(blanket.rows[0].count).toBe("0");

    await asRole(db, "authenticated", manager);
    const edited = await db.query<{ weekly_shift_quota: number }>(
      `update public.employees set weekly_shift_quota = 3 where name = 'Dana' returning weekly_shift_quota`,
    );
    expect(edited.rows[0].weekly_shift_quota).toBe(3);
    const removed = await db.query(
      `delete from public.employee_agreements
       where weekday = 0
         and employee_id = (select id from public.employees where name = 'Dana')
         and shift_id = (select id from public.shifts where name = 'Morning' and site_id = '${headquarters}')
       returning employee_id`,
    );
    expect(removed.rows).toHaveLength(1);

    await asRole(db, "authenticated", danaUser);
    const blockedEdit = await db.query(
      `update public.employees set weekly_shift_quota = 9 where name = 'Dana' returning id`,
    );
    expect(blockedEdit.rows).toHaveLength(0);
    const blockedAgreement = await db.query(
      `delete from public.employee_agreements
       where employee_id = (select id from public.employees where name = 'Dana')
       returning employee_id`,
    );
    expect(blockedAgreement.rows).toHaveLength(0);
    await expect(
      db.query(
        `insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
         select '${sentinel}', '66666666-6666-4666-8666-666666666611', s.id, 1, e.id
         from public.shifts s
         join public.employees e on e.name = 'Dana'
         where s.name = 'Morning' and s.site_id = '${headquarters}'`,
      ),
    ).rejects.toThrow(/row-level security/i);

    const visiblePeople = await db.query<{ name: string }>(
      `select name from public.employees order by name`,
    );
    expect(visiblePeople.rows.map((row) => row.name)).toEqual(["Dana", "Yossi"]);
    const ownAgreement = await db.query<{ count: string }>(
      `select count(*)::text as count from public.employee_agreements`,
    );
    expect(Number(ownAgreement.rows[0].count)).toBeGreaterThan(0);
    const published = await db.query<{ name: string }>(
      `select e.name
       from public.assignments a
       join public.employees e on e.id = a.employee_id
       join public.schedules s on s.id = a.schedule_id
       where s.status = 'published'`,
    );
    expect(published.rows.map((row) => row.name)).toEqual(["Yossi"]);
    const drafts = await db.query(`select id from public.schedules where status = 'draft'`);
    expect(drafts.rows).toEqual([]);

    await expect(
      db.query(
        `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
         select '${sentinel}', '${headquarters}', id, '2026-10-11'
         from public.employees
         where name = 'Dana'
         returning id`,
      ),
    ).rejects.toThrow(/row-level security/i);
    const ownRequest = await db.query<{ id: string }>(
      `insert into public.availability_requests (org_id, site_id, employee_id, week_start, status, shifts)
       select '${sentinel}', '${headquarters}', id, '2026-10-11', 'pending', '[[],[],[],[],[],[],[]]'::jsonb
       from public.employees
       where name = 'Dana'
       returning id`,
    );
    expect(ownRequest.rows).toHaveLength(1);
    await expect(
      db.query(
        `insert into public.availability_requests (org_id, site_id, employee_id, week_start, status, shifts)
         select '${sentinel}', '${headquarters}', id, '2026-10-11', 'pending', '[[],[],[],[],[],[],[]]'::jsonb
         from public.employees
         where name = 'Yossi'`,
      ),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      db.query(
        `insert into public.memberships (org_id, user_id, role)
         values ('${sentinel}', '${founder}', 'manager')`,
      ),
    ).rejects.toThrow(/row-level security/i);

    await asRole(db, "authenticated", manager);
    const quota = await db.query<{ weekly_shift_quota: number }>(
      `select weekly_shift_quota from public.employees where name = 'Dana'`,
    );
    expect(quota.rows[0].weekly_shift_quota).toBe(3);
    const yossiWeek = await db.query(
      `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
       select '${sentinel}', '${headquarters}', id, '2026-10-25'
       from public.employees
       where name = 'Yossi'
       returning id`,
    );
    expect(yossiWeek.rows).toHaveLength(1);
    const ron = await db.query<{ name: string }>(`select name from public.employees where name = 'Ron'`);
    expect(ron.rows.map((row) => row.name)).toEqual(["Ron"]);

    await asRole(db, "authenticated", ownerB);
    const northOnly = await db.query<{ name: string }>(`select name from public.employees order by name`);
    expect(northOnly.rows.map((row) => row.name)).toEqual(["Secret"]);
    const foreignOrg = await db.query(`select id from public.organizations where id = '${sentinel}'`);
    expect(foreignOrg.rows).toEqual([]);

    await asRole(db, "authenticated", ownerA);
    const memberships = await listMemberships(client(db));
    expect(memberships.map((membership) => membership.orgName).sort()).toEqual(["North Gate", "Sentinel Security"]);
    expect(resolveActiveOrg(memberships, null)?.orgName).toBe("Sentinel Security");
    expect(resolveActiveOrg(memberships, north)?.role).toBe("employee");
    const asNorthEmployee = await db.query<{ name: string }>(
      `select name from public.employees where org_id = '${north}'`,
    );
    expect(asNorthEmployee.rows).toEqual([]);
    await expect(
      db.query(`delete from public.memberships where org_id = '${sentinel}' and user_id = '${ownerA}'`),
    ).rejects.toThrow(/keep an owner/i);

    await db.exec("reset role");
    await db.exec(
      `update auth.users set email = 'founder@example.com' where id = '${founder}';
       insert into public.founder_approvals (email, full_name) values ('founder@example.com', 'Founder One');`,
    );
    await asRole(db, "authenticated", founder);
    await expect(
      db.query(`insert into public.organizations (name, slug) values ('Nope', 'nope')`),
    ).rejects.toThrow(/row-level security/i);
    const created = await db.query<{ id: string }>(
      `select public.create_organization('Gate Two', 'gate-two', 'Security company') as id`,
    );
    const createdId = created.rows[0].id;
    const founded = await listMemberships(client(db));
    expect(founded).toEqual([{ orgId: createdId, orgName: "Gate Two", role: "owner" }]);

    await asRole(db, "authenticated", ownerB);
    const hidden = await db.query(`select id from public.organizations where id = '${createdId}'`);
    expect(hidden.rows).toEqual([]);
  });
});
