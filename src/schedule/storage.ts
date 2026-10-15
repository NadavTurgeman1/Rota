import type { Lang, RotaState } from "../domain";
import type { Workspace } from "../workspace/workspace";

export const DEMO_STORAGE_KEY = "rota.schedule.demo.v1";
export const WORKSPACE_STORAGE_KEY = "rota.workspace.demo.v2";
export const SESSION_STORAGE_KEY = "rota.session.demo";

export interface DemoSave {
  state: RotaState;
  lang: Lang;
}

export interface WorkspaceSave {
  workspace: Workspace;
  lang: Lang;
}

function validState(state: RotaState | undefined): state is RotaState {
  if (!state || !/^\d{4}-\d{2}-\d{2}$/.test(state.week ?? "")) return false;
  return Boolean(state.biz && Array.isArray(state.emps) && state.sched && state.avail);
}

export function readDemoSave(raw: string | null): DemoSave | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; state?: RotaState; lang?: unknown };
    if (parsed.version !== 1 || !validState(parsed.state)) return null;
    return { state: parsed.state, lang: parsed.lang === "en" ? "en" : "he" };
  } catch {
    return null;
  }
}

export function writeDemoSave(state: RotaState, lang: Lang): string {
  return JSON.stringify({ version: 1, state, lang });
}

export function readWorkspaceSave(raw: string | null): WorkspaceSave | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; workspace?: Workspace; lang?: unknown };
    const workspace = parsed.workspace;
    if (parsed.version !== 2 || !workspace?.org?.name || !Array.isArray(workspace.users)) return null;
    if (!Array.isArray(workspace.sites) || workspace.sites.length === 0) return null;
    if (!workspace.sites.every((site) => typeof site.id === "string" && validState(site.state))) return null;
    return { workspace, lang: parsed.lang === "en" ? "en" : "he" };
  } catch {
    return null;
  }
}

export function writeWorkspaceSave(workspace: Workspace, lang: Lang): string {
  return JSON.stringify({ version: 2, workspace, lang });
}
