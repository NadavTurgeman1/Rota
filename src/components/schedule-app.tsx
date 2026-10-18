"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, analyze, slots, sundayOnOrBefore, type Analysis, type Lang, type RotaState } from "../domain";
import { addShift, removeShift, setShiftRequirement, updateBusiness, updateShift } from "../business/edit";
import { copy, deleteEmployeeBlocked, publishBlocked, selectionHint } from "../i18n/copy";
import { formatWeekRange, pngFileName, siteLabel } from "../schedule/display";
import { backupJson, weekExport } from "../schedule/export";
import {
  addEmployee,
  approveProposal,
  commit,
  approveEmergency,
  approveReplacement,
  freshStamp,
  generateWeek,
  goToWeek,
  hoursSinceWeek,
  moveEmployee,
  swapInSlot,
  parseAssignmentToken,
  publishCheck,
  publishWeek,
  redo,
  removeEmployee,
  reportCallOff,
  restoreWeekVersion,
  revertToDraft,
  undo,
  type History,
} from "../schedule/edit";
import { createSaveQueue } from "../schedule/save-queue";
import {
  addEmployeeRecord,
  applyConstraintText,
  copyAvailability,
  deletionBlockedBy,
  employeeName,
  removeEmployeeRecord,
  setAgreement,
  setPreference,
  setWholeAgreement,
  replaceAvailability,
  setAvailability,
  setWholeAvailability,
  updateEmployee,
  VIEWER,
} from "../people/edit";
import {
  actorFor,
  activeSite,
  addSite,
  canWrite as hasWrite,
  isOwner,
  removeSite,
  renameSiteAllowed,
  selectSite,
  updateOrg,
  withSiteState,
  type StaffRequest,
  type Workspace,
} from "../workspace/workspace";
import { BusinessScreen } from "./business-screen";
import { ConstraintsScreen } from "./constraints-screen";
import { InsightsScreen } from "./insights-screen";
import { IssuesPanel } from "./issues-panel";
import { ApprovalsScreen, type SignupApproval, type TenantRow } from "./approvals-screen";
import { BrandMark, CreateOrgScreen, CreateSiteScreen, LoginScreen, SignupScreen, Wordmark } from "./login-screen";
import { browserClient } from "../supabase/browser";
import { remoteConfigured } from "../supabase/public-env";
import { WeekBoard } from "./schedule-board";
import { StaffHome } from "./staff-home";
import { TeamScreen } from "./team-screen";
import { useAiEnabled } from "./use-ai";
import { SettingsMenu, type Theme } from "./settings-menu";
import { VersionsPanel } from "./versions-panel";
import { WeekSummary } from "./week-summary";
import { button } from "./ui";
import { downloadBlob, downloadWeekPng } from "./week-png";

const EMPTY: Analysis = { violations: [], overQuota: [], unfilled: [], under: [], hours: {}, counts: {} };
const THEME_KEY = "rota.theme";
const SUPPORT_KEY = "rota.supportOrg";

function persistable(workspace: Workspace) {
  return { org: workspace.org, sites: workspace.sites, activeSiteId: workspace.activeSiteId };
}

function blankWorkspace(userId: string, email: string): Workspace {
  const name = email.split("@")[0] || "Rota";
  return {
    org: { id: "", name: "", type: "" },
    sites: [],
    activeSiteId: "",
    users: [{ id: userId, name, email, password: "", access: "owner" }],
  };
}

type Screen = "business" | "team" | "constraints" | "insights" | "schedule" | "approvals";

function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyState(): RotaState {
  return {
    week: "2026-10-11",
    biz: { name: "", type: "", minRest: 8, maxHours: 72, maxShift: 0, assume: true, shifts: [] },
    emps: [],
    avail: {},
    sched: {},
    closed: {},
  };
}

