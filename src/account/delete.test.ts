import { describe, expect, it } from "vitest";
import { decideDeletion, type AccountOrg } from "./delete";

const owned: AccountOrg = { id: "org-1", name: "צוות 4", owner: true, otherOwners: 0 };
const shared: AccountOrg = { id: "org-1", name: "צוות 4", owner: true, otherOwners: 1 };
const staff: AccountOrg = { id: "org-1", name: "צוות 4", owner: false, otherOwners: 1 };

describe("decideDeletion", () => {
  it("lets staff delete only their login", () => {
    expect(decideDeletion([staff], { scope: "login", orgId: "", confirmedName: "" })).toEqual({
      ok: true,
      deleteOrgId: null,
      deleteLogin: true,
    });
    expect(decideDeletion([staff], { scope: "business", orgId: "org-1", confirmedName: "צוות 4" }).ok).toBe(false);
  });

  it("refuses to leave a business with no owner", () => {
    expect(decideDeletion([owned], { scope: "login", orgId: "org-1", confirmedName: "" })).toEqual({
      ok: false,
      reason: "sole_owner",
    });
  });

  it("deletes one business when the typed name matches, and the login when no other business remains", () => {
    expect(decideDeletion([owned], { scope: "business", orgId: "org-1", confirmedName: " צוות 4 " })).toEqual({
      ok: true,
      deleteOrgId: "org-1",
      deleteLogin: true,
    });
    const other: AccountOrg = { id: "org-2", name: "שני", owner: false, otherOwners: 1 };
    expect(decideDeletion([shared, other], { scope: "business", orgId: "org-1", confirmedName: "צוות 4" })).toMatchObject({
      deleteLogin: false,
    });
  });

  it("refuses a business delete when the name does not match", () => {
    expect(decideDeletion([owned], { scope: "business", orgId: "org-1", confirmedName: "אחר" })).toEqual({
      ok: false,
      reason: "name",
    });
  });
});
