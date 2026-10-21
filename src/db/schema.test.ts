import { describe, expect, it } from "vitest";
import { loadSiteWeek } from "./load";
import { saveSite } from "./save";
import { client, openDatabaseBefore, openTestDatabase } from "./test-db";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const week = "2026-10-11";

/** Tables that belong to the platform, not to one business. */
const PLATFORM_TABLES = ["founder_approvals", "organizations", "platform_admin_emails", "profiles"];

describe("database schema standards", () => {
  it("protects every table, indexes every foreign key and keeps each business apart", async () => {
    const db = await openTestDatabase();
    const sql = client(db);

    const unprotected = await sql.query<{ name: string }>(
      `select c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(unprotected).toEqual([]);

    const views = await sql.query<{ name: string }>(
      `select c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm')`,
    );
    expect(views).toEqual([]);

    const unindexed = await sql.query<{ name: string }>(
      `select fk.conname as name
       from pg_constraint fk
       join pg_namespace n on n.oid = fk.connamespace
       where fk.contype = 'f' and n.nspname = 'public'
         and not exists (
           select 1
           from pg_index ix
           where ix.indrelid = fk.conrelid
             and (string_to_array(ix.indkey::text, ' ')::int2[])[1:cardinality(fk.conkey)] @> fk.conkey
             and (string_to_array(ix.indkey::text, ' ')::int2[])[1:cardinality(fk.conkey)] <@ fk.conkey
         )
       order by 1`,
    );
    expect(unindexed).toEqual([]);

    const tenantless = await sql.query<{ name: string }>(
      `select c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and c.relname <> all ($1::text[])
         and not exists (
           select 1 from pg_attribute a
           where a.attrelid = c.oid and a.attname = 'org_id' and a.attnotnull and not a.attisdropped
         )`,
      [PLATFORM_TABLES],
    );
    expect(tenantless).toEqual([]);

    const crossTenant = await sql.query<{ name: string }>(
      `select fk.conname as name
       from pg_constraint fk
       join pg_namespace n on n.oid = fk.connamespace
       join pg_attribute own on own.attrelid = fk.conrelid and own.attname = 'org_id'
       join pg_attribute their on their.attrelid = fk.confrelid and their.attname = 'org_id'
       where fk.contype = 'f' and n.nspname = 'public'
         and not (own.attnum = any (fk.conkey))
         and not exists (
           select 1 from pg_constraint scoped
           where scoped.conrelid = fk.conrelid
             and scoped.contype = 'f'
             and own.attnum = any (scoped.conkey)
             and scoped.conkey && fk.conkey
         )`,
    );
    expect(crossTenant).toEqual([]);

    const looseDefiners = await sql.query<{ name: string }>(
      `select n.nspname || '.' || p.proname as name
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and p.prosecdef
         and not exists (select 1 from unnest(p.proconfig) as setting where setting like 'search_path=%')`,
    );
    expect(looseDefiners).toEqual([]);
  });

  it("stores locked and over-quota seats on the assignment itself", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const original = await loadSiteWeek(sql, headquarters, week);
    const morning = original.biz.shifts.find((shift) => shift.name === "Morning")!;
    const [dana, yossi] = original.emps;
    const slot = `0|${morning.id}`;
    const state = {
      ...original,
      sched: {
        [week]: {
          assign: { [slot]: [dana!.id, yossi!.id] },
          locked: [`${slot}#${dana!.id}`],
          over: { [`${slot}#${yossi!.id}`]: true as const },
          status: "draft" as const,
        },
      },
    };
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state });
    await db.exec("commit");

    const loaded = await loadSiteWeek(sql, headquarters, week);
    expect(loaded.sched[week]?.locked).toEqual([`${slot}#${dana!.id}`]);
    expect(loaded.sched[week]?.over).toEqual({ [`${slot}#${yossi!.id}`]: true });
    const rows = await sql.query<{ employee_id: string; locked: boolean; over_quota: boolean }>(
      `select employee_id, locked, over_quota from public.assignments order by locked desc`,
    );
    expect(rows).toEqual([
      { employee_id: dana!.id, locked: true, over_quota: false },
      { employee_id: yossi!.id, locked: false, over_quota: true },
    ]);
  });

  it("keeps a home site inside the business and clears it when the site is deleted", async () => {
    const db = await openTestDatabase();
    const other = "77777777-7777-4777-8777-777777777777";
    const otherSite = "78787878-7878-4878-8878-787878787878";
    const extraSite = "79797979-7979-4979-8979-797979797979";
    await db.exec(
      `insert into public.organizations (id, name, slug, kind) values ('${other}', 'Other', 'other', '');
       insert into public.sites (id, org_id, name) values ('${otherSite}', '${other}', 'Elsewhere');
       insert into public.sites (id, org_id, name) values ('${extraSite}', '${sentinel}', 'North');`,
    );
    const dana = "44444444-4444-4444-8444-444444444401";
    await expect(db.query(`update public.employees set home_site_id = $1 where id = $2`, [otherSite, dana])).rejects.toThrow();
    await db.query(`update public.employees set home_site_id = $1 where id = $2`, [extraSite, dana]);
    await db.query(`delete from public.sites where id = $1`, [extraSite]);
    const rows = await db.query<{ home_site_id: string | null; org_id: string }>(
      `select home_site_id, org_id from public.employees where id = $1`,
      [dana],
    );
    expect(rows.rows).toEqual([{ home_site_id: null, org_id: sentinel }]);
  });

  it("carries existing seats, invitations and contact emails into the consolidated schema", async () => {
    const { db, apply } = await openDatabaseBefore("schema_consolidation");
    const org = "11111111-1111-4111-8111-111111111111";
    const site = "22222222-2222-4222-8222-222222222222";
    const shift = "33333333-3333-4333-8333-333333333301";
    const employee = "44444444-4444-4444-8444-444444444401";
    const schedule = "66666666-6666-4666-8666-666666666601";
    const managerInvite = "88888888-8888-4888-8888-888888888801";
    const staffInvite = "88888888-8888-4888-8888-888888888802";
    const siteInvite = "88888888-8888-4888-8888-888888888803";
    await db.exec(
      `insert into public.organizations (id, name, slug, kind) values ('${org}', 'Sentinel', 'sentinel', '');
       insert into public.sites (id, org_id, name) values ('${site}', '${org}', 'Headquarters');
       insert into public.shifts (id, org_id, site_id, name, starts_at, ends_at, required_role, position)
         values ('${shift}', '${org}', '${site}', 'Morning', '06:00', '14:00', '', 0);
       insert into public.employees (id, org_id, name, contact, home_site_id)
         values ('${employee}', '${org}', 'Dana', 'dana@example.com', '${site}');
       insert into public.schedules (id, org_id, site_id, week_start, status)
         values ('${schedule}', '${org}', '${site}', '${week}', 'draft');
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
         values ('${org}', '${schedule}', '${shift}', 0, '${employee}');
       insert into public.assignment_locks (org_id, schedule_id, shift_id, weekday, employee_id)
         values ('${org}', '${schedule}', '${shift}', 0, '${employee}');
       insert into public.assignment_overages (org_id, schedule_id, shift_id, weekday, employee_id)
         values ('${org}', '${schedule}', '${shift}', 0, '${employee}');
       insert into public.manager_invitations (id, org_id, site_id, email, full_name)
         values ('${managerInvite}', '${org}', '${site}', 'noa@example.com', 'Noa');
       insert into public.staff_invitations (id, org_id, employee_id, email)
         values ('${staffInvite}', '${org}', '${employee}', 'dana@example.com');
       insert into public.site_invitations (id, org_id, site_id, email, full_name, role)
         values ('${siteInvite}', '${org}', '${site}', 'avi@example.com', 'Avi', 'manager');`,
    );

    await apply();

    const seats = await db.query(`select locked, over_quota from public.assignments`);
    expect(seats.rows).toEqual([{ locked: true, over_quota: true }]);
    const invitations = await db.query(
      `select id, kind, email, full_name, site_id, employee_id from public.invitations order by id`,
    );
    expect(invitations.rows).toEqual([
      { id: managerInvite, kind: "manager", email: "noa@example.com", full_name: "Noa", site_id: site, employee_id: null },
      { id: staffInvite, kind: "staff", email: "dana@example.com", full_name: "", site_id: null, employee_id: employee },
      { id: siteInvite, kind: "manager", email: "avi@example.com", full_name: "Avi", site_id: site, employee_id: null },
    ]);
    const people = await db.query(`select email, home_site_id from public.employees`);
    expect(people.rows).toEqual([{ email: "dana@example.com", home_site_id: site }]);
    const allowed = await db.query<{ ok: boolean }>(`select private.signup_allowed('NOA@example.com ') as ok`);
    expect(allowed.rows[0]?.ok).toBe(true);
    const gone = await db.query(
      `select relname from pg_class
       where relname in ('assignment_locks', 'assignment_overages', 'manager_invitations', 'staff_invitations',
                         'site_invitations', 'businesses', 'tenants', 'site_users', 'site_employees')`,
    );
    expect(gone.rows).toEqual([]);
  });
});