function useHistory(initial: RotaState) {
  const [history, setHistory] = useState<History>({ present: initial, past: [], future: [] });
  const update = useCallback((produce: (state: RotaState) => RotaState) => {
    setHistory((current) => commit(current, produce(current.present)));
  }, []);
  const undoHistory = useCallback(() => setHistory((current) => undo(current)), []);
  const redoHistory = useCallback(() => setHistory((current) => redo(current)), []);
  return {
    state: history.present,
    setHistory,
    update,
    undoHistory,
    redoHistory,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export function ScheduleApp() {
  const [workspace, setWorkspace] = useState<Workspace>(() => blankWorkspace("", ""));
  const { state, setHistory, update, undoHistory, redoHistory, canUndo, canRedo } = useHistory(emptyState());
  const [lang, setLang] = useState<Lang>("he");
  const [theme, setTheme] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [operator, setOperator] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [supportOrg, setSupportOrg] = useState<string | null>(null);
  const supportRef = useRef<string | null>(null);
  const emailRef = useRef("");
  const [suspended, setSuspended] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<"login" | "signup">("login");
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const remote = remoteConfigured();
  const tokenRef = useRef<string | null>(null);
  const retrySave = useRef(false);
  const saves = useRef(
    createSaveQueue(async (json, signal) => {
      const token = tokenRef.current;
      if (!token) return "retry";
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: authHeaders(true),
        body: json,
        keepalive: true,
        signal,
      });
      if (response.ok) {
        retrySave.current = false;
        setSaveNote(null);
        return "ok";
      }
      const retry = response.status === 503 || response.status >= 500;
      retrySave.current = retry;
      setSaveNote(response.status === 503 ? "db" : "save");
      return retry ? "retry" : "stop";
    }),
  );
  const [selection, setSelection] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("schedule");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const staffChain = useRef(Promise.resolve());
  const [nowHours, setNowHours] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState("2026-10-11");
  const aiEnabled = useAiEnabled();
  const t = copy[lang];

  const live = useMemo(() => withSiteState(workspace, workspace.activeSiteId, state), [workspace, state]);
  const user = live.users.find((item) => item.id === userId) ?? null;
  const actor = user ? actorFor(user, live.selfEmployeeId) : VIEWER;
  const writer = Boolean(user && hasWrite(user));
  const owner = Boolean(user && isOwner(user));

  function rememberSupport(orgId: string | null) {
    supportRef.current = orgId;
    setSupportOrg(orgId);
    if (orgId) window.sessionStorage.setItem(SUPPORT_KEY, orgId);
    else window.sessionStorage.removeItem(SUPPORT_KEY);
  }

  function authHeaders(json = false): HeadersInit {
    const headers: Record<string, string> = {};
    const token = tokenRef.current;
    if (token) headers.authorization = `Bearer ${token}`;
    if (supportRef.current) headers["x-rota-support-org"] = supportRef.current;
    if (json) headers["content-type"] = "application/json";
    return headers;
  }

  async function adopt(token: string, signedInId: string, email: string) {
    tokenRef.current = token;
    emailRef.current = email;
    const response = await fetch("/api/workspace", { headers: authHeaders() });
    if (response.status === 401) {
      setUserId(null);
      setHydrated(true);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setRemoteError(body?.error === "db_unconfigured" ? "db" : "load");
      setUserId(signedInId);
      setHydrated(true);
      return;
    }
    const body = (await response.json()) as { workspace: Workspace | null; admin?: boolean; canCreateBusiness?: boolean; suspended?: string | null };
    setOperator(body.admin === true);
    setCanCreate(body.canCreateBusiness === true);
    setSuspended(body.suspended ?? null);
    const next = body.workspace ?? blankWorkspace(signedInId, email);
    if (supportRef.current && next.org.id !== supportRef.current) rememberSupport(null);
    setWorkspace(next);
    const opened = activeSite(next);
    if (opened) setHistory({ present: opened.state, past: [], future: [] });
    setUserId(signedInId);
    saves.current.noteSaved(JSON.stringify(persistable(next)));
    setRemoteError(null);
    setHydrated(true);
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark" || (savedTheme === null && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
    }
    setCurrentWeek(sundayOnOrBefore(todayIso()));
    if (!remote) {
      setHydrated(true);
      return;
    }
    const supabase = browserClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      tokenRef.current = session?.access_token ?? null;
      if (event !== "INITIAL_SESSION") return;
      if (!session) {
        setHydrated(true);
        return;
      }
      supportRef.current = window.sessionStorage.getItem(SUPPORT_KEY);
      setSupportOrg(supportRef.current);
      void adopt(session.access_token, session.user.id, session.user.email ?? "");
    });
    return () => data.subscription.unsubscribe();
  }, [remote, setHistory]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    if (!remote || !user || !writer || live.sites.length === 0) return;
    const json = JSON.stringify(persistable(live));
    saves.current.push(json);
    const handle = window.setTimeout(() => saves.current.kick(), 200);
    return () => window.clearTimeout(handle);
  }, [hydrated, live, lang, remote, user, writer]);

  useEffect(() => {
    if (!remote || !saveNote || !retrySave.current) return;
    const handle = window.setInterval(() => saves.current.kick(), 2000);
    return () => window.clearInterval(handle);
  }, [remote, saveNote]);

  useEffect(() => {
    if (!remote) return;
    function flush() {
      saves.current.kick();
    }
    function onHide() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [remote]);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    return () => cancelAnimationFrame(frame);
  }, [hydrated, theme]);

  useEffect(() => {
    setNowHours(hoursSinceWeek(state.week, new Date()));
  }, [state.week]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      if (event.key === "Escape") {
        setSelection(null);
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      setSelection(null);
      if (event.shiftKey) redoHistory();
      else undoHistory();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redoHistory, undoHistory]);

  function change(produce: (current: RotaState) => RotaState) {
    setSelection(null);
    update(produce);
  }

  /** Workspace edits are not part of undo. Switching or replacing the active site starts a fresh history. */
  function changeWorkspace(produce: (current: Workspace) => Workspace) {
    const next = produce(live);
    if (next === live) return;
    setSelection(null);
    setWorkspace(next);
    const site = activeSite(next);
    if (!site) return;
    if (site.id !== live.activeSiteId || site.state !== state) {
      setHistory({ present: site.state, past: [], future: [] });
      setSelectedId(null);
    }
  }

  function switchSite(siteId: string) {
    changeWorkspace((current) => {
      const next = selectSite(current, siteId);
      if (next === current) return current;
      const site = activeSite(next);
      if (!site) return current;
      return withSiteState(next, site.id, goToWeek(site.state, state.week));
    });
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    const { data, error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session || !data.user) return false;
    await adopt(data.session.access_token, data.user.id, data.user.email ?? email);
    setScreen("schedule");
    return true;
  }

  async function createAccount(fullName: string, email: string, password: string): Promise<"signed-in" | "confirm" | "failed" | "denied" | "short" | "rate"> {
    const name = fullName.trim();
    const address = email.trim();
    if (!name || !address) return "failed";
    if (password.length < 6) return "short";
    const allowed = await browserClient().rpc("signup_allowed", { target_email: address });
    if (allowed.error || allowed.data !== true) return "denied";
    const { data, error } = await browserClient().auth.signUp({
      email: address,
      password,
      options: { data: { name } },
    });
    if (error || !data.user) {
      const detail = `${error?.message ?? ""} ${error?.code ?? ""}`;
      if (detail.includes("signup_not_approved")) return "denied";
      if (error?.status === 429 || /rate limit/i.test(detail)) return "rate";
      return "failed";
    }
    if (!data.session) return "confirm";
    await adopt(data.session.access_token, data.user.id, data.user.email ?? email);
    setScreen("schedule");
    return "signed-in";
  }

  async function postWorkspace(body: { name?: string; type?: string; siteName?: string }): Promise<boolean> {
    const token = tokenRef.current;
    if (!token) return false;
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (payload?.error === "db_unconfigured") setRemoteError("db");
      return false;
    }
    const payload = (await response.json()) as { workspace: Workspace };
    setWorkspace(payload.workspace);
    const opened = payload.workspace.sites[0];
    if (opened) setHistory({ present: opened.state, past: [], future: [] });
    saves.current.noteSaved(JSON.stringify(persistable(payload.workspace)));
    setRemoteError(null);
    setScreen("schedule");
    return true;
  }

  function createOrg(name: string, type: string): Promise<boolean> {
    return postWorkspace({ name, type });
  }

  function createSite(name: string): Promise<boolean> {
    return postWorkspace({ siteName: name });
  }

  const loadCompanies = useCallback(async (): Promise<{ companies: TenantRow[]; approvals: SignupApproval[] }> => {
    const token = tokenRef.current;
    if (!token) return { companies: [], approvals: [] };
    const response = await fetch("/api/companies", { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return { companies: [], approvals: [] };
    const body = (await response.json()) as { companies?: TenantRow[]; approvals?: SignupApproval[] };
    return { companies: body.companies ?? [], approvals: body.approvals ?? [] };
  }, []);

  async function approveEmail(email: string): Promise<boolean> {
    const token = tokenRef.current;
    if (!token) return false;
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  }

  async function setCompanyStatus(id: string, status: "active" | "suspended"): Promise<boolean> {
    const token = tokenRef.current;
    if (!token) return false;
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    return response.ok;
  }

  function storeRequest(siteId: string, request: StaffRequest) {
    setWorkspace((current) => ({
      ...current,
      sites: current.sites.map((site) =>
        site.id === siteId
          ? {
              ...site,
              requests: [...(site.requests ?? []).filter((item) => !(item.employeeId === request.employeeId && item.week === request.week)), request],
            }
          : site,
      ),
    }));
  }

  function dropRequest(siteId: string, requestId: string) {
    setWorkspace((current) => ({
      ...current,
      sites: current.sites.map((site) =>
        site.id === siteId ? { ...site, requests: (site.requests ?? []).filter((item) => item.id !== requestId) } : site,
      ),
    }));
  }

  function submitStaffRequest(shifts: string[][]) {
    const selfId = live.selfEmployeeId;
    if (!selfId) return;
    const siteId = live.activeSiteId;
    const week = state.week;
    if (!remote) {
      storeRequest(siteId, { id: crypto.randomUUID(), employeeId: selfId, week, shifts });
      return;
    }
    staffChain.current = staffChain.current.catch(() => undefined).then(async () => {
      const token = tokenRef.current;
      if (!token) return;
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ siteId, week, shifts }),
      });
      const body = (await response.json().catch(() => null)) as { request?: StaffRequest; error?: string } | null;
      if (!response.ok || !body?.request) {
        setSaveNote(body?.error === "blocks" ? "blocks" : "failed");
        return;
      }
      setSaveNote(null);
      storeRequest(siteId, body.request);
    });
  }

  async function decideRequest(requestId: string, approve: boolean) {
    const siteId = live.activeSiteId;
    const request = live.sites.find((site) => site.id === siteId)?.requests?.find((item) => item.id === requestId);
    if (!request) return;
    if (remote) {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ requestId, approve }),
      });
      if (!response.ok) {
        setSaveNote("failed");
        return;
      }
      setSaveNote(null);
    }
    if (approve) change((current) => replaceAvailability(current, actor, request.employeeId, request.week, request.shifts));
    dropRequest(siteId, requestId);
  }

  async function acknowledgeDecision(requestId: string): Promise<boolean> {
    if (remote) {
      const response = await fetch("/api/availability", {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ requestId }),
      });
      if (!response.ok) {
        setSaveNote("failed");
        return false;
      }
      setSaveNote(null);
    }
    setWorkspace((current) => ({
      ...current,
      decisions: (current.decisions ?? []).filter((item) => item.id !== requestId),
    }));
    return true;
  }

  async function inviteStaff(input: { employeeId: string; email: string }): Promise<boolean> {
    const token = tokenRef.current;
    if (!token || !live.org.id) return false;
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ ...input, orgId: live.org.id }),
    });
    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as { status?: string } | null;
    const address = input.email.trim().toLowerCase();
    const person = state.emps.find((employee) => employee.id === input.employeeId);
    change((current) => {
      const employee = current.emps.find((item) => item.id === input.employeeId);
      if (!employee || employee.loginEmail === address) return current;
      const next = structuredClone(current);
      const target = next.emps.find((item) => item.id === input.employeeId);
      if (!target) return current;
      target.loginEmail = address;
      target.loginConfirmed = body?.status === "linked";
      return next;
    });
    setWorkspace((current) => {
      if (current.users.some((member) => member.email.toLowerCase() === address)) return current;
      return {
        ...current,
        users: [
          ...current.users,
          {
            id: crypto.randomUUID(),
            name: person?.name || address,
            email: address,
            password: "",
            access: "read",
            siteId: current.activeSiteId,
            pending: body?.status !== "linked",
          },
        ],
      };
    });
    return true;
  }

  async function inviteManager(input: { fullName: string; email: string; siteIds: string[] }): Promise<boolean> {
    const token = tokenRef.current;
    if (!token || !live.org.id) return false;
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ ...input, orgId: live.org.id }),
    });
    return response.ok;
  }

  async function enterCompany(orgId: string) {
    const token = tokenRef.current;
    if (!token || !userId) return;
    rememberSupport(orgId);
    await adopt(token, userId, emailRef.current);
    setScreen("schedule");
  }

  async function leaveSupport() {
    const token = tokenRef.current;
    rememberSupport(null);
    if (token && userId) await adopt(token, userId, emailRef.current);
    setScreen("approvals");
  }

  function signOut() {
    void browserClient().auth.signOut();
    setUserId(null);
    setOperator(false);
    setCanCreate(false);
    rememberSupport(null);
    setSuspended(null);
    setAuthScreen("login");
    setSelection(null);
    setRemoteError(null);
  }

  function savePng(source: RotaState) {
    const data = weekExport(source, lang, live.org.name);
    if (!data) return;
    downloadWeekPng(
      data,
      { open: t.exportOpen, closed: t.exportClosed, covered: t.covered, overQuota: t.overQuota, legend: t.exportLegend },
      pngFileName(siteLabel(source.biz.name, lang), source.week),
    );
  }

  function publish() {
    if (!user) return;
    const next = publishWeek(state, freshStamp(user.name));
    if (next === state) return;
    change(() => next);
    savePng(next);
  }

  function exportPng() {
    savePng(state);
  }

  function exportJson() {
    const text = backupJson(state, { org: live.org.name, at: new Date().toISOString() });
    downloadBlob(new Blob([text], { type: "application/json" }), `rota-backup-${state.week}.json`);
  }

  const settings = (
    <SettingsMenu lang={lang} theme={theme} onLang={setLang} onTheme={setTheme} onSignOut={user ? signOut : undefined} />
  );

  if (!hydrated) return <div className="min-h-screen" />;

  if (!remote) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <p role="alert" className="text-sm leading-6 text-ink">
          {t.appDisconnected}
        </p>
        {settings}
      </div>
    );
  }

  if (remoteError === "db") {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <p role="alert" className="text-sm leading-6 text-danger-text">
          {t.remoteDbMissing}
        </p>
        {settings}
      </div>
    );
  }

  if (!user) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
        {remote && authScreen === "signup" ? (
          <SignupScreen lang={lang} toolbar={settings} onCreateAccount={createAccount} onShowLogin={() => setAuthScreen("login")} />
        ) : (
          <LoginScreen
            lang={lang}
            orgName="Rota"
            demoAccounts={[]}
            demoPassword=""
            toolbar={settings}
            onSignIn={signIn}
            onShowSignup={remote ? () => setAuthScreen("signup") : undefined}
          />
        )}
      </div>
    );
  }

  if (remote && live.sites.length === 0) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
        {live.org.id ? (
          <CreateSiteScreen
            lang={lang}
            toolbar={
              supportOrg ? (
                <>
                  <button type="button" className={button.quiet} onClick={() => void leaveSupport()}>
                    {t.leaveSupport}
                  </button>
                  {settings}
                </>
              ) : (
                settings
              )
            }
            onCreate={createSite}
          />
        ) : operator ? (
          <ApprovalsScreen lang={lang} toolbar={settings} load={loadCompanies} onApprove={approveEmail} onStatus={setCompanyStatus} onEnter={(orgId) => void enterCompany(orgId)} />
        ) : canCreate ? (
          <CreateOrgScreen lang={lang} toolbar={settings} onCreate={createOrg} />
        ) : (
          <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
            <p className="text-sm leading-6 text-ink">{suspended ? t.tenantSuspended : t.notApprovedTitle}</p>
            {settings}
          </div>
        )}
      </div>
    );
  }

  if (user.access === "read") {
    return (
      <StaffHome
        state={state}
        lang={lang}
        orgName={live.org.name}
        selfId={live.selfEmployeeId ?? null}
        sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name }))}
        activeSiteId={live.activeSiteId}
        toolbar={settings}
        saveNote={saveNote}
        onSelectSite={switchSite}
        pending={
          live.sites
            .find((site) => site.id === live.activeSiteId)
            ?.requests?.find((request) => request.employeeId === live.selfEmployeeId && request.week === state.week) ?? null
        }
        onSubmit={submitStaffRequest}
        onWeek={(days) => change((current) => goToWeek(current, addDays(current.week, days)))}
        decisions={live.decisions ?? []}
        onAcknowledge={acknowledgeDecision}
      />
    );
  }

  const schedule = state.sched[state.week];
  const published = schedule?.status === "published";
  const readOnly = published || !writer;
  const report = schedule ? analyze(state, state.week, lang) : EMPTY;
  const check = schedule ? publishCheck(state) : { ready: false, violations: 0, unfilled: 0 };
  const openSlots = slots(state, state.week);
  const selectedName = selection ? employeeName(state, parseAssignmentToken(selection)?.employeeId ?? "") : null;

  const status = !writer
    ? t.scheduleReadOnly
    : !schedule
      ? t.createBeforePublish
      : published
        ? report.unfilled.length > 0
          ? t.publishedOpen
          : t.publishedLock
        : check.ready
          ? t.allClear
          : publishBlocked(lang, check.violations, check.unfilled);

  const boardProps = {
    state,
    slots: openSlots,
    lang,
    published: readOnly,
    canCallOff: writer && published,
    nowHours,
    selectedToken: selection,
    focusEmployeeId: null,
    onAdd: (slotKey: string, employeeId: string) => change((current) => addEmployee(current, slotKey, employeeId)),
    onRemove: (slotKey: string, employeeId: string) => change((current) => removeEmployee(current, slotKey, employeeId)),
    onMove: (fromKey: string, employeeId: string, toKey: string) =>
      change((current) => moveEmployee(current, fromKey, employeeId, toKey)),
    onSwap: (slotKey: string, employeeId: string, otherId: string) =>
      change((current) => swapInSlot(current, slotKey, employeeId, otherId)),
    onToggleSelect: (token: string) => setSelection((current) => (current === token ? null : token)),
    onCallOff: (slotKey: string, employeeId: string) =>
      change((current) =>
        reportCallOff(current, actor, {
          id: crypto.randomUUID(),
          slotKey,
          employeeId,
          at: new Date().toISOString(),
          nowHours: nowHours ?? Number.POSITIVE_INFINITY,
        }),
      ),
  };

  const tabs: { id: Screen; label: string }[] = [
    { id: "business", label: t.navBusiness },
    { id: "team", label: t.navTeam },
    { id: "constraints", label: t.navConstraints },
    { id: "insights", label: t.navInsights },
    { id: "schedule", label: t.navSchedule },
  ];
  const weekly = screen === "schedule" || screen === "constraints";

  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
        {saveNote ? (
          <p role="alert" className="mx-auto max-w-[1440px] px-4 pt-2 text-sm text-danger-text sm:px-6">
            {saveNote === "db" ? t.remoteDbMissing : t.saveFailed}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandMark />
            <Wordmark />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only font-medium text-ink-soft sm:not-sr-only">{t.site}</span>
              <select
                data-testid="site-select"
                aria-label={t.site}
                className={`${button.quiet} max-w-36 px-3 sm:max-w-none`}
                value={live.activeSiteId}
                onChange={(event) => switchSite(event.target.value)}
              >
                {live.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {siteLabel(site.state.biz.name, lang)}
                  </option>
                ))}
              </select>
            </label>
            {supportOrg ? (
              <button type="button" className={button.quiet} onClick={() => void leaveSupport()}>
                {t.leaveSupport}
              </button>
            ) : operator ? (
              <button
                type="button"
                className={button.quiet}
                onClick={() => setScreen(screen === "approvals" ? "schedule" : "approvals")}
              >
                {t.approvalsTitle}
              </button>
            ) : null}
            {settings}
          </div>
        </div>
        {supportOrg ? (
          <p className="mx-auto max-w-[1440px] px-4 pb-2 text-sm text-muted sm:px-6">{t.supportBanner}</p>
        ) : null}
        <div className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-6">
        <nav role="tablist" aria-label="Rota" className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-track p-1 sm:inline-flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-testid={`nav-${tab.id}`}
              aria-selected={screen === tab.id}
              className={`min-h-9 rounded-lg px-1 py-2 text-center text-xs font-medium leading-4 sm:px-4 sm:text-sm sm:leading-5 ${
                screen === tab.id ? "bg-card font-semibold text-ink shadow-card" : "text-muted hover:bg-card/50 hover:text-ink"
              }`}
              onClick={() => {
                setSelection(null);
                setScreen(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        </div>
      </header>
      <main className={`mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 ${selection ? "pb-28" : ""}`}>
        {writer ? null : (
          <p
            data-testid="read-only-banner"
            className="flex items-start gap-3 rounded-xl border border-warn-line/40 bg-warn-softer px-4 py-3 text-sm leading-6 text-warn-text"
          >
            <EyeIcon />
            {t.readOnlyBanner}
          </p>
        )}
        {weekly ? (
          <section className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1 shadow-card">
              <button
                type="button"
                data-testid="prev-week"
                aria-label={t.previousWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, -7)))}
              >
                ‹
              </button>
              <span data-testid="week-range" className="min-w-36 px-2 text-center text-sm font-semibold tabular-nums">
                {formatWeekRange(state.week, lang)}
              </span>
              <button
                type="button"
                data-testid="next-week"
                aria-label={t.nextWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, 7)))}
              >
                ›
              </button>
            </div>
            {screen === "schedule" ? (
              <>
                <button
                  type="button"
                  data-testid="generate"
                  className={button.primary}
                  disabled={!writer || published}
                  onClick={() => change(generateWeek)}
                >
                  {schedule ? t.regenerate : t.generate}
                </button>
                <PublishButton
                  lang={lang}
                  canPublish={writer && Boolean(schedule) && !published && check.ready}
                  published={Boolean(published)}
                  canBackup={writer}
                  onPublish={publish}
                  onPng={exportPng}
                  onJson={exportJson}
                />
                <button type="button" data-testid="revert" className={button.quiet} disabled={!writer || !published} onClick={() => change(revertToDraft)}>
                  {t.revert}
                </button>
              </>
            ) : null}
            {writer ? (
              <>
                <button
                  type="button"
                  data-testid="undo"
                  className={button.quiet}
                  disabled={!canUndo}
                  onClick={() => {
                    setSelection(null);
                    undoHistory();
                  }}
                >
                  {t.undo}
                </button>
                <button
                  type="button"
                  data-testid="redo"
                  className={button.quiet}
                  disabled={!canRedo}
                  onClick={() => {
                    setSelection(null);
                    redoHistory();
                  }}
                >
                  {t.redo}
                </button>
              </>
            ) : null}
            {screen === "schedule" ? (
              <p data-testid="publish-status" aria-live="polite" className="text-sm leading-6 text-ink-soft sm:ms-2">
                {status}
              </p>
            ) : null}
          </section>
        ) : null}
        {screen === "schedule" ? (
          <div className="grid grid-cols-1 items-start gap-6 min-[1400px]:grid-cols-[minmax(0,1fr)_22rem]">
            <WeekBoard {...boardProps} />
            <div className="flex min-w-0 flex-col gap-4">
              <IssuesPanel
                state={state}
                report={report}
                lang={lang}
                hasSchedule={Boolean(schedule)}
                manager={writer}
                published={Boolean(published)}
                aiEnabled={aiEnabled}
                onApprove={(slot, index) => change((current) => approveProposal(current, slot, index))}
                onReplace={(slot, employeeId) =>
                  change((current) => approveReplacement(current, actor, slot.key, employeeId))
                }
                onEmergency={(slot, choice) => change((current) => approveEmergency(current, actor, slot.key, choice))}
              />
              <VersionsPanel
                state={state}
                lang={lang}
                canRestore={writer}
                onRestore={(versionId) => change((current) => restoreWeekVersion(current, actor, versionId))}
              />
            </div>
            {schedule ? (
              <div className="min-[1400px]:col-span-2">
                <WeekSummary state={state} report={report} lang={lang} />
              </div>
            ) : null}
          </div>
        ) : null}
        {screen === "team" ? (
          <TeamScreen
            state={state}
            lang={lang}
            canWrite={writer}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={(employeeId, patch) => change((current) => updateEmployee(current, actor, employeeId, patch))}
            onAdd={(name) => {
              const id = crypto.randomUUID();
              change((current) => addEmployeeRecord(current, actor, { id, name }));
              setSelectedId(id);
            }}
            onAgreement={(employeeId, dayIndex, shiftId, allowed) =>
              change((current) => setAgreement(current, actor, employeeId, dayIndex, shiftId, allowed))
            }
            onPreference={(employeeId, shiftId, preferred) =>
              change((current) => setPreference(current, actor, employeeId, shiftId, preferred))
            }
            onWholeAgreement={(employeeId, allowed) => change((current) => setWholeAgreement(current, actor, employeeId, allowed))}
            onDelete={(employeeId) => {
              change((current) => removeEmployeeRecord(current, actor, employeeId, currentWeek));
              setSelectedId(null);
            }}
            deletionBlock={(employeeId) => {
              const weeks = deletionBlockedBy(state, employeeId, currentWeek);
              return weeks.length > 0 ? deleteEmployeeBlocked(lang, weeks.map((week) => formatWeekRange(week, lang)).join(", ")) : null;
            }}
          />
        ) : null}
        {screen === "constraints" ? (
          <ConstraintsScreen
            state={state}
            lang={lang}
            canWrite={writer}
            aiEnabled={aiEnabled}
            requests={live.sites.find((site) => site.id === live.activeSiteId)?.requests ?? []}
            onAvailability={(employeeId, dayIndex, shiftId, available) =>
              change((current) => setAvailability(current, actor, employeeId, dayIndex, shiftId, available))
            }
            onWholeAvailability={(employeeId, available) => change((current) => setWholeAvailability(current, actor, employeeId, available))}
            onCopy={(employeeId) => change((current) => copyAvailability(current, actor, employeeId))}
            onDecide={(requestId, approve) => void decideRequest(requestId, approve)}
            onApply={(raw, overrides) =>
              change((current) =>
                applyConstraintText(current, actor, raw, overrides),
              )
            }
          />
        ) : null}
        {screen === "approvals" && operator ? (
          <ApprovalsScreen bare lang={lang} toolbar={null} load={loadCompanies} onApprove={approveEmail} onStatus={setCompanyStatus} onEnter={(orgId) => void enterCompany(orgId)} />
        ) : null}
        {screen === "business" ? (
          <BusinessScreen
            state={state}
            lang={lang}
            org={live.org}
            canEditOrg={owner}
            canWrite={writer}
            sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name }))}
            activeSiteId={live.activeSiteId}
            siteNameAllowed={(name, siteId) => {
              const wanted = name.trim().toLowerCase();
              const shownTwice = live.sites.some(
                (site) => site.id !== siteId && siteLabel(site.state.biz.name, lang).trim().toLowerCase() === wanted,
              );
              return !shownTwice && renameSiteAllowed(live, siteId ?? "", name);
            }}
            onOrg={(patch) => changeWorkspace((current) => updateOrg(current, user, patch))}
            onSelectSite={switchSite}
            onAddSite={(name) =>
              changeWorkspace((current) => addSite(current, user, { id: crypto.randomUUID(), name, newId: () => crypto.randomUUID() }))
            }
            onRemoveSite={(siteId) => changeWorkspace((current) => removeSite(current, user, siteId))}
            onBusiness={(patch) => change((current) => updateBusiness(current, actor, patch))}
            onShift={(shiftId, patch) => change((current) => updateShift(current, actor, shiftId, patch))}
            onRequirement={(shiftId, dayIndex, count) => change((current) => setShiftRequirement(current, actor, shiftId, dayIndex, count))}
            onAddShift={(name) => change((current) => addShift(current, actor, { id: crypto.randomUUID(), name }))}
            onRemoveShift={(shiftId) => change((current) => removeShift(current, actor, shiftId))}
            hideUserId={supportOrg ? user?.id : undefined}
            siteUsers={live.users
              .filter((member) => member.access === "owner" || member.pending || !member.siteId || member.siteId === live.activeSiteId)
              .map((member) => ({
                id: member.id,
                name: member.name,
                email: member.email,
                access: member.access,
                pending: member.pending,
              }))}
            onInvite={remote && owner ? inviteManager : undefined}
            onInviteStaff={remote && owner ? inviteStaff : undefined}
          />
        ) : null}
        {screen === "insights" ? <InsightsScreen state={state} lang={lang} /> : null}
      </main>
      {selectedName ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/90 px-4 py-3 shadow-pop backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <p className="text-sm font-medium">{selectionHint(lang, selectedName)}</p>
            <button type="button" className={button.quiet} onClick={() => setSelection(null)}>
              {t.cancelSelection}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/** Publish, with the export formats in a menu on the same button. */
function PublishButton({
  lang,
  canPublish,
  published,
  canBackup,
  onPublish,
  onPng,
  onJson,
}: {
  lang: Lang;
  canPublish: boolean;
  published: boolean;
  canBackup: boolean;
  onPublish: () => void;
  onPng: () => void;
  onJson: () => void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item =
    "block w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-well disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";
  return (
    <div ref={root} className="relative flex rounded-xl shadow-card">
      <button
        type="button"
        data-testid="publish"
        className={`${button.primary} rounded-e-none shadow-none`}
        disabled={!canPublish}
        onClick={onPublish}
      >
        {t.publish}
      </button>
      <button
        type="button"
        data-testid="export-menu"
        aria-label={t.exportMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${button.primary} rounded-s-none border-s border-on-brand/25 px-2.5 shadow-none`}
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M5.2 7.5a.75.75 0 0 1 1.06 0L10 11.2l3.74-3.7a.75.75 0 1 1 1.06 1.06l-4.27 4.24a.75.75 0 0 1-1.06 0L5.2 8.56a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute start-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-pop">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.exportMenu}</p>
          <button
            type="button"
            role="menuitem"
            data-testid="export-png"
            className={item}
            disabled={!published}
            onClick={() => {
              setOpen(false);
              onPng();
            }}
          >
            PNG
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          {canBackup ? (
            <button
              type="button"
              role="menuitem"
              data-testid="export-json"
              className={item}
              onClick={() => {
                setOpen(false);
                onJson();
              }}
            >
              JSON
              <span className="block text-xs font-normal text-subtle">{t.exportJson}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const stepButton = "grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-well hover:text-ink";
