import { describe, expect, it } from "vitest";
import { HARBOR, SENTINEL, sentinelWorkspace } from "../demo/sentinel";
import { withSiteState } from "../workspace/workspace";
import { MANAGER, setAgreement } from "./edit";
import { constraintsAsSeenHere, mirrorConstraints, setEmployeeSites } from "./sites";

const week = "2026-10-18";

describe("assigning one employee id to several sites", () => {
  it("keeps the same id and phone, and does not match a different person by name", () => {
    const workspace = sentinelWorkspace(week);
    const dana = workspace.sites[0]?.state.emps.find((employee) => employee.id === SENTINEL.dana);
    if (!dana) throw new Error("missing dana");
    dana.phone = "0501111111";
    const next = setEmployeeSites(workspace, SENTINEL.dana, [SENTINEL.siteId, HARBOR.siteId], week);
    const copy = next.sites.find((site) => site.id === HARBOR.siteId)?.state.emps.find((employee) => employee.id === SENTINEL.dana);
    expect(copy?.phone).toBe("0501111111");
    expect(copy?.name).toBe(dana.name);
    expect(copy?.homeSiteId).toBe(SENTINEL.siteId);
    expect(copy?.grid?.[0]).toContain(HARBOR.day);
    expect(copy?.grid?.[0]).not.toContain(HARBOR.night);
    expect(next.sites[0]?.state.emps.find((employee) => employee.id === SENTINEL.dana)?.homeSiteId).toBe(SENTINEL.siteId);
    expect(next.sites[0]?.state.emps.filter((employee) => employee.name === dana.name)).toHaveLength(1);
  });

  it("copies an agreement change onto the reinforcement site", () => {
    const linked = setEmployeeSites(sentinelWorkspace(week), SENTINEL.dana, [SENTINEL.siteId, HARBOR.siteId], week);
    const headquarters = linked.sites[0]?.state;
    if (!headquarters) throw new Error("missing headquarters");
    const changed = setAgreement(headquarters, MANAGER, SENTINEL.dana, 0, SENTINEL.morning, false);
    const mirrored = mirrorConstraints(withSiteState(linked, SENTINEL.siteId, changed), SENTINEL.siteId);
    const copy = mirrored.sites.find((site) => site.id === HARBOR.siteId)?.state.emps.find((employee) => employee.id === SENTINEL.dana);
    expect(copy?.grid?.[0]).not.toContain(HARBOR.day);
    expect(copy?.grid?.[1]).toContain(HARBOR.day);
  });

  it("reads the primary site's constraints through the secondary site's shifts", () => {
    const workspace = sentinelWorkspace(week);
    const home = workspace.sites[0]?.state;
    const harbor = workspace.sites.find((site) => site.id === HARBOR.siteId)?.state;
    if (!home || !harbor) throw new Error("missing site");
    home.avail[week] = { [SENTINEL.dana]: [[SENTINEL.morning], [], [], [], [], [], []] };
    const seen = constraintsAsSeenHere(harbor, { shifts: home.biz.shifts, avail: home.avail }, SENTINEL.dana, week);
    expect(seen?.[0]).toContain(HARBOR.day);
    expect(seen?.[1]).toEqual([]);
    expect(constraintsAsSeenHere(harbor, { shifts: home.biz.shifts, avail: {} }, SENTINEL.dana, week)).toBeUndefined();
  });

  it("does not remove the last site", () => {
    const workspace = sentinelWorkspace(week);
    const next = setEmployeeSites(workspace, SENTINEL.dana, [], week);
    expect(next).toBe(workspace);
  });
});
