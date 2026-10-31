import { describe, expect, it } from "vitest";
import {
  allCapabilities,
  capabilitiesOf,
  descendants,
  grantable,
  holdsPeople,
  isAncestor,
  isLead,
  isSiteManager,
  managerCapabilities,
  staffCapabilities,
  transferTargets,
  type ReportNode,
} from "./hierarchy";

function person(id: string, reportsTo: string | undefined, lead: boolean, openedBy?: string): ReportNode {
  return {
    id,
    ...(reportsTo ? { reportsTo } : {}),
    ...(openedBy ? { openedBy } : {}),
    capabilities: lead ? managerCapabilities() : staffCapabilities(),
  };
}

describe("reporting line", () => {
  const people = [
    person("owner", undefined, true),
    person("mid", "owner", true, "owner"),
    person("lead", "mid", true, "mid"),
    person("worker", "lead", false, "lead"),
    person("junior", "worker", false, "worker"),
    person("side", "owner", false, "owner"),
  ];

  it("walks a long line and stops at a cycle", () => {
    expect(isAncestor(people, "owner", "junior")).toBe(true);
    expect(isAncestor(people, "mid", "junior")).toBe(true);
    expect(isAncestor(people, "lead", "junior")).toBe(true);
    expect(isAncestor(people, "worker", "owner")).toBe(false);
    expect(isAncestor(people, "junior", "junior")).toBe(false);
    expect(descendants(people, "mid")).toEqual(expect.arrayContaining(["lead", "worker", "junior"]));
    expect(descendants(people, "mid")).not.toContain("side");
    const loop = [person("a", "b", true), person("b", "a", true)];
    expect(isAncestor(loop, "missing", "a")).toBe(false);
  });

  it("moves direct management only to a manager under the actor", () => {
    expect(transferTargets(people, "worker", "lead")).toEqual(["lead"]);
    expect(transferTargets(people, "worker", "mid")).toEqual(expect.arrayContaining(["mid", "lead"]));
    expect(transferTargets(people, "worker", "mid")).not.toContain("worker");
    expect(transferTargets(people, "worker", "mid")).not.toContain("junior");
    expect(transferTargets(people, "worker", "mid")).not.toContain("side");
    expect(transferTargets(people, "worker", "side")).toEqual([]);
    expect(transferTargets(people, "worker", "owner")).toEqual(expect.arrayContaining(["owner", "mid", "lead"]));
    expect(transferTargets(people, "worker", "owner")).not.toContain("side");
  });

  it("lets the owner move someone to any site manager, including one outside the current reporting line", () => {
    const loose = [
      person("owner", undefined, true),
      person("lead", undefined, true),
      { ...person("desk", undefined, false), schedulable: false as const },
      person("worker", undefined, false),
    ];
    expect(transferTargets(loose, "worker", "owner")).toEqual([]);
    expect(transferTargets(loose, "worker", "owner", true)).toEqual(["owner", "lead", "desk"]);
    expect(transferTargets(loose, "worker", null, true)).toEqual(["owner", "lead", "desk"]);
    expect(transferTargets(loose, "worker", "owner", true)).not.toContain("worker");
    expect(isSiteManager(loose[1])).toBe(true);
    expect(isSiteManager(loose[2])).toBe(true);
    expect(isSiteManager(loose[3])).toBe(false);
  });

  it("grants a subset of the creator's permissions and keeps a schedule editor able to view it", () => {
    const requested = allCapabilities();
    const granted = grantable(staffCapabilities(), requested);
    expect(granted.clock).toBe(true);
    expect(granted.schedule_edit).toBe(false);
    expect(granted.people_edit).toBe(false);
    expect(isLead(granted)).toBe(false);
    const editor = grantable(managerCapabilities(), { ...staffCapabilities(), schedule_edit: true, schedule_view: false });
    expect(editor.schedule_edit).toBe(true);
    expect(editor.schedule_view).toBe(true);
    expect(holdsPeople(people, "lead")).toBe(true);
    expect(capabilitiesOf({})).toEqual(staffCapabilities());
  });
});
