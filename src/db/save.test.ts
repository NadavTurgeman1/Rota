import { describe, expect, it } from "vitest";
import { loadSiteWeek } from "./load";
import { orgSlug } from "./slug";
import { createFirstOrganization, createFirstSite, loadStoredWorkspace, saveStoredWorkspace } from "./workspace-store";
import { SaveError, saveSite } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import type { RotaState } from "../domain/types";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const north = "99999999-9999-4999-8999-999999999999";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const founder = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const week = "2026-10-11";

describe("saving a site", () => {
  it("builds a slug for a Hebrew business name", () => {
    expect(orgSlug("צוות 3", sentinel)).toBe("3-11111111");
    expect(orgSlug("Sentinel Security", sentinel)).toBe("sentinel-security-11111111");
  });

  it("round-trips Headquarters, including a zero hour cap and a former employee", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const original = await loadSiteWeek(sql, headquarters, week);
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: original });
    await db.exec("commit");
    expect(await loadSiteWeek(sql, headquarters, week)).toEqual(original);

    const yossi = original.emps.find((employee) => employee.name === "Yossi");
    const morning = original.biz.shifts.find((shift) => shift.name === "Morning");
    if (!yossi || !morning) throw new Error("seed");
    const version = "55555555-5555-4555-8555-555555555599";
    const changed: RotaState = {
      ...original,
      biz: {
        ...original.biz,
        name: "ברן",
        maxHours: 0,
        maxShift: 0,
        maxDayHours: 0,
        blockLimit: true,
        blockSplit: "weekday",
        maxBlocks: 4,
        weekdayBlocks: 2,
        weekendBlocks: 1,
      },
      emps: original.emps
        .filter((employee) => employee.id !== yossi.id)
        .map((employee) =>
          employee.name === "Dana"
            ? { ...employee, customBlocks: { max: 1, weekday: 2, weekend: 0, shifts: { [morning.id]: 3 } } }
            : employee,
        ),
      former: { [yossi.id]: "Yossi" },
      sched: {
        [week]: {
          assign: { [`0|${morning.id}`]: [yossi.id] },
          locked: [],
          status: "published",
          restoredFrom: 2,
        },
      },
      versions: {
        [week]: [
          {
            id: version,
            number: 1,
            at: "2026-10-11T05:00:00.000Z",
            by: "Ari",
            reason: "publish",
            schedule: { assign: { [`0|${morning.id}`]: [yossi.id] }, locked: [], status: "published" },
          },
        ],
      },
    };
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: changed });
    await db.exec("commit");
    const loaded = await loadSiteWeek(sql, headquarters, week);
    expect(loaded.biz.name).toBe("ברן");
    expect(loaded.biz.blockSplit).toBe("weekday");
    expect(loaded.biz.weekdayBlocks).toBe(2);
    expect(loaded.biz.weekendBlocks).toBe(1);
    expect(loaded.emps.find((employee) => employee.name === "Dana")?.customBlocks).toEqual({
      max: 1,
      weekday: 2,
      weekend: 0,
      shifts: { [morning.id]: 3 },
    });
    expect(loaded.biz.maxHours).toBe(0);
    expect(loaded.biz.maxShift).toBe(0);
    expect(loaded.biz.maxDayHours).toBeUndefined();
    expect(loaded.emps.map((employee) => employee.id)).not.toContain(yossi.id);
    expect(loaded.former).toEqual({ [yossi.id]: "Yossi" });
    expect(loaded.sched[week]?.assign[`0|${morning.id}`]).toEqual([yossi.id]);
    expect(loaded.sched[week]?.restoredFrom).toBe(2);
    expect(loaded.versions?.[week]?.[0]?.by).toBe("Ari");

    const dropped: RotaState = { ...changed, versions: undefined };
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: dropped });
    await db.exec("commit");
    expect((await loadSiteWeek(sql, headquarters, week)).versions).toBeUndefined();
  });

  it("keeps an inactive teammate on the roster and stores a new draft week", async () => {
    const db = await openTestDatabase();
    await db.exec(
      `insert into auth.users (id) values ('${manager}');
       insert into public.memberships (org_id, user_id, role) values ('${sentinel}', '${manager}', 'manager');
       insert into public.site_memberships (org_id, site_id, user_id, role)
       values ('${sentinel}', '${headquarters}', '${manager}', 'manager');`,
    );
    const sql = client(db);
    const state = await loadSiteWeek(sql, headquarters, week);
    const person = state.emps[0];
    const morning = state.biz.shifts[0];
    if (!person || !morning) throw new Error("seed");
    const nextWeek = "2026-10-18";
    const draft: RotaState = {
      ...state,
      emps: state.emps.map((employee) =>
        employee.id === person.id
          ? {
              ...employee,
              active: false,
              phone: "0501234567",
              profile: {
                nationalId: "123456782",
                birthDate: "1990-04-02",
                gender: "female",
                mobile: "0537224225",
                city: "חיפה",
                street: "הרצל",
                houseNumber: "10",
                zip: "33000",
                startedOn: "2024-01-07",
                endedOn: "",
                employeeNumber: "",
                department: "מבצעים",
                maritalStatus: "married",
                bankName: "לאומי",
                bankBranch: "800",
                bankAccount: "123456",
              },
            }
          : employee,
      ),
      sched: {
        ...state.sched,
        [nextWeek]: {
          assign: { [`0|${morning.id}`]: [person.id] },
          locked: [],
          status: "draft",
          hours: { [`0|${morning.id}#${person.id}`]: { start: 6, end: 13 } },
        },
      },
    };
    await asRole(db, "authenticated", manager);
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: draft });
    await db.exec("commit");
    const stored = await sql.query<{ profile: { city?: string } }>(
      `select profile from public.employee_profiles where employee_id = '${person.id}'`,
    );
    expect(stored[0]?.profile.city).toBe("חיפה");
    await asRole(db, "authenticated", "dddddddd-dddd-4ddd-8ddd-ddddddddddd1");
    const hidden = await sql.query(`select employee_id from public.employee_profiles`);
    expect(hidden).toEqual([]);
    await db.exec("reset role");
    const loaded = await loadSiteWeek(sql, headquarters, nextWeek);
    const inactive = loaded.emps.find((employee) => employee.id === person.id);
    expect(inactive?.active).toBe(false);
    expect(inactive?.phone).toBe("0501234567");
    expect(inactive?.profile).toMatchObject({ nationalId: "123456782", city: "חיפה", bankAccount: "123456", gender: "female" });
    expect(inactive?.grid).toEqual(person.grid);
    expect(loaded.former?.[person.id]).toBeUndefined();
    expect(loaded.sched[nextWeek]?.status).toBe("draft");
    expect(loaded.sched[nextWeek]?.assign[`0|${morning.id}`]).toEqual([person.id]);
    expect(loaded.sched[nextWeek]?.hours).toEqual({ [`0|${morning.id}#${person.id}`]: { start: 6, end: 13 } });
  });

  it("lets a manager save their site and refuses another organization", async () => {
    const db = await openTestDatabase();
    await db.exec(
      `insert into auth.users (id) values ('${manager}');
       insert into public.memberships (org_id, user_id, role) values ('${sentinel}', '${manager}', 'manager');
       insert into public.site_memberships (org_id, site_id, user_id, role)
       values ('${sentinel}', '${headquarters}', '${manager}', 'manager');
       insert into public.organizations (id, name, slug) values ('${north}', 'North Gate', 'north-gate');`,
    );
    const sql = client(db);
    const state = await loadSiteWeek(sql, headquarters, week);
    await asRole(db, "authenticated", manager);
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: { ...state, biz: { ...state.biz, name: "משמרת" } } });
    await db.exec("commit");
    await expect(
      saveSite(sql, { orgId: north, siteId: headquarters, state }),
    ).rejects.toBeInstanceOf(SaveError);
    await db.exec("reset role");
    const loaded = await loadSiteWeek(sql, headquarters, week);
    expect(loaded.biz.name).toBe("משמרת");
  });

  it("creates the first organization for the signed-in user", async () => {
    const db = await openTestDatabase();
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${founder}', 'ari@example.com', '{"name":"Ari Cohen"}')`);
    await asRole(db, "authenticated", founder);
    await expect(createFirstOrganization(client(db), { name: "צוות 3", type: "אבטחה" })).rejects.toBeInstanceOf(SaveError);
    await db.exec("reset role");
    await db.exec(`insert into public.founder_approvals (email, full_name) values ('ari@example.com', 'Ari Cohen')`);
    const allowed = await client(db).query<{ signup_allowed: boolean }>(`select public.signup_allowed('ari@example.com') as signup_allowed`);
    expect(allowed[0]?.signup_allowed).toBe(true);
    await asRole(db, "authenticated", founder);
    const workspace = await createFirstOrganization(client(db), { name: "צוות 3", type: "אבטחה" });
    expect(workspace.org.name).toBe("צוות 3");
    expect(workspace.org.type).toBe("אבטחה");
    expect(workspace.users.map((user) => user.access)).toEqual(["owner"]);
    expect(workspace.users[0]?.password).toBe("");
    expect(workspace.sites).toHaveLength(0);
    const withSite = await createFirstSite(client(db), { name: "ברן" });
    expect(withSite.sites).toHaveLength(1);
    expect(withSite.sites[0]?.state.biz.name).toBe("ברן");
    expect(withSite.sites[0]?.state.biz.minRest).toBe(8);
    expect(withSite.sites[0]?.state.biz.maxHours).toBe(72);
    expect(withSite.sites[0]?.state.biz.shifts.map((shift) => shift.name)).toEqual(["Morning", "Afternoon", "Night"]);
    expect(withSite.sites[0]?.state.biz.shifts.every((shift) => shift.req.every((count) => count === 1))).toBe(true);
    expect(withSite.sites[0]?.state.biz.shifts.map((shift) => shift.start)).toEqual(["06:00", "14:00", "22:00"]);
    await expect(saveStoredWorkspace(client(db), { ...withSite, org: { ...withSite.org, name: "צוות 4" } })).resolves.toBeUndefined();
    expect(withSite.org.hebrewCalendar).toBe(true);
    await saveStoredWorkspace(client(db), { ...withSite, org: { ...withSite.org, name: "צוות 4", hebrewCalendar: false } });
    const reloaded = await loadStoredWorkspace(client(db), withSite.sites[0]!.state.week);
    expect(reloaded?.org.hebrewCalendar).toBe(false);
  });

  it("assigns a shift manager to one site without opening a site for the business", async () => {
    const db = await openTestDatabase();
    const invited = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${founder}', 'ari@example.com', '{"name":"Ari Cohen"}');
       insert into public.founder_approvals (email, full_name) values ('ari@example.com', 'Ari Cohen');`,
    );
    await asRole(db, "authenticated", founder);
    const created = await createFirstOrganization(client(db), { name: "צוות 3", type: "אבטחה" });
    expect(created.sites).toHaveLength(0);
    const withSite = await createFirstSite(client(db), { name: "ברן" });
    const siteId = withSite.sites[0]?.id;
    if (!siteId) throw new Error("site");
    await client(db).query(`select public.invite_shift_manager($1, $2, $3, $4)`, [
      withSite.org.id,
      siteId,
      "Dana Levy",
      "dana@example.com",
    ]);
    await db.exec("reset role");
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${invited}', 'dana@example.com', '{"name":"Dana Levy"}')`,
    );
    const link = await client(db).query<{ site_id: string; role: string }>(
      `select sm.site_id, m.role
       from public.memberships m
       join public.site_memberships sm on sm.user_id = m.user_id and sm.org_id = m.org_id
       where m.user_id = '${invited}'`,
    );
    expect(link).toEqual([{ site_id: siteId, role: "manager" }]);
    await asRole(db, "authenticated", invited);
    const loaded = await loadStoredWorkspace(client(db), week);
    expect(loaded?.sites.map((site) => site.id)).toEqual([siteId]);
    expect(loaded?.org.name).toBe("צוות 3");
  });

  it("assigns every checked site, including to a manager who already has an account", async () => {
    const db = await openTestDatabase();
    const invited = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${founder}', 'ari@example.com', '{"name":"Ari Cohen"}');
       insert into public.founder_approvals (email, full_name) values ('ari@example.com', 'Ari Cohen');`,
    );
    await asRole(db, "authenticated", founder);
    await createFirstOrganization(client(db), { name: "צוות 3", type: "אבטחה" });
    const withSite = await createFirstSite(client(db), { name: "ברן" });
    const first = withSite.sites[0]?.id;
    if (!first) throw new Error("site");
    const second = await client(db).query<{ id: string }>(
      `insert into public.sites (org_id, name, min_rest_hours, max_weekly_hours) values ($1, 'דרום', 8, 72) returning id`,
      [withSite.org.id],
    );
    const south = second[0]?.id;
    if (!south) throw new Error("site");
    await db.exec("reset role");
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${invited}', 'dana@example.com', '{"name":"Dana Levy"}')`);
    await asRole(db, "authenticated", founder);
    await client(db).query(`select public.assign_shift_manager($1, $2, $3, $4::uuid[])`, [
      withSite.org.id,
      "Dana Levy",
      "dana@example.com",
      [first, south],
    ]);
    await asRole(db, "authenticated", invited);
    const loaded = await loadStoredWorkspace(client(db), week);
    expect(loaded?.sites.map((site) => site.id).sort()).toEqual([first, south].sort());
  });

  it("opens an existing business for a platform admin who is not a member", async () => {
    const db = await openTestDatabase();
    const admin = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${admin}', 'admin@example.com', '{"name":"Admin"}');
       insert into public.platform_admin_emails (email) values ('admin@example.com');`,
    );
    await asRole(db, "authenticated", admin);
    await db.query(`select set_config('app.support_org', $1, false)`, [sentinel]);
    const loaded = await loadStoredWorkspace(client(db), week);
    expect(loaded?.org.id).toBe(sentinel);
    expect(loaded?.users.some((user) => user.id === admin && user.access === "owner")).toBe(true);
    expect(loaded?.sites.map((site) => site.id)).toContain(headquarters);
  });

  it("writes a quota without rewriting the week", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const original = await loadSiteWeek(sql, headquarters, week);
    const person = original.emps[0];
    if (!person) throw new Error("seed");
    const changed: RotaState = {
      ...original,
      emps: original.emps.map((employee) => (employee.id === person.id ? { ...employee, perWeek: person.perWeek + 1 } : employee)),
    };
    await db.exec("begin");
    await saveSite(sql, {
      orgId: sentinel,
      siteId: headquarters,
      state: changed,
      scope: { biz: false, people: true, availability: false, notes: false, weeks: [], removedWeeks: [] },
    });
    await db.exec("commit");
    const loaded = await loadSiteWeek(sql, headquarters, week);
    expect(loaded.emps.find((employee) => employee.id === person.id)?.perWeek).toBe(person.perWeek + 1);
    expect(loaded.sched).toEqual(original.sched);
    expect(loaded.biz).toEqual(original.biz);
  });
});
