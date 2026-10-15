import type { SqlClient } from "../db/types";

export type OrgRole = "owner" | "manager" | "employee";

export interface Membership {
  orgId: string;
  orgName: string;
  role: OrgRole;
}

/** Matches supabase-js `auth.signInWithPassword` without taking a dependency yet. */
export interface PasswordAuth {
  signInWithPassword(credentials: { email: string; password: string }): Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
}

const roleRank: Record<OrgRole, number> = { owner: 0, manager: 1, employee: 2 };

/**
 * Pick the org for this session.
 * A requested org wins when the user belongs to it. Otherwise prefer owner, then manager.
 */
export function resolveActiveOrg(memberships: Membership[], requestedOrgId: string | null): Membership | null {
  if (memberships.length === 0) return null;
  const requested = memberships.find((membership) => membership.orgId === requestedOrgId);
  if (requested) return requested;
  return [...memberships].sort(
    (a, b) => roleRank[a.role] - roleRank[b.role] || a.orgName.localeCompare(b.orgName),
  )[0];
}

/** Memberships for the signed-in user. Role comes from the membership row, not from the JWT. */
export async function listMemberships(sql: SqlClient): Promise<Membership[]> {
  const rows = await sql.query<{ org_id: string; org_name: string; role: OrgRole }>(
    `select m.org_id, o.name as org_name, m.role
     from public.memberships m
     join public.organizations o on o.id = m.org_id
     where m.user_id = (select auth.uid())
     order by o.name`,
  );
  return rows.map((row) => ({ orgId: row.org_id, orgName: row.org_name, role: row.role }));
}

export async function signIn(auth: PasswordAuth, email: string, password: string): Promise<string> {
  const trimmed = email.trim();
  if (!trimmed || password.length === 0) {
    throw new Error("Email and password are required");
  }
  const result = await auth.signInWithPassword({ email: trimmed, password });
  if (result.error || !result.data.user) {
    throw new Error(result.error?.message ?? "Sign-in failed");
  }
  return result.data.user.id;
}
