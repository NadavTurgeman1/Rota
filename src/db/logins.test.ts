import { describe, expect, it } from "vitest";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import { removeShiftManager, removeStaffLogin, setShiftManagerSites } from "./workspace-store";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const harbor = "33333333-3333-4333-8333-333333333333";
const owner = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const worker = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("managing logins", () => {
  it("edits and removes a shift manager, and removes an employee login but keeps the person", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    await db.exec(`insert into public.sites (id, org_id, name) values ('${harbor}', '${sentinel}', 'Harbor')`);
    const staff = (await sql.query<{ id: string }>(`select id from public.employees where org_id = $1 order by name limit 1`, [sentinel]))[0];
    if (!staff) throw new Error("seed");
    await db.exec(
      `insert into auth.users (id, email) values
         ('${owner}', 'owner@example.com'),
         ('${manager}', 'manager@example.com'),
         ('${worker}', 'worker@example.com');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${owner}', 'owner'),
         ('${sentinel}', '${manager}', 'manager'),
         ('${sentinel}', '${worker}', 'employee');
       insert into public.site_memberships (org_id, site_id, user_id, role) values
         ('${sentinel}', '${headquarters}', '${manager}', 'manager'),
         ('${sentinel}', '${headquarters}', '${worker}', 'employee');
       update public.employees set user_id = '${worker}' where id = '${staff.id}';`,
    );

    await asRole(db, "authenticated", manager);
    await expect(setShiftManagerSites(sql, { orgId: sentinel, email: "manager@example.com", siteIds: [harbor] })).rejects.toBeInstanceOf(SaveError);
    await expect(removeShiftManager(sql, { orgId: sentinel, email: "manager@example.com" })).rejects.toBeInstanceOf(SaveError);

    await asRole(db, "authenticated", owner);
    await setShiftManagerSites(sql, { orgId: sentinel, email: "Manager@example.com", siteIds: [harbor] });
    await db.exec("reset role");
    const moved = await sql.query<{ site_id: string }>(`select site_id from public.site_memberships where user_id = $1`, [manager]);
    expect(moved.map((row) => row.site_id)).toEqual([harbor]);

    await asRole(db, "authenticated", manager);
    await removeStaffLogin(sql, { orgId: sentinel, employeeId: staff.id });
    await db.exec("reset role");
    const person = await sql.query<{ user_id: string | null }>(`select user_id from public.employees where id = $1`, [staff.id]);
    expect(person).toEqual([{ user_id: null }]);
    expect(await sql.query(`select 1 from auth.users where id = $1`, [worker])).toEqual([]);

    await asRole(db, "authenticated", owner);
    await removeShiftManager(sql, { orgId: sentinel, email: "manager@example.com" });
    await db.exec("reset role");
    expect(await sql.query(`select 1 from public.memberships where user_id = $1`, [manager])).toEqual([]);
    expect(await sql.query(`select 1 from auth.users where id = $1`, [manager])).toEqual([]);
    expect(await sql.query(`select 1 from auth.users where id = $1`, [owner])).toHaveLength(1);
  });
});
