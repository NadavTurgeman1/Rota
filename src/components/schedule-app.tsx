"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, analyze, applyTrade, slots, sundayOnOrBefore, type Analysis, type Lang, type RotaState, type Schedule, type TradeMove, type TradeSeat } from "../domain";
import type { VersionStamp } from "../domain/versions";
import { peerDuties } from "../domain/peers";
import { isRelief } from "../domain/relief";
import { addShift, removeShift, setShiftRequirement, updateBusiness, updateShift } from "../business/edit";
import { constraintBlocked, copy, deleteEmployeeBlocked, publishWillAsk, selectionHint } from "../i18n/copy";
import { exportFileName, formatWeekRange, pngFileName, siteLabel } from "../schedule/display";
import { backupJson, parseBackupJson, siteShiftsIcs, weekCsv, weekExcelXml, weekExport, weekText } from "../schedule/export";
import {
  addEmployee,
  approveProposal,
  commit,
  approveEmergency,
  approveReplacement,
  freshStamp,
  generateWeek,
  reshuffleWeek,
  toggleSlotLock,
  goToWeek,
  hoursSinceWeek,
  moveEmployee,
  swapInSlot,
  parseAssignmentToken,
  publishCheck,
  publishWeek,
  redo,
  removeEmployee,
  clearSchedule,
  copySchedule,
  deleteWeekVersion,
  setAssignmentHours,
  hasAssignments,
  hasDraftAssignments,
  pasteSchedule,
  scheduleIssuesOpen,
  reportCallOff,
  restoreWeekVersion,
  revertToDraft,
  undo,
  type History,
} from "../schedule/edit";
import { scopeForSave } from "../db/save-scope";
import { createSaveQueue, keepaliveFits } from "../schedule/save-queue";
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
  grantConstraintException,
  hasConstraintGrant,
  replaceAvailability,
  setAvailability,
  withinBlockLimit,
  setWholeAvailability,
  updateEmployee,
  VIEWER,
} from "../people/edit";
import { mirrorConstraints, mirrorPerson, setEmployeeSites } from "../people/sites";
import {
  actorFor,
  activeSite,
  addSite,
  canWrite as hasWrite,
  hebrewCalendarOn,
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
import { ConstraintsScreen, ExtraWindowMenu } from "./constraints-screen";
import { InsightsScreen } from "./insights-screen";
import { IssuesPanel } from "./issues-panel";
import { ApprovalsScreen, type SignupApproval, type TenantRow } from "./approvals-screen";
import { CreateOrgScreen, CreateSiteScreen, LoginScreen, Logo, NewPasswordScreen, SignupScreen } from "./login-screen";
import { browserClient } from "../supabase/browser";
import { remoteConfigured } from "../supabase/public-env";
import { RailIcon } from "./rail-icon";
import { WeekBoard } from "./schedule-board";
import type { AttendanceRoster } from "../db/attendance";
import type { AttendanceApi, AttendanceSnapshot } from "./attendance";
import { StaffHome } from "./staff-home";
import { TeamScreen } from "./team-screen";
import { memoryEmployeeForms, remoteEmployeeForms } from "./employee-forms";
import { HebrewCalendarContext } from "./day-dates";
import { ManagerTradePrompt, tradeStillHeld, useSetAside, type ShiftTrade, type TradeApi, type TradeSite } from "./trades";
import { useAiEnabled } from "./use-ai";
import { SettingsMenu, type Theme } from "./settings-menu";
import { VersionsPanel } from "./versions-panel";
import { staffCanSubmitConstraints, withConstraintExtension } from "../schedule/constraint-window";
import { WeekPicker } from "./week-picker";
import { WeekSummary } from "./week-summary";
import { PublishAsk } from "./publish-ask";
import { button } from "./ui";
import { downloadBlob, downloadWeekPng } from "./week-png";

const EMPTY: Analysis = { violations: [], overQuota: [], unfilled: [], coverage: [], under: [], hours: {}, counts: {} };
const THEME_KEY = "rota.theme";
const SUPPORT_KEY = "rota.supportOrg";

function persistable(workspace: Workspace) {
  return { org: workspace.org, sites: workspace.sites, activeSiteId: workspace.activeSiteId };
}

function viewingContext(current: RotaState, sites: { id: string; state: RotaState }[], siteId: string): RotaState {
  return {
    ...current,
    siteId,
    peers: peerDuties(sites, siteId, current.week),
    homeReady: homeReadyFor(sites, siteId, current.week),
  };
}

function homeReadyFor(sites: { id: string; state: RotaState }[], siteId: string, week: string): Record<string, boolean> {
  const here = sites.find((site) => site.id === siteId);
  const ready: Record<string, boolean> = {};
  if (!here) return ready;
  for (const employee of here.state.emps) {
    if (!isRelief(employee, siteId)) continue;
    const home = sites.find((site) => site.id === employee.homeSiteId);
    if (!home) {
      ready[employee.id] = false;
      continue;
    }
    const viewed = home.state.week === week ? home.state : { ...home.state, week };
    ready[employee.id] = publishCheck({ ...viewed, peers: peerDuties(sites, home.id, week) }).ready;
  }
  return ready;
}

function withoutContext(next: RotaState): RotaState {
  if (next.siteId === undefined && next.peers === undefined && next.homeReady === undefined) return next;
  const rest = { ...next };
  delete rest.siteId;
  delete rest.peers;
  delete rest.homeReady;
  return rest;
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
  const [authScreen, setAuthScreen] = useState<"login" | "signup" | "recovery">("login");
  const recovering = useRef(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const remote = remoteConfigured();
  const tokenRef = useRef<string | null>(null);
  const retrySave = useRef(false);
  const savedBaseline = useRef("");
  const saves = useRef(
    createSaveQueue(async (json, signal) => {
      const token = tokenRef.current;
      if (!token) return "retry";
      const scope = scopeForSave(savedBaseline.current, json);
      if (!scope) {
        savedBaseline.current = json;
        retrySave.current = false;
        setSaveNote(null);
        return "ok";
      }
      const body = JSON.stringify({ ...JSON.parse(json), scope });
      let response: Response;
      try {
        response = await fetch("/api/workspace", {
          method: "PUT",
          headers: authHeaders(true),
          body,
          keepalive: keepaliveFits(body),
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        retrySave.current = true;
        setSaveNote("save");
        return "retry";
      }
      if (response.ok) {
        savedBaseline.current = json;
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
  const [schedulePane, setSchedulePane] = useState<"issues" | "summary" | "versions">("issues");
  const [scheduleClip, setScheduleClip] = useState<{ week: string; schedule: Schedule } | null>(null);
  useEffect(() => {
    setScheduleClip(null);
  }, [workspace.activeSiteId]);
  const activeNav = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeNav.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [screen]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const staffChain = useRef(Promise.resolve());
  const [nowHours, setNowHours] = useState<number | null>(null);
  const [publishAsk, setPublishAsk] = useState(false);
  const [currentWeek, setCurrentWeek] = useState("2026-10-11");
  const aiEnabled = useAiEnabled();
  const t = copy[lang];

  const live = useMemo(() => withSiteState(workspace, workspace.activeSiteId, state), [workspace, state]);
  const peered = useMemo(
    () => viewingContext(state, live.sites, live.activeSiteId),
    [state, live.sites, live.activeSiteId],
  );
  const user = live.users.find((item) => item.id === userId) ?? null;
  const actor = user ? actorFor(user, live.selfEmployeeId) : VIEWER;
  const writer = Boolean(user && hasWrite(user));
  const owner = Boolean(user && isOwner(user));
  const hebrew = hebrewCalendarOn(live);
  const [trades, setTrades] = useState<{ trades: ShiftTrade[]; takeable: string[] }>({ trades: [], takeable: [] });
  const [rosterLog, setRosterLog] = useState<(AttendanceRoster & { siteId: string }) | null>(null);
  const [rosterSite, setRosterSite] = useState<string | null>(null);
  const approvedSeen = useRef<Set<string> | null>(null);
  const tradeLater = useSetAside("later");
  const tradeSites: TradeSite[] = live.sites.map((site) => ({ id: site.id, name: site.state.biz.name, state: site.state }));

  const loadTrades = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (supportRef.current) headers["x-rota-support-org"] = supportRef.current;
    const response = await fetch("/api/trades", { headers }).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json().catch(() => null)) as { trades?: ShiftTrade[]; takeable?: string[] } | null;
    setTrades({ trades: body?.trades ?? [], takeable: body?.takeable ?? [] });
  }, []);

  const signedIn = Boolean(remote && hydrated && userId && live.sites.length > 0);
  useEffect(() => {
    if (!signedIn) return;
    void loadTrades();
    function onVisible() {
      if (document.visibilityState === "visible") void loadTrades();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const poll = window.setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(poll);
    };
  }, [signedIn, loadTrades]);

  useEffect(() => {
    if (!remote || !writer || screen !== "team" || !live.activeSiteId) return;
    const siteId = live.activeSiteId;
    const controller = new AbortController();
    let current = true;
    setRosterLog(null);
    setRosterSite(siteId);
    const headers: Record<string, string> = { authorization: `Bearer ${tokenRef.current ?? ""}` };
    if (supportRef.current) headers["x-rota-support-org"] = supportRef.current;
    void (async () => {
      const response = await fetch(`/api/attendance?siteId=${encodeURIComponent(siteId)}&roster=1`, {
        headers,
        signal: controller.signal,
      }).catch(() => null);
      if (!current || !response?.ok) {
        if (current) setRosterSite(null);
        return;
      }
      const body = (await response.json().catch(() => null)) as AttendanceRoster | null;
      if (!current || !body?.employees) {
        if (current) setRosterSite(null);
        return;
      }
      setRosterLog({ ...body, siteId });
    })();
    return () => {
      current = false;
      controller.abort();
    };
  }, [remote, writer, screen, live.activeSiteId]);

  useEffect(() => {
    const approved = new Set(trades.trades.filter((trade) => trade.status === "approved").map((trade) => trade.id));
    const seen = approvedSeen.current;
    approvedSeen.current = approved;
    if (!seen || writer || ![...approved].some((id) => !seen.has(id))) return;
    reloadWorkspace();
  }, [trades]);

  function reloadWorkspace() {
    const token = tokenRef.current;
    if (token && userId) void adopt(token, userId, emailRef.current);
  }

  async function postTrade(body: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string }> {
    if (!tokenRef.current) return { ok: false, code: "failed" };
    const response = await fetch("/api/trades", { method: "POST", headers: authHeaders(true), body: JSON.stringify(body) }).catch(() => null);
    const data = ((await response?.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (!response?.ok) return { ok: false, code: typeof data.error === "string" ? data.error : "failed" };
    return { ok: true, data };
  }

  async function tradeAction(body: Record<string, unknown>): Promise<string | null> {
    const result = await postTrade(body);
    void loadTrades();
    return result.ok ? null : result.code;
  }

  async function attendanceRequest(path: string, body?: object, signal?: AbortSignal): Promise<AttendanceSnapshot | string> {
    if (!tokenRef.current) return "forbidden";
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: authHeaders(Boolean(body)),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as (AttendanceSnapshot & { error?: string }) | null;
    if (!response?.ok) return data?.error ?? "attendance";
    return data ?? "attendance";
  }

  const attendanceApi: AttendanceApi = {
    load: (siteId) => attendanceRequest(`/api/attendance?siteId=${encodeURIComponent(siteId)}`),
    employee: (employeeId, signal) => attendanceRequest(`/api/attendance?employeeId=${encodeURIComponent(employeeId)}`, undefined, signal),
    punch: (input) => attendanceRequest("/api/attendance", input),
  };

  const tradeApi: TradeApi = {
    async options(siteId, week, slotKey) {
      const result = await postTrade({ action: "options", siteId, week, slotKey });
      return result.ok ? ((result.data.seats as TradeSeat[] | undefined) ?? []) : result.code;
    },
    create: (input) => tradeAction({ action: "create", ...input }),
    answer: (tradeId, accept) => tradeAction({ action: "answer", tradeId, accept }),
    cancel: (tradeId) => tradeAction({ action: "cancel", tradeId }),
  };

  /** The server already rewrote the week. Mirror it here, or reload when this copy has drifted. */
  function mirrorTrade(siteId: string, week: string, move: TradeMove, stamp: VersionStamp) {
    if (siteId === live.activeSiteId) {
      const next = applyTrade(state, week, move, stamp);
      if (next === state) reloadWorkspace();
      else change(() => next);
      return;
    }
    const site = live.sites.find((item) => item.id === siteId);
    const next = site ? applyTrade(site.state, week, move, stamp) : null;
    if (!site || !next || next === site.state) reloadWorkspace();
    else setWorkspace((current) => withSiteState(current, siteId, next));
  }

  async function decideTrade(trade: ShiftTrade, approve: boolean): Promise<string | null> {
    const result = await postTrade({ action: "decide", tradeId: trade.id, approve, by: user?.name ?? "" });
    void loadTrades();
    if (!result.ok) return result.code;
    if (approve) mirrorTrade(trade.siteId, trade.week, result.data.move as TradeMove, result.data.stamp as VersionStamp);
    return null;
  }

  const reviewable = writer ? trades.trades.filter((trade) => trade.status === "accepted" && tradeSites.some((site) => site.id === trade.siteId) && tradeStillHeld(trade, tradeSites)) : [];
  const review = reviewable.find((trade) => !tradeLater.ids.includes(trade.id)) ?? null;
  const reviewSite = review ? tradeSites.find((site) => site.id === review.siteId) ?? null : null;

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

  const localForms = useRef(new Map());
  const employeeForms = useMemo(
    () => (remote ? remoteEmployeeForms(() => authHeaders()) : memoryEmployeeForms(localForms)),
    [remote],
  );

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
    const saved = JSON.stringify(persistable(next));
    savedBaseline.current = saved;
    saves.current.noteSaved(saved);
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
    const recoveryLink = `${window.location.hash} ${window.location.search}`.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      tokenRef.current = session?.access_token ?? null;
      if (event === "PASSWORD_RECOVERY" || (recoveryLink && (event === "INITIAL_SESSION" || event === "SIGNED_IN"))) {
        recovering.current = true;
        setAuthScreen("recovery");
        setHydrated(true);
        return;
      }
      if (event !== "INITIAL_SESSION" || recovering.current) {
        if (event === "INITIAL_SESSION") setHydrated(true);
        return;
      }
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
    const handle = window.setTimeout(() => saves.current.kick(), 1000);
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
    update((current) => {
      const stamped = viewingContext(current, live.sites, live.activeSiteId);
      const next = produce(stamped);
      if (next === stamped) return current;
      return withoutContext(next);
    });
  }

  function applyConstraints(next: RotaState) {
    if (next === state) return;
    change(() => next);
    const siteId = live.activeSiteId;
    setWorkspace((current) => mirrorConstraints(withSiteState(current, siteId, next), siteId));
  }

  /** Writers see the open site, so a reinforcement employee stays read-only away from home. */
  function writeConstraints(produce: (current: RotaState) => RotaState) {
    const stamped = state.siteId === live.activeSiteId ? state : { ...state, siteId: live.activeSiteId };
    const next = produce(stamped);
    if (next === stamped) return;
    applyConstraints(next);
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

  async function requestReset(email: string): Promise<boolean> {
    const address = email.trim();
    if (!address) return false;
    const { error } = await browserClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/`,
    });
    return !error;
  }

  async function saveNewPassword(password: string): Promise<boolean> {
    if (password.length < 6) return false;
    const { data, error } = await browserClient().auth.updateUser({ password });
    const session = (await browserClient().auth.getSession()).data.session;
    if (error || !data.user || !session) return false;
    recovering.current = false;
    window.history.replaceState(null, "", window.location.pathname);
    await adopt(session.access_token, data.user.id, data.user.email ?? "");
    setAuthScreen("login");
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
    const saved = JSON.stringify(persistable(payload.workspace));
    savedBaseline.current = saved;
    saves.current.noteSaved(saved);
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

  function constraintTarget(employeeId: string): string {
    const person =
      state.emps.find((employee) => employee.id === employeeId) ??
      live.sites.flatMap((site) => site.state.emps).find((employee) => employee.id === employeeId);
    const homeId = person?.homeSiteId;
    if (homeId && live.sites.some((site) => site.id === homeId)) return homeId;
    return live.activeSiteId;
  }

  function writeSavedConstraints(siteId: string, employeeId: string, week: string, shifts: string[][]) {
    setWorkspace((current) => ({
      ...current,
      sites: current.sites.map((site) =>
        site.id === siteId
          ? {
              ...site,
              requests: (site.requests ?? []).filter((item) => !(item.employeeId === employeeId && item.week === week)),
              state: {
                ...site.state,
                avail: { ...site.state.avail, [week]: { ...site.state.avail[week], [employeeId]: shifts } },
              },
            }
          : site,
      ),
    }));
    if (siteId === live.activeSiteId) {
      patchPresent((current) => ({
        ...current,
        avail: { ...current.avail, [week]: { ...current.avail[week], [employeeId]: shifts } },
      }));
    }
  }

  function dropRequest(siteId: string, requestId: string) {
    setWorkspace((current) => ({
      ...current,
      sites: current.sites.map((site) =>
        site.id === siteId ? { ...site, requests: (site.requests ?? []).filter((item) => item.id !== requestId) } : site,
      ),
    }));
  }

  function homeBusiness(employeeId: string) {
    const person = state.emps.find((employee) => employee.id === employeeId);
    const homeId = person?.homeSiteId;
    if (!homeId) return state.biz;
    return live.sites.find((site) => site.id === homeId)?.state.biz ?? state.biz;
  }

  function submitStaffRequest(shifts: string[][]) {
    const selfId = live.selfEmployeeId;
    if (!selfId) return;
    const siteId = constraintTarget(selfId);
    const week = state.week;
    if (!staffCanSubmitConstraints(week)) {
      setSaveNote("week");
      return;
    }
    if (!remote) {
      const home = homeBusiness(selfId);
      const basis = siteId === live.activeSiteId ? state : { ...(live.sites.find((site) => site.id === siteId)?.state ?? state), week };
      const limited = home.blockLimit === true;
      const over = limited && !hasConstraintGrant(basis, selfId) && !withinBlockLimit(basis, selfId, shifts, home);
      if (over) {
        setSaveNote("blocks");
        return;
      }
      if (limited) {
        writeSavedConstraints(siteId, selfId, week, shifts);
        setSaveNote(null);
        return;
      }
      storeRequest(siteId, { id: crypto.randomUUID(), employeeId: selfId, week, shifts });
      setSaveNote(null);
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
      const body = (await response.json().catch(() => null)) as { request?: StaffRequest & { automatic?: boolean }; error?: string } | null;
      if (!response.ok || !body?.request) {
        setSaveNote(
          body?.error === "blocks" || body?.error === "same" || body?.error === "week" || body?.error === "home" ? body.error : "failed",
        );
        return;
      }
      setSaveNote(null);
      if (body.request.automatic) {
        writeSavedConstraints(siteId, body.request.employeeId, body.request.week, body.request.shifts);
        return;
      }
      storeRequest(siteId, body.request);
    });
  }

  /** Keeps a manager action on the screen the toolbar reads, without adding an undo step. */
  function patchPresent(patch: (current: RotaState) => RotaState) {
    setHistory((current) => {
      const present = patch(current.present);
      return present === current.present ? current : { ...current, present };
    });
  }

  async function saveConstraintGrant(employeeId: string, allowed: boolean) {
    const siteId = live.activeSiteId;
    const person = state.emps.find((employee) => employee.id === employeeId);
    if (person && isRelief(person, siteId)) return;
    const week = state.week;
    if (remote) {
      const response = await fetch("/api/constraints", {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ siteId, employeeId, week, allowed }),
      });
      if (!response.ok) {
        setSaveNote("failed");
        return;
      }
      setSaveNote(null);
    }
    patchPresent((current) => grantConstraintException(current, employeeId, allowed, week));
  }

  async function openExtraWindow(minutes: number) {
    const siteId = live.activeSiteId;
    let until = new Date(Date.now() + minutes * 60_000).toISOString();
    if (remote) {
      const response = await fetch("/api/constraints", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ siteId, minutes }),
      });
      const body = (await response.json().catch(() => null)) as { until?: string } | null;
      if (!response.ok || !body?.until) {
        setSaveNote("failed");
        return;
      }
      until = body.until;
      setSaveNote(null);
    }
    patchPresent((current) => {
      const biz = withConstraintExtension(current.biz, until);
      return biz === current.biz ? current : { ...current, biz };
    });
  }

  async function closeExtraWindow() {
    const siteId = live.activeSiteId;
    if (remote) {
      const response = await fetch("/api/constraints", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ siteId, minutes: null }),
      });
      if (!response.ok) {
        setSaveNote("failed");
        return;
      }
      setSaveNote(null);
    }
    patchPresent((current) => {
      const biz = withConstraintExtension(current.biz, null);
      return biz === current.biz ? current : { ...current, biz };
    });
  }

  async function decideRequest(requestId: string, approve: boolean) {
    const siteId = live.activeSiteId;
    const request = live.sites.find((site) => site.id === siteId)?.requests?.find((item) => item.id === requestId);
    if (!request) return;
    const person = state.emps.find((employee) => employee.id === request.employeeId);
    if (approve && person && isRelief(person, siteId)) return;
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
    if (approve) applyConstraints(replaceAvailability(state, actor, request.employeeId, request.week, request.shifts));
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
    const confirmed = body?.status === "linked";
    const link = (current: RotaState): RotaState => {
      const employee = current.emps.find((item) => item.id === input.employeeId);
      if (!employee || (employee.loginEmail === address && employee.loginConfirmed === confirmed && employee.contact === address)) {
        return current;
      }
      return {
        ...current,
        emps: current.emps.map((item) =>
          item.id === input.employeeId ? { ...item, loginEmail: address, loginConfirmed: confirmed, contact: address } : item,
        ),
      };
    };
    change(link);
    setWorkspace((current) => {
      const sites = current.sites.map((site) => (site.id === current.activeSiteId ? site : { ...site, state: link(site.state) }));
      if (current.users.some((member) => member.email.toLowerCase() === address)) return { ...current, sites };
      return {
        ...current,
        sites,
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

  async function accessRequest(path: string, method: "PATCH" | "DELETE", body: Record<string, unknown>): Promise<boolean> {
    if (!tokenRef.current || !live.org.id) return false;
    const response = await fetch(path, {
      method,
      headers: authHeaders(true),
      body: JSON.stringify({ ...body, orgId: live.org.id }),
    });
    return response.ok;
  }

  async function editManagerSites(email: string, siteIds: string[]): Promise<boolean> {
    if (!(await accessRequest("/api/invitations", "PATCH", { email, siteIds }))) return false;
    const address = email.toLowerCase();
    setWorkspace((current) => {
      const rows = current.users.filter((member) => member.email.toLowerCase() === address && member.access === "write");
      const first = rows[0];
      if (!first) return current;
      return {
        ...current,
        users: [
          ...current.users.filter((member) => !rows.includes(member)),
          ...siteIds.map((siteId) => ({ ...first, siteId })),
        ],
      };
    });
    return true;
  }

  async function deleteManager(email: string): Promise<boolean> {
    if (!(await accessRequest("/api/invitations", "DELETE", { email }))) return false;
    const address = email.toLowerCase();
    setWorkspace((current) => ({
      ...current,
      users: current.users.filter((member) => !(member.email.toLowerCase() === address && member.access === "write")),
    }));
    return true;
  }

  async function deleteStaffLogin(employeeId: string): Promise<boolean> {
    const address = state.emps.find((employee) => employee.id === employeeId)?.loginEmail?.toLowerCase();
    if (!(await accessRequest("/api/staff", "DELETE", { employeeId }))) return false;
    const unlink = (current: RotaState): RotaState => {
      if (!current.emps.some((employee) => employee.id === employeeId && employee.loginEmail)) return current;
      return {
        ...current,
        emps: current.emps.map((employee) => {
          if (employee.id !== employeeId) return employee;
          const { loginEmail: _email, loginConfirmed: _confirmed, ...rest } = employee;
          return rest;
        }),
      };
    };
    change(unlink);
    setWorkspace((current) => ({
      ...current,
      sites: current.sites.map((site) => (site.id === current.activeSiteId ? site : { ...site, state: unlink(site.state) })),
      users: address
        ? current.users.filter((member) => !(member.email.toLowerCase() === address && member.access === "read"))
        : current.users,
    }));
    return true;
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
    const data = weekExport(source, lang, live.org.name, hebrew);
    if (!data) return;
    downloadWeekPng(
      data,
      { open: t.exportOpen, closed: t.exportClosed, covered: t.covered, overQuota: t.overQuota, legend: t.exportLegend },
      pngFileName(siteLabel(source.biz.name, lang), source.week),
    );
  }

  function publish() {
    if (!user || !scheduleIssuesOpen(state)) return;
    const current = publishCheck(peered);
    if (current.constraint > 0) return;
    if (!current.ready) {
      setPublishAsk(true);
      return;
    }
    commitPublish(false);
  }

  function commitPublish(anyway: boolean) {
    if (!user || publishCheck(peered).constraint > 0) return;
    setPublishAsk(false);
    const next = publishWeek(state, freshStamp(user.name), { anyway });
    if (next === state) return;
    change(() => next);
  }

  function exportPng() {
    savePng(state);
  }

  function exportExcel() {
    const xml = weekExcelXml(state, lang, live.org.name, undefined, hebrew);
    if (!xml) return;
    downloadBlob(
      new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
      exportFileName(siteLabel(state.biz.name, lang), state.week, "xls"),
    );
  }

  function exportCsv() {
    const csv = weekCsv(state, lang, undefined, hebrew);
    if (!csv) return;
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      exportFileName(siteLabel(state.biz.name, lang), state.week, "csv"),
    );
  }

  function exportIcs() {
    const ics = siteShiftsIcs(state, lang, live.org.name);
    if (!ics) return;
    downloadBlob(
      new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      exportFileName(siteLabel(state.biz.name, lang), state.week, "ics"),
    );
  }

  async function exportText() {
    const text = weekText(state, lang, live.org.name, undefined, hebrew);
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      downloadBlob(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
        exportFileName(siteLabel(state.biz.name, lang), state.week, "txt"),
      );
    }
  }

  function exportJson() {
    const text = backupJson(state, { org: live.org.name, at: new Date().toISOString() });
    downloadBlob(new Blob([text], { type: "application/json" }), `rota-backup-${state.week}.json`);
  }

  function restoreJson(raw: string): boolean {
    const restored = parseBackupJson(raw);
    if (!restored) return false;
    change(() => restored);
    return true;
  }

  const settings = (
    <SettingsMenu lang={lang} theme={theme} onLang={setLang} onTheme={setTheme} onSignOut={user ? signOut : undefined} />
  );

  if (!hydrated) return <div className="min-h-screen" />;

  if (!remote) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="shell mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-page px-4 py-8 text-ink">
        <p role="alert" className="text-sm leading-6 text-ink">
          {t.appDisconnected}
        </p>
        {settings}
      </div>
    );
  }

  if (remoteError === "db") {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="shell mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-page px-4 py-8 text-ink">
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
        {remote && authScreen === "recovery" ? (
          <NewPasswordScreen lang={lang} toolbar={settings} onSave={saveNewPassword} />
        ) : remote && authScreen === "signup" ? (
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
            onRequestReset={remote ? requestReset : undefined}
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
          <div className="shell mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 bg-page px-4 text-ink">
            <p className="text-sm leading-6 text-ink">{suspended ? t.tenantSuspended : t.notApprovedTitle}</p>
            {settings}
          </div>
        )}
      </div>
    );
  }

  if (user.access === "read") {
    return (
      <HebrewCalendarContext.Provider value={hebrew}>
      <StaffHome
        state={state}
        lang={lang}
        orgName={live.org.name}
        selfId={live.selfEmployeeId ?? null}
        sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name }))}
        rosterSites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name, state: site.state }))}
        activeSiteId={live.activeSiteId}
        toolbar={settings}
        saveNote={saveNote}
        onSelectSite={switchSite}
        pending={
          live.sites
            .find((site) => site.id === (live.selfEmployeeId ? constraintTarget(live.selfEmployeeId) : live.activeSiteId))
            ?.requests?.find((request) => request.employeeId === live.selfEmployeeId && request.week === state.week) ?? null
        }
        onSubmit={submitStaffRequest}
        onWeek={(days) => change((current) => goToWeek(current, addDays(current.week, days)))}
        decisions={live.decisions ?? []}
        onAcknowledge={acknowledgeDecision}
        trades={trades.trades}
        takeable={trades.takeable}
        tradeApi={remote ? tradeApi : undefined}
        attendanceApi={attendanceApi}
      />
      </HebrewCalendarContext.Provider>
    );
  }

  const schedule = state.sched[state.week];
  const published = schedule?.status === "published";
  const readOnly = published || !writer;
  const issuesOpen = scheduleIssuesOpen(state);
  const fullReport = schedule ? analyze(peered, peered.week, lang) : EMPTY;
  const report = issuesOpen ? fullReport : EMPTY;
  const check = issuesOpen ? publishCheck(peered) : { ready: false, violations: 0, unfilled: 0, coverage: 0, constraint: 0 };
  const openSlots = slots(state, state.week);
  const selectedName = selection ? employeeName(state, parseAssignmentToken(selection)?.employeeId ?? "") : null;

  const status = !writer
    ? t.scheduleReadOnly
    : !issuesOpen
      ? t.createBeforePublish
      : published
        ? fullReport.unfilled.length > 0
          ? t.publishedOpen
          : t.publishedLock
        : check.constraint > 0
          ? constraintBlocked(lang, check.constraint)
          : check.ready
            ? t.allClear
            : publishWillAsk(lang, check.violations + check.unfilled + check.coverage);

  const boardProps = {
    state: peered,
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
    onHours: (slotKey: string, employeeId: string, start: number, end: number) =>
      change((current) => setAssignmentHours(current, slotKey, employeeId, start, end)),
    onRequired: (shiftId: string, day: number, count: number) =>
      change((current) => setShiftRequirement(current, actor, shiftId, day, count)),
    onToggleLock: (slotKey: string) => change((current) => toggleSlotLock(current, slotKey)),
  };

  const tabs: { id: Exclude<Screen, "approvals">; label: string }[] = [
    { id: "schedule", label: t.navSchedule },
    { id: "team", label: t.navTeam },
    { id: "constraints", label: t.navConstraints },
    { id: "insights", label: t.navInsights },
    { id: "business", label: t.navBusiness },
  ];
  const weekly = screen === "schedule" || screen === "constraints";

  return (
    <HebrewCalendarContext.Provider value={hebrew}>
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="shell min-h-dvh bg-page text-ink">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b border-line bg-paper md:h-dvh md:w-56 md:self-start md:border-e md:border-b-0">
          <div className="flex h-14 shrink-0 items-center px-4 md:h-16 md:px-5">
            <Logo className="h-7" />
          </div>
          <p className="hidden px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted md:block">{t.railLabel}</p>
          <nav role="tablist" aria-label="Rota" className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:px-3 md:pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-testid={`nav-${tab.id}`}
                ref={screen === tab.id ? activeNav : undefined}
                aria-selected={screen === tab.id}
                className={`flex min-h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] leading-5 md:w-full ${
                  screen === tab.id ? "bg-well font-medium text-ink" : "text-muted hover:bg-well/80 hover:text-ink"
                }`}
                onClick={() => {
                  setSelection(null);
                  setScreen(tab.id);
                }}
              >
                <RailIcon name={tab.id} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
      {saveNote ? (
        <p role="alert" className="bg-danger-softer px-6 py-2 text-sm text-danger-text sm:px-8">
          {saveNote === "db" ? t.remoteDbMissing : t.saveFailed}
        </p>
      ) : null}
      {supportOrg ? <p className="px-6 pt-4 text-sm text-ink-soft sm:px-8">{t.supportBanner}</p> : null}
      <main className={`flex flex-col gap-8 px-6 py-6 sm:px-8 ${selection ? "pb-28" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink">
              {screen === "approvals" ? t.approvalsTitle : tabs.find((tab) => tab.id === screen)?.label}
            </h1>
            <p className="mt-2 text-sm text-muted">{siteLabel(state.biz.name, lang)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center">
              <span className="sr-only">{t.site}</span>
              <select
                data-testid="site-select"
                aria-label={t.site}
                className={`${button.quiet} max-w-44 px-3`}
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
            {reviewable.length > 0 ? (
              <button type="button" data-testid="trade-queue" className={button.quiet} onClick={() => tradeLater.clear()}>
                {t.tradeManagerQueue(reviewable.length)}
              </button>
            ) : null}
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
            <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-1">
              <button
                type="button"
                data-testid="prev-week"
                aria-label={t.previousWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, -7)))}
              >
                <Chevron dir="prev" />
              </button>
              <WeekPicker lang={lang} week={state.week} onPick={(sunday) => change((current) => goToWeek(current, sunday))} />
              <button
                type="button"
                data-testid="next-week"
                aria-label={t.nextWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, 7)))}
              >
                <Chevron dir="next" />
              </button>
            </div>
            {screen === "schedule" ? (
              <>
                <button
                  type="button"
                  data-testid="generate"
                  className={button.primary}
                  disabled={!writer || published}
                  onClick={() => change((current) => (hasAssignments(current) ? reshuffleWeek(current) : generateWeek(current)))}
                >
                  {schedule ? t.regenerate : t.generate}
                </button>
                <button
                  type="button"
                  data-testid="copy-schedule"
                  className={`${button.quiet} ${scheduleClip ? "border-brand bg-brand-soft" : ""}`}
                  aria-pressed={scheduleClip !== null}
                  disabled={!writer || !hasAssignments(state)}
                  onClick={() => {
                    const snapshot = copySchedule(state);
                    if (snapshot) setScheduleClip({ week: state.week, schedule: snapshot });
                  }}
                >
                  {t.copySchedule}
                </button>
                <button
                  type="button"
                  data-testid="paste-schedule"
                  className={button.quiet}
                  title={scheduleClip ? formatWeekRange(scheduleClip.week, lang) : undefined}
                  disabled={!writer || published || !scheduleClip}
                  onClick={() => {
                    const source = scheduleClip?.schedule ?? null;
                    change((current) => pasteSchedule(current, source));
                  }}
                >
                  {t.pasteSchedule}
                </button>
                <button
                  type="button"
                  data-testid="clear-schedule"
                  className={button.quiet}
                  disabled={!writer || published || !hasDraftAssignments(state)}
                  onClick={() => change(clearSchedule)}
                >
                  {t.clearSchedule}
                </button>
                <PublishButton
                  lang={lang}
                  canPublish={writer && Boolean(schedule) && !published && issuesOpen && check.constraint === 0}
                  published={Boolean(published)}
                  onPublish={publish}
                  onPng={exportPng}
                  onExcel={exportExcel}
                  onCsv={exportCsv}
                  onIcs={exportIcs}
                  onText={exportText}
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
                {screen === "constraints" ? (
                  <ExtraWindowMenu
                    lang={lang}
                    until={state.biz.constraintExtensionUntil}
                    onOpen={(minutes) => void openExtraWindow(minutes)}
                    onClose={() => void closeExtraWindow()}
                  />
                ) : null}
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
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
            <div className="min-w-0">
              <WeekBoard {...boardProps} />
            </div>
            <div
              className={`flex min-w-0 flex-col rounded-xl border border-line bg-card p-3 lg:sticky lg:top-4 lg:overflow-hidden ${
                selection ? "lg:max-h-[calc(100dvh-7rem)]" : "lg:max-h-[calc(100dvh-2rem)]"
              }`}
            >
              <div role="tablist" aria-label={t.issues} className="grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-well p-1">
                {(
                  [
                    ["issues", t.issues],
                    ["summary", t.summaryTitle],
                    ["versions", t.versionsTitle],
                  ] as const
                ).map(([id, label]) => {
                  const count =
                    id === "issues" && schedule
                      ? report.violations.length + report.unfilled.length + report.coverage.length + report.overQuota.length + report.under.length
                      : 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      data-testid={`schedule-pane-${id}`}
                      aria-selected={schedulePane === id}
                      className={`min-h-9 rounded-lg border px-1.5 py-1 text-center text-xs font-medium leading-4 ${
                        schedulePane === id ? "border-line bg-card text-ink" : "border-transparent text-muted hover:text-ink"
                      }`}
                      onClick={() => setSchedulePane(id)}
                    >
                      {label}
                      {count > 0 ? <span className="ms-1 tabular-nums text-danger-text">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 min-h-0 overflow-y-auto overscroll-y-contain">
                {schedulePane === "issues" ? (
                  <IssuesPanel
                    embedded
                    state={peered}
                    report={report}
                    lang={lang}
                    hasSchedule={issuesOpen}
                    manager={writer}
                    published={Boolean(published)}
                    aiEnabled={aiEnabled}
                    onApprove={(slot, index) => change((current) => approveProposal(current, slot, index))}
                    onAdjustHours={(slotKey, employeeId, start, end) =>
                      change((current) => setAssignmentHours(current, slotKey, employeeId, start, end))
                    }
                    onReplace={(slot, employeeId) =>
                      change((current) => approveReplacement(current, actor, slot.key, employeeId))
                    }
                    onEmergency={(slot, choice) => change((current) => approveEmergency(current, actor, slot.key, choice))}
                  />
                ) : null}
                {schedulePane === "summary" ? (
                  schedule ? (
                    <WeekSummary embedded state={peered} report={fullReport} lang={lang} />
                  ) : (
                    <p className="text-sm text-muted">{t.noSchedule}</p>
                  )
                ) : null}
                {schedulePane === "versions" ? (
                  <VersionsPanel
                    embedded
                    state={state}
                    lang={lang}
                    canRestore={writer}
                    onRestore={(versionId) => change((current) => restoreWeekVersion(current, actor, versionId))}
                    onDelete={writer ? (versionId) => change((current) => deleteWeekVersion(current, actor, versionId)) : undefined}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {screen === "team" ? (
          <TeamScreen
            sharedAttendance={
              rosterSite === live.activeSiteId
                ? (employeeId) => {
                    if (!rosterLog || rosterLog.siteId !== live.activeSiteId) return null;
                    const person = rosterLog.employees.find((item) => item.id === employeeId);
                    return {
                      serverNow: rosterLog.serverNow,
                      timeZone: person?.timeZone || rosterLog.timeZone,
                      punches: person?.punches ?? [],
                    };
                  }
                : undefined
            }
            state={state}
            lang={lang}
            canWrite={writer}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
            onUpdate={(employeeId, patch) => {
              const next = updateEmployee(state, actor, employeeId, patch);
              if (next === state) return;
              change(() => next);
              const person = next.emps.find((employee) => employee.id === employeeId);
              if (person) setWorkspace((current) => mirrorPerson(current, current.activeSiteId, person));
            }}
            onAdd={(name) => {
              const id = crypto.randomUUID();
              change((current) => addEmployeeRecord(current, actor, { id, name }));
              setSelectedId(id);
            }}
            onAgreement={(employeeId, dayIndex, shiftId, allowed) =>
              applyConstraints(setAgreement(state, actor, employeeId, dayIndex, shiftId, allowed))
            }
            onPreference={(employeeId, shiftId, preferred) =>
              applyConstraints(setPreference(state, actor, employeeId, shiftId, preferred))
            }
            onWholeAgreement={(employeeId, allowed) => applyConstraints(setWholeAgreement(state, actor, employeeId, allowed))}
            onDelete={(employeeId) => {
              change((current) => removeEmployeeRecord(current, actor, employeeId, currentWeek));
              setSelectedId(null);
            }}
            deletionBlock={(employeeId) => {
              const weeks = deletionBlockedBy(state, employeeId, currentWeek);
              return weeks.length > 0 ? deleteEmployeeBlocked(lang, weeks.map((week) => formatWeekRange(week, lang)).join(", ")) : null;
            }}
            sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name, biz: site.state.biz }))}
            siteId={live.activeSiteId}
            assignedSiteIds={
              selectedId
                ? live.sites.filter((site) => site.state.emps.some((employee) => employee.id === selectedId)).map((site) => site.id)
                : []
            }
            lockedSiteIds={
              selectedId
                ? live.sites
                    .filter((site) => deletionBlockedBy(site.state, selectedId, currentWeek).length > 0)
                    .map((site) => site.id)
                : []
            }
            onSites={(employeeId, siteIds, homeSiteId) =>
              changeWorkspace((current) => setEmployeeSites(current, employeeId, siteIds, currentWeek, homeSiteId))
            }
            loadAttendance={attendanceApi.employee}
            forms={employeeForms}
          />
        ) : null}
        {screen === "constraints" ? (
          <ConstraintsScreen
            state={state}
            lang={lang}
            siteId={live.activeSiteId}
            sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name, biz: site.state.biz, avail: site.state.avail }))}
            canWrite={writer}
            aiEnabled={aiEnabled}
            requests={live.sites.find((site) => site.id === live.activeSiteId)?.requests ?? []}
            onAvailability={(employeeId, dayIndex, shiftId, available) =>
              writeConstraints((current) => setAvailability(current, actor, employeeId, dayIndex, shiftId, available, homeBusiness(employeeId)))
            }
            onWholeAvailability={(employeeId, available) =>
              writeConstraints((current) => setWholeAvailability(current, actor, employeeId, available, homeBusiness(employeeId)))
            }
            onCopy={(employeeId) => writeConstraints((current) => copyAvailability(current, actor, employeeId, homeBusiness(employeeId)))}
            onDecide={(requestId, approve) => void decideRequest(requestId, approve)}
            onGrant={(employeeId, allowed) => void saveConstraintGrant(employeeId, allowed)}
            onApply={(raw, overrides) =>
              writeConstraints((current) => applyConstraintText(current, actor, raw, overrides, homeBusiness))
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
                siteIds: live.users
                  .filter((row) => row.id === member.id && row.siteId)
                  .map((row) => row.siteId as string),
              }))}
            onInvite={remote && owner ? inviteManager : undefined}
            onInviteStaff={remote && writer ? inviteStaff : undefined}
            onEditManagerSites={remote && owner ? editManagerSites : undefined}
            onDeleteManager={remote && owner ? deleteManager : undefined}
            onDeleteStaffLogin={remote && writer ? deleteStaffLogin : undefined}
            onBackupJson={operator ? exportJson : undefined}
            onRestoreJson={operator ? restoreJson : undefined}
          />
        ) : null}
        {screen === "insights" ? <InsightsScreen state={state} lang={lang} /> : null}
      </main>
        </div>
      </div>
      {selectedName ? (
        <div className="fixed bottom-0 end-0 start-0 z-20 border-t border-line bg-card px-6 py-3 sm:px-8 md:start-56">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <p className="text-sm font-medium">{selectionHint(lang, selectedName)}</p>
            <button type="button" className={button.quiet} onClick={() => setSelection(null)}>
              {t.cancelSelection}
            </button>
          </div>
        </div>
      ) : null}
      {publishAsk ? (
        <PublishAsk
          lang={lang}
          violations={check.violations}
          unfilled={check.unfilled}
          coverage={check.coverage}
          onPublish={() => commitPublish(true)}
          onStay={() => setPublishAsk(false)}
        />
      ) : null}
      {review && reviewSite ? (
        <ManagerTradePrompt
          key={review.id}
          trade={review}
          site={reviewSite}
          lang={lang}
          onDecide={(approve) => decideTrade(review, approve)}
          onLater={() => tradeLater.add(review.id)}
        />
      ) : null}
    </div>
    </HebrewCalendarContext.Provider>
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
  onPublish,
  onPng,
  onExcel,
  onCsv,
  onIcs,
  onText,
}: {
  lang: Lang;
  canPublish: boolean;
  published: boolean;
  onPublish: () => void;
  onPng: () => void;
  onExcel: () => void;
  onCsv: () => void;
  onIcs: () => void;
  onText: () => Promise<void> | void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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
        <div role="menu" className="absolute start-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
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
            {t.exportPng}
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-excel"
            className={item}
            disabled={!published}
            onClick={() => {
              setOpen(false);
              onExcel();
            }}
          >
            {t.exportExcel}
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-csv"
            className={item}
            disabled={!published}
            onClick={() => {
              setOpen(false);
              onCsv();
            }}
          >
            {t.exportCsv}
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-ics"
            className={item}
            disabled={!published}
            onClick={() => {
              setOpen(false);
              onIcs();
            }}
          >
            {t.exportCalendar}
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-text"
            className={item}
            disabled={!published}
            onClick={() => {
              void Promise.resolve(onText()).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? t.exportTextCopied : t.exportText}
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const stepButton = "grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-well hover:text-ink";

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="week-chevron h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "prev" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}
