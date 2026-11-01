import type { SqlClient } from "../db/types";
import { decideDeletion, type AccountOrg, type DeleteDecision, type DeleteRequest } from "../account/delete";

interface OrgRow {
  id: string;
  name: string;
  owner: boolean;
  other_owners: number;
}

/** Deletes the signed-in user's login, and one business they own when they asked for that. */
export async function deleteSignedInAccount(sql: SqlClient, userId: string, request: DeleteRequest): Promise<DeleteDecision> {
  const rows = await sql.query<OrgRow>(
    `select o.id, o.name,
       (m.role = 'owner') as owner,
       (select count(*)::int from public.memberships other
         where other.org_id = o.id and other.role = 'owner' and other.user_id <> $1) as other_owners
     from public.memberships m
     join public.organizations o on o.id = m.org_id
     where m.user_id = $1`,
    [userId],
  );
  const orgs: AccountOrg[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    owner: row.owner === true,
    otherOwners: Number(row.other_owners),
  }));
  const decision = decideDeletion(orgs, request);
  if (!decision.ok) return decision;
  if (decision.deleteOrgId) {
    await sql.query(`update public.employees set reports_to = null, opened_by = null where org_id = $1`, [decision.deleteOrgId]);
    await sql.query(`delete from public.assignments where org_id = $1`, [decision.deleteOrgId]);
    await sql.query(`delete from public.schedule_calloffs where org_id = $1`, [decision.deleteOrgId]);
    await sql.query(`delete from public.organizations where id = $1`, [decision.deleteOrgId]);
  }
  if (decision.deleteLogin) await sql.query(`delete from auth.users where id = $1`, [userId]);
  return decision;
}
