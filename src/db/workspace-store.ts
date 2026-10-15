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
    active.role === "owner"
      ? `select id from public.sites where org_id = $1 order by created_at, name`
      : `select s.id
         from public.sites s
         join public.site_memberships m on m.site_id = s.id and m.user_id = (select auth.uid())
         where s.org_id = $1
         order by s.created_at, s.name`,
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
  if (active.role !== "owner") {
    const allowed = await sql.query<{ site_id: string }>(
      `select site_id from public.site_memberships where org_id = $1 and user_id = (select auth.uid())`,
      [workspace.org.id],
    );
    const allowedIds = new Set(allowed.map((row) => row.site_id));
    if (workspace.sites.some((site) => !allowedIds.has(site.id))) throw new SaveError("forbidden");
  }
  for (const site of workspace.sites) {
    await saveSite(sql, { orgId: workspace.org.id, siteId: site.id, state: site.state });
  }
  if (active.role === "owner") {
    await sql.query(`delete from public.sites where org_id = $1 and not (id = any($2::uuid[]))`, [
      workspace.org.id,
      workspace.sites.map((site) => site.id),
    ]);
  }
  await deleteOrphanEmployees(sql, workspace.org.id);
}

/** First business for a signed-in user. The first site is created on the next screen. */
export async function createFirstOrganization(sql: SqlClient, input: { name: string; type: string }): Promise<Workspace> {
  const name = input.name.trim();
  if (!name) throw new SaveError("organization");
  let created: { id: string }[];
  try {
    created = await sql.query<{ id: string }>(`select public.create_organization($1, $2, $3) as id`, [
      name,
      orgSlug(name, crypto.randomUUID()),
      input.type.trim(),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not approved|not authenticated|42501|28000/i.test(message)) throw new SaveError("forbidden");
    throw error;
  }
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
  const rows = await sql.query<{ user_id: string; role: OrgRole; email: string; name: string; site_id: string | null }>(
    `select m.user_id, m.role, coalesce(p.email, '') as email,
            coalesce(nullif(btrim(p.name), ''), '') as name,
            su.site_id
     from public.memberships m
     left join public.profiles p on p.user_id = m.user_id
     left join public.site_memberships su on su.org_id = m.org_id and su.user_id = m.user_id
     where m.org_id = $1
     order by m.created_at, m.user_id, su.site_id`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.user_id,
    name: row.name || row.email.split("@")[0] || "Rota",
    email: row.email,
    password: "",
    access: accessFor[row.role],
    siteId: row.site_id,
  }));
}

export async function platformAdmin(sql: SqlClient): Promise<boolean> {
  const rows = await sql.query<{ admin: boolean }>(`select private.is_platform_admin() as admin`);
  return rows[0]?.admin === true;
}

export async function canCreateBusiness(sql: SqlClient): Promise<boolean> {
  const rows = await sql.query<{ allowed: boolean }>(`select private.can_create_business() as allowed`);
  return rows[0]?.allowed === true;
}

export async function openApprovalName(sql: SqlClient): Promise<string | null> {
  const rows = await sql.query<{ full_name: string }>(
    `select full_name from public.founder_approvals
     where email = (select private.actor_email()) and consumed_at is null
     order by created_at
     limit 1`,
  );
  return rows[0]?.full_name ?? null;
}

export async function listFounderApprovals(sql: SqlClient): Promise<{ id: string; email: string; fullName: string; consumed: boolean }[]> {
  if (!(await platformAdmin(sql))) throw new SaveError("forbidden");
  const rows = await sql.query<{ id: string; email: string; full_name: string; consumed_at: string | null }>(
    `select id, email, full_name, consumed_at from public.founder_approvals order by created_at desc`,
  );
  return rows.map((row) => ({ id: row.id, email: row.email, fullName: row.full_name, consumed: row.consumed_at != null }));
}

export async function suspendedTenantName(sql: SqlClient): Promise<string | null> {
  const rows = await sql.query<{ name: string | null }>(`select private.suspended_tenant_name() as name`);
  return rows[0]?.name ?? null;
}

export interface TenantRecord {
  id: string;
  name: string;
  kind: string;
  status: "active" | "suspended";
  adminEmail: string;
  adminName: string;
  adminJoined: boolean;
}

export async function listTenants(sql: SqlClient): Promise<TenantRecord[]> {
  if (!(await platformAdmin(sql))) throw new SaveError("forbidden");
  const rows = await sql.query<{
    id: string;
    name: string;
    kind: string;
    status: string;
    admin_email: string | null;
    admin_name: string | null;
    admin_joined: boolean | null;
  }>(`select id, name, kind, status, admin_email, admin_name, admin_joined from public.list_tenants()`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status === "suspended" ? "suspended" : "active",
    adminEmail: row.admin_email ?? "",
    adminName: row.admin_name ?? "",
    adminJoined: row.admin_joined === true,
  }));
}

export async function provisionCompany(
  sql: SqlClient,
  input: { name: string; type: string; fullName: string; email: string },
): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new SaveError("organization");
  try {
    await sql.query(`select public.provision_company($1, $2, $3, $4, $5)`, [
      name,
      orgSlug(name, crypto.randomUUID()),
      input.type.trim(),
      input.fullName,
      input.email,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|42501/i.test(message)) throw new SaveError("forbidden");
    if (/invalid|23514|duplicate|unique/i.test(message)) throw new SaveError("approval");
    throw error;
  }
}

export async function setTenantStatus(sql: SqlClient, input: { id: string; status: "active" | "suspended" }): Promise<void> {
  try {
    await sql.query(`select public.set_tenant_status($1, $2)`, [input.id, input.status]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|42501/i.test(message)) throw new SaveError("forbidden");
    if (/invalid|23514/i.test(message)) throw new SaveError("approval");
    throw error;
  }
}

export async function approveSignupEmail(sql: SqlClient, email: string): Promise<void> {
  try {
    await sql.query(`select public.approve_signup_email($1)`, [email]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|42501/i.test(message)) throw new SaveError("forbidden");
    if (/invalid|23514|duplicate|unique/i.test(message)) throw new SaveError("approval");
    throw error;
  }
}

export async function approveFounder(sql: SqlClient, input: { fullName: string; email: string }): Promise<void> {
  try {
    await sql.query(`select public.approve_founder($1, $2)`, [input.fullName, input.email]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|42501/i.test(message)) throw new SaveError("forbidden");
    if (/invalid|23514|duplicate|unique/i.test(message)) throw new SaveError("approval");
    throw error;
  }
}

export async function inviteShiftManager(sql: SqlClient, input: { orgId: string; siteId: string; fullName: string; email: string }): Promise<void> {
  try {
    await sql.query(`select public.invite_shift_manager($1, $2, $3, $4)`, [input.orgId, input.siteId, input.fullName, input.email]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not allowed|42501/i.test(message)) throw new SaveError("forbidden");
    if (/invalid|23514|duplicate|unique/i.test(message)) throw new SaveError("invitation");
    throw error;
  }
}
