import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, HARBOR, SENTINEL, sentinelWorkspace } from "../demo/sentinel";
import { MANAGER, VIEWER, deletionBlockedBy, employeeName, removeEmployeeRecord, setAvailability } from "../people/edit";
import { generateWeek } from "../schedule/edit";
import { readWorkspaceSave, writeWorkspaceSave } from "../schedule/storage";
import {
  actorFor,
  activeSite,
  addSite,
  addUser,
  authenticate,
  removeSite,
  removeUser,
  selectSite,
  setUserAccess,
  updateOrg,
  userInputError,
} from "./workspace";

const WEEK = "2026-10-11";

/** The demo seeds the owner only; the access model is still exercised with a writer and a reader. */
function users() {
  const seeded = sentinelWorkspace(WEEK);
  const [owner] = seeded.users;
  const editor = { id: "u-editor", name: "Shira", email: "editor@sentinel.demo", password: DEMO_PASSWORD, access: "write" as const };
  const viewer = { id: "u-viewer", name: "Gil", email: "viewer@sentinel.demo", password: DEMO_PASSWORD, access: "read" as const };
  const workspace = { ...seeded, users: [owner, editor, viewer] };
  return { workspace, owner, editor, viewer };
}

describe("workspace", () => {
  it("has no active site until the first site exists", () => {
    const empty = { ...sentinelWorkspace(WEEK), sites: [], activeSiteId: "" };
    expect(activeSite(empty)).toBeUndefined();
    expect(activeSite(empty)?.state ?? sentinelWorkspace(WEEK).sites[0].state).toBeDefined();
  });

  it("signs in by email and password, and maps access to an actor", () => {
    const { workspace, owner, viewer } = users();
    expect(authenticate(workspace, " OWNER@sentinel.demo ", DEMO_PASSWORD)?.id).toBe(owner.id);
    expect(authenticate(workspace, owner.email, "wrong")).toBeNull();
    expect(actorFor(owner)).toEqual(MANAGER);
    expect(actorFor(viewer)).toEqual(VIEWER);
    expect(actorFor(viewer, "emp-1")).toEqual({ kind: "employee", employeeId: "emp-1" });
    expect(authenticate({ ...workspace, users: [{ ...viewer, pending: true }] }, viewer.email, DEMO_PASSWORD)).toBeNull();
  });

  it("lets only the owner rename the business and manage users", () => {
    const { workspace, owner, editor } = users();
    expect(updateOrg(workspace, editor, { name: "Other" })).toBe(workspace);
    expect(updateOrg(workspace, owner, { name: "  " })).toBe(workspace);
    expect(updateOrg(workspace, owner, { name: " Shield " }).org.name).toBe("Shield");

    const input = { id: "u-new", name: "Noam", email: "noam@sentinel.demo", password: "secret1", access: "read" as const };
    expect(addUser(workspace, editor, input)).toBe(workspace);
    expect(userInputError(workspace, { ...input, email: editor.email })).toBe("duplicate");
    expect(userInputError(workspace, { ...input, password: "123" })).toBe("password");
    const added = addUser(workspace, owner, input);
    expect(added.users.at(-1)).toMatchObject({ email: "noam@sentinel.demo", access: "read" });

    const promoted = setUserAccess(added, owner, "u-new", "write");
    expect(promoted.users.at(-1)?.access).toBe("write");
    expect(setUserAccess(added, owner, owner.id, "read")).toBe(added);
    expect(removeUser(added, owner, owner.id)).toBe(added);
    expect(removeUser(added, owner, "u-new").users).toHaveLength(3);
  });

  it("keeps sites apart and refuses to delete the last one", () => {
    const { workspace, editor, viewer } = users();
    expect(selectSite(workspace, HARBOR.siteId).activeSiteId).toBe(HARBOR.siteId);
    expect(addSite(workspace, viewer, { id: "s3", name: "Mall", newId: () => "x" })).toBe(workspace);
    expect(addSite(workspace, editor, { id: "s3", name: "harbor", newId: () => "x" })).toBe(workspace);

    let counter = 0;
    const added = addSite(workspace, editor, { id: "s3", name: "Mall", newId: () => `shift-${++counter}` });
    const mall = added.sites.at(-1)!.state;
    expect(added.activeSiteId).toBe("s3");
    expect(mall.emps).toEqual([]);
    expect(mall.biz.minRest).toBe(8);
    expect(mall.biz.maxHours).toBe(72);
    expect(mall.biz.shifts.map((shift) => shift.id)).toEqual(["shift-1", "shift-2", "shift-3"]);
    expect(workspace.sites[0].state.biz.shifts[0].id).toBe(SENTINEL.morning);

    const removed = removeSite(removeSite(added, editor, "s3"), editor, HARBOR.siteId);
    expect(removed.sites).toHaveLength(1);
    expect(removeSite(removed, editor, SENTINEL.siteId)).toBe(removed);
  });

  it("seeds the demo with the owner account only", () => {
    expect(sentinelWorkspace(WEEK).users.map((user) => [user.email, user.access])).toEqual([["owner@sentinel.demo", "owner"]]);
  });

  it("round-trips through storage", () => {
    const { workspace } = users();
    expect(readWorkspaceSave(writeWorkspaceSave(workspace, "en"))).toEqual({ workspace, lang: "en" });
    expect(readWorkspaceSave("{\"version\":1}")).toBeNull();
  });
});

describe("deleting an employee", () => {
  it("clears drafts and availability, and keeps published weeks", () => {
    const state = sentinelWorkspace(WEEK).sites[0].state;
    const draft = generateWeek(setAvailability(state, MANAGER, SENTINEL.dana, 1, SENTINEL.morning, false));
    expect(removeEmployeeRecord(draft, VIEWER, SENTINEL.dana, WEEK)).toBe(draft);

    const removed = removeEmployeeRecord(draft, MANAGER, SENTINEL.dana, WEEK);
    expect(removed.emps.some((employee) => employee.id === SENTINEL.dana)).toBe(false);
    expect(Object.values(removed.sched[WEEK].assign).flat()).not.toContain(SENTINEL.dana);
    expect(removed.avail[WEEK]?.[SENTINEL.dana]).toBeUndefined();
    expect(employeeName(removed, SENTINEL.dana)).toBe("Dana");
  });

  it("is refused while a current published week seats them", () => {
    const state = sentinelWorkspace(WEEK).sites[0].state;
    const published = structuredClone(generateWeek(state));
    published.sched[WEEK].status = "published";
    const seated = Object.values(published.sched[WEEK].assign).flat()[0];
    expect(deletionBlockedBy(published, seated, WEEK)).toEqual([WEEK]);
    expect(removeEmployeeRecord(published, MANAGER, seated, WEEK)).toBe(published);
    expect(deletionBlockedBy(published, seated, "2026-10-18")).toEqual([]);
    const later = removeEmployeeRecord(published, MANAGER, seated, "2026-10-18");
    expect(Object.values(later.sched[WEEK].assign).flat()).toContain(seated);
  });
});
