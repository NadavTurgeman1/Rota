import { describe, expect, it } from "vitest";
import { acknowledgeAvailabilityRequest, decideAvailabilityRequest, submitAvailabilityRequest } from "./availability";
import { SaveError, saveSite } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import { inviteStaffLogin, loadStoredWorkspace, saveStoredWorkspace } from "./workspace-store";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const owner = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const worker = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const existing = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const draftWeek = "2026-11-08";
const constraintWeek = "2026-11-01";

describe("a roster employee login", () => {
  it("links the login to that person, keeps drafts hidden, and shows a published week", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const people = await sql.query<{ id: string; name: string }>(
      `select e.id, e.name
       from public.employees e
       join public.employee_sites es on es.employee_id = e.id
       where es.site_id = $1
       order by e.name
       limit 3`,
      [headquarters],
    );
    const staff = people[0];
    const coworker = people[1];
    const third = people[2];
    if (!staff || !coworker || !third) throw new Error("seed");
    await db.exec(
      `insert into auth.users (id, email) values
         ('${owner}', 'owner.portal@example.com'),
         ('${manager}', 'manager.portal@example.com');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${owner}', 'owner'),
         ('${sentinel}', '${manager}', 'manager');
       insert into public.site_memberships (org_id, site_id, user_id, role)
       values ('${sentinel}', '${headquarters}', '${manager}', 'manager');`,
    );

    await asRole(db, "authenticated", manager);
    expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: staff.id, email: "worker.portal@example.com" })).toBe("invited");

    await asRole(db, "authenticated", owner);
    expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: staff.id, email: "worker.portal@example.com" })).toBe("invited");
    const invited = await loadStoredWorkspace(sql, constraintWeek);
    expect(invited?.users.some((user) => user.email === "worker.portal@example.com" && user.pending)).toBe(true);

    await db.exec("reset role");
    await db.exec(`insert into auth.users (id, email) values ('${worker}', 'worker.portal@example.com')`);
    const linked = await sql.query<{ user_id: string | null }>(`select user_id from public.employees where id = $1`, [staff.id]);
    expect(linked[0]?.user_id).toBe(worker);
    const role = await sql.query<{ role: string }>(`select role from public.memberships where user_id = $1`, [worker]);
    expect(role[0]?.role).toBe("employee");

    await db.exec("reset role");
    await sql.query(`update public.sites set staff_access = false where id = $1`, [headquarters]);
    await asRole(db, "authenticated", worker);
    const morning = (await loadStoredWorkspace(sql, constraintWeek))?.sites[0]?.state.biz.shifts[0];
    if (!morning) throw new Error("shifts");
    const grid = [[morning.id], [], [], [], [], [], []];
    await expect(submitAvailabilityRequest(sql, { siteId: headquarters, week: constraintWeek, shifts: grid })).rejects.toBeInstanceOf(SaveError);
    await db.exec("reset role");
    await sql.query(
      `update public.sites
       set staff_access = true,
           constraint_opens_day = extract(dow from ((now() at time zone timezone) + interval '2 days'))::int,
           constraint_closes_day = extract(dow from ((now() at time zone timezone) + interval '2 days'))::int,
           constraint_opens = '03:00',
           constraint_closes = '04:00'
       where id = $1`,
      [headquarters],
    );
    await asRole(db, "authenticated", worker);
    await expect(submitAvailabilityRequest(sql, { siteId: headquarters, week: constraintWeek, shifts: grid })).rejects.toBeInstanceOf(SaveError);
    await db.exec("reset role");
    await sql.query(
      `update public.sites
       set constraint_opens_day = 0, constraint_closes_day = 6, constraint_opens = '00:00', constraint_closes = '23:59'
       where id = $1`,
      [headquarters],
    );

    await db.exec("reset role");
    await sql.query(`update public.sites set constraint_block_limit = true, constraint_max_blocks = 0 where id = $1`, [headquarters]);
    await asRole(db, "authenticated", worker);
    await expect(
      submitAvailabilityRequest(sql, { siteId: headquarters, week: constraintWeek, shifts: [[], [], [], [], [], [], []] }),
    ).rejects.toBeInstanceOf(SaveError);
    await db.exec("reset role");
    await sql.query(`update public.sites set constraint_block_limit = false where id = $1`, [headquarters]);

    await asRole(db, "authenticated", worker);
    const submitted = await submitAvailabilityRequest(sql, { siteId: headquarters, week: constraintWeek, shifts: grid });
    expect(submitted.employeeId).toBe(staff.id);

    await asRole(db, "authenticated", owner);
    const waiting = await loadStoredWorkspace(sql, constraintWeek);
    expect(waiting?.sites[0]?.state.avail[constraintWeek]?.[staff.id]).toBeUndefined();
    expect(waiting?.sites[0]?.requests?.some((request) => request.id === submitted.id)).toBe(true);
    const person = waiting?.sites[0]?.state.emps.find((employee) => employee.id === staff.id);
    expect(person?.loginEmail).toBe("worker.portal@example.com");
    expect(person?.loginConfirmed).toBe(true);
    await decideAvailabilityRequest(sql, { requestId: submitted.id, approve: true });
    const seen = await loadStoredWorkspace(sql, constraintWeek);
    expect(seen?.sites[0]?.state.avail[constraintWeek]?.[staff.id]?.[0]).toEqual([morning.id]);
    expect(seen?.sites[0]?.requests ?? []).toEqual([]);
    await asRole(db, "authenticated", worker);
    await expect(submitAvailabilityRequest(sql, { siteId: headquarters, week: constraintWeek, shifts: grid })).rejects.toThrow("same");
    await asRole(db, "authenticated", owner);
    expect(seen?.decisions ?? []).toEqual([]);
    expect(seen?.users.some((user) => user.email === "worker.portal@example.com" && user.pending)).toBe(false);
    const withDraft = seen?.sites[0]?.state;
    if (!seen || !withDraft) throw new Error("owner load");
    withDraft.sched = {
      ...withDraft.sched,
      [draftWeek]: { assign: { [`0|${morning.id}`]: [staff.id, coworker.id] }, locked: [], status: "draft" },
    };
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: withDraft });
    await db.exec("commit");

    await asRole(db, "authenticated", worker);
    const hidden = await loadStoredWorkspace(sql, draftWeek);
    expect(hidden?.selfEmployeeId).toBe(staff.id);
    expect(hidden?.sites[0]?.state.sched[draftWeek]).toBeUndefined();
    expect(hidden?.sites[0]?.state.avail[constraintWeek]?.[staff.id]?.[0]).toEqual([morning.id]);
    await expect(saveStoredWorkspace(sql, hidden!)).rejects.toBeInstanceOf(SaveError);

    await asRole(db, "authenticated", owner);
    const publishing = await loadStoredWorkspace(sql, draftWeek);
    const publishedState = publishing?.sites[0]?.state;
    if (!publishedState) throw new Error("publish load");
    publishedState.sched = {
      ...publishedState.sched,
      [draftWeek]: { assign: { [`0|${morning.id}`]: [staff.id, coworker.id] }, locked: [], status: "published" },
    };
    await db.exec("begin");
    await saveSite(sql, { orgId: sentinel, siteId: headquarters, state: publishedState });
    await db.exec("commit");
    const stillLinked = await sql.query<{ user_id: string | null }>(`select user_id from public.employees where id = $1`, [staff.id]);
    expect(stillLinked[0]?.user_id).toBe(worker);

    await asRole(db, "authenticated", worker);
    const open = await loadStoredWorkspace(sql, draftWeek);
    expect(open?.sites[0]?.state.sched[draftWeek]?.status).toBe("published");
    expect(open?.sites[0]?.state.sched[draftWeek]?.assign[`0|${morning.id}`]?.slice().sort()).toEqual([coworker.id, staff.id].sort());
    expect(open?.sites[0]?.state.emps.map((employee) => employee.id)).toEqual(expect.arrayContaining([staff.id, coworker.id]));
    expect(open?.decisions).toEqual([
      {
        id: submitted.id,
        siteId: headquarters,
        siteName: open?.sites[0]?.state.biz.name,
        week: constraintWeek,
        outcome: "approved",
      },
    ]);

    await asRole(db, "authenticated", owner);
    await expect(acknowledgeAvailabilityRequest(sql, submitted.id)).rejects.toBeInstanceOf(SaveError);
    const rejectedWeek = "2026-11-15";
    await asRole(db, "authenticated", worker);
    const denied = await submitAvailabilityRequest(sql, { siteId: headquarters, week: rejectedWeek, shifts: grid });
    await asRole(db, "authenticated", owner);
    await decideAvailabilityRequest(sql, { requestId: denied.id, approve: false });
    await asRole(db, "authenticated", worker);
    const answered = await loadStoredWorkspace(sql, draftWeek);
    expect(answered?.decisions?.map((item) => [item.id, item.outcome])).toEqual([
      [submitted.id, "approved"],
      [denied.id, "rejected"],
    ]);
    expect(answered?.sites[0]?.state.avail[rejectedWeek]?.[staff.id]).toBeUndefined();
    await acknowledgeAvailabilityRequest(sql, submitted.id);
    await acknowledgeAvailabilityRequest(sql, denied.id);
    await acknowledgeAvailabilityRequest(sql, submitted.id);
    expect((await loadStoredWorkspace(sql, draftWeek))?.decisions ?? []).toEqual([]);

    await db.exec("reset role");
    await db.exec(`insert into auth.users (id, email) values ('${existing}', 'existing.portal@example.com')`);
    await asRole(db, "authenticated", owner);
    expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: third.id, email: "existing.portal@example.com" })).toBe("linked");
    const thirdRow = await sql.query<{ user_id: string | null }>(`select user_id from public.employees where id = $1`, [third.id]);
    expect(thirdRow[0]?.user_id).toBe(existing);
  });

  it("shows member names to a platform admin who is not a member of the business", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.exec(
      `insert into auth.users (id, email) values
         ('${admin}', 'platform.admin@example.com'),
         ('${owner}', 'owner.portal@example.com');
       insert into public.platform_admin_emails (email) values ('platform.admin@example.com');
       insert into public.memberships (org_id, user_id, role) values ('${sentinel}', '${owner}', 'owner');
       update public.profiles set name = 'Owner Person' where user_id = '${owner}';`,
    );
    await asRole(db, "authenticated", admin);
    const hidden = await db.query<{ name: string }>(`select name from public.profiles where user_id = '${owner}'`);
    expect(hidden.rows).toEqual([]);
    await db.query(`select set_config('app.support_org', '${sentinel}', false)`);
    const visible = await db.query<{ name: string; email: string }>(
      `select name, email from public.profiles where user_id = '${owner}'`,
    );
    expect(visible.rows).toEqual([{ name: "Owner Person", email: "owner.portal@example.com" }]);
    const workspace = await loadStoredWorkspace(sql, constraintWeek);
    const ownerRow = workspace?.users.find((user) => user.email === "owner.portal@example.com");
    expect(ownerRow?.name).toBe("Owner Person");
    expect(workspace?.users.some((user) => user.email === "platform.admin@example.com")).toBe(true);
  });
});
