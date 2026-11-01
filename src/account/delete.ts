export interface AccountOrg {
  id: string;
  name: string;
  owner: boolean;
  otherOwners: number;
}

export interface DeleteRequest {
  scope: "login" | "business";
  orgId: string;
  confirmedName: string;
}

export type DeleteDecision =
  | { ok: true; deleteOrgId: string | null; deleteLogin: boolean }
  | { ok: false; reason: "sole_owner" | "name" | "not_owner" };

/** What a signed-in person may delete. The business name must match exactly, after trimming. */
export function decideDeletion(orgs: readonly AccountOrg[], request: DeleteRequest): DeleteDecision {
  if (request.scope === "login") {
    if (orgs.some((org) => org.owner && org.otherOwners === 0)) return { ok: false, reason: "sole_owner" };
    return { ok: true, deleteOrgId: null, deleteLogin: true };
  }
  const org = orgs.find((item) => item.id === request.orgId);
  if (!org?.owner) return { ok: false, reason: "not_owner" };
  if (org.name.trim() !== request.confirmedName.trim() || request.confirmedName.trim() === "") return { ok: false, reason: "name" };
  const stillMember = orgs.some((item) => item.id !== org.id);
  return { ok: true, deleteOrgId: org.id, deleteLogin: !stillMember };
}
