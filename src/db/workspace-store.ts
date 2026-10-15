import { NEW_SITE_MAX_HOURS, NEW_SITE_MIN_REST, type Workspace, type WorkspaceUser } from "../workspace/workspace";
import { listMemberships, resolveActiveOrg, type OrgRole } from "../auth/session";
import { orgSlug } from "./slug";
import { deleteOrphanEmployees, SaveError, saveSite } from "./save";
import { loadSiteWeek } from "./load";
import type { SqlClient } from "./types";

const accessFor: Record<OrgRole, WorkspaceUser["access"]> = {
  owner: "owner",
  manager: "write",
  employee: "read",
};

/** The signed-in user's organization, or null when they have not created one. */
export async function loadStoredWorkspace(sql: SqlClient, week: string): Promise<Workspace | null> {
  const memberships = await listMemberships(sql);
  const active = resolveActiveOrg(memberships, null);
  if (!active) return null;
  const orgs = await sql.query<{ id: string; name: string; kind: string }>(
    `select id, name, kind from public.organizations where id = $1`,
    [active.orgId],
  );
  const org = orgs[0];
  if (!org) return null;
  const sites = await sql.query<{ id: string }>(
    `select id from public.sites where org_id = $1 order by created_at, name`,
    [org.id],
  );
  const loaded = [];
  for (const site of sites) loaded.push({ id: site.id, state: await loadSiteWeek(sql, site.id, week) });
  const users = await loadMembers(sql, org.id);
  return {
    org: { id: org.id, name: org.name, type: org.kind },
    sites: loaded,
    activeSiteId: loaded[0]?.id ?? "",
    users,
  };
}

/** Owners can rename the business. Managers can write sites. Employees cannot. */
export async function saveStoredWorkspace(sql: SqlClient, workspace: Workspace): Promise<void> {
  const memberships = await listMemberships(sql);
  const active = memberships.find((membership) => membership.orgId === workspace.org.id);
  if (!active || active.role === "employee") throw new SaveError("forbidden");
  if (workspace.sites.length === 0) throw new SaveError("sites");
  if (active.role === "owner") {
    const name = workspace.org.name.trim();
    if (!name) throw new SaveError("organization");
    await sql.query(`update public.organizations set name = $1, kind = $2 where id = $3`, [
      name,
      workspace.org.type.trim(),
      workspace.org.id,
    ]);
  }
  for (const site of workspace.sites) {
    await saveSite(sql, { orgId: workspace.org.id, siteId: site.id, state: site.state });
  }
  await sql.query(`delete from public.sites where org_id = $1 and not (id = any($2::uuid[]))`, [
    workspace.org.id,
    workspace.sites.map((site) => site.id),
  ]);
  await deleteOrphanEmployees(sql, workspace.org.id);
}

/** First business for a signed-in user. The first site is created on the next screen. */
export async function createFirstOrganization(sql: SqlClient, input: { name: string; type: string }): Promise<Workspace> {
  const name = input.name.trim();
  if (!name) throw new SaveError("organization");
  const created = await sql.query<{ id: string }>(`select public.create_organization($1, $2, $3) as id`, [
    name,
    orgSlug(name, crypto.randomUUID()),
    input.type.trim(),
  ]);
  const orgId = created[0]?.id;
  if (!orgId) throw new SaveError("organization");
  const week = await currentWeek(sql);
  const workspace = await loadStoredWorkspace(sql, week);
  if (!workspace) throw new SaveError("organization");
  return workspace;
}

/** First site: three named shifts, a 72-hour weekly cap, and 8 hours of rest between shifts. */
export async function createFirstSite(sql: SqlClient, input: { name: string }): Promise<Workspace> {
  const name = input.name.trim();
  if (!name) throw new SaveError("site name");
  const active = resolveActiveOrg(await listMemberships(sql), null);
  if (!active) throw new SaveError("organization");
  if (active.role !== "owner") throw new SaveError("forbidden");
  const existing = await sql.query<{ id: string }>(`select id from public.sites where org_id = $1 limit 1`, [active.orgId]);
  if (existing.length === 0) {
    const sites = await sql.query<{ id: string }>(
      `insert into public.sites (org_id, name, min_rest_hours, max_weekly_hours)
       values ($1, $2, $3, $4)
       returning id`,
      [active.orgId, name, NEW_SITE_MIN_REST, NEW_SITE_MAX_HOURS],
    );
    const siteId = sites[0]?.id;
    if (!siteId) throw new SaveError("site");
    await insertOpeningShifts(sql, active.orgId, siteId);
  }
  const workspace = await loadStoredWorkspace(sql, await currentWeek(sql));
  if (!workspace?.sites.length) throw new SaveError("site");
  return workspace;
}

async function insertOpeningShifts(sql: SqlClient, orgId: string, siteId: string): Promise<void> {
  const shifts = [
    ["Morning", "06:00", "14:00"],
    ["Afternoon", "14:00", "22:00"],
    ["Night", "22:00", "06:00"],
  ] as const;
  for (const [index, shift] of shifts.entries()) {
    const inserted = await sql.query<{ id: string }>(
      `insert into public.shifts (org_id, site_id, name, starts_at, ends_at, position)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [orgId, siteId, shift[0], shift[1], shift[2], index],
    );
    const shiftId = inserted[0]?.id;
    if (!shiftId) throw new SaveError("shift");
    for (let weekday = 0; weekday < 7; weekday += 1) {
      await sql.query(
        `insert into public.shift_requirements (org_id, shift_id, weekday, required_count)
         values ($1, $2, $3, 1)`,
        [orgId, shiftId, weekday],
      );
    }
  }
}

async function currentWeek(sql: SqlClient): Promise<string> {
  const rows = await sql.query<{ week: string }>(
    `select to_char(date_trunc('week', (now() at time zone 'Asia/Jerusalem') + interval '1 day') - interval '1 day', 'YYYY-MM-DD') as week`,
  );
  return rows[0]?.week ?? "2026-10-11";
}

async function loadMembers(sql: SqlClient, orgId: string): Promise<WorkspaceUser[]> {
  const rows = await sql.query<{ user_id: string; role: OrgRole; email: string; name: string }>(
    `select m.user_id, m.role, coalesce(p.email, '') as email,
            coalesce(nullif(btrim(p.name), ''), '') as name
     from public.memberships m
     left join public.profiles p on p.user_id = m.user_id
     where m.org_id = $1
     order by m.created_at, m.user_id`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.user_id,
    name: row.name || row.email.split("@")[0] || "Rota",
    email: row.email,
    password: "",
    access: accessFor[row.role],
  }));
}
