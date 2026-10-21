import type { RotaState } from "../domain";
import { MANAGER, VIEWER, type Actor } from "../people/edit";

/** `owner` writes and is the only one who manages users and the business name. */
export type Access = "owner" | "write" | "read";

/** Demo account. Passwords live in the browser until Supabase Auth replaces this list. */
export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  password: string;
  access: Access;
  /** Empty for the business owner, who covers every site. */
  siteId?: string | null;
  /** Invited, and has not created the login yet. */
  pending?: boolean;
}

/** A constraint request waiting for the shift manager. It is not part of the saved schedule. */
export interface StaffRequest {
  id: string;
  employeeId: string;
  week: string;
  shifts: string[][];
}

/** A decided request the employee has not dismissed yet. */
export interface StaffDecision {
  id: string;
  siteId: string;
  siteName: string;
  week: string;
  outcome: "approved" | "rejected";
}

/** One site. `state.biz.name` is the site name; the business name lives on `Workspace.org`. */
export interface WorkspaceSite {
  id: string;
  state: RotaState;
  requests?: StaffRequest[];
}

export interface Workspace {
  /** `hebrewCalendar` adds Hebrew dates and holidays next to Gregorian dates. Missing means on. */
  org: { id: string; name: string; type: string; hebrewCalendar?: boolean };
  sites: WorkspaceSite[];
  activeSiteId: string;
  users: WorkspaceUser[];
  /** Roster employee linked to the signed-in user, when they are a simple employee. */
  selfEmployeeId?: string | null;
  /** Answers the signed-in employee has not dismissed. */
  decisions?: StaffDecision[];
}

export type UserInputError = "name" | "email" | "duplicate" | "password";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

/** Caps applied when a site is created, before anyone edits business settings. */
export const NEW_SITE_MIN_REST = 8;
export const NEW_SITE_MAX_HOURS = 72;

export function canWrite(user: WorkspaceUser): boolean {
  return user.access !== "read";
}

export function isOwner(user: WorkspaceUser): boolean {
  return user.access === "owner";
}

export function actorFor(user: WorkspaceUser, selfEmployeeId?: string | null): Actor {
  if (canWrite(user)) return MANAGER;
  if (user.access === "read" && selfEmployeeId) return { kind: "employee", employeeId: selfEmployeeId };
  return VIEWER;
}

export function activeSite(workspace: Workspace): WorkspaceSite | undefined {
  return workspace.sites.find((site) => site.id === workspace.activeSiteId) ?? workspace.sites[0];
}

export function withSiteState(workspace: Workspace, siteId: string, state: RotaState): Workspace {
  const site = workspace.sites.find((item) => item.id === siteId);
  if (!site || site.state === state) return workspace;
  return { ...workspace, sites: workspace.sites.map((item) => (item.id === siteId ? { ...item, state } : item)) };
}

export function selectSite(workspace: Workspace, siteId: string): Workspace {
  if (workspace.activeSiteId === siteId || !workspace.sites.some((site) => site.id === siteId)) return workspace;
  return { ...workspace, activeSiteId: siteId };
}

export function authenticate(workspace: Workspace, email: string, password: string): WorkspaceUser | null {
  const wanted = email.trim().toLowerCase();
  return (
    workspace.users.find((user) => !user.pending && user.email.toLowerCase() === wanted && user.password === password) ?? null
  );
}

export function updateOrg(workspace: Workspace, user: WorkspaceUser, patch: { name?: string; type?: string; hebrewCalendar?: boolean }): Workspace {
  if (!isOwner(user)) return workspace;
  const name = patch.name === undefined ? workspace.org.name : patch.name.trim();
  const type = patch.type === undefined ? workspace.org.type : patch.type.trim();
  const hebrewCalendar = patch.hebrewCalendar ?? workspace.org.hebrewCalendar !== false;
  if (!name || (name === workspace.org.name && type === workspace.org.type && hebrewCalendar === (workspace.org.hebrewCalendar !== false))) return workspace;
  return { ...workspace, org: { ...workspace.org, name, type, hebrewCalendar } };
}

export function hebrewCalendarOn(workspace: Workspace): boolean {
  return workspace.org.hebrewCalendar !== false;
}

function siteNameTaken(workspace: Workspace, name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return workspace.sites.some((site) => site.id !== exceptId && site.state.biz.name.trim().toLowerCase() === wanted);
}

/** A new site starts with the active site's shifts and rules, and no employees. */
export function addSite(workspace: Workspace, user: WorkspaceUser, input: { id: string; name: string; newId: () => string }): Workspace {
  const name = input.name.trim();
  if (!canWrite(user) || !name || siteNameTaken(workspace, name) || workspace.sites.some((site) => site.id === input.id)) {
    return workspace;
  }
  const template = activeSite(workspace)?.state;
  if (!template) return workspace;
  const state: RotaState = {
    week: template.week,
    biz: {
      ...structuredClone(template.biz),
      name,
      minRest: NEW_SITE_MIN_REST,
      maxHours: NEW_SITE_MAX_HOURS,
      shifts: template.biz.shifts.map((shift) => ({ ...shift, id: input.newId(), req: [...shift.req] })),
    },
    emps: [],
    avail: {},
    sched: {},
    closed: {},
  };
  return { ...workspace, sites: [...workspace.sites, { id: input.id, state }], activeSiteId: input.id };
}

export function renameSiteAllowed(workspace: Workspace, siteId: string, name: string): boolean {
  return Boolean(name.trim()) && !siteNameTaken(workspace, name, siteId);
}

export function removeSite(workspace: Workspace, user: WorkspaceUser, siteId: string): Workspace {
  if (!canWrite(user) || workspace.sites.length < 2 || !workspace.sites.some((site) => site.id === siteId)) return workspace;
  const sites = workspace.sites.filter((site) => site.id !== siteId);
  return { ...workspace, sites, activeSiteId: workspace.activeSiteId === siteId ? sites[0].id : workspace.activeSiteId };
}

export function userInputError(
  workspace: Workspace,
  input: { name: string; email: string; password: string },
): UserInputError | null {
  if (!input.name.trim()) return "name";
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return "email";
  if (workspace.users.some((user) => user.email.toLowerCase() === email)) return "duplicate";
  if (input.password.length < MIN_PASSWORD) return "password";
  return null;
}

export function addUser(
  workspace: Workspace,
  owner: WorkspaceUser,
  input: { id: string; name: string; email: string; password: string; access: "write" | "read" },
): Workspace {
  if (!isOwner(owner) || userInputError(workspace, input) || workspace.users.some((user) => user.id === input.id)) return workspace;
  const user: WorkspaceUser = {
    id: input.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    access: input.access,
  };
  return { ...workspace, users: [...workspace.users, user] };
}

/** The owner's own access cannot be changed here. */
export function setUserAccess(workspace: Workspace, owner: WorkspaceUser, userId: string, access: "write" | "read"): Workspace {
  const target = workspace.users.find((user) => user.id === userId);
  if (!isOwner(owner) || !target || target.access === "owner" || target.access === access) return workspace;
  return { ...workspace, users: workspace.users.map((user) => (user.id === userId ? { ...user, access } : user)) };
}

export function removeUser(workspace: Workspace, owner: WorkspaceUser, userId: string): Workspace {
  const target = workspace.users.find((user) => user.id === userId);
  if (!isOwner(owner) || !target || target.access === "owner") return workspace;
  return { ...workspace, users: workspace.users.filter((user) => user.id !== userId) };
}
