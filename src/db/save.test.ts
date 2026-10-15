import { describe, expect, it } from "vitest";
import { loadSiteWeek } from "./load";
import { orgSlug } from "./slug";
import { createFirstOrganization, createFirstSite, saveStoredWorkspace } from "./workspace-store";
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
      biz: { ...original.biz, name: "ברן", maxHours: 0, maxShift: 0, maxDayHours: 0 },
      emps: original.emps.filter((employee) => employee.id !== yossi.id),
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
    expect(loaded.biz.maxHours).toBe(0);
    expect(loaded.biz.maxShift).toBe(0);
    expect(loaded.biz.maxDayHours).toBeUndefined();
    expect(loaded.emps.map((employee) => employee.id)).not.toContain(yossi.id);
    expect(loaded.former).toEqual({ [yossi.id]: "Yossi" });
    expect(loaded.sched[week]?.assign[`0|${morning.id}`]).toEqual([yossi.id]);
    expect(loaded.sched[week]?.restoredFrom).toBe(2);
    expect(loaded.versions?.[week]?.[0]?.by).toBe("Ari");
  });

  it("lets a manager save their site and refuses another organization", async () => {
    const db = await openTestDatabase();
    await db.exec(
      `insert into auth.users (id) values ('${manager}');
       insert into public.memberships (org_id, user_id, role) values ('${sentinel}', '${manager}', 'manager');
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
  });
});
