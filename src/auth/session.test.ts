import { describe, expect, it, vi } from "vitest";
import { resolveActiveOrg, signIn, type Membership, type PasswordAuth } from "./session";

const sentinel: Membership = { orgId: "sentinel", orgName: "Sentinel Security", role: "owner" };
const north: Membership = { orgId: "north", orgName: "North Gate", role: "employee" };
const other: Membership = { orgId: "other", orgName: "Alpha Guards", role: "manager" };

describe("session", () => {
  it("uses the requested organization when the user belongs to it", () => {
    expect(resolveActiveOrg([sentinel, north], "north")).toEqual(north);
  });

  it("falls back to the highest role when nothing was requested", () => {
    expect(resolveActiveOrg([north, other, sentinel], null)).toEqual(sentinel);
  });

  it("breaks role ties by organization name", () => {
    const beta: Membership = { orgId: "beta", orgName: "Beta", role: "manager" };
    expect(resolveActiveOrg([beta, other], "missing")).toEqual(other);
  });

  it("returns null when the user has no organizations", () => {
    expect(resolveActiveOrg([], null)).toBeNull();
  });

  it("signs in with the trimmed email and returns the auth user id", async () => {
    const auth: PasswordAuth = {
      signInWithPassword: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
    };
    await expect(signIn(auth, "  ada@example.com  ", "secret")).resolves.toBe("user-1");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "secret" });
  });

  it("rejects a blank password before calling auth", async () => {
    const auth: PasswordAuth = { signInWithPassword: vi.fn() };
    await expect(signIn(auth, "ada@example.com", "")).rejects.toThrow(/required/i);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("surfaces a failed sign-in", async () => {
    const auth: PasswordAuth = {
      signInWithPassword: async () => ({ data: { user: null }, error: { message: "Invalid login credentials" } }),
    };
    await expect(signIn(auth, "ada@example.com", "nope")).rejects.toThrow(/invalid login/i);
  });
});
